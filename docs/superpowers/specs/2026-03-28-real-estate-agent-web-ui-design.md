# Real Estate Agent — Web UI Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Agent:** Real Estate Transaction Agent (Gujarat)

---

## Overview

A minimal web UI that makes the real estate agent accessible to non-technical property buyers. 3-step guided wizard for intake, then interactive chat for the copilot experience. Local-first, deployable to S3+CloudFront + EC2 later.

## Architecture

```
┌─────────────────────────┐     SSE stream      ┌──────────────────────────────┐
│  Frontend (Vite+React)  │ ←─────────────────→  │  Backend (Hono API Server)   │
│  localhost:5173          │     REST + SSE       │  localhost:3001               │
│                         │                      │                              │
│  - Step Wizard          │                      │  - Claude Agent SDK          │
│  - Chat UI              │                      │  - browser-mcp (in-process)  │
│  - Report Viewer        │                      │  - property-kb-mcp           │
│  - Progress Indicators  │                      │  - tracker-mcp               │
└─────────────────────────┘                      │                              │
                                                 │  Spawns:                     │
                                                 │  - dev-browser (portal auto) │
                                                 │  - Chrome MCP (fallback)     │
                                                 └──────────────────────────────┘
```

- **Frontend:** Vite + React SPA. No SSR needed.
- **Backend:** Hono server wrapping Claude Agent SDK with all 3 MCP servers running in-process. Streams agent events to the frontend via SSE.
- **Browser automation:** dev-browser spawned by browser-mcp for portal checks. Chrome MCP as CAPTCHA fallback.
- **Startup:** Single `npm run dev` starts both frontend (Vite) and backend (Hono) concurrently.
- **Deployment (later):** Frontend → S3 + CloudFront. Backend → EC2 with headless Chrome.

## User Flow

### Phase 1: Wizard (3 steps)

The wizard collects just enough to start verification. The agent asks deeper questions in chat.

**Step 1 — Location:**
- Address text input (placeholder: "Enter address or area name, e.g. Vesu, Surat")
- State dropdown (default: Gujarat — only supported state for now)
- City text input (default: Surat)

**Step 2 — Property Details:**
- Property type selector — visual cards: Flat, Plot, Row House, Villa, Commercial Office
- Budget input — number field with Rs prefix, formatted with Indian numbering
- Builder name — optional text input (placeholder: "Builder or developer name, if known")

**Step 3 — RERA & Priorities:**
- RERA ID — optional text input (placeholder: "PR/GJ/SURAT/...", with helper text: "Find this on the builder's brochure or GujRERA portal")
- Primary concern — radio group:
  - Builder reliability
  - Legal clearance
  - Total cost breakdown
  - All of the above (default)
- "Start Verification" button

### Phase 2: Transition

When the user clicks "Start Verification":
1. Wizard collapses/slides up (not disappears — user can see their inputs at a glance)
2. Chat UI opens below/replaces the wizard
3. A system message appears: "Starting property verification for [address]..."
4. Backend creates a session via `POST /api/sessions` with wizard data
5. SSE stream begins — tool calls appear as progress indicators

### Phase 3: Chat (Copilot)

The chat interface is the main interaction surface after the wizard.

**Message types:**
- **Agent message** — text in a bubble, left-aligned, with "Property Copilot" label
- **User message** — text in a bubble, right-aligned
- **Tool progress** — inline indicator showing "Searching GujRERA..." with spinner, then checkmark/warning on completion
- **Finding card** — structured finding (RERA verified, litigation found, etc.) with severity badge (green/yellow/red)
- **System message** — centered, dimmed text for status updates

**Quick action bar:**
Below the input field, a row of clickable buttons for common slash commands:
- `/summary` — "Summary"
- `/risks` — "Red Flags"
- `/cost` — "Total Cost"
- `/dossier` — "Full Report"
- `/help` — "All Commands"

These buttons insert the command and auto-send.

**Input bar:**
- Text input (placeholder: "Ask anything or type /help for commands...")
- Send button
- Supports Enter to send, Shift+Enter for newline

### Phase 4: Report View (optional enhancement)

When the user types `/dossier`, the agent generates a structured report. This could be displayed in a dedicated report view panel (side-by-side with chat, or replacing chat temporarily) with:
- Risk score badge at top
- Expandable sections (RERA, eCourts, AnyRoR, Financial, Red Flags)
- Print/export button

This is an enhancement — not required for v1. The chat can render the report as formatted markdown.

## Backend API

### Endpoints

**`POST /api/sessions`**
Creates a new agent session with wizard inputs.

Request body:
```json
{
  "address": "Vesu, Surat",
  "state": "Gujarat",
  "city": "Surat",
  "propertyType": "residential_flat",
  "budget": 7500000,
  "builderName": "ABC Developers",
  "reraId": "PR/GJ/SURAT/...",
  "primaryConcern": "all"
}
```

Response:
```json
{
  "sessionId": "sess_abc123",
  "status": "created"
}
```

Internally: calls `create_purchase` via tracker-mcp, builds the initial prompt from wizard data (same as copilot-cli.ts does today), starts the first `query()` call.

**`POST /api/sessions/:id/message`**
Sends a user message to the agent.

Request body:
```json
{
  "message": "What about the builder's track record?"
}
```

Response:
```json
{
  "status": "processing"
}
```

The response comes via SSE, not in this HTTP response.

**`GET /api/sessions/:id/stream`**
SSE stream of agent events.

Event types:
```
event: tool_call
data: {"tool": "search_rera_project", "display": "Searching GujRERA portal", "detail": "RERA ID: PR/GJ/..."}

event: tool_result
data: {"tool": "search_rera_project", "status": "success", "summary": "Project found: ABC Tower"}

event: text
data: {"content": "The project is registered with GujRERA. Here's what I found:\n\n..."}

event: done
data: {"turns": 5, "cost_usd": 0.08}

event: error
data: {"message": "Agent encountered an error", "recoverable": true}
```

### Agent Bridge (`server/agent-bridge.ts`)

Wraps the existing `query()` function from the Agent SDK. Translates SDK message types into SSE events:

- `message.type === "system"` + `subtype === "init"` → capture session ID
- `message.type === "assistant"` + `tool_use` blocks → emit `tool_call` events
- `message.type === "result"` + `subtype === "success"` → emit `text` event with result, then `done`

The bridge reuses the existing MCP server instances (`browserMcp`, `propertyKbMcp`, `trackerMcp`) — no duplication. The system prompt is the existing `COPILOT_SYSTEM_PROMPT` from `copilot.ts`.

## Project Structure

```
implementation/real-estate-agent/
├── web/                          # NEW — Frontend
│   ├── src/
│   │   ├── App.tsx               # Root — routes between wizard and chat
│   │   ├── components/
│   │   │   ├── Wizard.tsx        # 3-step intake form
│   │   │   ├── WizardStep.tsx    # Individual step wrapper
│   │   │   ├── Chat.tsx          # Chat interface container
│   │   │   ├── MessageBubble.tsx # Agent/user message display
│   │   │   ├── ToolProgress.tsx  # "Searching RERA..." inline indicator
│   │   │   ├── FindingCard.tsx   # Structured finding with severity badge
│   │   │   ├── QuickActions.tsx  # Slash command button bar
│   │   │   └── SessionHeader.tsx # Property info bar at top of chat
│   │   ├── hooks/
│   │   │   ├── useAgentStream.ts # SSE connection + message parsing
│   │   │   └── useSession.ts     # Session create/resume/state
│   │   ├── types.ts              # Frontend-specific types (SSE events, UI state)
│   │   └── api/
│   │       └── client.ts         # HTTP client for backend API
│   ├── index.html
│   ├── package.json              # react, react-dom, vite, tailwindcss
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── server/                       # NEW — API Server
│   ├── index.ts                  # Hono server — CORS, routes, startup
│   ├── routes/
│   │   └── sessions.ts           # POST /sessions, POST /message, GET /stream
│   ├── agent-bridge.ts           # query() wrapper → SSE event emitter
│   └── session-store.ts          # In-memory session state (sessionId → SDK session)
├── src/                          # EXISTING — Agent core (unchanged)
│   ├── agent.ts                  # Subagent definitions
│   ├── copilot.ts                # System prompt, slash commands
│   ├── mcp-servers/              # browser-mcp, property-kb-mcp, tracker-mcp
│   ├── knowledge-base/           # All KB modules
│   ├── portals/                  # Portal automation modules
│   └── types/                    # Shared types
├── package.json                  # Add "dev" script that runs both
└── .claude/skills/               # Agent skills (unchanged)
```

## Styling

- **Tailwind CSS** for utility-first styling
- Clean, minimal design — white/light gray background, indigo accent color
- Mobile-responsive (property buyers browse on phones)
- No component library initially — raw Tailwind + custom components

## Key Behaviors

### Streaming
Tool calls and agent text stream in real-time via SSE. The user sees:
1. Tool progress: "Searching GujRERA..." with spinner
2. Tool result: spinner → checkmark (✓ Found) or warning (⚠ CAPTCHA)
3. Agent response: text appears word-by-word or in chunks

### Error Handling
- Portal failures shown inline: "⚠ eCourts — CAPTCHA blocked. Skipping, will continue with other checks."
- Network disconnection: auto-reconnect SSE with exponential backoff
- Agent error: show error message with "Retry" button

### Session Persistence
- Session ID stored in localStorage
- On page load, check for existing session → offer "Resume previous session?" or "Start new"
- Sessions survive page refresh (SSE reconnects, chat history preserved via backend)

## Slash Command Handling

When the user types a `/command` in the chat input:
1. Frontend recognizes it starts with `/`
2. Sends as a regular message via `POST /api/sessions/:id/message`
3. Backend routes through the existing slash command system in `copilot.ts`
4. Response streams back via SSE

Quick action buttons simply insert the command text and auto-send.

## What's NOT in v1

- No authentication / user accounts
- No persistent database (in-memory sessions)
- No PDF export of dossier
- No report view panel (markdown in chat is fine for v1)
- No dark mode toggle (pick one theme)
- No mobile app (responsive web is sufficient)
- No multi-language support

## Development Workflow

```bash
# Install dependencies
cd implementation/real-estate-agent
npm install                    # Backend deps (existing)
cd web && npm install          # Frontend deps (new)

# Development
npm run dev                    # Starts both Vite (:5173) + Hono (:3001)

# Open browser
open http://localhost:5173
```

The `dev` script in the root `package.json` uses `concurrently` to run both servers:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:web\"",
    "dev:server": "tsx server/index.ts",
    "dev:web": "cd web && npm run dev"
  }
}
```
