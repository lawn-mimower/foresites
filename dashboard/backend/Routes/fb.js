const express = require('express');
const Router = express.Router();
const mongoose = require('mongoose');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const { REPORTS_DIR, DAYWISE_CSV, SITEWISE_CSV } = require('../../../config/paths');

const UserFeedback = require('../Models/userfb');
const Passphrase=require('../Models/passpharse')
const Site = require('../Models/sitename');
const { authenticateToken, requireAdmin } = require('./auth');



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

// ✅ Fetch all feedbacks
Router.get('/feedbacks', async (req, res) => {
  try {
    const feedbacks = await UserFeedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    console.error('❌ Error fetching feedbacks:', err);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
});

// ✅ Add new feedback (DB only, CSV handled by chatbot)
Router.post('/feedbacks', async (req, res) => {
  try {
    const payload = req.body || {};
    const created = await UserFeedback.create(payload);

    res.status(201).json({
      message: '✅ Feedback saved in database (CSV managed by chatbot)',
      created,
    });
  } catch (err) {
    console.error('❌ Error creating feedback:', err);
    res.status(400).json({ error: 'Failed to create feedback', details: err?.message });
  }
});

// ✅ Toggle resolved → Update DB and chatbot-generated CSV (fully standardized)
Router.put('/feedbacks/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;

    // Step 1️⃣: Update in MongoDB
    const updated = await UserFeedback.findByIdAndUpdate(
      id,
      {
        $set: {
          resolved: !!resolved,
          resolvedAt: resolved ? new Date() : null,
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Feedback not found' });

    // Step 2️⃣: Define report paths
    const DAYWISE_CSV = path.join(REPORTS_DIR, 'MD-report-data-Daywise.csv');
    const SITEWISE_CSV = path.join(REPORTS_DIR, 'MD-report-data-Sitewise.csv');

    if (!fs.existsSync(DAYWISE_CSV)) {
      console.warn('⚠️ Daywise CSV missing — skipping CSV sync.');
      return res.json({ message: '⚠️ DB updated, CSV not found.', updated });
    }

    // ✅ CSV Loader Helper
    const loadCsv = (filePath) => {
      const data = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      const headers = data[0].split(',');
      return {
        headers,
        rows: data.slice(1).map(line => {
          const cols = line.split(',');
          const obj = {};
          headers.forEach((h, i) => obj[h.trim()] = cols[i]?.trim() || '');
          return obj;
        }),
      };
    };

    // Step 3️⃣: Load both CSVs
    const { headers: dayHeaders, rows: dayData } = loadCsv(DAYWISE_CSV);
    const { headers: siteHeaders, rows: siteData } = fs.existsSync(SITEWISE_CSV)
      ? loadCsv(SITEWISE_CSV)
      : { headers: [], rows: [] };

    // Step 4️⃣: Update Daywise CSV (match feedback_id)
    const row = dayData.find(r => r.feedback_id === id);
    if (row) {
      row.resolved = resolved ? 'Yes' : 'No';

      if (resolved) {
        const resolvedAt = new Date(updated.resolvedAt);
        const createdAt = new Date(updated.createdAt);
        const diffHrs = Math.round((resolvedAt - createdAt) / 3600000);

        row.resolvedAt = resolvedAt.toISOString();
        row.time_to_resolve_hrs = diffHrs.toString();
      } else {
        row.resolvedAt = '';
        row.time_to_resolve_hrs = '';
      }
    } else {
      console.warn(`⚠️ Feedback ID ${id} not found in Daywise CSV.`);
    }

    // Step 5️⃣: Update Sitewise CSV (based on site + category)
    const siteRow = siteData.find(r => r.name === updated.sitename);
    if (siteRow) {
      const catSolvedKey = `${updated.category}_solved`;

      if (siteRow[catSolvedKey] !== undefined) {
        if (resolved) {
          siteRow[catSolvedKey] = (parseInt(siteRow[catSolvedKey]) || 0) + 1;
        } else {
          siteRow[catSolvedKey] = Math.max((parseInt(siteRow[catSolvedKey]) || 0) - 1, 0);
        }
      }

      // ✅ Recalculate totals safely
      const raisedKeys = Object.keys(siteRow).filter(k => k.endsWith('_raised'));
      const solvedKeys = Object.keys(siteRow).filter(k => k.endsWith('_solved'));

      siteRow.total_raised = raisedKeys.reduce(
        (a, k) => a + (parseInt(siteRow[k]) || 0),
        0
      ).toString();

      siteRow.total_solved = solvedKeys.reduce(
        (a, k) => a + (parseInt(siteRow[k]) || 0),
        0
      ).toString();

      siteRow.total_pending = (
        parseInt(siteRow.total_raised) - parseInt(siteRow.total_solved)
      ).toString();
    }

    // Step 6️⃣: Write updated CSVs back to file (newline-safe)
    const writeCsv = (filePath, headers, rows) => {
      const csv = [headers.join(',')]
        .concat(rows.map(r => headers.map(h => r[h] ?? '').join(',')))
        .join('\n')
        .trim() + '\n';
      fs.writeFileSync(filePath, csv, 'utf8');
    };

    if (dayData.length) writeCsv(DAYWISE_CSV, dayHeaders, dayData);
    if (siteData.length) writeCsv(SITEWISE_CSV, siteHeaders, siteData);

    console.log('✅ CSV sync successful for feedback resolution.');

    res.json({
      message: `✅ Feedback ${resolved ? 'resolved' : 'unresolved'} — CSV updated successfully`,
      updated,
    });
  } catch (err) {
    console.error('❌ Error updating feedback resolution:', err);
    res.status(500).json({ error: 'Failed to update feedback resolution' });
  }
});

// ✅ Stats summary
Router.get('/stats', async (req, res) => {
  try {
    const total = await UserFeedback.countDocuments({});
    const resolved = await UserFeedback.countDocuments({ resolved: true });
    const pending = total - resolved;
    res.json({ total, resolved, pending });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
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





//--------------------_PYTHON WORK----------------------
Router.post("/generate-report", async (req, res) => {
  try {
    // Path to the existing PDF
    const pdfPath = path.join(__dirname, "../scripts/construction_site_report_enhanced.pdf");

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: "Report file not found." });
    }

    console.log("📄 Sending pre-generated PDF:", pdfPath);

    // Set headers for download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=construction_site_report.pdf"
    );

    // Stream the file to the frontend
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      console.error("Error reading PDF file:", err);
      res.status(500).json({ error: "Error reading report file" });
    });
  } catch (err) {
    console.error("❌ Error serving report:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});


module.exports = Router;
