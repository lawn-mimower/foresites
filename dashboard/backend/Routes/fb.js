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

    // Update in Supabase
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

module.exports = Router;
