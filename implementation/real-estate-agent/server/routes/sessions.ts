// Session routes — CRUD + SSE streaming for agent sessions

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createSession,
  getSession,
  updateSession,
  addMessage,
} from "../session-store.js";
import { runAgentTurn, type AgentEvent } from "../agent-bridge.js";

// ---------------------------------------------------------------------------
// Extract COPILOT_SYSTEM_PROMPT from src/copilot.ts at startup
// ---------------------------------------------------------------------------

const copilotSource = readFileSync(
  resolve(import.meta.dirname ?? ".", "../../src/copilot.ts"),
  "utf-8"
);

const promptMatch = copilotSource.match(
  /const COPILOT_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/
);

if (!promptMatch) {
  throw new Error(
    "Could not extract COPILOT_SYSTEM_PROMPT from src/copilot.ts"
  );
}

const COPILOT_SYSTEM_PROMPT = promptMatch[1];

// ---------------------------------------------------------------------------
// Pending events storage — keyed by session ID
// ---------------------------------------------------------------------------

const pendingEvents = new Map<string, AgentEvent[]>();

function pushEvent(sessionId: string, event: AgentEvent): void {
  let queue = pendingEvents.get(sessionId);
  if (!queue) {
    queue = [];
    pendingEvents.set(sessionId, queue);
  }
  queue.push(event);
}

function drainEvents(sessionId: string): AgentEvent[] {
  const queue = pendingEvents.get(sessionId);
  if (!queue || queue.length === 0) return [];
  const events = [...queue];
  queue.length = 0;
  return events;
}

// ---------------------------------------------------------------------------
// Start an agent turn and pipe events into the pending queue
// ---------------------------------------------------------------------------

function startAgentTurn(
  sessionId: string,
  prompt: string,
  sdkSessionId?: string
): void {
  const emitter = runAgentTurn({
    prompt,
    systemPrompt: COPILOT_SYSTEM_PROMPT,
    sdkSessionId,
  });

  emitter.on("event", (event: AgentEvent) => {
    // Capture SDK session ID on the session object
    if (event.type === "session_id" && event.sessionId) {
      updateSession(sessionId, { sdkSessionId: event.sessionId });
    }

    // Store agent text as a message
    if (event.type === "text" && event.text) {
      addMessage(sessionId, "agent", event.text);
    }

    // Mark session active once we get first event
    if (event.type === "session_id") {
      updateSession(sessionId, { status: "active" });
    }

    // Mark error
    if (event.type === "error") {
      updateSession(sessionId, { status: "error" });
    }

    pushEvent(sessionId, event);
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();

// POST / — create session from wizard data
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

  const session = createSession({
    address: body.address,
    state: body.state,
    city: body.city,
    propertyType: body.propertyType,
    budget: body.budget,
    builderName: body.builderName,
    reraId: body.reraId,
    primaryConcern: body.primaryConcern,
  });

  // Build initial prompt (mirrors copilot.ts logic)
  const initialPrompt = `The buyer wants to verify a property interactively. Here are the details:

- Address: ${body.address}
${body.reraId ? `- RERA ID: ${body.reraId}` : "- RERA ID: not provided yet"}
${body.builderName ? `- Builder: ${body.builderName}` : "- Builder: not provided yet"}
- Property type: ${body.propertyType}
- Budget: Rs ${body.budget.toLocaleString("en-IN")}
- State: ${body.state}
- Primary concern: ${body.primaryConcern}

Start by:
1. Create a purchase record using create_purchase
2. Give a quick overview — property details and first impression
3. Ask the buyer 2-3 contextual questions:
   - "Is this a new construction or resale?"
   - "What's your budget?" (confirm the number)
   - "Primary concern — builder reliability, legal clearance, or pricing?"

Remember: this is a conversation, not a report. Keep the first response concise — overview + questions only.`;

  addMessage(session.id, "user", initialPrompt);

  // Start first agent turn in background
  startAgentTurn(session.id, initialPrompt);

  return c.json({ sessionId: session.id }, 201);
});

// POST /:id/message — send user message to agent
app.post("/:id/message", async (c) => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const body = await c.req.json<{ message: string }>();
  addMessage(id, "user", body.message);

  // Start agent turn with existing SDK session
  startAgentTurn(id, body.message, session.sdkSessionId);

  return c.json({ status: "processing" });
});

// GET /:id/stream — SSE stream of agent events
app.get("/:id/stream", (c) => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    let eventId = 0;

    // Send session history as initial context
    for (const msg of session.messages) {
      await stream.writeSSE({
        event: "history",
        data: JSON.stringify(msg),
        id: String(eventId++),
      });
    }

    // Keep polling for events — stream stays open for the entire session
    // (the client uses one long-lived SSE connection for all turns)
    while (true) {
      const events = drainEvents(id);

      for (const event of events) {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
            id: String(eventId++),
          });
        } catch {
          // Client disconnected
          return;
        }
      }

      // Poll interval — 500ms between checks
      await stream.sleep(500);
    }
  });
});

// GET /:id — return session info
app.get("/:id", (c) => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json(session);
});

export { app as sessionRoutes };
