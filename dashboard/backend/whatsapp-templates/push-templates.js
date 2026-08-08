/**
 * Creates (or reports) the ForeSites templates on Meta from definitions.js.
 *
 *   node push-templates.js            # push all
 *   node push-templates.js --dry-run  # print payloads, send nothing
 *   node push-templates.js --only foresites_snag_approved
 *
 * Reads WHATSAPP_WABA_ID + WHATSAPP_ACCESS_TOKEN from ../.env
 * Set TEMPLATE_VIEW_JOB_BASE to a public https URL for the View Job button.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const { templates, VIEW_JOB_BASE } = require('./definitions');

const GRAPH_API = 'https://graph.facebook.com/v22.0';
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

function preflight() {
  const problems = [];
  if (!WABA_ID) problems.push('WHATSAPP_WABA_ID missing from .env');
  if (!TOKEN) problems.push('WHATSAPP_ACCESS_TOKEN missing from .env');
  if (/REPLACE_ME|^http:\/\//.test(VIEW_JOB_BASE)) {
    problems.push(
      `View Job URL "${VIEW_JOB_BASE}" is not a public https URL — Meta will reject the button.\n` +
      '     Fix: TEMPLATE_VIEW_JOB_BASE=https://your-domain/assignedjobs node push-templates.js'
    );
  }
  return problems;
}

async function pushOne(tpl) {
  const payload = {
    name: tpl.name,
    language: tpl.language,
    category: tpl.category,
    components: tpl.components,
  };

  if (dryRun) {
    console.log(`\n── ${tpl.name} (dry-run) ──`);
    console.log(JSON.stringify(payload, null, 2));
    return { name: tpl.name, status: 'dry-run' };
  }

  try {
    const res = await axios.post(
      `${GRAPH_API}/${WABA_ID}/message_templates`,
      payload,
      { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ ${tpl.name.padEnd(30)} → id=${res.data.id} status=${res.data.status}`);
    return { name: tpl.name, status: res.data.status, id: res.data.id };
  } catch (err) {
    const e = err.response?.data?.error;
    // 100 / "already exists" → not fatal, just report
    console.error(`❌ ${tpl.name.padEnd(30)} → ${e?.message || err.message}`);
    return { name: tpl.name, status: 'error', error: e?.message || err.message };
  }
}

(async () => {
  const problems = preflight();
  if (dryRun && problems.length) {
    console.log('⚠️ Preflight notes (ignored for dry-run):');
    problems.forEach(p => console.log('  •', p));
    console.log('');
  } else if (problems.length && !(force && problems.every(p => p.includes('View Job')))) {
    console.error('Preflight failed:');
    problems.forEach(p => console.error('  •', p));
    if (problems.some(p => p.includes('View Job')))
      console.error('\n(Use --force to push anyway, e.g. to test non-button templates.)');
    process.exit(1);
  }

  let list = templates;
  if (only) {
    list = templates.filter(t => t.name === only);
    if (!list.length) { console.error(`No template named "${only}"`); process.exit(1); }
  }

  console.log(`${dryRun ? 'DRY-RUN' : 'Pushing'} ${list.length} template(s) to WABA ${WABA_ID || '(none)'}\n`);
  const results = [];
  for (const tpl of list) results.push(await pushOne(tpl));

  console.log('\n── Summary ──');
  results.forEach(r => console.log(`  ${r.name.padEnd(30)} ${r.status}`));
  const failed = results.filter(r => r.status === 'error').length;
  process.exit(failed ? 1 : 0);
})();
