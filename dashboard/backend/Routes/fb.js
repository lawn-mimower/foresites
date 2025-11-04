const express=require('express');
const Router=express.Router();
const mongoose=require('mongoose');
require('dotenv').config();
const axios=require('axios');
const UserFeedback=require('../Models/userfb');
const Site=require('../Models/sitename');
const Passphrase=require('../Models/passpharse');
const { getSignedUrlForImage } = require('../../../chatbot/s3.js');
const { authenticateToken, requireAdmin } = require('./auth');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');



// Health check (public)
Router.get('/health', (req,res)=>{
  res.json({ ok: true, service: 'dashboard-api' });
});

// Apply authentication middleware to all routes except health check
Router.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  return authenticateToken(req, res, next);
});

// Proxy S3 image through server (protected)
Router.get('/image-proxy', async (req,res)=>{
  try{
    const { url } = req.query;
    if(!url){
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Extract S3 key from URL
    const urlParts = url.split('/');
    const s3Key = urlParts.slice(3).join('/'); // Remove domain parts
    
    // Get the image directly from S3
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key
    });
    
    const response = await s3.send(command);
    
    // Set appropriate headers
    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Stream the image data
    response.Body.pipe(res);
    
  }catch(err){
    console.error('Error proxying image:', err);
    res.status(500).json({ error: 'Failed to load image' });
  }
});

// Stats for home banner
Router.get('/stats', async (req,res)=>{
  try{
    const total = await UserFeedback.countDocuments({});
    const resolved = await UserFeedback.countDocuments({ resolved: true });
    const pending = total - resolved;
    res.json({ total, resolved, pending });
  }catch(err){
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// List feedbacks
Router.get('/feedbacks', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;

    let feedbacks = await UserFeedback.find(filter).sort({ createdAt: -1 });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    feedbacks = feedbacks.map(fb => {
      const obj = fb.toObject();

      // 🖼️ Convert image paths to full URLs
      if (Array.isArray(obj.image)) {
        obj.image = obj.image.map(imgPath =>
          imgPath.startsWith('http')
            ? imgPath
            : `${baseUrl}${imgPath.startsWith('/') ? imgPath : '/' + imgPath}`
        );
      }

      // 🎧 Convert voice file path to full URL
      if (obj.voice_url) {
        obj.voice_url = obj.voice_url.startsWith('http')
          ? obj.voice_url
          : `${baseUrl}${obj.voice_url.startsWith('/') ? obj.voice_url : '/' + obj.voice_url}`;
      }

      return obj;
    });

    res.json(feedbacks);
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
});




// Create feedback
Router.post('/feedbacks', async (req,res)=>{
  try{
    const payload = req.body || {};
    const created = await UserFeedback.create(payload);
    res.status(201).json(created);
  }catch(err){
    res.status(400).json({ error: 'Failed to create feedback', details: err?.message });
  }
});

// Update feedback
Router.put('/feedbacks/:id', async (req,res)=>{
  try{
    const { id } = req.params;
    const update = req.body || {};
    const updated = await UserFeedback.findByIdAndUpdate(id, update, { new: true });
    if(!updated){
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json(updated);
  }catch(err){
    res.status(400).json({ error: 'Failed to update feedback', details: err?.message });
  }
});

// Toggle resolve
Router.put('/feedbacks/:id/resolve', async (req,res)=>{
  try{
    const { id } = req.params;
    const { resolved } = req.body;
    const updated = await UserFeedback.findByIdAndUpdate(
      id,
      { $set: { resolved: !!resolved } },
      { new: true }
    );
    if(!updated){
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json(updated);
  }catch(err){
    res.status(400).json({ error: 'Failed to update feedback' });
  }
});

// Delete feedback
Router.delete('/feedbacks/:id', async (req,res)=>{
  try{
    const { id } = req.params;
    const deleted = await UserFeedback.findByIdAndDelete(id);
    if(!deleted){
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json({ ok: true });
  }catch(err){
    res.status(400).json({ error: 'Failed to delete feedback' });
  }
});

// Sites list
Router.get('/sites', async (req,res)=>{
  try{
    const sites = await Site.find({}).sort({ createdAt: -1 });
    res.json(sites);
  }catch(err){
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Create site (admin only)
Router.post('/sites', requireAdmin, async (req,res)=>{
  try{
    const created = await Site.create(req.body || {});
    res.status(201).json(created);
  }catch(err){
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Site already exists' });
    }
    res.status(400).json({ error: 'Failed to create site', details: err?.message });
  }
});

// Update site (admin only)
Router.put('/sites/:id', requireAdmin, async (req,res)=>{
  try{
    const { id } = req.params;
    const update = req.body || {};
    const updated = await Site.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if(!updated){
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json(updated);
  }catch(err){
    res.status(400).json({ error: 'Failed to update site', details: err?.message });
  }
});

// Delete site (admin only)
Router.delete('/sites/:id', requireAdmin, async (req,res)=>{
  try{
    const { id } = req.params;
    const deleted = await Site.findByIdAndDelete(id);
    if(!deleted){
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ ok: true });
  }catch(err){
    res.status(400).json({ error: 'Failed to delete site' });
  }
});

// Passphrases list
Router.get('/passphrases', async (req,res)=>{
  try{
    const items = await Passphrase.find({}).sort({ createdAt: -1 });
    res.json(items);
  }catch(err){
    res.status(500).json({ error: 'Failed to fetch passphrases' });
  }
});

// Create passphrase (admin only)
Router.post('/passphrases', requireAdmin, async (req,res)=>{
  try{
    const { code, site } = req.body || {};
    if(!code || !site){
      return res.status(400).json({ error: 'code and site are required' });
    }
    const created = await Passphrase.create({ code, site });
    res.status(201).json(created);
  }catch(err){
    res.status(400).json({ error: 'Failed to create passphrase', details: err?.message });
  }
});

// Update passphrase (admin only)
Router.put('/passphrases/:id', requireAdmin, async (req,res)=>{
  try{
    const { id } = req.params;
    const update = req.body || {};
    const updated = await Passphrase.findByIdAndUpdate(id, update, { new: true });
    if(!updated){
      return res.status(404).json({ error: 'Passphrase not found' });
    }
    res.json(updated);
  }catch(err){
    res.status(400).json({ error: 'Failed to update passphrase', details: err?.message });
  }
});

// Delete passphrase (admin only)
Router.delete('/passphrases/:id', requireAdmin, async (req,res)=>{
  try{
    const { id } = req.params;
    const deleted = await Passphrase.findByIdAndDelete(id);
    if(!deleted){
      return res.status(404).json({ error: 'Passphrase not found' });
    }
    res.json({ ok: true });
  }catch(err){
    res.status(400).json({ error: 'Failed to delete passphrase' });
  }
});
// Get feedbacks from the last 24 hours
Router.get('/feedbacks/last24hrs', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours
    let feedbacks = await UserFeedback.find({ createdAt: { $gte: since } });

    const categoryPriority = [
      "safety_compliance",
      "design_conflicts",
      "resource_blockers",
      "workflow_issues",
      "miscellaneous",
    ];

    // Sort according to category priority
    feedbacks.sort((a, b) => {
      return categoryPriority.indexOf(a.category) - categoryPriority.indexOf(b.category);
    });

    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
});

// Generate report (admin only)
Router.get('/generate-report', authenticateToken, requireAdmin, async (req, res) => {
  console.log("📊 [DEBUG] Generate report route called by:", req.user?.username || "unknown");

  try {
    const feedbacks = await UserFeedback.find();
    console.log("📊 [DEBUG] Feedback count:", feedbacks.length);

    if (!feedbacks.length) {
      console.log("⚠️ [DEBUG] No feedback data found");
      return res.status(404).json({ message: "No feedback data found" });
    }

    // Compute aggregation
    const summary = {};
    feedbacks.forEach(fb => {
      const site = fb.sitename || "Unknown Site";
      if (!summary[site]) {
        summary[site] = {
          Date: new Date().toISOString().split('T')[0],
          name: site,
          safety_compliance: 0,
          design_conflicts: 0,
          resource_blockers: 0,
          workflow_issues: 0,
          miscellaneous: 0,
          resolved: 0,
        };
      }

      if (fb.category && summary[site][fb.category] !== undefined) {
        summary[site][fb.category] += 1;
      }
      if (fb.resolved) summary[site].resolved += 1;
    });

    console.log("📊 [DEBUG] Summary prepared:", summary);

    // Save CSV file
    const csvPath = path.join(process.cwd(), 'dashboard/backend/MD-report-data.csv');
    console.log("📁 [DEBUG] CSV Path:", csvPath);

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'Date', title: 'Date' },
        { id: 'name', title: 'name' },
        { id: 'safety_compliance', title: 'safety_compliance' },
        { id: 'design_conflicts', title: 'design_conflicts' },
        { id: 'resource_blockers', title: 'resource_blockers' },
        { id: 'workflow_issues', title: 'workflow_issues' },
        { id: 'miscellaneous', title: 'miscellaneous' },
        { id: 'resolved', title: 'resolved' },
      ],
    });

    const records = Object.values(summary);
    await csvWriter.writeRecords(records);

    console.log("✅ [DEBUG] CSV write successful");

    res.json({
      message: "✅ Report generated successfully",
      summary: records,
      file: "/MD-report-data.csv"
    });
  } catch (err) {
    console.error("❌ [DEBUG] Error generating report:", err);
    res.status(500).json({ error: err.message || "Failed to generate report" });
  }
});







module.exports = Router;
