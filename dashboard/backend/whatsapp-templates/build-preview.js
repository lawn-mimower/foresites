/**
 * Renders definitions.js into a WhatsApp-accurate preview (preview.html).
 * Fills each {{n}} with its example value and applies WhatsApp text formatting,
 * so the bubble you see here is exactly what Meta will render.
 *
 *   node build-preview.js
 */
const fs = require('fs');
const path = require('path');
const { templates, LANGUAGE, CATEGORY, VIEW_JOB_BASE } = require('./definitions');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// WhatsApp inline formatting: *bold* _italic_ ~strike~ `mono`
function waFormat(text) {
  let t = esc(text);
  t = t.replace(/\*(.+?)\*/g, '<b>$1</b>');
  t = t.replace(/_(.+?)_/g, '<i>$1</i>');
  t = t.replace(/~(.+?)~/g, '<s>$1</s>');
  t = t.replace(/`(.+?)`/g, '<code>$1</code>');
  return t.replace(/\n/g, '<br>');
}

function fillBody(component) {
  const values = component.example.body_text[0];
  return component.text.replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1] ?? `{{${n}}}`);
}

function renderBubble(tpl) {
  const body = tpl.components.find(c => c.type === 'BODY');
  const buttons = tpl.components.find(c => c.type === 'BUTTONS');
  const filled = fillBody(body);
  const btnHtml = buttons
    ? buttons.buttons.map(b => `<div class="wa-btn"><span class="wa-btn-ico">↗</span>${esc(b.text)}</div>`).join('')
    : '';
  const rawEsc = esc(body.text);
  return `
  <article class="card">
    <header class="card-head">
      <div class="tname">${esc(tpl.name)}</div>
      <div class="tmeta"><span class="chip">${esc(tpl.category)}</span><span class="chip chip-ghost">${esc(tpl.language)}</span></div>
    </header>
    <div class="phone">
      <div class="bubble">
        <div class="bubble-body">${waFormat(filled)}</div>
        <div class="bubble-time">11:09 AM</div>
      </div>
      ${btnHtml}
    </div>
    <details class="raw">
      <summary>Raw template body (what Meta stores)</summary>
      <pre>${rawEsc}</pre>
    </details>
  </article>`;
}

const cards = templates.map(renderBubble).join('\n');
const publicUrlWarning = /REPLACE_ME|^http:\/\//.test(VIEW_JOB_BASE)
  ? `<div class="warn">⚠️ View Job button base is <code>${esc(VIEW_JOB_BASE)}</code> — Meta requires a public <b>https</b> URL. Set <code>TEMPLATE_VIEW_JOB_BASE</code> before pushing.</div>`
  : '';

const html = `<title>ForeSites WhatsApp Templates — Preview</title>
<style>
:root{
  --bg:#0d1117; --panel:#161b22; --ink:#e6edf3; --muted:#8b949e; --line:#30363d;
  --wa-bubble:#202c33; --wa-ink:#e9edef; --wa-time:#8696a0; --wa-wall:#0b141a;
  --accent:#25d366; --btn-ink:#53bdeb; --warn:#f0b429;
}
@media (prefers-color-scheme: light){
  :root{ --bg:#f2f3f5; --panel:#ffffff; --ink:#1c2126; --muted:#5b6570; --line:#d8dde3;
    --wa-bubble:#ffffff; --wa-ink:#111b21; --wa-time:#667781; --wa-wall:#e5ddd5; }
}
:root[data-theme="dark"]{ --bg:#0d1117; --panel:#161b22; --ink:#e6edf3; --muted:#8b949e; --line:#30363d;
  --wa-bubble:#202c33; --wa-ink:#e9edef; --wa-time:#8696a0; --wa-wall:#0b141a; }
:root[data-theme="light"]{ --bg:#f2f3f5; --panel:#ffffff; --ink:#1c2126; --muted:#5b6570; --line:#d8dde3;
  --wa-bubble:#ffffff; --wa-ink:#111b21; --wa-time:#667781; --wa-wall:#e5ddd5; }

*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  line-height:1.5;padding:32px 20px 64px;}
.wrap{max-width:960px;margin:0 auto;}
h1{font-size:1.4rem;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--muted);margin:0 0 24px;font-size:.9rem}
.warn{background:color-mix(in srgb,var(--warn) 14%,transparent);border:1px solid var(--warn);
  color:var(--ink);padding:10px 14px;border-radius:10px;margin:0 0 24px;font-size:.86rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.card-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;
  align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.tname{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;font-weight:600}
.tmeta{display:flex;gap:6px}
.chip{font-size:.66rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,transparent);
  color:var(--accent)}
.chip-ghost{background:transparent;border:1px solid var(--line);color:var(--muted)}
.phone{background:var(--wa-wall);padding:20px 16px;
  background-image:radial-gradient(color-mix(in srgb,var(--wa-ink) 4%,transparent) 1px,transparent 1px);
  background-size:22px 22px}
.bubble{background:var(--wa-bubble);color:var(--wa-ink);border-radius:10px;
  padding:8px 10px 6px;max-width:100%;box-shadow:0 1px 1px rgba(0,0,0,.16);
  position:relative;font-size:.9rem;word-wrap:break-word}
.bubble-body b{font-weight:700}
.bubble-body i{font-style:italic}
.bubble-body code{font-family:ui-monospace,Menlo,monospace;font-size:.85em}
.bubble-time{text-align:right;color:var(--wa-time);font-size:.66rem;margin-top:4px}
.wa-btn{background:var(--wa-bubble);color:var(--btn-ink);text-align:center;
  padding:9px;border-radius:10px;margin-top:8px;font-size:.9rem;font-weight:500;
  display:flex;align-items:center;justify-content:center;gap:6px;
  box-shadow:0 1px 1px rgba(0,0,0,.16)}
.wa-btn-ico{font-size:.9em;opacity:.9}
.raw{border-top:1px solid var(--line)}
.raw summary{cursor:pointer;padding:10px 16px;font-size:.78rem;color:var(--muted)}
.raw pre{margin:0;padding:0 16px 14px;font-family:ui-monospace,Menlo,monospace;
  font-size:.74rem;white-space:pre-wrap;color:var(--ink);overflow-x:auto}
</style>
<div class="wrap">
  <h1>ForeSites — WhatsApp Template Preview</h1>
  <p class="sub">${templates.length} templates · rendered from <code>definitions.js</code> with formatting &amp; sample values applied. This is exactly what Meta will render.</p>
  ${publicUrlWarning}
  <div class="grid">
    ${cards}
  </div>
</div>`;

const out = path.join(__dirname, 'preview.html');
fs.writeFileSync(out, html);
console.log('✅ wrote', out);
