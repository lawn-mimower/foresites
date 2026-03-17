#!/usr/bin/env node
/**
 * WhatsApp Closure Notification Test Script
 *
 * Tests the notification pipeline at three layers:
 *   1. Direct WhatsApp API call via sendApprovalNotification()
 *   2. POST /api/snag-assignments/notify endpoint
 *   3. DB phone_number format validation
 *
 * Usage:
 *   node scripts/testClosureNotification.js [--token <JWT>]
 *
 * Does NOT close any snag — only tests the notification path.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { sendApprovalNotification, normalizePhone } = require('../services/whatsapp');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_BASE = process.env.API_BASE || 'http://localhost:9999/api';

// Parse CLI args for --token
const args = process.argv.slice(2);
const tokenIdx = args.indexOf('--token');
const cliToken = tokenIdx !== -1 ? args[tokenIdx + 1] : null;

function pass(label) { console.log(`  \x1b[32mPASS\x1b[0m ${label}`); }
function fail(label, reason) { console.log(`  \x1b[31mFAIL\x1b[0m ${label} — ${reason}`); }
function info(label, detail) { console.log(`  \x1b[36mINFO\x1b[0m ${label}: ${detail}`); }

async function main() {
  console.log('\n=== WhatsApp Closure Notification Test ===\n');

  // ── Env check ──
  console.log('1. Environment check');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    fail('Supabase', 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }
  pass('Supabase config present');

  if (!WA_TOKEN) fail('WHATSAPP_ACCESS_TOKEN', 'not set');
  else pass('WHATSAPP_ACCESS_TOKEN present');

  if (!WA_PHONE_ID) fail('WHATSAPP_PHONE_NUMBER_ID', 'not set');
  else pass('WHATSAPP_PHONE_NUMBER_ID present');

  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.log('\n  Cannot proceed without WhatsApp credentials.\n');
    return;
  }

  // ── Find a test assignment with phone number ──
  console.log('\n2. Finding test assignment with phone number');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: testAssignment, error: assignErr } = await supabase
    .from('snag_assignment')
    .select(`
      assignment_id,
      snag_id,
      site_id,
      assigned_user:website_user!assigned_user_id(username, phone_number),
      site(site_name)
    `)
    .eq('is_active', true)
    .not('assigned_user.phone_number', 'is', null)
    .limit(1)
    .single();

  if (assignErr || !testAssignment) {
    fail('Query', 'No active assignment with a phone_number found');
    info('Hint', 'Ensure at least one assigned user has phone_number set in website_user');
    return;
  }

  const phone = testAssignment.assigned_user?.phone_number;
  const username = testAssignment.assigned_user?.username || 'Test User';
  const siteName = testAssignment.site?.site_name || 'Test Site';
  const assignmentId = testAssignment.assignment_id;

  info('Found', `${username} (phone: ${phone}) at ${siteName}`);
  info('Assignment ID', assignmentId);

  // ── Layer 3: DB phone format check ──
  console.log('\n3. Phone number format validation');
  const normalized = normalizePhone(phone);
  info('Raw phone', phone);
  info('Normalized', normalized);
  if (normalized && normalized.length >= 10) {
    pass('Phone normalization');
  } else {
    fail('Phone normalization', `Result "${normalized}" looks invalid`);
  }

  // ── Layer 1: Direct API test ──
  console.log('\n4. Direct WhatsApp API test (sendApprovalNotification)');
  try {
    const result = await sendApprovalNotification(phone, { username, siteName });
    if (result) {
      pass('Template message sent');
      info('Response', JSON.stringify(result));
    } else {
      info('Template failed', 'fell back to plain text (check logs above)');
      pass('Fallback text message attempted');
    }
  } catch (err) {
    fail('Direct send', err.message);
  }

  // ── Layer 2: Endpoint test ──
  console.log('\n5. Endpoint test (POST /api/snag-assignments/notify)');
  const jwtToken = cliToken || process.env.TEST_JWT_TOKEN;
  if (!jwtToken) {
    fail('Endpoint test', 'No JWT token provided. Use --token <JWT> or set TEST_JWT_TOKEN env var');
    info('Hint', 'Get a token by logging in via the dashboard, then copy from localStorage.authToken');
  } else {
    try {
      const res = await fetch(`${API_BASE}/snag-assignments/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ assignment_id: assignmentId, type: 'approve' }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        pass('Endpoint returned success');
        info('Response', JSON.stringify(body));
      } else {
        fail('Endpoint', `Status ${res.status}: ${JSON.stringify(body)}`);
      }
    } catch (err) {
      fail('Endpoint', err.message);
    }
  }

  console.log('\n=== Test Complete ===\n');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
