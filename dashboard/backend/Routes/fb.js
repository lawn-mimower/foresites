const express = require('express');
const Router = express.Router();
const supabase = require('../config/supabaseClient');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const { REPORTS_DIR, DAYWISE_CSV, SITEWISE_CSV } = require('../../../config/paths');
const { getSignedUrlForS3Object, isS3Key } = require('../../../chatbot/s3');

const { authenticateToken, requireAdmin } = require('./auth');

const AWS_API_URL = "https://w3cabs3fz0.execute-api.eu-north-1.amazonaws.com/default/issuesDynamicQuery";



//------------------------REPORT GENERATION CALLER-------------
const { spawn } = require('child_process');

// ------------------------- CONSTANTS -------------------------

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ------------------------- HEALTH CHECK -------------------------
Router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'dashboard-api' });
});

// ------------------------- AUTH MIDDLEWARE -------------------------
Router.use((req, res, next) => {
  if (req.path === '/health') return next();
  return authenticateToken(req, res, next);
});

// ------------------------- FEEDBACK ROUTES -------------------------

// ✅ Fetch all snags (feedbacks)
Router.get('/feedbacks', async (req, res) => {
  try {
    const { data: snags, error } = await supabase
      .from('snag')
      .select(`
        *,
        site(site_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching snags:', error);
      return res.status(500).json({ error: 'Failed to fetch feedbacks' });
    }

    res.json(snags);
  } catch (err) {
    console.error('❌ Error fetching feedbacks:', err);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
});

// ✅ Add new snag (feedback)
Router.post('/feedbacks', async (req, res) => {
  try {
    const payload = req.body || {};
    
    const { data: created, error } = await supabase
      .from('snag')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating snag:', error);
      return res.status(400).json({ error: 'Failed to create feedback', details: error?.message });
    }

    res.status(201).json({
      message: '✅ Feedback saved in database',
      created,
    });
  } catch (err) {
    console.error('❌ Error creating feedback:', err);
    res.status(400).json({ error: 'Failed to create feedback', details: err?.message });
  }
});

// ✅ Update snag status
Router.put('/feedbacks/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Update in Supabase - snag table
    const { data: updated, error } = await supabase
      .from('snag')
      .update({
        status: status,
        assigned_at: status === 'resolved' ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(404).json({ error: 'Feedback not found' });
    }

    if (!updated) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // ✅ Also update any related assignments for this snag
    // Map snag status to assignment status (snag uses 'pending', assignment uses 'open')
    const assignmentStatus = status === 'resolved' ? 'resolved' : 'open';
    const assignmentUpdateData = { status: assignmentStatus };
    if (status === 'resolved') {
      assignmentUpdateData.resolved_at = new Date().toISOString();
    }

    const { error: assignmentError } = await supabase
      .from('snag_assignment')
      .update(assignmentUpdateData)
      .eq('snag_id', id);

    if (assignmentError) {
      console.warn('⚠️ Warning: Assignment update failed', assignmentError);
      // Don't fail the response, just warn
    }

    res.json({
      message: '✅ Snag status updated',
      updated
    });
  } catch (err) {
    console.error('❌ Error updating snag:', err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// ✅ Update snag feedback and suggestion
Router.put('/feedbacks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, suggestion } = req.body;

    const { data: updated, error } = await supabase
      .from('snag')
      .update({ feedback, suggestion })
      .eq('id', id)
      .select()
      .single();

    if (!updated || error) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('❌ Error updating snag:', err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// ✅ Delete snag
Router.delete('/feedbacks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('snag')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ message: '✅ Feedback deleted' });
  } catch (err) {
    console.error('❌ Error deleting snag:', err);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// ✅ Stats summary
Router.get('/stats', async (req, res) => {
  try {
    const { data: snags, error } = await supabase
      .from('snag')
      .select('status');

    if (error) {
      throw error;
    }

    const total = snags.length;
    const resolved = snags.filter(s => s.status === 'resolved').length;
    const pending = total - resolved;
    
    res.json({ total, resolved, pending });
  } catch (err) {
    console.error('❌ Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ✅ Generate signed URL for S3 object or return local path
Router.get('/media-url', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    console.log(`🔍 Media URL request for: ${filePath}`);

    // Check if it's an S3 key
    if (isS3Key(filePath)) {
      const bucketName = process.env.S3_BUCKET_NAME;
      if (!bucketName) {
        console.warn('⚠️ S3_BUCKET_NAME not configured');
        return res.status(500).json({ error: 'S3 bucket not configured' });
      }
      
      try {
        console.log(`📤 Generating signed URL for S3 key: ${filePath} in bucket: ${bucketName}`);
        const signedUrl = await getSignedUrlForS3Object(filePath, bucketName);
        console.log(`✅ Generated signed URL for: ${filePath}`);
        return res.json({ url: signedUrl });
      } catch (s3Error) {
        console.error('❌ Error generating signed URL:', s3Error);
        return res.status(500).json({ error: 'Failed to generate signed URL', details: s3Error.message });
      }
    } else {
      // It's a local path, return the local URL
      console.log(`📁 Returning local path for: ${filePath}`);
      const baseUrl = process.env.BASE_URL || 'http://localhost:9999';
      const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
      return res.json({ url: `${baseUrl}${cleanPath}` });
    }
  } catch (err) {
    console.error('❌ Error getting media URL:', err);
    res.status(500).json({ error: 'Failed to get media URL', details: err.message });
  }
});

// ── Metrics cache: 30-second TTL per site_id ──
const metricsCache = new Map();
const CACHE_TTL = 30_000;

function getCachedMetrics(key) {
  const entry = metricsCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

// ✅ Dashboard metrics — RPC for headlines (~20ms) + 3 parallel bulk queries for sparklines
Router.get('/dashboard-metrics', async (req, res) => {
  try {
    const siteId = req.query.site_id || null;
    const cacheKey = `metrics_${siteId || 'all'}`;

    // Return from cache if fresh
    const cached = getCachedMetrics(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 7-day window for sparklines
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sparkStart = sevenDaysAgo.toISOString().split('T')[0] + 'T00:00:00.000Z';

    // ── 4 PARALLEL calls: 1 RPC + 3 bulk fetches ──
    const rpcArgs = {};
    if (siteId) rpcArgs.p_site_id = siteId;

    // Snags from last 7 days (for sparklines only)
    let snagQ = supabase.from('snag').select('created_at, category, status')
      .gte('created_at', sparkStart);
    if (siteId) snagQ = snagQ.eq('site_id', siteId);

    // Assignments: only those with due_date or resolved_at in the 7-day window
    let assignQ = supabase.from('snag_assignment').select('status, resolved_at, due_date');
    if (siteId) assignQ = assignQ.eq('site_id', siteId);

    // ALL open snags for category counts (not limited to 7 days)
    let catQ = supabase.from('snag').select('category').neq('status', 'resolved');
    if (siteId) catQ = catQ.eq('site_id', siteId);

    const [rpcRes, snagRes, assignRes, catRes] = await Promise.all([
      supabase.rpc('dashboard_metrics', rpcArgs),
      snagQ,
      assignQ,
      catQ,
    ]);

    // ── Headline numbers from RPC (with fallback if RPC fails) ──
    let reported_24h = 0, completed_24h = 0, due_today = 0, overdue = 0;

    if (rpcRes.error) {
      console.warn('⚠️ RPC dashboard_metrics failed, falling back to JS counts:', rpcRes.error.message);
      // Fallback: compute from bulk data
      const twentyFourAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const allSnags = snagRes.data || [];
      const allAssigns = assignRes.data || [];
      reported_24h = allSnags.filter(s => s.created_at >= twentyFourAgo).length;
      completed_24h = allAssigns.filter(a => a.status === 'resolved' && a.resolved_at && a.resolved_at >= twentyFourAgo).length;
      for (const a of allAssigns) {
        if (a.status === 'resolved' || !a.due_date) continue;
        const ds = a.due_date.split('T')[0];
        if (ds === todayStr) due_today++;
        else if (ds < todayStr) overdue++;
      }
    } else {
      const headlines = rpcRes.data || {};
      console.log('📊 RPC dashboard_metrics returned:', JSON.stringify(headlines));
      reported_24h = headlines.reported_24h ?? 0;
      completed_24h = headlines.completed_24h ?? 0;
      due_today = headlines.due_today ?? 0;
      overdue = headlines.overdue ?? 0;
    }

    const snags = snagRes.data || [];
    const assigns = assignRes.data || [];

    // ── Sparklines: bucket into 7 day bins in JS ──
    const dayKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().split('T')[0]);
    }

    const sparklines = { reported: [], completed: [], due: [], overdue: [] };
    for (const dk of dayKeys) {
      sparklines.reported.push(
        snags.filter(s => s.created_at && s.created_at.startsWith(dk)).length
      );
      sparklines.completed.push(
        assigns.filter(a => a.status === 'resolved' && a.resolved_at && a.resolved_at.startsWith(dk)).length
      );
      sparklines.due.push(
        assigns.filter(a => a.status !== 'resolved' && a.due_date && a.due_date.startsWith(dk)).length
      );
      // Overdue on day X = assignments due before day X and still unresolved
      sparklines.overdue.push(
        assigns.filter(a => a.status !== 'resolved' && a.due_date && a.due_date.split('T')[0] < dk).length
      );
    }

    // ── Category counts from ALL open snags (separate query, not 7-day limited) ──
    const category_counts = {};
    (catRes.data || []).forEach(r => {
      const cat = r.category || 'uncategorized';
      category_counts[cat] = (category_counts[cat] || 0) + 1;
    });

    const result = { reported_24h, completed_24h, due_today, overdue, sparklines, category_counts };

    // Cache for 30s
    metricsCache.set(cacheKey, { data: result, ts: Date.now() });

    res.json(result);
  } catch (err) {
    console.error('❌ Error fetching dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

module.exports = Router;
