const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const Feedback = require('../chatbot/Models/userfbschema');
const sitename = require('../chatbot/Models/sitename');
const passphrase = require('../chatbot/Models/passphrase');

const accessToken = '***REMOVED-META-WHATSAPP-TOKEN***';
const phone_number_id = '753635067842107';
const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

const userStates = {};
const processedMessages = new Set();

// -------------------- Helper Functions --------------------
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
    // WhatsApp list title limit = 24 chars
    const cleanOptions = options.map(o => ({
      id: o.id,
      title: o.title.substring(0, 24)
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: header.substring(0, 24) },
        body: { text: body },
        action: { button: 'Select', sections: [{ title: 'Choose One', rows: cleanOptions }] }
      }
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

// 📥 DOWNLOAD MEDIA (voice/image) AND SAVE LOCALLY
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
      responseType: 'arraybuffer'
    });

    const contentType = mediaRes.headers['content-type'] || 'application/octet-stream';
    const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
    const dir = path.join(__dirname, '../uploads', folderName);
    await fsPromises.mkdir(dir, { recursive: true });

    // 🕒 Create filename with date + name
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = userName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${dateStr}_${safeName}.${ext}`;
    const filePath = path.join(dir, filename);

    await fsPromises.writeFile(filePath, mediaRes.data);
    console.log(`✅ Saved ${folderName}: ${filePath}`);

    // return relative path for frontend use
    return `/uploads/${folderName}/${filename}`;
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
    const sites = await sitename.find({}).limit(20).lean();
    const opts = sites.length
      ? sites.map(s => ({ id: s.name, title: s.name }))
      : [{ id: 'Site Alpha', title: 'Site Alpha' }];
    await sendList(from, 'Site Name', 'Please choose your site name:', opts);
  },

  askSite: async (from, user, msgObj, text) => {
    const site = await sitename.findOne({ name: { $regex: `^${text}$`, $options: 'i' } });
    if (!site) return sendText(from, `⚠️ Site "${text}" not found. Try again.`);

    user.feedback.sitename = site.name;
    user.step = 'askPassphrase';
    await sendText(from, `✅ Site verified: *${site.name}*\nEnter your passphrase:`);
  },

  askPassphrase: async (from, user, msgObj, text) => {
    const code = await passphrase.findOne({
      code: { $regex: `^${text}$`, $options: 'i' },
      site: { $regex: `^${user.feedback.sitename}$`, $options: 'i' }
    });

    if (!code) return sendText(from, '❌ Invalid passphrase. Try again.');
    user.feedback.code = code.code || text;
    await steps.askCategory(from, user, msgObj, text);
  },

  askCategory: async (from, user) => {
    const categories = [
      { id: 'safety_compliance', title: 'Safety&Compliance' },
      { id: 'design_conflicts', title: 'Design' },
      { id: 'resource_blockers', title: 'Resources' },
      { id: 'workflow_issues', title: 'Workflow' },
      { id: 'miscellaneous', title: 'Other' }
    ];
    await sendList(from, 'Category', 'Select issue category:', categories);
    user.step = 'awaitCategory';
  },

  awaitCategory: async (from, user, msgObj, text) => {
    user.feedback.category = text;
    user.step = 'chooseFeedbackType';
    await sendList(from, 'Feedback Type', 'Choose how to give feedback:', [
      { id: 'voice', title: '🎙️ Voice' },
      { id: 'text', title: '✍️ Text' }
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
    const mediaId =
      msgObj.audio?.id || msgObj.voice?.id || msgObj.audio_message?.id;
    if (!mediaId) return sendText(from, '⚠️ No audio found. Please resend.');

    const localPath = await downloadMedia(mediaId, 'voice', user.feedback.name || 'user');
    user.feedback.voice_url = localPath;
    user.step = 'askImage';
    await sendList(from, 'Upload Image', 'Would you like to attach an image?', [
      { id: 'yes', title: 'Yes' },
      { id: 'no', title: 'No' }
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
      { id: 'no', title: 'No' }
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

  saveFeedback: async (from, user) => {
    try {
      user.feedback.phone = from;
      user.feedback.createdAt = new Date();

      const saved = await Feedback.create(user.feedback);
      console.log('\n📝 Feedback Saved:', saved);

      await sendText(from, '🙏 Thank you! Your feedback was saved successfully.');
      delete userStates[from];
    } catch (err) {
      console.error('❌ saveFeedback error:', err.message);
      await sendText(from, '⚠️ Error saving feedback. Try again later.');
    }
  }
};

// -------------------- Main Webhook --------------------
exports.receiveWhatsAppMessage = async (req, res) => {
  try {
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
