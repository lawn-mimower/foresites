/**
 * Single source of truth for ForeSites WhatsApp message templates.
 *
 * Consumed by:
 *   - build-preview.js  → renders preview.html (visual check before pushing)
 *   - push-templates.js → creates/updates the templates on Meta
 *
 * Meta rules honoured here:
 *   - Body may not start or end with a variable, and no two variables adjacent.
 *   - Params can't contain newlines / tabs / 4+ spaces (so remark blocks are one line).
 *   - Every variable needs a sample value in `example`.
 *   - Footer text supports NO formatting, so "_ForeSites by OMNIFEED_" lives in the
 *     BODY (last line) to keep its italics — matching the reference screenshots.
 *
 * Language is en_US to match the existing account locale.
 * The View Job button needs a PUBLIC https URL — a private IP / http is rejected by Meta.
 */

const LANGUAGE = 'en_US';
const CATEGORY = 'UTILITY';

// Public https base for the View Job button (Meta rejects private IP / http).
// mihirmohite.in/foresite-redirect forwards ?highlight=<assignment_id> to the local dashboard.
// (assignment_id — the frontend highlights job cards by assignment_id, not snag_id.)
//    Override at runtime with:  TEMPLATE_VIEW_JOB_BASE=https://other-domain/path
const VIEW_JOB_BASE =
  process.env.TEMPLATE_VIEW_JOB_BASE || 'https://www.mihirmohite.in/foresite-redirect';

const viewJobButton = (sampleSnagId) => ({
  type: 'BUTTONS',
  buttons: [
    {
      type: 'URL',
      text: 'View Job',
      url: `${VIEW_JOB_BASE}?highlight={{1}}`,
      example: [`${VIEW_JOB_BASE}?highlight=${sampleSnagId}`],
    },
  ],
});

const SAMPLE_SNAG_UUID = 'a1b2c3d4-0000-4444-8888-1234567890ab';

/**
 * Each template: { name, components } plus `sample` used only for the preview
 * (maps variable index → filled value so the artifact shows a real bubble).
 */
const templates = [
  // ── 1. ASSIGNED ──────────────────────────────────────────────────────────
  {
    name: 'foresites_snag_assigned',
    language: LANGUAGE,
    category: CATEGORY,
    components: [
      {
        type: 'BODY',
        text:
          '*ForeSites – SNAG ASSIGNED!*\n\n' +
          'Hi {{1}}, a new snag has been assigned to you by *{{2}}*.\n\n' +
          '*Snag ID:* {{3}}\n' +
          '*Priority:* {{4}}\n' +
          '*Issue:* {{5}}\n' +
          '*Location:* {{6}}\n' +
          '*Category:* {{7}}\n\n' +
          '{{8}}\n\n' +
          '_ForeSites by OMNIFEED_',
        example: {
          body_text: [[
            'Mihir',
            'System Administrator superadmin',
            'SNG-7797',
            '🟡 High',
            'Cement not received',
            'Cedar Complex',
            'Workflow Issues',
            'Remarks by System Administrator superadmin: "Instructions abc"',
          ]],
        },
      },
      viewJobButton(SAMPLE_SNAG_UUID),
    ],
  },

  // ── 2. REJECTED ──────────────────────────────────────────────────────────
  {
    name: 'foresites_snag_rejected',
    language: LANGUAGE,
    category: CATEGORY,
    components: [
      {
        type: 'BODY',
        text:
          '*ForeSites – SNAG REJECTED*\n\n' +
          'Hi {{1}}, your work on the following snag has been sent back for rework.\n\n' +
          '*Snag ID:* {{2}}\n' +
          '*Priority:* {{3}}\n' +
          '*Location:* {{4}}\n' +
          '*Category:* {{5}}\n\n' +
          '*Rejection Remarks by {{6}}:*\n' +
          '"{{7}}"\n\n' +
          'This is rejection #{{8}} for this snag.\n' +
          'Please address the remarks and resubmit.\n\n' +
          '_ForeSites by OMNIFEED_',
        example: {
          body_text: [[
            'Mihir',
            'SNG-7797',
            '🟡 High',
            'Cedar Complex',
            'Workflow Issues',
            'System Administrator superadmin',
            'Please redo the plastering, finish is uneven',
            '2',
          ]],
        },
      },
      viewJobButton(SAMPLE_SNAG_UUID),
    ],
  },

  // ── 3. ESCALATION ────────────────────────────────────────────────────────
  {
    name: 'foresites_snag_escalation',
    language: LANGUAGE,
    category: CATEGORY,
    components: [
      {
        type: 'BODY',
        text:
          '*ForeSites – SNAG ESCALATED* ⚠️\n\n' +
          'Hi {{1}}, the following snag has been escalated by *{{2}}*.\n\n' +
          '*Snag ID:* {{3}}\n' +
          '*Priority:* {{4}}\n' +
          '*Location:* {{5}}\n' +
          '*Category:* {{6}}\n\n' +
          '{{7}}\n\n' +
          '_Immediate attention required._\n\n' +
          '_ForeSites by OMNIFEED_',
        example: {
          body_text: [[
            'Mihir',
            'System Administrator superadmin',
            'SNG-7797',
            '🔴 Urgent',
            'Cedar Complex',
            'Workflow Issues',
            'Escalation Remarks: "Client visiting tomorrow, must be fixed today"',
          ]],
        },
      },
      viewJobButton(SAMPLE_SNAG_UUID),
    ],
  },

  // ── 4. APPROVED / CLOSED ─────────────────────────────────────────────────
  {
    name: 'foresites_snag_approved',
    language: LANGUAGE,
    category: CATEGORY,
    components: [
      {
        type: 'BODY',
        text:
          '*ForeSites – SNAG CLOSED* ✅\n\n' +
          'Hi {{1}}, your work on the following snag has been approved and closed.\n\n' +
          '*Snag ID:* {{2}}\n' +
          '*Location:* {{3}}\n' +
          '*Category:* {{4}}\n\n' +
          '_Great work — snag resolved successfully._\n\n' +
          '_ForeSites by OMNIFEED_',
        example: {
          body_text: [[
            'Mihir',
            'SNG-7797',
            'Cedar Complex',
            'Workflow Issues',
          ]],
        },
      },
      viewJobButton(SAMPLE_SNAG_UUID),
    ],
  },
];

module.exports = { templates, LANGUAGE, CATEGORY, VIEW_JOB_BASE };
