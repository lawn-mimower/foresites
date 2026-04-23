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

const TEMPLATES = [
  {
    name: 'foresites_snag_assigned',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Foresites Snag Alert: Hello {{1}}, a new snag has been assigned to you at site {{2}} under the {{3}} category. Please review the details and take the necessary action at the earliest.',
        example: { body_text: [['Pratik', 'Lodha Palava', 'Safety Compliance']] },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Job',
            url: `${FRONTEND_URL}/assignedjobs?highlight={{1}}`,
            example: ['test-assignment-id'],
          },
        ],
      },
    ],
  },
  {
    name: 'foresites_snag_escalation',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Foresites Escalation: Hello {{1}}, your assigned snag at site {{2}} requires urgent attention and has been escalated. Reason: {{3}}. Please address this as a priority.',
        example: { body_text: [['Pratik', 'Lodha Palava', 'Overdue by 3 days']] },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Job',
            url: `${FRONTEND_URL}/assignedjobs?highlight={{1}}`,
            example: ['test-assignment-id'],
          },
        ],
      },
    ],
  },
  {
    name: 'foresites_snag_rejected',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Foresites Review Update: Hello {{1}}, your submitted proof for the snag at site {{2}} has been reviewed and rejected. Reason: {{3}}. Please resubmit with the required corrections.',
        example: { body_text: [['Pratik', 'Lodha Palava', 'Insufficient evidence provided']] },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Job',
            url: `${FRONTEND_URL}/assignedjobs?highlight={{1}}`,
            example: ['test-assignment-id'],
          },
        ],
      },
    ],
  },
  {
    name: 'foresites_snag_approved',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Foresites Resolution Confirmed: Hello {{1}}, your resolution for the snag at site {{2}} has been reviewed, approved, and marked as closed. Great work on getting this resolved!',
        example: { body_text: [['Pratik', 'Lodha Palava']] },
      },
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
