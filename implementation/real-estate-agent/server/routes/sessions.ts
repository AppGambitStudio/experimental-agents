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
// Slash command → prompt resolution
// The SDK interprets /commands as skill invocations. We resolve them to
// natural language prompts server-side so the agent gets a plain prompt.
// ---------------------------------------------------------------------------

const SLASH_COMMANDS: Record<string, string | ((args: string) => string)> = {
  "/summary":
    "Give me a concise summary of all findings so far — overall risk rating, critical items, and top 3 things I should do next. Before presenting, call review_report to validate the summary against the verification log.",
  "/risks":
    "Run a full red flag check using check_red_flags based on everything we've verified so far. List ALL critical and high-severity risks. For each: what is it, why does it matter, and what should I do?",
  "/cost":
    "Recalculate the total cost of ownership using calculate_total_cost. If I haven't provided all details yet, ask me for: total agreed price, declared value (bank payment), carpet area, maintenance deposit, parking charges, and whether it's under construction. Then show the complete breakdown with the REAL total outflow.",
  "/dossier":
    "Generate a final due diligence dossier ready for sharing with my lawyer. Include: property overview, RERA status, litigation findings, land records, document verification, financial analysis, red flags, and verification limitations disclaimer. Before presenting, call review_report to validate completeness. Format it as a clean, professional report.",
  "/documents":
    "Show me the complete document checklist for this property type using get_required_documents. Mark which documents we've already verified and which are still pending.",
  "/verify": (portal: string) =>
    portal
      ? `Show me all verification details from the ${portal} portal. Use get_verification_log and filter for ${portal} entries. Include: what was checked, results, any red flags, and screenshots taken.`
      : "Which portal do you want to deep-dive into? Options: RERA, eCourts, AnyRoR, GARVI, SMC, GSTN.",
  "/compare-jantri":
    "Compare the agreed price against the jantri (government ready reckoner) rate using get_jantri_rate. What's the difference? What does this mean for stamp duty calculation? Is the price fair for this area?",
  "/timeline":
    "Walk me through the registration timeline step-by-step using get_registration_guide. What do I do first? How long does each step take? What documents do I need on registration day?",
  "/postpurchase":
    "After registration, what are all the formalities I need to complete? Use get_post_purchase_checklist to show me the complete list with timelines, ordered by priority (mandatory first).",
  "/next-steps":
    "Based on everything we've found so far, give me a prioritized list of the top 5 things I need to do next. What's urgent? What can wait? What needs a lawyer? Be specific and actionable.",
  "/check-builder": (name: string) =>
    name
      ? `Search for all projects by builder "${name}" on GujRERA using search_rera_project. How many projects have they done? Any complaints? What's their track record?`
      : "What's the builder's name? I'll search their RERA track record.",
  "/help":
    "List all available commands: /summary, /risks, /cost, /dossier, /documents, /verify <portal>, /compare-jantri, /timeline, /postpurchase, /next-steps, /check-builder <name>. Briefly describe each one.",
};

function resolveSlashCommand(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) return message;

  const spaceIdx = trimmed.indexOf(" ");
  const cmd = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  const handler = SLASH_COMMANDS[cmd.toLowerCase()];
  if (!handler) return message; // unknown command — pass as-is

  return typeof handler === "function" ? handler(args) : handler;
}

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

  // Resolve slash commands to natural language prompts
  const prompt = resolveSlashCommand(body.message);

  // Start agent turn with existing SDK session
  startAgentTurn(id, prompt, session.sdkSessionId);

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
