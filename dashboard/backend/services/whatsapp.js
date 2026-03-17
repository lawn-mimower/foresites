const axios = require('axios');

const GRAPH_API = 'https://graph.facebook.com/v22.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Helpers ──

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.length === 10) p = '91' + p;
  return p;
}

function formatSnagId(id) {
  if (!id) return 'SNG-????';
  const str = String(id);
  if (str.length > 8) {
    const num = parseInt(str.replace(/-/g, '').slice(-6), 16) % 10000;
    return `SNG-${String(num).padStart(4, '0')}`;
  }
  return `SNG-${String(id).padStart(4, '0')}`;
}

function formatCategory(category) {
  if (!category) return 'Uncategorized';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatPriority(priority) {
  if (!priority) return 'Medium';
  const map = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
  return map[priority.toLowerCase()] || priority;
}

function priorityEmoji(priority) {
  if (!priority) return '🔵';
  const map = { low: '⚪', medium: '🔵', high: '🟡', urgent: '🔴' };
  return map[priority.toLowerCase()] || '🔵';
}

function assignerLabel(ctx) {
  const parts = [ctx.assignerDesignation, ctx.assignerName].filter(Boolean);
  return parts.join(' ') || 'Management';
}

// ── Low-level senders ──

/**
 * Send a WhatsApp template message with body params and optional URL button.
 */
async function sendTemplateMessage(to, templateName, bodyParams, buttonParam) {
  try {
    const phone = normalizePhone(to);
    if (!phone || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.warn('⚠️ WhatsApp not configured or invalid phone:', { phone, hasToken: !!ACCESS_TOKEN, hasPhoneId: !!PHONE_NUMBER_ID });
      return null;
    }

    const components = [
      {
        type: 'body',
        parameters: bodyParams.map(text => ({ type: 'text', text })),
      },
    ];

    if (buttonParam) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: buttonParam }],
      });
    }

    const res = await axios.post(
      `${GRAPH_API}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
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
    return null;
  }
}

/**
 * Send a plain text WhatsApp message (fallback).
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

// ── Fallback message builders (plain text when template fails) ──

function buildAssignmentFallback(ctx) {
  const assigner = `*${assignerLabel(ctx)}*`;
  const snagId = formatSnagId(ctx.snagDbId);
  const pLabel = `${priorityEmoji(ctx.priority)} ${formatPriority(ctx.priority)}`;
  const category = formatCategory(ctx.category);
  let msg = `*ForeSites – SNAG ASSIGNED!*\n\nHi ${ctx.username}, a new snag has been assigned to you by ${assigner}.\n\n*Snag ID:* ${snagId}\n*Priority:* ${pLabel}\n*Issue:* ${ctx.feedback || 'No description'}\n*Location:* ${ctx.siteName || 'N/A'}\n*Category:* ${category}`;
  if (ctx.remarks) msg += `\n\n*Remarks by ${assigner}:*\n"${ctx.remarks}"`;
  msg += `\n\n_ForeSites by OMNIFEED_`;
  return msg;
}

function buildRejectionFallback(ctx) {
  const assigner = `*${assignerLabel(ctx)}*`;
  const snagId = formatSnagId(ctx.snagDbId);
  const pLabel = `${priorityEmoji(ctx.priority)} ${formatPriority(ctx.priority)}`;
  const category = formatCategory(ctx.category);
  return `*ForeSites – SNAG REJECTED*\n\nHi ${ctx.username}, your work on the following snag has been sent back for rework.\n\n*Snag ID:* ${snagId}\n*Priority:* ${pLabel}\n*Location:* ${ctx.siteName || 'N/A'}\n*Category:* ${category}\n\n*Rejection Remarks by ${assigner}:*\n"${ctx.rejectionRemarks || 'No remarks provided'}"\n\nThis is rejection #${ctx.rejectionCount} for this snag.\nPlease address the remarks and resubmit.\n\n_ForeSites by OMNIFEED_`;
}

function buildEscalationFallback(ctx) {
  const assigner = `*${assignerLabel(ctx)}*`;
  const snagId = formatSnagId(ctx.snagDbId);
  const pLabel = `${priorityEmoji(ctx.priority)} ${formatPriority(ctx.priority)}`;
  const category = formatCategory(ctx.category);
  const remarks = ctx.escalationRemarks || ctx.remarks;
  let msg = `*ForeSites – SNAG ESCALATED* ⚠️\n\nHi ${ctx.username}, the following snag has been escalated by ${assigner}.\n\n*Snag ID:* ${snagId}\n*Priority:* ${pLabel}\n*Location:* ${ctx.siteName || 'N/A'}\n*Category:* ${category}`;
  if (remarks) msg += `\n\n*Escalation Remarks:*\n"${remarks}"`;
  msg += `\n\n_Immediate attention required._\n\n_ForeSites by OMNIFEED_`;
  return msg;
}

function buildClosureFallback(ctx) {
  const snagId = formatSnagId(ctx.snagDbId);
  const category = formatCategory(ctx.category);
  return `*ForeSites – SNAG CLOSED* ✅\n\nHi ${ctx.username}, your work on the following snag has been approved and closed.\n\n*Snag ID:* ${snagId}\n*Location:* ${ctx.siteName || 'N/A'}\n*Category:* ${category}\n\n_Great work — snag resolved successfully._\n\n_ForeSites by OMNIFEED_`;
}

// ── Public notification functions ──
// Each: try template first → fallback to plain text if template fails/pending

/**
 * Assignment: template "foresites_snag_assign"
 * Body params: {{1}}=name, {{2}}=assigner, {{3}}=snagId, {{4}}=priority,
 *              {{5}}=issue, {{6}}=location, {{7}}=category, {{8}}=remarks
 * Button param: {{1}}=snagId (for URL suffix)
 */
async function sendAssignmentNotification(phone, ctx) {
  const assigner = assignerLabel(ctx);
  const snagId = formatSnagId(ctx.snagDbId);
  const pLabel = `${priorityEmoji(ctx.priority)} ${formatPriority(ctx.priority)}`;
  const category = formatCategory(ctx.category);
  const remarksBlock = ctx.remarks
    ? `Remarks by *${assigner}*:\n"${ctx.remarks}"`
    : '—';

  const result = await sendTemplateMessage(phone, 'foresites_snag_assigned', [
    ctx.username || 'Team member',     // {{1}}
    assigner,                           // {{2}}
    snagId,                             // {{3}}
    pLabel,                             // {{4}}
    ctx.feedback || 'No description',   // {{5}}
    ctx.siteName || 'N/A',             // {{6}}
    category,                           // {{7}}
    remarksBlock,                       // {{8}}
  ], ctx.snagId);

  if (!result) {
    await sendTextMessage(phone, buildAssignmentFallback(ctx));
  }
}

/**
 * Rejection: template "foresites_snag_rejected"
 * Body params: {{1}}=name, {{2}}=snagId, {{3}}=priority, {{4}}=location,
 *              {{5}}=category, {{6}}=assigner, {{7}}=rejectionRemarks, {{8}}=count
 * Button param: {{1}}=snagId
 */
async function sendRejectionNotification(phone, ctx) {
  const assigner = `*${assignerLabel(ctx)}*`;
  const snagId = formatSnagId(ctx.snagDbId);
  const pLabel = `${priorityEmoji(ctx.priority)} ${formatPriority(ctx.priority)}`;
  const category = formatCategory(ctx.category);

  const result = await sendTemplateMessage(phone, 'foresites_snag_rejected', [
    ctx.username || 'Team member',                  // {{1}}
    snagId,                                          // {{2}}
    pLabel,                                          // {{3}}
    ctx.siteName || 'N/A',                          // {{4}}
    category,                                        // {{5}}
    assigner,                                        // {{6}}
    ctx.rejectionRemarks || 'No remarks provided',  // {{7}}
    String(ctx.rejectionCount || 1),                // {{8}}
  ], ctx.snagId);

  if (!result) {
    await sendTextMessage(phone, buildRejectionFallback(ctx));
  }
}

/**
 * Escalation: template "foresites_snag_escalation"
 * Body params: {{1}}=name, {{2}}=assigner, {{3}}=snagId, {{4}}=priority,
 *              {{5}}=location, {{6}}=category, {{7}}=remarks
 * Button param: {{1}}=snagId
 */
async function sendEscalationNotification(phone, ctx) {
  const assigner = assignerLabel(ctx);
  const snagId = formatSnagId(ctx.snagDbId);
  const pLabel = `${priorityEmoji(ctx.priority)} ${formatPriority(ctx.priority)}`;
  const category = formatCategory(ctx.category);
  const remarks = ctx.escalationRemarks || ctx.remarks;
  const remarksBlock = remarks
    ? `Escalation Remarks:\n"${remarks}"`
    : '—';

  const result = await sendTemplateMessage(phone, 'foresites_snag_escalation', [
    ctx.username || 'Team member',  // {{1}}
    assigner,                        // {{2}}
    snagId,                          // {{3}}
    pLabel,                          // {{4}}
    ctx.siteName || 'N/A',          // {{5}}
    category,                        // {{6}}
    remarksBlock,                    // {{7}}
  ], ctx.snagId);

  if (!result) {
    await sendTextMessage(phone, buildEscalationFallback(ctx));
  }
}

/**
 * Closure/Approval: template "foresites_snag_approved"
 * Body params: {{1}}=name, {{2}}=snagId, {{3}}=location, {{4}}=category
 * Button param: {{1}}=snagId
 */
async function sendApprovalNotification(phone, ctx) {
  const snagId = formatSnagId(ctx.snagDbId);
  const category = formatCategory(ctx.category);

  const result = await sendTemplateMessage(phone, 'foresites_snag_approved', [
    ctx.username || 'Team member',  // {{1}}
    snagId,                          // {{2}}
    ctx.siteName || 'N/A',          // {{3}}
    category,                        // {{4}}
  ], ctx.snagId);

  if (!result) {
    await sendTextMessage(phone, buildClosureFallback(ctx));
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
