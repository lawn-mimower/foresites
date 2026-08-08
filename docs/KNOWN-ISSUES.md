# Known issues

Things that are wrong, dead, or surprising. Recorded so they stop being
rediscovered. Everything here was verified against the code at the time of
writing — line numbers are from `main`.

---

## Bugs

### "View My Snags" returns nothing

The two halves of the feature disagree about phone number format.

**Stored** — `controller.js:754,758`, full digits including country code:

```js
const phoneNumber = from.replace(/\D/g, '');   // "918007953471"
...
phone_number: parseInt(phoneNumber),
```

**Queried** — `controller.js:315`, last ten digits only:

```js
.eq('phone_number', from.replace(/\D/g, '').slice(-10))   // "8007953471"
```

These never match for any number carrying a country code, so the query returns
an empty set and the user is told they have no snags.

Note that the *user lookup* at `controller.js:30-37` uses the full-digit form,
consistent with how snags are stored — line 315 is the lone outlier. The fix is
to drop the `.slice(-10)`, but check existing rows first: anything written
during an earlier convention may need backfilling.

### `/api/report/generate-report` is unauthenticated and spawns a subprocess

`reportRoutes.js` is the one router with no auth on any route. It runs:

```js
spawn('script-report/venv/bin/python3', ['script-report/report-generate.py'])
```

and streams back the resulting PDF. Anyone who can reach the API can trigger
report generation. Either put `authenticateToken` in front of it or drop the
route.

Every other router is covered — `fb.js` via a router-level `Router.use()` that
exempts `/health`, and the rest per-route.

---

## Dead code

### `/api/employee` — 4 routes, non-functional

`Routes/employee.js` requires `Models/employee.js`, a Mongoose schema. There is
no Mongo connection anywhere in `index.js`. The routes exist, have no
authentication, and cannot work. Delete them.

### `chatbot/Models/` — three schemas for a database that isn't there

`passphrase.js`, `userfbschema.js` and `sitename.js` all `require('mongoose')`
— but **mongoose is not in `chatbot/package.json` or its lockfile at all**.
Nothing imports these files, which is the only reason they don't crash the
process. Import any of them and you get `Cannot find module 'mongoose'`.

Their responsibilities moved to Postgres: `snag` replaced `userfbschema`, `site`
replaced `sitename`, and the passphrase feature is disabled outright —
`controller.js:650` hardcodes `user.feedback.code = 'skipped'`.

### Other unreferenced files

| File | Note |
|---|---|
| `dashboard/frontend/src/foresights dashboard.jsx` | 769 lines, imported nowhere. The live component is `ForesitesDashboard.jsx`. The space in the filename is also a portability hazard. |
| `dashboard/backend/testconnect.js` | Queries a table called `snags` (plural). No such table exists — it's `snag`. |
| Root `package.json` / `package-lock.json` | Declares `qrcode.react`, which appears in no source file. The app uses the *different* package `react-qr-code` (in `ManageEmployee.jsx`), declared in the frontend's own manifest. Also duplicates React. Safe to delete. |

---

## Half-finished migrations

### Mongo → Postgres

Six Mongoose model files survive across `chatbot/Models/` and
`dashboard/backend/Models/`. Only `dashboard/backend/Models/employee.js` is
still imported, by the dead employee router. `MONGO_URI` / `MONGOURI` linger in
the `.env` files with no reader.

Finishing this means deleting the six model files, the employee route, the
`mongoose` dependency from `dashboard/backend/package.json`, and the two env
vars.

### Two Meta Graph API versions

| Version | Where |
|---|---|
| `v22.0` | `dashboard/backend/services/whatsapp.js` and the template scripts (5 call sites) |
| `v25.0` | `chatbot/controller.js:14` |

Worth unifying. (A third, `v18.0`, went away with `chatbot/whatsappimage.js`.)

---

## Design constraints that look like bugs

### The chatbot cannot be scaled horizontally

`userStates` and `processedMessages` are plain in-process objects
(`controller.js:21-22`). Consequences:

- Run **one instance only**. A second replica drops every conversation routed to the wrong one.
- Every restart, including each nodemon reload in development, loses in-flight conversations. A user mid-way through reporting a snag has to start over.

Fixing this means moving conversation state to Postgres or Redis.

### The Lambda's "streaming" is cosmetic at the boundary

`run_agent_stream` genuinely streams internally, but `_handle_message`
(`lambda_function.py:106-162`) collects every event into a list and returns one
joined body — despite sending `Transfer-Encoding: chunked`. The Express layer
re-splits that NDJSON into SSE, so the browser sees chunks, but they all arrive
at once after the full round trip.

### The frontend has no build-time configuration

`dashboard/frontend/src/config/api.js` derives the API base from
`window.location.hostname` at runtime. Great on a LAN, blocking for deployment.
See [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Configuration traps

| Trap | Detail |
|---|---|
| Misleading error message | `controller.js:16-18` says to set `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`. Nothing reads those. The real names are lowercase `accessToken` / `phone_number_id`. |
| `PORT` ignored | `dashboard/backend` hardcodes 9999; a `PORT` in its `.env` does nothing. |
| `PORT` mandatory | `chatbot` has no fallback — unset means a random port. |
| Silent secret fallbacks | `JWT_SECRET` and `SESSION_SECRET` fall back to hardcoded dev defaults. |
| Placeholder DB password | `schema/001_omnifeed_schema.sql:221` creates `omnifeed_reader` with the literal `CHANGE_ME_IN_PRODUCTION`. |
| Reseeded admin | `createSuperAdmin()` runs on every backend start. Deleting the account brings it back; change the password instead. |
| Missing RPCs | `dashboard_metrics` and `get_assignment_fingerprint` are called but defined nowhere in this repo. Fallback paths work but are slow. |
| Undocumented venv | `script-report/venv` must exist at that exact path, and has no `requirements.txt`. |
| Doubled path segment | `todo.js` mounts `PUT /todos/:todoId/complete` *inside* the `/api/todos` router, making the real path `/api/todos/todos/:todoId/complete`. |

---

## Repo hygiene

`node_modules`, both `.env` files, all `.DS_Store` and stray build artifacts
were removed from every commit via `git-filter-repo`, and the exposed
credentials were rotated. `.gitignore` now covers all of it, so it shouldn't
recur.

Two things to keep in mind:

- **Every commit SHA changed.** Any clone predating the cleanup must be deleted and re-cloned. Pushing from an old clone restores everything that was removed.
- Consider enabling GitLab's **Secret push protection** as a forward guard.
