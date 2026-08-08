/**
 * One-time script to create WhatsApp message templates on WABA.
 *
 * Usage: node scripts/createTemplates.js
 *
 * Requires env vars: WHATSAPP_ACCESS_TOKEN, WHATSAPP_WABA_ID, FRONTEND_URL
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const WABA_ID = process.env.WHATSAPP_WABA_ID || '893861906425835';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!ACCESS_TOKEN) {
  console.error('❌ WHATSAPP_ACCESS_TOKEN not set in .env');
  process.exit(1);
}

// URL button used by all templates. The {{1}} suffix is the snag id, filled in
// at send time by whatsapp.js (button param). Meta wants the example as the full URL.
const viewJobButton = () => ({
  type: 'BUTTONS',
  buttons: [
    {
      type: 'URL',
      text: 'View Job',
      url: `${FRONTEND_URL}/assignedjobs?highlight={{1}}`,
      example: [`${FRONTEND_URL}/assignedjobs?highlight=test-assignment-id`],
    },
  ],
});

const FOOTER = { type: 'FOOTER', text: 'ForeSites by OMNIFEED' };

// NOTE: body text + variable order/count below must stay in lockstep with the
// bodyParams arrays in dashboard/backend/services/whatsapp.js. If you reorder a
// variable here, live notifications will fill the wrong slots.
const TEMPLATES = [
  // whatsapp.js → sendAssignmentNotification
  // {{1}}=name {{2}}=assigner {{3}}=snagId {{4}}=priority {{5}}=issue
  // {{6}}=location {{7}}=category {{8}}=remarks block
  {
    name: 'foresites_snag_assigned',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'ForeSites – SNAG ASSIGNED!' },
      {
        type: 'BODY',
        text:
          'Hi {{1}}, a new snag has been assigned to you by {{2}}.\n\n' +
          'Snag ID: {{3}}\n' +
          'Priority: {{4}}\n' +
          'Issue: {{5}}\n' +
          'Location: {{6}}\n' +
          'Category: {{7}}\n\n' +
          '{{8}}',
        example: {
          body_text: [[
            'Mihir',
            'System Administrator superadmin',
            'SNG-7797',
            '🔴 Urgent',
            'Cement not received',
            'Cedar Complex',
            'Workflow Issues',
            'Remarks by System Administrator superadmin: "Get appropriate cement from supplier Subhash"',
          ]],
        },
      },
      FOOTER,
      viewJobButton(),
    ],
  },
  // whatsapp.js → sendEscalationNotification
  // {{1}}=name {{2}}=assigner {{3}}=snagId {{4}}=priority
  // {{5}}=location {{6}}=category {{7}}=escalation remarks block
  {
    name: 'foresites_snag_escalation',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'ForeSites – SNAG ESCALATED! ⚠️' },
      {
        type: 'BODY',
        text:
          'Hi {{1}}, the following snag has been escalated by {{2}}.\n\n' +
          'Snag ID: {{3}}\n' +
          'Priority: {{4}}\n' +
          'Location: {{5}}\n' +
          'Category: {{6}}\n\n' +
          '{{7}}\n\n' +
          'Immediate attention required.',
        example: {
          body_text: [[
            'Mihir',
            'System Administrator superadmin',
            'SNG-7797',
            '🔴 Urgent',
            'Cedar Complex',
            'Workflow Issues',
            'Escalation Remarks: "Overdue by 3 days"',
          ]],
        },
      },
      FOOTER,
      viewJobButton(),
    ],
  },
  // whatsapp.js → sendRejectionNotification
  // {{1}}=name {{2}}=snagId {{3}}=priority {{4}}=location
  // {{5}}=category {{6}}=assigner {{7}}=rejection remarks {{8}}=rejection count
  {
    name: 'foresites_snag_rejected',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'ForeSites – SNAG REJECTED' },
      {
        type: 'BODY',
        text:
          'Hi {{1}}, your work on the following snag has been sent back for rework.\n\n' +
          'Snag ID: {{2}}\n' +
          'Priority: {{3}}\n' +
          'Location: {{4}}\n' +
          'Category: {{5}}\n\n' +
          'Rejection Remarks by {{6}}: "{{7}}"\n\n' +
          'This is rejection #{{8}} for this snag. Please address the remarks and resubmit.',
        example: {
          body_text: [[
            'Mihir',
            'SNG-7797',
            '🔴 Urgent',
            'Cedar Complex',
            'Workflow Issues',
            'System Administrator superadmin',
            'Insufficient evidence provided',
            '2',
          ]],
        },
      },
      FOOTER,
      viewJobButton(),
    ],
  },
  // whatsapp.js → sendApprovalNotification
  // {{1}}=name {{2}}=snagId {{3}}=location {{4}}=category
  {
    name: 'foresites_snag_approved',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'ForeSites – SNAG CLOSED! ✅' },
      {
        type: 'BODY',
        text:
          'Hi {{1}}, your work on the following snag has been approved and closed.\n\n' +
          'Snag ID: {{2}}\n' +
          'Location: {{3}}\n' +
          'Category: {{4}}\n\n' +
          'Great work — snag resolved successfully.',
        example: {
          body_text: [['Mihir', 'SNG-7797', 'Cedar Complex', 'Workflow Issues']],
        },
      },
      FOOTER,
      viewJobButton(),
    ],
  },
];

async function deleteTemplate(name) {
  try {
    await axios.delete(
      `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { name },
      }
    );
    console.log(`🗑️  Deleted existing template "${name}"`);
  } catch (err) {
    const errData = err.response?.data?.error || err.message;
    // Ignore if template doesn't exist
    if (errData?.code === 100 && errData?.error_subcode === 2388049) {
      console.log(`ℹ️  Template "${name}" does not exist — nothing to delete.`);
    } else {
      console.warn(`⚠️  Could not delete "${name}":`, errData?.message || errData);
    }
  }
}

async function createTemplate(template) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates`,
      template,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Created template "${template.name}":`, res.data);
  } catch (err) {
    const errData = err.response?.data?.error || err.message;
    if (errData?.error_subcode === 2388024) {
      console.log(`ℹ️  Template "${template.name}" already exists with this language.`);
    } else {
      console.error(`❌ Failed to create "${template.name}":`, errData);
    }
  }
}

const DELETE_FIRST = process.argv.includes('--delete');

(async () => {
  console.log(`Creating templates on WABA ${WABA_ID}...`);
  if (DELETE_FIRST) console.log('(--delete flag: deleting existing templates first)\n');
  else console.log('(pass --delete to remove & recreate existing templates)\n');

  if (DELETE_FIRST) {
    for (const t of TEMPLATES) {
      await deleteTemplate(t.name);
    }
    console.log('\nWaiting 60 seconds for Meta to finish deletions...\n');
    await new Promise(r => setTimeout(r, 60000));
  }

  for (const t of TEMPLATES) {
    await createTemplate(t);
  }
  console.log('\nDone.');
})();
