const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticateToken } = require('./auth');
const supabase = require('../config/supabaseClient');

const CHAT_LAMBDA_URL = process.env.CHAT_LAMBDA_URL;

// Rate limit: 30 requests per minute per user
const rateLimitMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(userId, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Purge expired rate limit entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      rateLimitMap.delete(userId);
    }
  }
}, 60 * 1000);

// POST /api/chat/message — proxy user message to Lambda agent
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { message, session_id } = req.body;
    const user_id = req.user.user_id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 4000) {
      return res.status(400).json({ error: 'Message too long (max 4000 characters)' });
    }

    if (!checkRateLimit(user_id)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
    }

    if (!CHAT_LAMBDA_URL) {
      return res.status(500).json({ error: 'Chat service not configured' });
    }

    const lambdaResponse = await axios.post(
      CHAT_LAMBDA_URL,
      {
        action: 'message',
        user_id,
        session_id: session_id || null,
        message: message.trim(),
        user_context: {
          username: req.user.username,
          role: req.user.role,
          site_id: req.user.site_id,
          department: req.user.department,
        },
      },
      { timeout: 120000, headers: { 'Content-Type': 'application/json' } }
    );

    // Lambda returns { statusCode, body } — body may be a string
    const lambdaBody = typeof lambdaResponse.data.body === 'string'
      ? JSON.parse(lambdaResponse.data.body)
      : lambdaResponse.data.body || lambdaResponse.data;

    if (lambdaResponse.data.statusCode && lambdaResponse.data.statusCode >= 400) {
      return res.status(lambdaResponse.data.statusCode).json(lambdaBody);
    }

    res.json(lambdaBody);
  } catch (err) {
    console.error('Chat proxy error:', err.message);
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Chat service timed out. Please try again.' });
    }
    // Pass through Lambda error body if available (e.g. rate limit messages)
    if (err.response?.data) {
      const errBody = typeof err.response.data === 'string'
        ? (() => { try { return JSON.parse(err.response.data); } catch { return { error: err.response.data }; } })()
        : err.response.data;
      const statusCode = err.response.status || 500;
      return res.status(statusCode).json(errBody);
    }
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// GET /api/chat/sessions — list user's chat sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { data: sessions, error } = await supabase
      .from('chat_session')
      .select('session_id, title, created_at, updated_at')
      .eq('user_id', req.user.user_id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching chat sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }

    res.json({ sessions: sessions || [] });
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/chat/sessions/:id/messages — get messages for a session
router.get('/sessions/:id/messages', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('chat_session')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', req.user.user_id)
      .single();

    if (!session || sessionError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { data: messages, error } = await supabase
      .from('chat_message')
      .select('message_id, role, content, chart_data, metadata, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json({ messages: messages || [] });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PATCH /api/chat/sessions/:id — rename a session
router.patch('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify session belongs to user
    const { data: session, error: verifyError } = await supabase
      .from('chat_session')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', req.user.user_id)
      .single();

    if (!session || verifyError) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { error } = await supabase
      .from('chat_session')
      .update({ title: title.trim() })
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error renaming session:', error);
      return res.status(500).json({ error: 'Failed to rename session' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error renaming session:', err);
    res.status(500).json({ error: 'Failed to rename session' });
  }
});

// DELETE /api/chat/sessions/:id — delete a session and its messages
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    console.log(`[DELETE] Session ${sessionId} by user ${req.user.user_id}`);

    // Verify session belongs to user
    const { data: session, error: verifyError } = await supabase
      .from('chat_session')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', req.user.user_id)
      .single();

    if (!session || verifyError) {
      console.error('Session verify failed:', verifyError);
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete messages first (child rows)
    const { error: msgError, count: msgCount } = await supabase
      .from('chat_message')
      .delete()
      .eq('session_id', sessionId)
      .select('message_id', { count: 'exact', head: true });

    if (msgError) {
      console.error('Error deleting messages:', msgError);
      return res.status(500).json({ error: 'Failed to delete messages' });
    }
    console.log(`[DELETE] Deleted messages for session ${sessionId}`);

    // Delete session
    const { error: sessionError } = await supabase
      .from('chat_session')
      .delete()
      .eq('session_id', sessionId);

    if (sessionError) {
      console.error('Error deleting session:', sessionError);
      return res.status(500).json({ error: 'Failed to delete session' });
    }

    console.log(`[DELETE] Session ${sessionId} deleted successfully`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// POST /api/chat/stream — SSE streaming endpoint
// Calls Lambda, reads response, pipes as SSE events to browser
router.post('/stream', authenticateToken, async (req, res) => {
  // Set SSE headers FIRST — all errors go as SSE events after this
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const { message, session_id } = req.body;
  const user_id = req.user.user_id;

  // Validate — errors as SSE events (headers already sent)
  if (!message || !message.trim()) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
    return res.end();
  }
  if (message.length > 4000) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Message too long (max 4000 characters)' })}\n\n`);
    return res.end();
  }
  if (!checkRateLimit(user_id)) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' })}\n\n`);
    return res.end();
  }
  if (!CHAT_LAMBDA_URL) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Chat service not configured' })}\n\n`);
    return res.end();
  }

  // Send processing event immediately
  res.write(`event: processing\ndata: ${JSON.stringify({ status: 'Analyzing your request...' })}\n\n`);

  // Keepalive heartbeat every 15s
  const heartbeat = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 15000);

  // Client disconnect — must use res.on('close'), NOT req.on('close')
  // req 'close' fires when the request body is received (immediately for POST),
  // res 'close' fires when the SSE connection is actually closed by the client.
  let aborted = false;
  res.on('close', () => {
    aborted = true;
    clearInterval(heartbeat);
  });

  try {
    const lambdaResponse = await axios.post(
      CHAT_LAMBDA_URL,
      {
        action: 'message',
        user_id,
        session_id: session_id || null,
        message: message.trim(),
        user_context: {
          username: req.user.username,
          role: req.user.role,
          site_id: req.user.site_id,
          department: req.user.department,
        },
      },
      { timeout: 120000, headers: { 'Content-Type': 'application/json' } }
    );
    if (aborted) return;

    const raw = lambdaResponse.data;

    // Extract the response body — handle both wrapped {statusCode, body} and unwrapped formats
    let responseBody;

    if (raw && typeof raw.body === 'string') {
      // Wrapped response: {statusCode, headers, body: "..."}
      // Check for error status
      if (raw.statusCode && raw.statusCode >= 400) {
        let errorMsg = 'Chat service error';
        try { errorMsg = JSON.parse(raw.body).error || errorMsg; } catch {}
        res.write(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`);
        clearInterval(heartbeat);
        return res.end();
      }
      responseBody = raw.body; // string — could be NDJSON or JSON
    } else if (typeof raw === 'string') {
      // Raw string response (unwrapped NDJSON or JSON)
      responseBody = raw;
    } else if (raw && typeof raw === 'object') {
      // Unwrapped JSON object (old Lambda format returned directly)
      responseBody = JSON.stringify(raw);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Unexpected response from chat service' })}\n\n`);
      clearInterval(heartbeat);
      return res.end();
    }

    // Detect format: NDJSON (multiple JSON objects per line) vs single JSON object
    // NDJSON lines start with {"event": and the content-type hint from inner headers
    const innerContentType = raw?.headers?.['Content-Type'] || '';
    const isNdjson = innerContentType.includes('application/x-ndjson')
      || responseBody.trimStart().startsWith('{"event":');

    if (isNdjson) {
      // NDJSON path: split on newlines, forward each event as SSE
      const lines = responseBody.split('\n');
      for (const line of lines) {
        if (aborted) break;
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          if (event.event === '_complete') continue;
          res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
        } catch (e) {
          console.error('Stream: malformed NDJSON line:', trimmed.slice(0, 100), e.message);
        }
      }
    } else {
      // Legacy JSON path: single JSON object with {response, thinking, artifacts, ...}
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch {
        console.error('Stream: failed to parse Lambda response body:', responseBody.slice(0, 200));
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Invalid response from chat service' })}\n\n`);
        clearInterval(heartbeat);
        return res.end();
      }

      if (data.error) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: data.error })}\n\n`);
        clearInterval(heartbeat);
        return res.end();
      }

      // Emit events from legacy response
      if (data.session_id) {
        res.write(`event: session\ndata: ${JSON.stringify({ session_id: data.session_id })}\n\n`);
      }
      if (data.thinking) {
        for (const t of data.thinking) {
          res.write(`event: thinking\ndata: ${JSON.stringify(t)}\n\n`);
        }
      }
      if (data.artifacts) {
        res.write(`event: artifacts\ndata: ${JSON.stringify({ artifacts: data.artifacts })}\n\n`);
      }
      const responseText = data.response || '';
      const words = responseText.split(/(\s+)/);
      for (const word of words) {
        res.write(`event: text\ndata: ${JSON.stringify({ token: word })}\n\n`);
      }
      if (data.chart_data && !data.artifacts) {
        res.write(`event: chart\ndata: ${JSON.stringify({ chart_data: data.chart_data })}\n\n`);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ metadata: data.metadata })}\n\n`);
    }

    clearInterval(heartbeat);
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    if (aborted) return;
    const errorMsg = err.code === 'ECONNABORTED'
      ? 'Chat service timed out. Please try again.'
      : 'Failed to process message';
    res.write(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.end();
  }
});

module.exports = router;
