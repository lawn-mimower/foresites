# Deployment

> **Status: partly reconstructed.** There is no deploy script anywhere in this
> repo — no Makefile, SAM template, Terraform, `serverless.yml`, or CI workflow.
> The Lambda procedure below is reconstructed from what `.gitignore` implies
> (`lambda-agent/package/`, `*.zip`, `lambda-agent/output.json`), from
> `test-event.json`, and from standard practice. **The function name and ARN are
> recorded nowhere in the repo** — fill them in below the first time you deploy,
> and correct anything here that turns out to differ.

---

## 1. AI agent → AWS Lambda

**Region:** `eu-north-1` (per `chat_ux_upgrade_plan.md:145`)
**Runtime:** Python 3.10+
**Handler:** `lambda_function.lambda_handler`
**Function name:** `<fill in>`

### Build the deployment package

Dependencies must be vendored into the zip — Lambda has no `pip install` step.
`psycopg2-binary` contains compiled C extensions, so it **must** be built for
Lambda's Linux x86-64 environment. Building on an Apple Silicon Mac without the
platform flags produces a package that imports fine locally and fails in Lambda
with `no module named psycopg2._psycopg`.

```bash
cd lambda-agent
rm -rf package && mkdir package

pip install \
  --platform manylinux2014_x86_64 \
  --target ./package \
  --implementation cp \
  --python-version 3.11 \
  --only-binary=:all: \
  -r requirements.txt

# Application code + the skill prompt package (loaded from disk at cold start)
cp -r *.py tools/ skill/ package/

cd package && zip -qr ../deploy.zip . && cd ..
```

`skill/` is **required at runtime** — `skill_loader.py` reads `SKILL.md` and the
six `skill/references/*.md` files at cold start to build the system prompt. Omit
it and the agent starts with no instructions.

### Deploy

```bash
aws lambda update-function-code \
  --region eu-north-1 \
  --function-name <fill in> \
  --zip-file fileb://deploy.zip
```

### Configuration

| Setting | Value | Why |
|---|---|---|
| Memory | 512 MB+ | The ~11K-token skill prompt plus psycopg2 |
| Timeout | 120 s | Matches the backend's proxy timeout; up to 8 tool rounds |
| Function URL | enabled | `CHAT_LAMBDA_URL` points at it |

Environment variables (see `lambda-agent/.env.example`):

```
SUPABASE_DB_URL          transaction pooler, port 6543
SUPABASE_DB_WRITE_URL    chat memory writes
GEMINI_API_KEY
GEMINI_MODEL_ID          optional, defaults to gemini-2.0-flash
```

Use the **transaction pooler (6543)**, not a direct connection. Lambda's
concurrency model exhausts direct Postgres connections quickly; `db.py` keeps
module-level singletons with TCP keepalives to reuse connections across warm
invocations, and retries once on `OperationalError` after a PgBouncer timeout.

### Verify

```bash
aws lambda invoke \
  --region eu-north-1 \
  --function-name <fill in> \
  --payload fileb://test-event.json \
  output.json
cat output.json
```

Then point `CHAT_LAMBDA_URL` in `dashboard/backend/.env` at the Function URL and
try the AI Chat page.

---

## 2. Everything else → one small server

The target is a 6–12 month pilot at roughly **Rs 800–1,000/month**. Fixed cost
is about Rs 424/month (VPS + domain); everything else is free-tier or usage-based.

| Component | Where | Cost/mo |
|---|---|---|
| `chatbot` + `dashboard/backend` | 1 VPS (Hetzner CX22, 2 vCPU / 4 GB) under PM2 | Rs 340 |
| `dashboard/frontend` | Cloudflare Pages or Vercel, static build | Rs 0 |
| Postgres | Supabase free tier | Rs 0 |
| Media | S3 (or Cloudflare R2, 10 GB free, S3-compatible) | Rs 0–50 |
| AI agent | Lambda + Gemini Flash | ~Rs 180 |
| WhatsApp | Meta Cloud API direct — no BSP | ~Rs 150 |
| Domain | registrar | Rs 84 |

Notes that matter for the bill:

- WhatsApp goes **directly to Meta Graph API**. There is no BSP (AiSensy/WATI) in the code, so there's no BSP fee. Meta gives 1,000 free service conversations/month.
- Supabase is used for **Postgres only** — no Auth, Storage, Realtime or Edge Functions. The free tier is architecturally sufficient.
- Gemini is the only cost that grows with usage. Cap it: set `max_output_tokens`, lower `MAX_TOOL_ROUNDS` (currently 8) in `agent_loop.py`, and keep the static skill prompt cached.

### Topology

Run both Node apps under PM2 on one box, with Caddy in front for automatic SSL.
This keeps the codebases separate and is the least work. Alternatives — merging
into one Express process, or moving the chatbot webhook to a function — are more
refactoring for marginal gain at this scale.

```
Caddy (auto-SSL)
 ├── bot.<domain>  → :4545   chatbot   (must be always-on; Meta needs a fast ack)
 └── api.<domain>  → :9999   dashboard backend
```

### Pre-launch checklist

- [ ] **Point the frontend at a real domain.** `dashboard/frontend/src/config/api.js` hardcodes `http://${window.location.hostname}:9999`. This is the single biggest blocker to a real deployment — it must become an env-driven HTTPS base URL, and CRA bakes env vars in at build time, so it has to be set before `npm run build`.
- [ ] **Repoint the Meta webhook** from ngrok to the production HTTPS URL, and re-verify.
- [ ] **Swap the temporary WhatsApp token** for a System User token that never expires ([SETUP.md §5.3](SETUP.md#53-the-access-token)).
- [ ] **Set `JWT_SECRET` and `SESSION_SECRET`.** Both silently fall back to hardcoded dev defaults.
- [ ] **Set `NODE_ENV=production`** so session cookies become secure-only.
- [ ] **Change the bootstrap super admin password** (`superadmin@admin.com` / `SuperAdmin@123`, reseeded on every start).
- [ ] **Change the `omnifeed_reader` password** from `CHANGE_ME_IN_PRODUCTION` (`schema/001_omnifeed_schema.sql:221`).
- [ ] **Create the two missing RPCs** — `dashboard_metrics` and `get_assignment_fingerprint` — or accept the slow fallback paths.
- [ ] **Lock down CORS.** `index.js:29-34` currently reflects any origin.
- [ ] **Protect or remove `/api/report/generate-report`.** It has no authentication and spawns a Python subprocess. See [KNOWN-ISSUES.md](KNOWN-ISSUES.md).
- [ ] **Remove `/api/employee`.** Unauthenticated and non-functional (Mongoose-backed with no Mongo connection).
- [ ] **Create `script-report/venv`** on the server, or `/api/report/generate-report` fails.
- [ ] **Ensure `uploads/` exists and is writable** at the repo root — both Node apps use it.
- [ ] **Weekly Supabase cron ping.** The free tier pauses a project after 7 days of inactivity; any `.from()` read prevents it.
- [ ] **Nightly `pg_dump` to S3/R2.** The free tier has no daily backups and the VPS is a single point of failure.

### Accepted risks for a pilot

| Risk | Mitigation |
|---|---|
| VPS is a single point of failure | Nightly dump; a lost box costs an afternoon, not data |
| Supabase free tier: no backups, 7-day pause | Cron ping + nightly dump |
| Gemini/WhatsApp scale with usage | Token cap, lower `MAX_TOOL_ROUNDS`, Meta's free conversation tier |
| Chatbot is single-instance by design | In-memory conversation state — do **not** run two replicas |

That last one is a hard constraint, not a preference: `controller.js` keeps
`userStates` in process memory, so a second instance would drop every
conversation routed to the wrong replica.
