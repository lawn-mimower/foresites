# Setup guide

From a fresh machine to a working system. This is the internal guide — it names
the gotchas rather than pretending they don't exist.

Order matters: **database → config → install → run**. The WhatsApp bot is last
because it needs the most external setup.

---

## 0. Prerequisites

- **Node.js 20+** and npm
- **Python 3.10+** (the Lambda agent uses `str | None` syntax)
- A **Supabase** project (Postgres only — no Auth, Storage or Realtime is used)
- An **AWS** account with an S3 bucket
- A **Meta WhatsApp Cloud API** app, plus the `ngrok` CLI for local webhooks
- A **Google Gemini** API key, if you want the AI chat to work

---

## 1. Database

Run these in the Supabase SQL editor, in order:

1. [`schema/001_omnifeed_schema.sql`](../schema/001_omnifeed_schema.sql) — 9 tables, constraints, indexes, and the `resolve_snag_trigger`
2. [`schema/002_seed_data.sql`](../schema/002_seed_data.sql) — the 5 default impact-category rows

Then apply the incremental migrations in `dashboard/backend/scripts/`, which are
not folded into `001` yet:

- `migrate-snag-card-refactor.sql` — adds `snag_assignment.priority` and `is_active`
- `migration_impact_mapping.sql` — creates `impact_category_mapping` + `mapping_change_log`
- `migration_fix_assignments.sql` — backfills null `assigner_id`, dedupes active assignments

### Two things the schema file does not give you

**The two RPCs are missing.** The backend calls `dashboard_metrics(p_site_id)`
and `get_assignment_fingerprint()`, but neither is defined anywhere in this
repo — they exist only in the original live Supabase project. Both callers have
a fallback path, so a fresh environment *works* but runs the slow route: 33
sequential queries instead of one RPC for dashboard metrics, and a full table
scan instead of a cheap fingerprint for change detection. If the dashboard feels
sluggish on a new environment, this is why.

**The read-only role ships with a placeholder password.** Line 221 of `001`
creates `omnifeed_reader` with the literal password `CHANGE_ME_IN_PRODUCTION`.
This is the role the AI agent uses for its SQL tool. Change it before the
database is reachable from anywhere but your laptop.

---

## 2. Configuration

Each subsystem has its own `.env`; there is no shared root config. Copy the
examples and fill them in:

```bash
cp chatbot/.env.example           chatbot/.env
cp dashboard/backend/.env.example dashboard/backend/.env
cp lambda-agent/.env.example      lambda-agent/.env   # local test runs only
```

The example files document every variable. The traps worth repeating:

### The chatbot's Meta variables are lowercase

`controller.js` reads `process.env.accessToken` and `process.env.phone_number_id`
— lowercase, case-sensitive, unlike everything else in the repo.

Worse, the startup warning in `controller.js` tells you to set
`WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. **Nothing reads those
names.** If you follow that message the bot will start and then fail to reply.

### `chatbot/.env` must be named exactly `.env`

`dotenv` reads a file named exactly `.env`. A trailing space — `.env ` — is
silently ignored and *nothing* loads, including `PORT`. This cost us an
afternoon once.

```bash
cd chatbot && ls -la | grep '\.env'   # must show ".env", no trailing characters
```

### `PORT` behaves differently in each app

| App | Behaviour |
|---|---|
| `chatbot` | Reads `process.env.PORT` with **no fallback**. Unset → Node binds a random port → your ngrok tunnel hits nothing. |
| `dashboard/backend` | **Ignores `PORT` entirely.** `index.js:10` hardcodes `const PORT=9999`. |
| `dashboard/frontend` | Hardcoded to `48317` in the `start` script. |

### The frontend has no environment config at all

`dashboard/frontend/src/config/api.js` derives the API base from
`window.location.hostname` at runtime:

```js
export const API_BASE = `http://${window.location.hostname}:9999/api`;
```

Opening the dashboard at `192.168.1.5:48317` on a phone automatically targets
`192.168.1.5:9999`, which is convenient on a LAN and a blocker for real
deployment. See [DEPLOYMENT.md](DEPLOYMENT.md).

### Secrets that silently fall back

`JWT_SECRET` and `SESSION_SECRET` both fall back to hardcoded dev defaults if
unset. Set them anywhere that isn't your laptop.

---

## 3. Install

Three separate installs — there is no npm workspace root:

```bash
cd chatbot            && npm install && cd ..
cd dashboard/backend  && npm install && cd ../..
cd dashboard/frontend && npm install && cd ../..
```

Python, if you need the agent or the PDF reports:

```bash
# AI agent
cd lambda-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# PDF report generator — the API spawns script-report/venv/bin/python3 by
# absolute path, so this venv must live exactly here and be named `venv`.
cd ../script-report
python3 -m venv venv && ./venv/bin/pip install pandas numpy matplotlib reportlab
```

> `script-report/` has no `requirements.txt`. The dependency list above is
> derived from the imports in `report-generate.py`. Without this venv,
> `GET /api/report/generate-report` fails.

---

## 4. Run the dashboard

```bash
cd dashboard/backend  && npm start    # → http://0.0.0.0:9999
cd dashboard/frontend && npm start    # → http://0.0.0.0:48317
```

On every backend start, `createSuperAdmin()` seeds a bootstrap account if it's
absent:

```
superadmin@admin.com  /  SuperAdmin@123
```

**Change this immediately on any shared environment.** It is recreated on every
start if you delete it, so change the password rather than the account.

---

## 5. Run the WhatsApp bot

The bot is two halves that fail independently:

- **Receiving** needs a public URL, a verified webhook, and the `messages` field subscribed.
- **Replying** needs a valid `accessToken`. This is the half that breaks daily.

### 5.1 Start the server and a tunnel

```bash
cd chatbot && npm start          # expect: 🚀 Server is running on port 4545
ngrok http 4545                  # in a second terminal; copy the https URL
```

Confirm the tunnel actually reaches the app — this should echo `test123`:

```bash
curl "https://<your-ngrok>.ngrok-free.dev/api/whatsapp/chatbot?hub.mode=subscribe&hub.verify_token=MDC&hub.challenge=test123"
```

If you get ngrok's `ERR_NGROK_8012` instead, nothing is listening on 4545.

### 5.2 Configure the Meta webhook

**App Dashboard → WhatsApp → Configuration → Webhooks → Edit:**

| Field | Value |
|---|---|
| Callback URL | `https://<your-ngrok>.ngrok-free.dev/api/whatsapp/chatbot` |
| Verify token | `MDC` |

Both the path and the token `MDC` are hardcoded in `chatbot/route.js` — they
must match exactly. Click **Verify and save**; the app log prints
`WEBHOOK_VERIFIED ✅`.

Then under **Webhook fields → Manage**, subscribe to **`messages`**. Without
this, verification succeeds but no messages are ever delivered — a confusing
failure because everything looks configured.

Two more constraints:

- Free ngrok URLs change on every restart, so you must re-paste and re-verify each session.
- While the Meta app is unpublished, only numbers registered as testers reach the bot.

### 5.3 The access token

The token from **WhatsApp → API Setup** is a **temporary 24-hour token**. When
it dies, the bot receives fine but can't reply:

```
✅ User found: Mihir                       ← receiving works, Supabase is fine
❌ sendText error: { code: 190, type: 'OAuthException' }   ← Meta, not Supabase
```

**Permanent fix** — create a System User token that never expires:

1. Business Settings → **Users → System Users** → Add, role Admin
2. **Add Assets** → your WhatsApp app → full control
3. **Generate new token** → select the app → permissions `whatsapp_business_messaging` + `whatsapp_business_management`
4. Expiration: **Never** → copy the token (shown once)
5. Put it in `accessToken=` and restart

### 5.4 Smoke test

Message `hi` to the business number from a tester phone. Expected log:

```
🔍 Looking up phone number: ... in website_user table...
✅ User found: <name>
👋 Greeting registered user: <name>
```

…and the interactive menu arrives on WhatsApp. Greeting logged but no reply
means the token (5.3).

---

## 6. WhatsApp notification templates

The dashboard sends templated messages for assign / reject / approve / escalate.
Templates must be registered with Meta and approved before they work; until then
`services/whatsapp.js` silently falls back to plain text.

```bash
cd dashboard/backend/whatsapp-templates
node build-preview.js              # renders preview.html — check the wording first
node push-templates.js --dry-run   # then drop --dry-run to submit to Meta
```

`definitions.js` is the single source of truth for all four templates. Meta's
rules are strict and the file documents the workarounds: no leading, trailing or
adjacent variables; no newlines or tabs in parameters; footers can't be
italicised, so the sign-off lives in the body's last line.

The `View Job` button needs a **public HTTPS** target — Meta rejects `http://`
and private IPs. `foresite-redirect.html` is the bounce page that solves this:
host it publicly, point `TEMPLATE_VIEW_JOB_BASE` at it, and it forwards to
whichever local address the dashboard is on.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '@supabase/supabase-js'` | deps not installed | `npm install` in that subsystem (§3) |
| Server starts on a random port / ngrok 502 | `.env` not loaded, or `PORT` missing | check the filename is exactly `.env`, set `PORT=4545` (§2) |
| ngrok `ERR_NGROK_8012` Bad Gateway | nothing listening on 4545 | start the server first (§5.1) |
| Meta: "callback URL or verify token couldn't be validated" | app not running, wrong path, or token ≠ `MDC` | make the §5.1 curl work first |
| Webhook verified but no messages arrive | `messages` field not subscribed, or number isn't a tester | §5.2 |
| `sendText/sendList error … code: 190 OAuthException` | `accessToken` expired | refresh it (§5.3) |
| WhatsApp notifications arrive as plain text, not templates | templates unapproved or `WHATSAPP_TEMPLATE_LANG` mismatch | §6; Meta error 132001 is a language mismatch |
| Dashboard loads but is slow | the two RPCs are missing, so fallback paths are running | §1 |
| `GET /api/report/generate-report` fails | `script-report/venv` doesn't exist | §3 |
| Backend exits immediately on start | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` unset — `supabaseClient.js` calls `process.exit(1)` | §2 |

---

## 8. Moving to a new machine

1. `git clone` (fresh — do not reuse a clone from before the history rewrite)
2. `npm install` in all three Node directories
3. Create the three `.env` files from the examples
4. Create `script-report/venv` if you need PDF reports
5. `npm start` the backend, confirm port 9999
6. `npm start` the frontend, log in as the bootstrap super admin
7. For the bot: `npm start`, `ngrok http 4545`, re-point the Meta callback URL, re-verify
8. Refresh `accessToken` if it's been more than 24h
