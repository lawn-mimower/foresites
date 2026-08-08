# Chatbot Setup Guide

WhatsApp snag-reporting bot (Node/Express + Supabase + S3). This guide takes you
from a fresh machine to a verified, replying bot, and lists fixes for every error
we've actually hit.

---

## 0. Architecture in one line

WhatsApp user → Meta Cloud API → **webhook** (`POST /api/whatsapp/chatbot`) →
`controller.js` (in-memory step machine) → Supabase (`website_user`, `site`,
`snag`, `todo`) + S3 (media) + transcription Lambda. The bot **replies** by calling
the Meta Graph API with `accessToken` + `phone_number_id`.

- **Receiving** needs: a public URL (ngrok), the webhook verified, `messages` subscribed.
- **Replying** needs: a valid `accessToken`. (This is the one that expires — see §5.)

---

## 1. Prerequisites

- Node.js (CommonJS; tested on v20+) and npm
- An ngrok account + the `ngrok` CLI
- Access to the Meta **App Dashboard** → WhatsApp product
- The Supabase project URL + service key, AWS keys (already in the team `.env`)

---

## 2. Environment file (read this carefully)

The app loads config with `dotenv`, which reads a file named **exactly `.env`**.

> ⚠️ **Gotcha that cost us an afternoon:** the file must be `chatbot/.env` — no
> trailing space, no other name. `.env ` (with a space) is silently ignored and
> *nothing* loads, so the server can't even find its `PORT`.

Verify the filename is exact:

```bash
cd chatbot
ls -la | grep '\.env'      # must show ".env" with no trailing characters
```

Required keys in `chatbot/.env`:

```ini
PORT=4545                  # server listens here; ngrok must tunnel to this

SUPABASE_URL=...
SUPABASE_KEY=...           # service key

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-north-1
S3_BUCKET_NAME=...

accessToken=...            # Meta WhatsApp token — EXPIRES, see §5
phone_number_id=...        # from WhatsApp > API Setup
```

`server.js` uses `process.env.PORT` with **no fallback** — if `PORT` is missing the
server binds to a random port and ngrok's `http 4545` tunnel hits nothing.

---

## 3. Install dependencies

`node_modules` is **not** guaranteed complete on a fresh clone/device. Always run:

```bash
cd chatbot
npm install
```

If you skip this you'll get `Error: Cannot find module '@supabase/supabase-js'` on start.

---

## 4. Start the server + tunnel

Terminal 1 — the app:

```bash
cd chatbot
npm start            # nodemon server.js
# expect: 🚀 Server is running on port 4545
# expect: dotenv injecting env (11) from .env
```

Terminal 2 — the public tunnel:

```bash
ngrok http 4545
# copy the https URL, e.g. https://<something>.ngrok-free.dev
```

Sanity check the tunnel actually reaches your app (should print `test123`):

```bash
curl "https://<your-ngrok>.ngrok-free.dev/api/whatsapp/chatbot?hub.mode=subscribe&hub.verify_token=MDC&hub.challenge=test123"
```

If you get ngrok's `ERR_NGROK_8012` (Bad Gateway) instead, the app isn't running on
4545 — fix §2/§3 first.

---

## 5. Meta webhook configuration

App Dashboard → **WhatsApp → Configuration → Webhooks → Edit**:

| Field        | Value                                                        |
| ------------ | ----------------------------------------------------------- |
| Callback URL | `https://<your-ngrok>.ngrok-free.dev/api/whatsapp/chatbot`  |
| Verify token | `MDC`                                                       |

- The path `/api/whatsapp/chatbot` and token `MDC` are **hardcoded** in
  `route.js` — they must match exactly.
- Click **Verify and save** → your app log prints `WEBHOOK_VERIFIED ✅`.
- Then under **Webhook fields**, click **Manage** and subscribe to **`messages`**.
  Without this, verification passes but no messages are delivered.

> ℹ️ ngrok free URLs change on every restart. Each time you restart ngrok you must
> re-paste the Callback URL and re-verify.

> ℹ️ While the app is **unpublished**, Meta only delivers messages from numbers added
> as **testers/admins** (WhatsApp → API Setup → add recipient). Real users won't reach
> it until the app is published.

---

## 6. The access token (the recurring pain) 🔑

Symptom when the token is bad — the bot **receives** but **fails to reply**:

```
✅ User found: Mihir          <- receiving works (Supabase fine)
❌ sendText error: { message: 'Authentication Error', code: 190, type: 'OAuthException' }
```

`code: 190 / OAuthException` = the `accessToken` is **expired or invalid**. This is a
**Meta** error, not Supabase. The token from WhatsApp → **API Setup** is a
**temporary 24-hour token**, so it dies every day.

### Quick fix (dev)
WhatsApp → **API Setup** → copy the new temporary token → paste into
`accessToken=` in `chatbot/.env` → restart the server (`rs` in nodemon, or Ctrl+C +
`npm start`). The `phone_number_id` on that same page rarely changes, but copy it too
if you switched apps/numbers.

### Permanent fix (recommended — stops the daily breakage)
Create a **System User token** so it never expires:

1. Business Settings → **Users → System Users** → Add (role: Admin).
2. **Add Assets** → your WhatsApp app → full control.
3. **Generate new token** → select the app → permissions
   `whatsapp_business_messaging` + `whatsapp_business_management`.
4. Choose **Never** for expiration → copy the token (shown once).
5. Put it in `accessToken=` and restart.

---

## 7. Smoke test

From a tester WhatsApp number, send `hi` to the business number. Expected app log:

```
🔍 Looking up phone number: ... in website_user table...
✅ User found: <name>
👋 Greeting registered user: <name>
```

…and you receive a reply with the interactive menu on WhatsApp. If you see the
greeting log but no reply, it's the token (§6).

---

## 8. Troubleshooting quick table

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Cannot find module '@supabase/supabase-js'` | deps not installed | `npm install` in `chatbot/` (§3) |
| Server starts on random port / ngrok 502 | `.env` not loaded (wrong filename) or `PORT` missing | fix filename to exactly `.env`, set `PORT=4545` (§2) |
| ngrok `ERR_NGROK_8012` Bad Gateway | nothing listening on 4545 | start the server first (§4) |
| Meta: "callback URL or verify token couldn't be validated" | app not running, wrong path, or token ≠ `MDC` | verify §4 curl works, check path/token (§5) |
| Verified but no messages arrive | `messages` field not subscribed, or app unpublished + number not a tester | subscribe `messages`; add number as tester (§5) |
| `sendText/sendList error … code: 190 OAuthException` | `accessToken` expired/invalid | refresh token (§6) |

---

## 9. Device-switch checklist

When you move to a new machine, in order:

1. `git pull` (or clone)
2. `cd chatbot && npm install`
3. Confirm `chatbot/.env` exists, named exactly `.env`, with all keys (§2)
4. `npm start` → see the 🚀 line
5. `ngrok http 4545` → copy the new https URL
6. Update Meta Callback URL + **Verify and save** (§5)
7. Refresh `accessToken` if it's been >24h or you're getting code 190 (§6)
