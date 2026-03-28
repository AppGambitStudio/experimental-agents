# Real Estate Agent Web UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web UI (Vite+React frontend + Hono API backend) that makes the real estate agent accessible to non-technical property buyers via a 3-step wizard → interactive chat flow.

**Architecture:** Vite+React SPA talks to a Hono API server via REST + SSE. The Hono server wraps the existing Claude Agent SDK `query()` function with all 3 MCP servers (browser-mcp, property-kb-mcp, tracker-mcp) running in-process. SSE streams tool calls and agent responses to the frontend in real-time. Single `npm run dev` starts both.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, Hono, Claude Agent SDK, SSE (EventSource), TypeScript

---

## File Structure

```
implementation/real-estate-agent/
├── server/                           # NEW — Hono API server
│   ├── index.ts                      # Server entry: Hono app, CORS, routes, listen on :3001
│   ├── session-store.ts              # In-memory Map<sessionId, SessionState> with SDK session IDs
│   ├── agent-bridge.ts               # Wraps query() → emits SSE-compatible events via EventEmitter
│   └── routes/
│       └── sessions.ts               # POST /api/sessions, POST /api/sessions/:id/message, GET /api/sessions/:id/stream
├── web/                              # NEW — Vite+React frontend
│   ├── index.html                    # SPA entry point
│   ├── package.json                  # react, react-dom, vite, tailwindcss, @tailwindcss/vite
│   ├── vite.config.ts                # Dev server on :5173, proxy /api → :3001
│   ├── tsconfig.json                 # Frontend TS config
│   └── src/
│       ├── main.tsx                  # React root mount
│       ├── App.tsx                   # Top-level: wizard → chat state machine
│       ├── types.ts                  # SSE event types, wizard form data, message types
│       ├── api/
│       │   └── client.ts            # createSession(), sendMessage(), streamEvents()
│       ├── hooks/
│       │   ├── useAgentStream.ts    # SSE connection, auto-reconnect, message accumulation
│       │   └── useSession.ts        # Session lifecycle: create, resume from localStorage
│       └── components/
│           ├── Wizard.tsx           # 3-step wizard container with progress bar
│           ├── WizardStep.tsx       # Step wrapper (title, fields, next/back buttons)
│           ├── Chat.tsx             # Chat container: message list + input bar + quick actions
│           ├── MessageBubble.tsx    # Single message (agent/user/system) with markdown rendering
│           ├── ToolProgress.tsx     # "Searching GujRERA..." spinner → result indicator
│           ├── QuickActions.tsx     # Slash command button bar
│           └── SessionHeader.tsx    # Collapsed wizard info bar at top of chat
├── src/                              # EXISTING — unchanged
├── package.json                      # MODIFY — add dev/dev:server/dev:web scripts + concurrently + hono deps
└── tsconfig.json                     # MODIFY — add server/ to include paths
```

---

## Task 1: Backend — Project Setup & Session Store

**Files:**
- Modify: `implementation/real-estate-agent/package.json`
- Modify: `implementation/real-estate-agent/tsconfig.json`
- Create: `implementation/real-estate-agent/server/session-store.ts`

- [ ] **Step 1: Install backend dependencies**

```bash
cd implementation/real-estate-agent
npm install hono @hono/node-server concurrently
```

- [ ] **Step 2: Update package.json scripts**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "analyze": "tsx src/cli.ts",
    "copilot": "tsx src/copilot-cli.ts",
    "dev": "concurrently --names server,web --prefix-colors blue,green \"npm run dev:server\" \"npm run dev:web\"",
    "dev:server": "tsx --watch server/index.ts",
    "dev:web": "cd web && npm run dev",
    "test": "node --import tsx --test src/tests/*.test.ts",
    "test-tools": "tsx src/test-tools.ts",
    "typecheck": "tsc --noEmit --project tsconfig.json",
    "build": "tsc"
  }
}
```

- [ ] **Step 3: Update tsconfig.json to include server/**

Replace the `include` and `rootDir` fields:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "server/**/*"],
  "exclude": ["node_modules", "dist", "web"]
}
```

- [ ] **Step 4: Create session store**

Create `server/session-store.ts`:

```typescript
// In-memory session store
// Maps our session IDs to SDK session IDs and conversation state

export interface SessionState {
  id: string;
  sdkSessionId?: string;
  address: string;
  state: string;
  city: string;
  propertyType: string;
  budget: number;
  builderName?: string;
  reraId?: string;
  primaryConcern: string;
  messages: Array<{ role: "user" | "agent" | "system"; content: string; timestamp: string }>;
  createdAt: string;
  status: "created" | "active" | "error";
}

const sessions = new Map<string, SessionState>();

let counter = 0;

export function createSession(data: Omit<SessionState, "id" | "messages" | "createdAt" | "status">): SessionState {
  const id = `sess_${Date.now()}_${++counter}`;
  const session: SessionState = {
    ...data,
    id,
    messages: [],
    createdAt: new Date().toISOString(),
    status: "created",
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, update: Partial<SessionState>): void {
  const session = sessions.get(id);
  if (session) {
    Object.assign(session, update);
  }
}

export function addMessage(
  id: string,
  role: "user" | "agent" | "system",
  content: string
): void {
  const session = sessions.get(id);
  if (session) {
    session.messages.push({ role, content, timestamp: new Date().toISOString() });
  }
}
```

- [ ] **Step 5: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json server/session-store.ts
git commit -m "feat: add backend project setup and session store"
```

---

## Task 2: Backend — Agent Bridge

**Files:**
- Create: `implementation/real-estate-agent/server/agent-bridge.ts`

The agent bridge wraps the existing `query()` call and emits structured events that can be sent via SSE. It reuses `COPILOT_SYSTEM_PROMPT`, MCP servers, and the `TOOL_DISPLAY` map from the existing copilot.

- [ ] **Step 1: Create agent-bridge.ts**

Create `server/agent-bridge.ts`:

```typescript
// Agent Bridge — wraps Claude Agent SDK query() into an event emitter
// Reuses MCP servers and system prompt from the existing copilot

import { query } from "@anthropic-ai/claude-agent-sdk";
import { EventEmitter } from "events";
import { browserMcp } from "../src/mcp-servers/browser-mcp.js";
import { propertyKbMcp } from "../src/mcp-servers/property-kb-mcp.js";
import { trackerMcp } from "../src/mcp-servers/tracker-mcp.js";

// Re-export the system prompt and tool display from copilot
// We import the copilot module to reuse COPILOT_SYSTEM_PROMPT
// but since it's not exported, we define the essentials here.
// In a future refactor, these should be extracted to a shared module.

const TOOL_DISPLAY: Record<string, string> = {
  "mcp__browser-mcp__search_rera_project": "Searching GujRERA portal",
  "mcp__browser-mcp__get_rera_project_details": "Fetching RERA project details",
  "mcp__browser-mcp__take_portal_screenshot": "Taking portal screenshot",
  "mcp__browser-mcp__search_ecourts": "Searching eCourts for litigation",
  "mcp__browser-mcp__search_anyror_land_record": "Searching AnyRoR land records",
  "mcp__browser-mcp__search_anyror_by_owner": "Searching AnyRoR by owner",
  "mcp__browser-mcp__search_garvi_document": "Searching GARVI documents",
  "mcp__browser-mcp__lookup_garvi_jantri": "Looking up jantri rates",
  "mcp__browser-mcp__check_smc_property_tax": "Checking SMC property tax",
  "mcp__browser-mcp__verify_gstin": "Verifying builder GST registration",
  "mcp__property-kb-mcp__get_jantri_rate": "Looking up jantri rate",
  "mcp__property-kb-mcp__calculate_stamp_duty": "Calculating stamp duty",
  "mcp__property-kb-mcp__check_red_flags": "Checking red flag patterns",
  "mcp__property-kb-mcp__get_required_documents": "Getting document checklist",
  "mcp__property-kb-mcp__calculate_total_cost": "Calculating total cost",
  "mcp__property-kb-mcp__get_registration_guide": "Loading registration guide",
  "mcp__property-kb-mcp__get_post_purchase_checklist": "Loading post-purchase checklist",
  "mcp__property-kb-mcp__get_verification_limitations": "Loading verification limitations",
  "mcp__property-kb-mcp__review_report": "Running critic review",
  "mcp__tracker-mcp__create_purchase": "Registering purchase",
  "mcp__tracker-mcp__log_verification": "Logging verification step",
  "mcp__tracker-mcp__get_verification_log": "Loading verification log",
  "mcp__tracker-mcp__update_phase": "Updating purchase phase",
  "mcp__tracker-mcp__get_purchase_summary": "Getting purchase summary",
  "mcp__tracker-mcp__track_checklist_item": "Tracking checklist progress",
};

export interface AgentEvent {
  type: "tool_call" | "tool_result" | "text" | "done" | "error" | "session_id";
  data: Record<string, unknown>;
}

export interface RunTurnOptions {
  prompt: string;
  systemPrompt: string;
  sdkSessionId?: string;
}

/**
 * Run a single agent turn and emit events via the returned EventEmitter.
 * The caller listens for 'event' emissions of type AgentEvent.
 */
export function runAgentTurn(options: RunTurnOptions): EventEmitter {
  const emitter = new EventEmitter();

  const execute = async () => {
    try {
      const queryOptions: Parameters<typeof query>[0] = {
        prompt: options.prompt,
        options: {
          systemPrompt: options.systemPrompt,
          mcpServers: {
            "browser-mcp": browserMcp,
            "property-kb-mcp": propertyKbMcp,
            "tracker-mcp": trackerMcp,
          },
          model: "sonnet",
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 15,
          ...(options.sdkSessionId ? { resume: options.sdkSessionId } : {}),
        },
      };

      for await (const message of query(queryOptions)) {
        // Capture SDK session ID
        if ("type" in message && message.type === "system" && "subtype" in message) {
          const sysMsg = message as { type: "system"; subtype: string; session_id?: string };
          if (sysMsg.subtype === "init" && sysMsg.session_id) {
            emitter.emit("event", {
              type: "session_id",
              data: { sessionId: sysMsg.session_id },
            } satisfies AgentEvent);
          }
        }

        // Tool use blocks
        if ("type" in message && message.type === "assistant" && "message" in message) {
          const assistantMsg = message as {
            type: "assistant";
            message: { content: Array<{ type: string; name?: string; text?: string }> };
          };
          const content = assistantMsg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_use" && block.name) {
                const display = TOOL_DISPLAY[block.name] ?? block.name.replace(/mcp__[^_]+__/, "");
                emitter.emit("event", {
                  type: "tool_call",
                  data: { tool: block.name, display },
                } satisfies AgentEvent);
              }
            }
          }
        }

        // Final result
        if ("type" in message && message.type === "result") {
          const resultMsg = message as {
            type: "result";
            subtype: string;
            result?: string;
            num_turns?: number;
            total_cost_usd?: number;
            duration_ms?: number;
            session_id?: string;
          };

          if (resultMsg.subtype === "success" && resultMsg.result) {
            emitter.emit("event", {
              type: "text",
              data: { content: resultMsg.result },
            } satisfies AgentEvent);
          }

          emitter.emit("event", {
            type: "done",
            data: {
              turns: resultMsg.num_turns,
              costUsd: resultMsg.total_cost_usd,
              durationMs: resultMsg.duration_ms,
              sessionId: resultMsg.session_id,
            },
          } satisfies AgentEvent);
        }
      }
    } catch (error) {
      emitter.emit("event", {
        type: "error",
        data: { message: error instanceof Error ? error.message : String(error) },
      } satisfies AgentEvent);
    }
  };

  // Run asynchronously — the caller attaches listeners before events fire
  execute();

  return emitter;
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/agent-bridge.ts
git commit -m "feat: add agent bridge — wraps SDK query into SSE events"
```

---

## Task 3: Backend — Hono Server & Routes

**Files:**
- Create: `implementation/real-estate-agent/server/routes/sessions.ts`
- Create: `implementation/real-estate-agent/server/index.ts`

- [ ] **Step 1: Create session routes**

Create `server/routes/sessions.ts`:

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createSession, getSession, updateSession, addMessage } from "../session-store.js";
import { runAgentTurn } from "../agent-bridge.js";

// The copilot system prompt — imported from the existing copilot module
// For now, we read it from the source to avoid circular deps.
// The system prompt is defined as a const in copilot.ts but not exported.
// We duplicate the reference here; in a refactor this would be a shared constant.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const copilotSource = readFileSync(resolve(__dirname, "../../src/copilot.ts"), "utf-8");
const systemPromptMatch = copilotSource.match(/const COPILOT_SYSTEM_PROMPT = `([\s\S]*?)`;/);
const SYSTEM_PROMPT = systemPromptMatch
  ? systemPromptMatch[1]!
  : "You are a Real Estate Transaction Copilot specializing in Gujarat property verification.";

const app = new Hono();

// POST /api/sessions — create a new session
app.post("/", async (c) => {
  const body = await c.req.json<{
    address: string;
    state: string;
    city: string;
    propertyType: string;
    budget: number;
    builderName?: string;
    reraId?: string;
    primaryConcern: string;
  }>();

  if (!body.address || !body.propertyType || !body.budget) {
    return c.json({ error: "address, propertyType, and budget are required" }, 400);
  }

  const session = createSession({
    address: body.address,
    state: body.state || "Gujarat",
    city: body.city || "Surat",
    propertyType: body.propertyType,
    budget: body.budget,
    builderName: body.builderName,
    reraId: body.reraId,
    primaryConcern: body.primaryConcern || "all",
  });

  // Build the initial prompt (same as copilot-cli.ts)
  const initialPrompt = `The buyer wants to verify a property interactively. Here are the details:

- Address: ${session.address}
${session.reraId ? `- RERA ID: ${session.reraId}` : "- RERA ID: not provided yet"}
${session.builderName ? `- Builder: ${session.builderName}` : "- Builder: not provided yet"}
- Property type: ${session.propertyType}
- Budget: Rs ${session.budget.toLocaleString("en-IN")}
- State: ${session.state}
- Primary concern: ${session.primaryConcern}

Start by:
1. Create a purchase record using create_purchase
2. Give a quick overview — property details and first impression
3. Ask the buyer 2-3 contextual questions about their specific situation

Remember: this is a conversation, not a report. Keep the first response concise — overview + questions only.`;

  addMessage(session.id, "system", `Session created for ${session.address}`);

  // Start the first agent turn in the background — results come via SSE
  const emitter = runAgentTurn({
    prompt: initialPrompt,
    systemPrompt: SYSTEM_PROMPT,
  });

  emitter.on("event", (event) => {
    if (event.type === "session_id") {
      updateSession(session.id, { sdkSessionId: event.data.sessionId as string, status: "active" });
    }
    if (event.type === "text") {
      addMessage(session.id, "agent", event.data.content as string);
    }
    // Store events for SSE pickup (see stream route)
    const s = getSession(session.id);
    if (s) {
      if (!( s as any)._pendingEvents) (s as any)._pendingEvents = [];
      (s as any)._pendingEvents.push(event);
    }
  });

  return c.json({ sessionId: session.id, status: "created" });
});

// POST /api/sessions/:id/message — send a user message
app.post("/:id/message", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const body = await c.req.json<{ message: string }>();
  if (!body.message) {
    return c.json({ error: "message is required" }, 400);
  }

  addMessage(sessionId, "user", body.message);

  // Run the agent turn
  const emitter = runAgentTurn({
    prompt: body.message,
    systemPrompt: SYSTEM_PROMPT,
    sdkSessionId: session.sdkSessionId,
  });

  emitter.on("event", (event) => {
    if (event.type === "session_id") {
      updateSession(sessionId, { sdkSessionId: event.data.sessionId as string });
    }
    if (event.type === "text") {
      addMessage(sessionId, "agent", event.data.content as string);
    }
    const s = getSession(sessionId);
    if (s) {
      if (!(s as any)._pendingEvents) (s as any)._pendingEvents = [];
      (s as any)._pendingEvents.push(event);
    }
  });

  return c.json({ status: "processing" });
});

// GET /api/sessions/:id/stream — SSE stream
app.get("/:id/stream", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Send any pending events immediately
    const pending = (session as any)._pendingEvents as Array<{ type: string; data: Record<string, unknown> }> | undefined;
    if (pending) {
      for (const event of pending) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data) });
      }
      (session as any)._pendingEvents = [];
    }

    // Send existing messages as history
    for (const msg of session.messages) {
      await stream.writeSSE({
        event: "history",
        data: JSON.stringify(msg),
      });
    }

    // Keep connection alive and relay new events
    // Poll for new events every 500ms (simple approach for v1)
    let lastCount = session.messages.length;
    const interval = setInterval(async () => {
      const s = getSession(sessionId);
      if (!s) {
        clearInterval(interval);
        return;
      }

      // Send new pending events
      const newPending = (s as any)._pendingEvents as Array<{ type: string; data: Record<string, unknown> }> | undefined;
      if (newPending && newPending.length > 0) {
        for (const event of newPending) {
          try {
            await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data) });
          } catch {
            clearInterval(interval);
            return;
          }
        }
        (s as any)._pendingEvents = [];
      }
    }, 500);

    // Clean up on disconnect
    stream.onAbort(() => {
      clearInterval(interval);
    });

    // Keep the stream open
    while (true) {
      await stream.writeSSE({ event: "ping", data: "" });
      await stream.sleep(15000);
    }
  });
});

// GET /api/sessions/:id — get session info
app.get("/:id", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    id: session.id,
    address: session.address,
    propertyType: session.propertyType,
    budget: session.budget,
    builderName: session.builderName,
    status: session.status,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
  });
});

export { app as sessionRoutes };
```

- [ ] **Step 2: Create server entry point**

Create `server/index.ts`:

```typescript
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { sessionRoutes } from "./routes/sessions.js";

const app = new Hono();

// CORS — allow frontend dev server
app.use("/api/*", cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

// Routes
app.route("/api/sessions", sessionRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

const port = parseInt(process.env.PORT || "3001", 10);

console.log(`\n  Real Estate Agent API Server`);
console.log(`  http://localhost:${port}`);
console.log(`  Press Ctrl+C to stop\n`);

serve({ fetch: app.fetch, port });
```

- [ ] **Step 3: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Test server starts**

```bash
npx tsx server/index.ts &
sleep 2
curl http://localhost:3001/api/health
kill %1
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat: add Hono API server with session routes and SSE streaming"
```

---

## Task 4: Frontend — Project Scaffold

**Files:**
- Create: `implementation/real-estate-agent/web/package.json`
- Create: `implementation/real-estate-agent/web/index.html`
- Create: `implementation/real-estate-agent/web/vite.config.ts`
- Create: `implementation/real-estate-agent/web/tsconfig.json`
- Create: `implementation/real-estate-agent/web/src/main.tsx`
- Create: `implementation/real-estate-agent/web/src/App.tsx`
- Create: `implementation/real-estate-agent/web/src/types.ts`
- Create: `implementation/real-estate-agent/web/src/index.css`

- [ ] **Step 1: Create web/package.json**

```json
{
  "name": "real-estate-agent-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-markdown": "^10.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.4",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.1",
    "tailwindcss": "^4.1.4",
    "typescript": "^5.8.3",
    "vite": "^6.3.2"
  }
}
```

- [ ] **Step 2: Create web/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Create web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Property Verification Copilot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create web/src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Create web/src/types.ts**

```typescript
// Frontend types for SSE events and UI state

export interface WizardData {
  address: string;
  state: string;
  city: string;
  propertyType: string;
  budget: number;
  builderName: string;
  reraId: string;
  primaryConcern: string;
}

export type AppPhase = "wizard" | "loading" | "chat";

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
}

export interface ToolCallEvent {
  tool: string;
  display: string;
  status: "running" | "done";
}

export type SSEEventType = "tool_call" | "text" | "done" | "error" | "history" | "session_id" | "ping";
```

- [ ] **Step 7: Create web/src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 8: Create web/src/App.tsx**

```tsx
import { useState } from "react";
import type { WizardData, AppPhase, ChatMessage, ToolCallEvent } from "./types";
import Wizard from "./components/Wizard";
import Chat from "./components/Chat";
import SessionHeader from "./components/SessionHeader";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("wizard");
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTools, setActiveTools] = useState<ToolCallEvent[]>([]);

  const handleWizardSubmit = async (data: WizardData) => {
    setWizardData(data);
    setPhase("loading");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const { sessionId: sid } = await res.json();
      setSessionId(sid);
      localStorage.setItem("sessionId", sid);
      setPhase("chat");

      // Start SSE stream
      const eventSource = new EventSource(`/api/sessions/${sid}/stream`);

      eventSource.addEventListener("tool_call", (e) => {
        const data = JSON.parse(e.data);
        setActiveTools((prev) => [...prev, { ...data, status: "running" }]);
      });

      eventSource.addEventListener("text", (e) => {
        const data = JSON.parse(e.data);
        setMessages((prev) => [
          ...prev,
          { id: `msg_${Date.now()}`, role: "agent", content: data.content, timestamp: new Date().toISOString() },
        ]);
        setActiveTools([]);
      });

      eventSource.addEventListener("history", (e) => {
        const msg = JSON.parse(e.data);
        setMessages((prev) => {
          if (prev.some((m) => m.timestamp === msg.timestamp && m.content === msg.content)) return prev;
          return [...prev, { id: `msg_${Date.now()}_${Math.random()}`, ...msg }];
        });
      });

      eventSource.addEventListener("error", () => {
        // SSE auto-reconnects
      });
    } catch (error) {
      console.error("Failed to create session:", error);
      setPhase("wizard");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    setMessages((prev) => [
      ...prev,
      { id: `msg_${Date.now()}`, role: "user", content: message, timestamp: new Date().toISOString() },
    ]);

    await fetch(`/api/sessions/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Property Verification Copilot</h1>
        <p className="text-sm text-gray-500">Gujarat Real Estate Due Diligence</p>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {phase === "wizard" && <Wizard onSubmit={handleWizardSubmit} />}

        {phase === "loading" && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600">Starting property verification...</p>
            </div>
          </div>
        )}

        {phase === "chat" && wizardData && (
          <>
            <SessionHeader data={wizardData} />
            <Chat
              messages={messages}
              activeTools={activeTools}
              onSendMessage={handleSendMessage}
            />
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Install frontend dependencies**

```bash
cd web && npm install
```

- [ ] **Step 10: Commit**

```bash
cd ..
git add web/package.json web/vite.config.ts web/tsconfig.json web/index.html web/src/
git commit -m "feat: add frontend scaffold — Vite+React+Tailwind with App shell"
```

---

## Task 5: Frontend — Wizard Component

**Files:**
- Create: `implementation/real-estate-agent/web/src/components/Wizard.tsx`
- Create: `implementation/real-estate-agent/web/src/components/WizardStep.tsx`

- [ ] **Step 1: Create WizardStep.tsx**

Create `web/src/components/WizardStep.tsx`:

```tsx
interface WizardStepProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function WizardStep({ title, subtitle, children }: WizardStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create Wizard.tsx**

Create `web/src/components/Wizard.tsx`:

```tsx
import { useState } from "react";
import type { WizardData } from "../types";
import WizardStep from "./WizardStep";

const PROPERTY_TYPES = [
  { value: "residential_flat", label: "Flat", icon: "🏢" },
  { value: "plot", label: "Plot", icon: "🏗️" },
  { value: "row_house", label: "Row House", icon: "🏠" },
  { value: "villa", label: "Villa", icon: "🏡" },
  { value: "commercial_office", label: "Commercial", icon: "🏛️" },
];

const CONCERNS = [
  { value: "all", label: "All of the above" },
  { value: "builder", label: "Builder reliability" },
  { value: "legal", label: "Legal clearance" },
  { value: "cost", label: "Total cost breakdown" },
];

interface WizardProps {
  onSubmit: (data: WizardData) => void;
}

export default function Wizard({ onSubmit }: WizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    address: "",
    state: "Gujarat",
    city: "Surat",
    propertyType: "",
    budget: 0,
    builderName: "",
    reraId: "",
    primaryConcern: "all",
  });

  const update = (fields: Partial<WizardData>) => setData((prev) => ({ ...prev, ...fields }));

  const canNext = () => {
    if (step === 1) return data.address.length > 0;
    if (step === 2) return data.propertyType.length > 0 && data.budget > 0;
    return true;
  };

  const handleSubmit = () => {
    if (canNext()) onSubmit(data);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-indigo-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <WizardStep title="Where is the property?" subtitle="Enter the location details">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address / Area</label>
              <input
                type="text"
                value={data.address}
                onChange={(e) => update({ address: e.target.value })}
                placeholder="e.g. Vesu, Surat or Near Science Centre, Adajan"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={data.state}
                  onChange={(e) => update({ state: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Gujarat">Gujarat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={data.city}
                  onChange={(e) => update({ city: e.target.value })}
                  placeholder="Surat"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        </WizardStep>
      )}

      {step === 2 && (
        <WizardStep title="Property details" subtitle="What type of property are you looking at?">
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => update({ propertyType: pt.value })}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                    data.propertyType === pt.value
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl mb-1">{pt.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{pt.label}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget (Rs)</label>
              <input
                type="number"
                value={data.budget || ""}
                onChange={(e) => update({ budget: parseInt(e.target.value) || 0 })}
                placeholder="e.g. 7500000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {data.budget > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Rs {data.budget.toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Builder name (optional)</label>
              <input
                type="text"
                value={data.builderName}
                onChange={(e) => update({ builderName: e.target.value })}
                placeholder="Builder or developer name, if known"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </WizardStep>
      )}

      {step === 3 && (
        <WizardStep title="RERA & priorities" subtitle="Help us focus the verification">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RERA ID (optional)</label>
              <input
                type="text"
                value={data.reraId}
                onChange={(e) => update({ reraId: e.target.value })}
                placeholder="PR/GJ/SURAT/..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Find this on the builder's brochure or GujRERA portal</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">What's your main concern?</label>
              <div className="space-y-2">
                {CONCERNS.map((c) => (
                  <label
                    key={c.value}
                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      data.primaryConcern === c.value
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="concern"
                      value={c.value}
                      checked={data.primaryConcern === c.value}
                      onChange={(e) => update({ primaryConcern: e.target.value })}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </WizardStep>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            onClick={() => canNext() && setStep((s) => s + 1)}
            disabled={!canNext()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Start Verification
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Wizard.tsx web/src/components/WizardStep.tsx
git commit -m "feat: add 3-step wizard component — location, property, RERA"
```

---

## Task 6: Frontend — Chat Components

**Files:**
- Create: `implementation/real-estate-agent/web/src/components/MessageBubble.tsx`
- Create: `implementation/real-estate-agent/web/src/components/ToolProgress.tsx`
- Create: `implementation/real-estate-agent/web/src/components/QuickActions.tsx`
- Create: `implementation/real-estate-agent/web/src/components/SessionHeader.tsx`
- Create: `implementation/real-estate-agent/web/src/components/Chat.tsx`

- [ ] **Step 1: Create MessageBubble.tsx**

Create `web/src/components/MessageBubble.tsx`:

```tsx
import Markdown from "react-markdown";
import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className="text-center py-2">
        <span className="text-xs text-gray-400">{message.content}</span>
      </div>
    );
  }

  const isAgent = message.role === "agent";

  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isAgent
            ? "bg-white border border-gray-200 text-gray-800"
            : "bg-indigo-600 text-white"
        }`}
      >
        {isAgent && (
          <p className="text-xs font-semibold text-indigo-600 mb-1">Property Copilot</p>
        )}
        <div className={`text-sm leading-relaxed ${isAgent ? "prose prose-sm max-w-none" : ""}`}>
          {isAgent ? (
            <Markdown>{message.content}</Markdown>
          ) : (
            <p>{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ToolProgress.tsx**

Create `web/src/components/ToolProgress.tsx`:

```tsx
import type { ToolCallEvent } from "../types";

interface ToolProgressProps {
  tools: ToolCallEvent[];
}

export default function ToolProgress({ tools }: ToolProgressProps) {
  if (tools.length === 0) return null;

  return (
    <div className="mb-4 space-y-1.5">
      {tools.map((tool, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full" />
          <span>{tool.display}...</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create QuickActions.tsx**

Create `web/src/components/QuickActions.tsx`:

```tsx
interface QuickActionsProps {
  onAction: (command: string) => void;
}

const ACTIONS = [
  { command: "/summary", label: "Summary" },
  { command: "/risks", label: "Red Flags" },
  { command: "/cost", label: "Total Cost" },
  { command: "/dossier", label: "Full Report" },
  { command: "/help", label: "All Commands" },
];

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ACTIONS.map((action) => (
        <button
          key={action.command}
          onClick={() => onAction(action.command)}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create SessionHeader.tsx**

Create `web/src/components/SessionHeader.tsx`:

```tsx
import type { WizardData } from "../types";

interface SessionHeaderProps {
  data: WizardData;
}

export default function SessionHeader({ data }: SessionHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-4 text-sm">
      <div className="flex-1">
        <span className="font-medium text-gray-900">{data.address}</span>
        <span className="text-gray-400 mx-2">|</span>
        <span className="text-gray-600">{data.propertyType.replace(/_/g, " ")}</span>
        <span className="text-gray-400 mx-2">|</span>
        <span className="text-gray-600">Rs {data.budget.toLocaleString("en-IN")}</span>
      </div>
      {data.builderName && (
        <span className="text-gray-500 text-xs">Builder: {data.builderName}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create Chat.tsx**

Create `web/src/components/Chat.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import type { ChatMessage, ToolCallEvent } from "../types";
import MessageBubble from "./MessageBubble";
import ToolProgress from "./ToolProgress";
import QuickActions from "./QuickActions";

interface ChatProps {
  messages: ChatMessage[];
  activeTools: ToolCallEvent[];
  onSendMessage: (message: string) => void;
}

export default function Chat({ messages, activeTools, onSendMessage }: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTools]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (command: string) => {
    onSendMessage(command);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <ToolProgress tools={activeTools} />
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions + Input */}
      <div className="border-t border-gray-200 bg-white pt-3 pb-2 space-y-3">
        <QuickActions onAction={handleQuickAction} />
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or type /help for commands..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/components/
git commit -m "feat: add chat components — messages, tool progress, quick actions"
```

---

## Task 7: Integration Test — End-to-End

**Files:** No new files — testing the full flow

- [ ] **Step 1: Start both servers**

```bash
cd implementation/real-estate-agent
npm run dev
```

Expected output:
```
[server] Real Estate Agent API Server
[server] http://localhost:3001
[web] VITE v6.x.x ready in Xms
[web] Local: http://localhost:5173/
```

- [ ] **Step 2: Open browser and test wizard**

Open `http://localhost:5173`. Verify:
- Step 1: Address input, state dropdown, city input all render
- Step 2: Property type cards are clickable, budget accepts numbers, Indian formatting shows
- Step 3: RERA ID input, concern radio buttons, "Start Verification" button

- [ ] **Step 3: Test wizard submission → chat transition**

Fill in wizard with test data:
- Address: "Vesu, Surat"
- Type: Flat
- Budget: 7500000
- Click "Start Verification"

Verify:
- Loading spinner appears
- Chat UI opens with session header showing property details
- Tool progress shows "Registering purchase...", "Searching GujRERA..."
- Agent response appears in a message bubble

- [ ] **Step 4: Test chat interaction**

Type a message in the chat input and send. Verify:
- User message appears right-aligned in indigo
- Agent response streams back
- Quick action buttons work (click "Summary" → sends `/summary`)

- [ ] **Step 5: Commit final integration**

```bash
git add -A
git commit -m "feat: complete real estate agent web UI — wizard + chat + SSE streaming"
```

- [ ] **Step 6: Push**

```bash
git push
```
