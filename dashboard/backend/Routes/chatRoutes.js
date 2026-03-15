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

// POST /api/chat/message — proxy user message to Lambda agent
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { message, session_id } = req.body;
    const user_id = req.user.user_id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
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

module.exports = router;
