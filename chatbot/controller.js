
const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const { createObjectCsvWriter } = require('csv-writer');
const { uploadToS3 } = require('./s3');

// Models
const Feedback = require('../chatbot/Models/userfbschema');
const SitenameModel = require('../chatbot/Models/sitename');
const PassphraseModel = require('../chatbot/Models/passphrase');

// Environment Variables
const accessToken = process.env.accessToken;
const phone_number_id = process.env.phone_number_id;
const apiVersion = 'v25.0';

if (!accessToken || !phone_number_id) {
  console.warn('⚠️ Missing WhatsApp API credentials — please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.');
}

// State Holders
const userStates = {};
const processedMessages = new Set();

// -------------------- Helper Functions --------------------
// 🎤 TRANSCRIBE VOICE AUDIO
async function getTranscription(audioFilePath) {
  try {
    // Read the audio file from disk
    // audioFilePath can be either S3 key (voice/filename.ogg) or local path (/uploads/voice/filename.ogg)
    console.log(`📝 Reading audio file for transcription: ${audioFilePath}...`);
    
    let audioFile;
    // Check if it's an S3 key (starts with voice/ or images/) or local path
    if (audioFilePath.startsWith('voice/') || audioFilePath.startsWith('images/')) {
      // It's an S3 key, read from local uploads folder (file was saved locally before S3 upload)
      const localPath = path.join(__dirname, '../uploads', audioFilePath);
      audioFile = fs.readFileSync(localPath);
    } else {
      // It's a local path, resolve from project root
      const cleanPath = audioFilePath.startsWith('/') ? audioFilePath.substring(1) : audioFilePath;
      audioFile = fs.readFileSync(path.resolve(__dirname, '..', cleanPath));
    }

    // Convert the file buffer to a Base64 string
    const audioBase64 = audioFile.toString('base64');
    console.log('✅ File converted to Base64.');

    // Determine MIME type based on file extension
    const ext = path.extname(audioFilePath).toLowerCase();
    const mimeTypes = {
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
    };
    const mimeType = mimeTypes[ext] || 'audio/wav';

    // Create the JSON payload
    const payload = {
      mime_type: mimeType,
      audio_base64: audioBase64,
    };

    // API endpoint from voice_test.js
    const API_ENDPOINT_URL = 'https://u91h1twf00.execute-api.eu-north-1.amazonaws.com/default/IssueTranscribe';

    // Send the POST request to the API Gateway
    console.log(`📤 Sending transcription request to API...`);
    const response = await axios.post(API_ENDPOINT_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds
    });

    // Extract transcription from response
    const transcription = response.data?.transcription || '';
    console.log('✅ Transcription received:', transcription.substring(0, 50) + '...');
    return transcription;
  } catch (error) {
    console.error('❌ Transcription error:', error.response?.data || error.message);
    return null; // Return null on error so the flow can continue
  }
}

async function sendText(to, body) {
  try {
    await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phone_number_id}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    console.log(`➡️ Sent text to ${to}: ${body.replace(/\n/g, ' | ')}`);
  } catch (e) {
    console.error('❌ sendText error:', e.response?.data || e.message);
  }
}

async function sendList(to, header, body, options = []) {
  try {
    const cleanOptions = options.map(o => ({
      id: o.id,
      title: o.title.substring(0, 24),
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: header.substring(0, 24) },
        body: { text: body },
        action: { button: 'Select', sections: [{ title: 'Choose One', rows: cleanOptions }] },
      },
    };

    await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phone_number_id}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    console.log('➡️ Sent list:', header);
  } catch (e) {
    console.error('❌ sendList error:', e.response?.data || e.message);
  }
}

// 📥 DOWNLOAD MEDIA (voice/image), SAVE LOCALLY, AND UPLOAD TO S3
async function downloadMedia(mediaId, folderName, userName = 'anonymous') {
  try {
    const metaRes = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const mediaUrl = metaRes.data.url;
    if (!mediaUrl) throw new Error('No media URL found');

    const mediaRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    const contentType = mediaRes.headers['content-type'] || 'application/octet-stream';
    const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
    const dir = path.join(__dirname, '../uploads', folderName);
    await fsPromises.mkdir(dir, { recursive: true });

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = userName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${dateStr}_${safeName}.${ext}`;
    const filePath = path.join(dir, filename);

    // Save locally first (needed for transcription)
    await fsPromises.writeFile(filePath, mediaRes.data);
    console.log(`✅ Saved ${folderName} locally: ${filePath}`);

    // Upload to S3
    const bucketName = process.env.S3_BUCKET_NAME;
    if (bucketName) {
      try {
        const s3Key = await uploadToS3(filePath, bucketName, `${folderName}/`);
        console.log(`✅ Uploaded to S3: ${s3Key}`);
        // Return S3 key instead of local path
        return s3Key;
      } catch (s3Error) {
        console.error('❌ S3 upload error, using local path:', s3Error.message);
        // Fallback to local path if S3 upload fails
        return `/uploads/${folderName}/${filename}`;
      }
    } else {
      console.warn('⚠️ S3_BUCKET_NAME not set, using local storage');
      return `/uploads/${folderName}/${filename}`;
    }
  } catch (err) {
    console.error('❌ downloadMedia error:', err.response?.data || err.message);
    return null;
  }
}

// -------------------- Steps --------------------
const steps = {
  askName: async (from, user, msgObj, text) => {
    user.feedback.name = text;
    user.step = 'askSite';
    const sites = await SitenameModel.find({}).limit(20).lean();
    const opts = sites.length
      ? sites.map(s => ({ id: s.name, title: s.name }))
      : [{ id: 'Site Alpha', title: 'Site Alpha' }];
    await sendList(from, 'Site Name', 'Please choose your site name:', opts);
  },

  askSite: async (from, user, msgObj, text) => {
    const site = await SitenameModel.findOne({ name: { $regex: `^${text}$`, $options: 'i' } });
    if (!site) return sendText(from, `⚠️ Site "${text}" not found. Try again.`);

    user.feedback.sitename = site.name;
    user.step = 'askPassphrase';
    await sendText(from, `✅ Site verified: *${site.name}*\nEnter your passphrase:`);
  },

  askPassphrase: async (from, user, msgObj, text) => {
    const code = await PassphraseModel.findOne({
      code: { $regex: `^${text}$`, $options: 'i' },
      site: { $regex: `^${user.feedback.sitename}$`, $options: 'i' },
    });

    if (!code) return sendText(from, '❌ Invalid passphrase. Try again.');
    user.feedback.code = code.code || text;
    await steps.askCategory(from, user, msgObj, text);
  },

  askCategory: async (from, user) => {
    const categories = [
      { id: 'safety_compliance', title: 'Safety & Compliance' },
      { id: 'design_conflicts', title: 'Design' },
      { id: 'resource_blockers', title: 'Resources' },
      { id: 'workflow_issues', title: 'Workflow' },
      { id: 'miscellaneous', title: 'Other' },
    ];
    await sendList(from, 'Category', 'Select issue category:', categories);
    user.step = 'awaitCategory';
  },

  awaitCategory: async (from, user, msgObj, text) => {
    user.feedback.category = text;
    user.step = 'chooseFeedbackType';
    await sendList(from, 'Feedback Type', 'Choose how to give feedback:', [
      { id: 'voice', title: '🎙️ Voice' },
      { id: 'text', title: '✍️ Text' },
    ]);
  },

  chooseFeedbackType: async (from, user, msgObj, text) => {
    if (text === 'voice') {
      user.feedback.feedback_type = 'voice';
      user.step = 'awaitVoice';
      return sendText(from, '🎤 Please record and send your voice note.');
    }
    if (text === 'text') {
      user.feedback.feedback_type = 'text';
      user.step = 'awaitTextFeedback';
      return sendText(from, '✍️ Please type your feedback:');
    }
  },

  awaitVoice: async (from, user, msgObj) => {
    const mediaId = msgObj.audio?.id || msgObj.voice?.id || msgObj.audio_message?.id;
    if (!mediaId) return sendText(from, '⚠️ No audio found. Please resend.');

    const localPath = await downloadMedia(mediaId, 'voice', user.feedback.name || 'user');
    if (!localPath) {
      return sendText(from, '⚠️ Error downloading voice file. Please try again.');
    }

    user.feedback.voice_url = localPath;
    
    // Transcribe the voice message
    console.log('🎤 Starting transcription process...');
    await sendText(from, '🔄 Processing your voice message...');
    const transcription = await getTranscription(localPath);
    
    if (transcription) {
      user.feedback.transcription = transcription;
      console.log('✅ Transcription stored:', transcription.substring(0, 100));
    } else {
      console.warn('⚠️ Transcription failed, but continuing with voice file.');
      // Continue even if transcription fails
    }

    user.step = 'askImage';
    await sendList(from, 'Upload Image', 'Would you like to attach an image?', [
      { id: 'yes', title: 'Yes' },
      { id: 'no', title: 'No' },
    ]);
  },

  awaitTextFeedback: async (from, user, msgObj, text) => {
    user.feedback.feedback = text;
    user.step = 'askSolution';
    await sendText(from, 'Do you have a suggested solution? Type it or "no".');
  },

  askSolution: async (from, user, msgObj, text) => {
    user.feedback.solution = text.toLowerCase() === 'no' ? null : text;
    user.step = 'askImage';
    await sendList(from, 'Upload Image', 'Would you like to attach an image?', [
      { id: 'yes', title: 'Yes' },
      { id: 'no', title: 'No' },
    ]);
  },

  askImage: async (from, user, msgObj, text) => {
    if (text === 'yes') {
      user.step = 'awaitImage';
      return sendText(from, '📸 Please send your image now.');
    }
    if (text === 'no') {
      user.step = 'saveFeedback';
      return steps.saveFeedback(from, user);
    }
  },

  awaitImage: async (from, user, msgObj) => {
    const mediaId = msgObj.image?.id;
    if (!mediaId) return sendText(from, '⚠️ No image found. Please resend.');
    const localPath = await downloadMedia(mediaId, 'images', user.feedback.name || 'user');
    user.feedback.image = [localPath];
    user.step = 'saveFeedback';
    await steps.saveFeedback(from, user);
  },

// 🧾 SAVE FEEDBACK + Fully Standardized CSV Integration (with newline fix)
saveFeedback: async (from, user) => {
  try {
    user.feedback.phone = from;
    user.feedback.createdAt = new Date();

    const saved = await Feedback.create(user.feedback);
    console.log('\n📝 Feedback Saved:', saved);

    // --- Define Report Paths ---
    const { REPORTS_DIR, DAYWISE_CSV, SITEWISE_CSV } = require('../config/paths');
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    // --- Extract Required Fields ---
    const createdAtISO = saved.createdAt.toISOString();
    const today = createdAtISO.split('T')[0];
    const { sitename, category, resolved } = saved;
    const feedbackId = saved._id.toString();

    // --- Get Site Metadata ---
    const siteDoc = await SitenameModel.findOne({ name: sitename });
    const siteCode = siteDoc ? siteDoc.siteCode : 'N/A';

    // ====================================================
    // 1️⃣  APPEND TO DAYWISE CSV  (append-only per feedback)
    // ====================================================
    const dayHeaders = [
      'feedback_id',
      'createdAt',
      'date',
      'site code',
      'name',
      'category',
      'resolved',
      'resolvedAt',
      'time_to_resolve_hrs',
    ];

    // Ensure CSV file exists with headers
    if (!fs.existsSync(DAYWISE_CSV)) {
      fs.writeFileSync(DAYWISE_CSV, dayHeaders.join(',') + '\n', 'utf8');
    }

    // --- Build new row ---
    const newDayRow = [
      feedbackId,
      createdAtISO,
      today,
      siteCode,
      sitename,
      category,
      resolved ? 'Yes' : 'No',
      '', // resolvedAt
      '', // time_to_resolve_hrs
    ].join(',');

    // ✅ Fix: ensure newline before appending if last line doesn’t end with \n
    try {
      let needsNewline = true;
      const stats = fs.statSync(DAYWISE_CSV);
      if (stats.size > 0) {
        const fd = fs.openSync(DAYWISE_CSV, 'r');
        const buffer = Buffer.alloc(1);
        fs.readSync(fd, buffer, 0, 1, stats.size - 1);
        fs.closeSync(fd);
        if (buffer.toString() === '\n') needsNewline = false;
      }
      fs.appendFileSync(DAYWISE_CSV, (needsNewline ? '\n' : '') + newDayRow + '\n', 'utf8');
    } catch (err) {
      fs.appendFileSync(DAYWISE_CSV, newDayRow + '\n', 'utf8');
    }

    console.log('✅ Daywise CSV appended successfully (newline safe).');

    // ====================================================
    // 2️⃣  UPDATE SITEWISE CSV (aggregate per site)
    // ====================================================
    const siteHeaders = [
      'date', 'site code', 'name', 'feedback_ids',
      'safety_compliance_raised', 'design_conflicts_raised', 'resource_blockers_raised',
      'workflow_issues_raised', 'miscellaneous_raised',
      'safety_compliance_solved', 'design_conflicts_solved', 'resource_blockers_solved',
      'workflow_issues_solved', 'miscellaneous_solved',
      'total_raised', 'total_solved', 'total_pending',
    ];

    // Ensure CSV exists with headers
    if (!fs.existsSync(SITEWISE_CSV)) {
      fs.writeFileSync(SITEWISE_CSV, siteHeaders.join(',') + '\n', 'utf8');
    }

    // Parse CSV
    const csvData = fs.readFileSync(SITEWISE_CSV, 'utf8').trim().split('\n');
    const siteRows = csvData.length > 1 ? csvData.slice(1).map(line => line.split(',')) : [];
    const headerIndex = Object.fromEntries(siteHeaders.map((h, i) => [h, i]));

    // Find or create site row (match by both date AND site name)
    let siteRow = siteRows.find(r => 
      r[headerIndex['date']] === today && r[headerIndex['name']] === sitename
    );

    if (!siteRow) {
      // Create new site row with default values
      siteRow = Array(siteHeaders.length).fill('0');
      siteRow[headerIndex['date']] = today;
      siteRow[headerIndex['site code']] = siteCode;
      siteRow[headerIndex['name']] = sitename;
      siteRow[headerIndex['feedback_ids']] = feedbackId;
      siteRows.push(siteRow);
    } else {
      // Add feedback ID to list if missing
      const ids = siteRow[headerIndex['feedback_ids']]?.split('|').filter(Boolean) || [];
      if (!ids.includes(feedbackId)) {
        ids.push(feedbackId);
        siteRow[headerIndex['feedback_ids']] = ids.join('|');
      }
    }

    // --- Increment counts ---
    const raisedKey = `${category}_raised`;
    const solvedKey = `${category}_solved`;

    if (headerIndex[raisedKey] !== undefined) {
      siteRow[headerIndex[raisedKey]] = String(
        (parseInt(siteRow[headerIndex[raisedKey]]) || 0) + 1
      );
    }

    if (resolved && headerIndex[solvedKey] !== undefined) {
      siteRow[headerIndex[solvedKey]] = String(
        (parseInt(siteRow[headerIndex[solvedKey]]) || 0) + 1
      );
    }

    // --- Recalculate totals ---
    const raisedCols = siteHeaders.filter(h => h.endsWith('_raised'));
    const solvedCols = siteHeaders.filter(h => h.endsWith('_solved'));

    const totalRaised = raisedCols.reduce(
      (sum, key) => sum + (parseInt(siteRow[headerIndex[key]]) || 0),
      0
    );
    const totalSolved = solvedCols.reduce(
      (sum, key) => sum + (parseInt(siteRow[headerIndex[key]]) || 0),
      0
    );

    siteRow[headerIndex['total_raised']] = totalRaised.toString();
    siteRow[headerIndex['total_solved']] = totalSolved.toString();
    siteRow[headerIndex['total_pending']] = (totalRaised - totalSolved).toString();

    // --- Write updated CSV back ---
    const updatedCsv = [siteHeaders.join(',')]
      .concat(siteRows.map(r => r.join(',')))
      .join('\n')
      .trim() + '\n';

    fs.writeFileSync(SITEWISE_CSV, updatedCsv, 'utf8');
    console.log('✅ Sitewise CSV updated successfully.');

    // --- Send confirmation ---
    await sendText(from, '🙏 Thank you! Your feedback has been saved successfully.');

    delete userStates[from];
  } catch (err) {
    console.error('❌ saveFeedback error:', err);
    await sendText(from, '⚠️ Error saving feedback. Please try again later.');
  }
}






};

// -------------------- Main Webhook --------------------
exports.receiveWhatsAppMessage = async (req, res) => {
  try {
    console.log('📩 Incoming Payload:', JSON.stringify(req.body, null, 2));
    res.sendStatus(200);

    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msgObj = entry?.messages?.[0];
    if (!msgObj) return;

    const msgId = msgObj.id;
    const from = msgObj.from;
    const msgType = msgObj.type;
    let text = msgObj.text?.body?.trim();

    if (msgType === 'interactive' && msgObj.interactive?.type === 'list_reply') {
      text = msgObj.interactive.list_reply.id;
    }

    if (!msgId) {
      console.log('⚠️ Missing msgId — skipping.');
      return;
    }

    if (processedMessages.has(msgId)) return;
    processedMessages.add(msgId);
    setTimeout(() => processedMessages.delete(msgId), 2 * 60 * 1000);

    if (!userStates[from]) userStates[from] = { step: null, feedback: {} };
    const user = userStates[from];

    if (!user.step && text?.toLowerCase() === 'hi') {
      user.step = 'askName';
      return sendText(from, '👋 Hi! Please enter your *name* to start:');
    }

    if (!user.step) return sendText(from, '⚠️ Please type "Hi" to start.');

    const stepHandler = steps[user.step];
    if (stepHandler) await stepHandler(from, user, msgObj, text);
    else {
      await sendText(from, '⚠️ Restarting flow. Please type "Hi".');
      delete userStates[from];
    }
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
  }
};
