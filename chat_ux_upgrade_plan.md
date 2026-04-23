# AI Chat UX Upgrade Plan

## Part 1: Open-Source Template Research

### Summary Matrix

| Criteria | assistant-ui | Vercel Chatbot | LibreChat |
|---|---|---|---|
| GitHub Stars | 8.9k | 19.9k | 34.7k |
| License | MIT | MIT | MIT |
| Markdown | Yes | Yes | Yes |
| Streaming | Yes | Yes | Yes (resumable) |
| Artifacts/Side-panel | Build yourself | No | Yes (built-in) |
| Code highlighting | Yes | Yes | Yes |
| CRA/React 19 compatible | **Yes** | No (Next.js only) | No (monolith) |
| Integration effort | Low (npm install) | High (framework migration) | Very high (extract from monolith) |
| Design quality | Good (customizable) | Excellent | Good |

---

### Rank 1: assistant-ui (`@assistant-ui/react`)

**GitHub:** [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) — 8.9k stars, MIT, YC W25 backed, 271k weekly npm downloads

A composable React component library (npm package) for building AI chat interfaces. Not a full application template — it gives you primitives you compose into your own UI.

**Built-in features:**
- Markdown rendering with syntax-highlighted code blocks
- Streaming with auto-scroll, reconnection handling
- Generative UI (render tool calls as custom React components inline)
- Voice input, file attachments, keyboard shortcuts, a11y
- Human-in-the-loop approval workflows

**Artifacts/side-panel:** No built-in artifact panel, but the generative UI system lets you render arbitrary React components from tool calls — the building block for implementing a side-panel yourself.

**Pros:**
- Best integration path: npm package that installs into existing CRA app — no framework migration
- Composable Radix-style primitives, full control over layout and styling
- Active development, strong community, YC-backed
- Works with any backend (AI SDK, LangGraph, or custom endpoints)
- Lightweight — pull in only the components you need

**Cons:**
- No turnkey artifact side-panel; you build it yourself using primitives
- Relatively young (v0.12.x) — API may still evolve
- Documentation good but not as extensive as larger projects

---

### Rank 2: Vercel AI Chatbot (`vercel/chatbot`)

**GitHub:** [vercel/chatbot](https://github.com/vercel/chatbot) — 19.9k stars, MIT

Full-featured, production-ready Next.js chat application template. Fork-and-customize model.

**Built-in features:**
- Markdown rendering, streaming via Vercel AI SDK
- Multi-model support, chat history persistence, file uploads
- Polished production-grade UI, shadcn/ui code blocks

**Artifacts/side-panel:** Not built-in.

**Pros:**
- Most polished, battle-tested chat UI design
- Excellent code quality (Vercel's reference implementation)
- shadcn/ui foundation = every component customizable
- Great design reference even if not used directly

**Cons:**
- **Hard blocker: Requires Next.js App Router with RSC/Server Actions.** Cannot be used in CRA without full framework migration.
- Tightly coupled to Vercel ecosystem (Neon DB, Vercel Blob, Auth.js)
- Fork-and-own = inherit maintenance burden

---

### Rank 3: LibreChat

**GitHub:** [danny-avila/LibreChat](https://github.com/danny-avila/LibreChat) — 34.7k stars, MIT, 354 contributors

Full-stack, self-hosted AI chat platform (monorepo: React frontend + Node.js backend).

**Built-in features:**
- Markdown rendering, resumable streaming
- **Artifacts side-panel** — renders React components, HTML, Mermaid diagrams (closest to Claude's artifact UX)
- Code interpreter (sandboxed Python, Node.js, Go, etc.)
- Multi-provider model switching, agents with MCP, conversation branching

**Pros:**
- **Only option with production-ready artifact side-panel**
- Most feature-complete platform, massive community
- `/client` React frontend is the best reference for artifact panel implementation

**Cons:**
- Full-stack monolith — cannot npm install into existing app
- Heavy Docker-based deployment with its own auth/database layer
- Extracting just the chat UI + artifact panel = significant engineering effort

---

### Recommended Strategy

> **Use `assistant-ui` as the foundation.** Install `@assistant-ui/react` into the existing CRA app, configure markdown/streaming/code-highlight primitives, then **study LibreChat's artifact panel source** (`/client` directory) as a reference to build our own side-panel. Use **Vercel Chatbot as a design reference** for visual polish and UX patterns.

---

## Part 2: Current Chat Architecture Audit

### File Map

```
dashboard/frontend/src/
├── ChatPanel.jsx                 (Main chat component, ~320 lines)
├── css/chat.css                  (Chat-specific styling, ~342 lines)
└── [In App.jsx, Navbar.jsx]      (Navigation integration)

dashboard/backend/
├── Routes/chatRoutes.js          (Chat API endpoints, ~139 lines)
└── .env                          (CHAT_LAMBDA_URL configuration)
```

### Component Architecture

**ChatPanel.jsx** — single functional component with hooks:
- **Sub-component:** `ChatChart` (recharts visualizations: Line, Pie, Bar, Area)
- **Utility:** `formatContent()` — basic markdown via regex (bold, italic, newlines)

**State management (React hooks):**
- `sessions` — chat session list from server
- `activeSessionId` — current session
- `messages` — messages in active session
- `input` — textarea buffer
- `sending` — loading flag
- `messagesEndRef` / `textareaRef` — DOM refs for scroll & auto-height

**Key functions:** `loadSessions()`, `loadSessionMessages()`, `handleNewChat()`, `handleSelectSession()`, `handleSend()`, `scrollToBottom()`

### API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/chat/message` | JWT | Send message, proxy to Lambda agent |
| GET | `/api/chat/sessions` | JWT | List user's sessions (20 limit, desc) |
| GET | `/api/chat/sessions/:id/messages` | JWT | Fetch session messages (ownership check) |

**Upstream:** Backend proxies to AWS Lambda (`CHAT_LAMBDA_URL`, eu-north-1), 120s timeout, 30 req/min rate limit per user.

**Response schema:** `{ role, content, chart_data?, metadata? }` — chart_data includes `chart_type, title, labels, datasets[]`

### Data Model (Supabase)

- `chat_session` — `session_id, user_id, title, created_at, updated_at`
- `chat_message` — `message_id, session_id, role, content, chart_data, metadata, created_at`

### Existing Dependencies

```
react: ^19.1.1
react-dom: ^19.1.1
react-router-dom: ^7.9.3
recharts: ^3.8.0          // Chart rendering in assistant responses
```

**No markdown library.** No streaming library. No WebSocket/SSE. Stateless HTTP/REST only.

### Routing & Navigation

- Route: `/chat` → `<ProtectedRoute><ChatPanel /></ProtectedRoute>` (App.jsx)
- Navbar link: `{ to: '/chat', label: 'AI Chat' }`

### Styling Approach

**Plain CSS with design system variables** (no CSS Modules, no Tailwind, no styled-components).

- **Stylesheet:** `css/chat.css` (~342 lines)
- **Variables:** `--ink-*` (colors), `--space-*` (spacing), `--font-*` (typography), `--shadow-*`
- **Layout:** 280px fixed sidebar (dark) + flex main area
- **Message bubbles:** User (right, dark bg) vs Assistant (left, white bg + border)
- **Responsive:** Mobile breakpoint at 768px
- **Animations:** Typing indicator (3-dot bounce), smooth hover transitions

### Current Limitations & Technical Debt

| # | Issue | Impact |
|---|-------|--------|
| 1 | **No markdown rendering** — `dangerouslySetInnerHTML` with basic regex | No code blocks, tables, links, or complex formatting |
| 2 | **No streaming** — full round-trip to Lambda per message | Poor perceived latency on long responses |
| 3 | **No session CRUD** — sessions auto-created by Lambda, no delete/clear | Users can't manage chat history |
| 4 | **No error recovery** — failed optimistic messages persist in state | Confusing UX on errors |
| 5 | **Rate limiting in-memory** — resets on server restart | Not production-safe |
| 6 | **Chart rendering limited** to recharts built-ins | No custom visualizations |
| 7 | **No auto-save drafts** — navigate away = lost input | Minor UX gap |
| 8 | **Lambda single point of failure** — no fallback or offline mode | Full chat outage if Lambda is down |

---

## Part 3: Upgrade Roadmap (Proposed)

### Phase 1 — Foundation (Markdown + Streaming)
1. Install `@assistant-ui/react` and its markdown dependencies
2. Replace `formatContent()` with assistant-ui's `MarkdownText` component (proper code blocks, tables, links)
3. Add SSE/streaming endpoint to backend (proxy Lambda token stream or implement server-side streaming)
4. Wire assistant-ui's streaming primitives to the new endpoint
5. Preserve existing `ChatChart` recharts integration as a custom tool-call renderer

### Phase 2 — Side-Panel Artifacts
1. Study LibreChat's `/client` artifact panel implementation
2. Build a resizable side-panel component (code viewer, chart viewer, table viewer)
3. Integrate with assistant-ui's generative UI system to route artifact-type responses to the panel
4. Add artifact types: code snippets, charts, data tables, generated reports

### Phase 3 — Polish & Features
1. Session management (rename, delete, search)
2. Message actions (copy, regenerate, edit & resend)
3. Input enhancements (file upload, voice input via assistant-ui primitives)
4. Mobile-responsive side-panel (drawer/modal on small screens)
5. Keyboard shortcuts and accessibility improvements

### Migration Notes
- **No framework migration required** — assistant-ui works as an npm package within CRA
- **Existing CSS variables** can be mapped to assistant-ui's theming system
- **Existing route structure** (`/chat` with ProtectedRoute) stays intact
- **Backend changes** primarily in `chatRoutes.js` — add SSE streaming endpoint alongside existing REST endpoint for backward compatibility
- **Lambda integration** may need modification to support streaming (check if Lambda supports response streaming or if we need an intermediate layer)

---

*Generated: 2026-03-16 | Status: Awaiting review before implementation*
