const axios = require('axios');

const GRAPH_API = 'https://graph.facebook.com/v22.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Normalize phone number: if 10 digits, prepend 91 (India).
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.length === 10) p = '91' + p;
  return p;
}

/**
 * Send a WhatsApp template message.
 */
async function sendTemplateMessage(to, templateName, langCode, components) {
  try {
    const phone = normalizePhone(to);
    if (!phone || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.warn('⚠️ WhatsApp not configured or invalid phone:', { phone, hasToken: !!ACCESS_TOKEN, hasPhoneId: !!PHONE_NUMBER_ID });
      return null;
    }

    const res = await axios.post(
      `${GRAPH_API}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: langCode },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Template "${templateName}" sent to ${phone}:`, res.data);
    return res.data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error(`❌ Template "${templateName}" send failed:`, errData);
    // Fall back to plain text if template fails
    return null;
  }
}

/**
 * Send a plain text WhatsApp message.
 */
async function sendTextMessage(to, body) {
  try {
    const phone = normalizePhone(to);
    if (!phone || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.warn('⚠️ WhatsApp not configured or invalid phone');
      return null;
    }

    const res = await axios.post(
      `${GRAPH_API}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Text message sent to ${phone}`);
    return res.data;
  } catch (err) {
    console.error('❌ Text message send failed:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Send assignment notification. Fire-and-forget.
 */
async function sendAssignmentNotification(phone, { username, siteName, category, remarks, assignmentId }) {
  const deepLink = `${FRONTEND_URL}/assignedjobs?highlight=${assignmentId}`;

  // Try template first (3 body params: username, siteName, category)
  const result = await sendTemplateMessage(phone, 'foresites_snag_assigned', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: username || 'Team member' },
        { type: 'text', text: siteName || 'your site' },
        { type: 'text', text: category || 'General' },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: assignmentId }],
    },
  ]);

  // Fallback to plain text if template fails
  if (!result) {
    const text = `Hello ${username || 'Team member'}, you've been assigned a new snag at ${siteName || 'your site'}.\n\nCategory: ${category || 'General'}\n${remarks ? `Notes: ${remarks}\n` : ''}\nView your job: ${deepLink}`;
    await sendTextMessage(phone, text);
  }
}

/**
 * Send escalation notification. Fire-and-forget.
 */
async function sendEscalationNotification(phone, { username, siteName, remarks, assignmentId }) {
  const deepLink = `${FRONTEND_URL}/assignedjobs?highlight=${assignmentId}`;

  const result = await sendTemplateMessage(phone, 'foresites_snag_escalation', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: username || 'Team member' },
        { type: 'text', text: siteName || 'your site' },
        { type: 'text', text: remarks || 'This snag needs urgent attention.' },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: assignmentId }],
    },
  ]);

  if (!result) {
    const text = `Reminder ${username || 'Team member'}: your snag at ${siteName || 'your site'} needs urgent attention.\n\n${remarks ? `Remarks: ${remarks}\n` : ''}\nView your job: ${deepLink}`;
    await sendTextMessage(phone, text);
  }
}

/**
 * Send rejection notification. Fire-and-forget.
 */
async function sendRejectionNotification(phone, { username, siteName, rejectionRemarks, assignmentId }) {
  const deepLink = `${FRONTEND_URL}/assignedjobs?highlight=${assignmentId}`;

  const result = await sendTemplateMessage(phone, 'foresites_snag_rejected', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: username || 'Team member' },
        { type: 'text', text: siteName || 'your site' },
        { type: 'text', text: rejectionRemarks || 'Your proof was not sufficient.' },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: assignmentId }],
    },
  ]);

  if (!result) {
    const text = `${username || 'Team member'}, your proof for snag at ${siteName || 'your site'} was rejected.\n\nReason: ${rejectionRemarks || 'Not specified'}\nPlease resubmit.\n\nView your job: ${deepLink}`;
    await sendTextMessage(phone, text);
  }
}

/**
 * Send approval notification. Plain text only (no deep link needed).
 */
async function sendApprovalNotification(phone, { username, siteName }) {
  const result = await sendTemplateMessage(phone, 'foresites_snag_approved', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: username || 'Team member' },
        { type: 'text', text: siteName || 'your site' },
      ],
    },
  ]);

  if (!result) {
    const text = `${username || 'Team member'}, your resolution at ${siteName || 'your site'} has been approved and closed. Good work!`;
    await sendTextMessage(phone, text);
  }
}

module.exports = {
  sendTemplateMessage,
  sendTextMessage,
  sendAssignmentNotification,
  sendEscalationNotification,
  sendRejectionNotification,
  sendApprovalNotification,
  normalizePhone,
};
