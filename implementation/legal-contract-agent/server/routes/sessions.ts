// Session routes — create sessions, send messages, stream events via SSE.

import { Hono } from "hono";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createSession,
  getSession,
  updateSession,
  addMessage,
  getFile,
} from "../session-store.js";
import { chunkDocument, estimateProcessingTime } from "../chunker.js";
import { runAgentTurn, type AgentEvent } from "../agent-bridge.js";

// ── Extract system prompt from copilot.ts at startup ───────────────────────

const copilotSource = readFileSync(
  resolve(import.meta.dirname ?? ".", "../../src/copilot.ts"),
  "utf-8",
);

const promptMatch = copilotSource.match(
  /const COPILOT_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/,
);
const SYSTEM_PROMPT = promptMatch
  ? promptMatch[1]
  : "You are a Legal Contract Intelligence Copilot specializing in Indian law.";

// ── Slash command resolution ───────────────────────────────────────────────

const SLASH_COMMANDS: Record<string, string | ((args: string) => string)> = {
  "/summary":
    "Give me a concise summary of all findings so far — risk score, critical items, and top 3 things to negotiate first.",
  "/risks":
    "List ALL critical and high-risk clauses found so far. For each: quote the original text, state the risk level, cite the applicable Indian law, and explain why it matters in plain language.",
  "/playbook":
    "Generate a complete negotiation playbook based on all the risks we've discussed. Priority-ordered, with specific talking points and alternative clause language for each item.",
  "/redline":
    "Generate a redlined version — for each flagged clause, show the original text and the suggested replacement text side by side.",
  "/stamp-duty":
    "Calculate the stamp duty for this contract using get_stamp_duty. Show the duty amount, whether e-stamping is available, registration requirements, and penalty for deficiency.",
  "/checklist":
    "Use get_required_clauses to show me the complete checklist of clauses required for this contract type. Mark which ones are present and which are missing.",
  "/enforceability": (clauseType: string) =>
    clauseType
      ? `Use check_enforceability to analyze the enforceability of the "${clauseType}" clause under Indian law. Include applicable sections, case law, and practical implications.`
      : "Which clause type do you want to check enforceability for? Options: non_compete, indemnity, penalty, moral_rights, governing_law, arbitration, termination.",
  "/dossier":
    "Generate a final analysis dossier suitable for sharing with the legal team. Include: executive summary, risk score, clause-by-clause analysis, missing clauses, stamp duty, regulatory compliance, negotiation playbook, and the full limitations disclaimer. Before presenting, run a critic review to validate completeness.",
  "/next-steps":
    "Based on everything we've found so far, give me a prioritized list of the top 5 things I should do next. What's urgent? What can wait? What needs a lawyer? Be specific and actionable.",
  "/help": "",
};

function resolveSlashCommand(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  const cmd = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase();
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  if (cmd === "/help") {
    // Return help text directly — no agent call needed
    return null;
  }

  const handler = SLASH_COMMANDS[cmd];
  if (!handler) return null;
  if (typeof handler === "function") return handler(args);
  return handler;
}

// ── Pending events store (polled by SSE) ───────────────────────────────────

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
  const drained = [...queue];
  queue.length = 0;
  return drained;
}

// ── Routes ─────────────────────────────────────────────────────────────────

const sessionRoutes = new Hono();

// POST / — create session and start initial analysis
sessionRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    fileId: string;
    counterparty: string;
    contractType: string;
    ourRole: string;
    state: string;
    contractValue?: number;
  }>();

  const file = getFile(body.fileId);
  if (!file) {
    return c.json({ error: "File not found. Upload a file first." }, 404);
  }

  const chunkResult = chunkDocument(file.text, file.pageCount);

  const session = createSession({
    fileId: body.fileId,
    fileName: file.fileName,
    counterparty: body.counterparty,
    contractType: body.contractType,
    ourRole: body.ourRole,
    state: body.state,
    contractValue: body.contractValue,
    pageCount: file.pageCount,
    wordCount: file.wordCount,
    chunkCount: chunkResult.chunks.length,
  });

  updateSession(session.id, { status: "analyzing" });

  // Start analysis in background
  const runAnalysis = async () => {
    try {
      if (chunkResult.isSinglePass) {
        // Single pass — send the full text in one agent turn
        const initialPrompt = buildInitialPrompt(
          file.text,
          body.counterparty,
          body.contractType,
          body.ourRole,
          body.state,
          body.contractValue,
        );

        await runAgentTurnAndCollect(session.id, initialPrompt);
      } else {
        // Chunked analysis — NON-CONVERSATIONAL extraction phase
        // Each chunk uses a focused extraction prompt (no questions, no chat)
        // Only the final consolidation uses the full copilot prompt for conversation
        const totalChunks = chunkResult.chunks.length;
        const allFindings: string[] = [];

        const EXTRACTION_PROMPT = `You are a contract risk extraction engine. Your job is to analyze a single clause and output ONLY the findings — no questions, no conversation, no "would you like to know more". Be direct and concise.

For each risk found, output exactly:
- **[SEVERITY] Clause X.X: Title** — One-sentence description of the risk and the applicable Indian law.

If no risks are found in this clause, output: "No risks identified in this clause."

Use search_clause_patterns and check_enforceability tools to validate your findings. Do NOT ask the user any questions.`;

        for (let i = 0; i < totalChunks; i++) {
          const chunk = chunkResult.chunks[i];
          pushEvent(session.id, {
            type: "chunk_progress",
            data: {
              current: i + 1,
              total: totalChunks,
              clauseNumber: chunk.clauseNumber,
              clauseTitle: chunk.clauseTitle,
              status: "analyzing",
            },
          });

          const chunkPrompt = `Contract: ${body.contractType} between us (${body.ourRole}) and ${body.counterparty}. State: ${body.state}.

${chunkResult.definitionsText ? `DEFINITIONS (for reference):\n${chunkResult.definitionsText.slice(0, 2000)}\n\n---\n\n` : ""}CLAUSE ${chunk.clauseNumber} — ${chunk.clauseTitle} (pages ${chunk.pageStart}-${chunk.pageEnd}):

${chunk.text}

Extract risks. Use search_clause_patterns and check_enforceability. Output findings only — no questions.`;

          // Use extraction prompt instead of conversational copilot prompt
          await new Promise<void>((resolve) => {
            const emitter = runAgentTurn({
              prompt: chunkPrompt,
              systemPrompt: EXTRACTION_PROMPT,
              sessionId: undefined, // fresh context per chunk — no conversation carryover
            });

            emitter.on("event", (event: AgentEvent) => {
              if (event.type === "text") {
                const text = (event as any).text ?? (event as any).data?.text ?? "";
                if (text) allFindings.push(`### Chunk ${i + 1}: ${chunk.clauseTitle}\n${text}`);
                // Don't stream chunk text to the user — collect silently
              }
              if (event.type === "done" || event.type === "error") {
                pushEvent(session.id, {
                  type: "chunk_progress",
                  data: {
                    current: i + 1,
                    total: totalChunks,
                    clauseNumber: chunk.clauseNumber,
                    clauseTitle: chunk.clauseTitle,
                    status: "done",
                  },
                });
                resolve();
              }
            });
          });
        }

        // Consolidation — now use the CONVERSATIONAL copilot prompt
        // Feed all collected findings as context and let the copilot present them
        pushEvent(session.id, {
          type: "chunk_progress",
          data: {
            current: totalChunks,
            total: totalChunks,
            clauseNumber: "final",
            clauseTitle: "Preparing your analysis...",
            status: "analyzing",
          },
        });

        const consolidationPrompt = `You have analyzed a ${body.contractType} contract (${file.pageCount} pages) between us (${body.ourRole}) and ${body.counterparty}. State: ${body.state}.${body.contractValue ? ` Value: INR ${body.contractValue.toLocaleString("en-IN")}.` : ""}

Here are the clause-by-clause findings from the analysis:

${allFindings.join("\n\n")}

Now:
1. Use get_required_clauses for "${body.contractType}" to check for MISSING clauses
2. Use get_stamp_duty for state "${body.state}"${body.contractValue ? `, value ${body.contractValue}` : ""}
3. Use get_applicable_regulations for "${body.contractType}"
4. Use get_contract_limitations to include the disclaimer

Present a CONSOLIDATED analysis:
- Overall risk score (0-100) and grade (A-F)
- Executive summary (3-5 sentences in plain language)
- Top risks ordered by severity (critical first)
- Missing clauses
- Stamp duty requirements
- What the user should negotiate first

After presenting, you are now in INTERACTIVE MODE. The user can ask follow-up questions about any clause, request alternative language, or ask for a negotiation playbook.`;

        await runAgentTurnAndCollect(session.id, consolidationPrompt);
      }

      updateSession(session.id, { status: "active" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Analysis failed";
      pushEvent(session.id, { type: "error", data: { error: errMsg } });
      updateSession(session.id, { status: "error" });
    }
  };

  // Fire and forget — client polls via SSE
  runAnalysis();

  return c.json({
    sessionId: session.id,
    status: session.status,
    chunkCount: chunkResult.chunks.length,
    isSinglePass: chunkResult.isSinglePass,
    estimatedTimeSeconds: estimateProcessingTime(chunkResult.chunks.length),
  });
});

// POST /:id/message — send a user message (with slash command resolution)
sessionRoutes.post("/:id/message", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ error: "Session not found." }, 404);
  }

  const { message } = await c.req.json<{ message: string }>();
  if (!message?.trim()) {
    return c.json({ error: "Message is required." }, 400);
  }

  // Check for /help — return help text directly
  if (message.trim().toLowerCase() === "/help") {
    const helpText = Object.entries(SLASH_COMMANDS)
      .filter(([cmd]) => cmd !== "/help")
      .map(([cmd]) => `  ${cmd}`)
      .join("\n");
    addMessage(sessionId, "user", message);
    addMessage(sessionId, "assistant", `Available commands:\n${helpText}\n\nYou can also type any question in plain language.`);
    return c.json({ status: "ok", isHelp: true });
  }

  // Resolve slash commands
  const resolved = resolveSlashCommand(message);
  const prompt = resolved ?? message;

  addMessage(sessionId, "user", message);

  // Start agent turn in background
  runAgentTurnAndCollect(sessionId, prompt);

  return c.json({ status: "ok" });
});

// GET /:id/stream — SSE endpoint
sessionRoutes.get("/:id/stream", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ error: "Session not found." }, 404);
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Send history first
      send("history", {
        messages: session.messages,
        findings: session.findings,
        riskSummary: session.riskSummary,
        status: session.status,
      });

      // Poll for new events — stream stays open for the entire session
      const interval = setInterval(() => {
        const events = drainEvents(sessionId);
        for (const evt of events) {
          try {
            send(evt.type, evt.data ?? evt);
          } catch {
            clearInterval(interval);
          }
        }
      }, 100);

      // Clean up on abort
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// GET /:id — session info
sessionRoutes.get("/:id", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ error: "Session not found." }, 404);
  }

  return c.json({
    id: session.id,
    fileName: session.fileName,
    counterparty: session.counterparty,
    contractType: session.contractType,
    ourRole: session.ourRole,
    state: session.state,
    contractValue: session.contractValue,
    pageCount: session.pageCount,
    wordCount: session.wordCount,
    chunkCount: session.chunkCount,
    status: session.status,
    messageCount: session.messages.length,
    findingCount: session.findings.length,
    riskSummary: session.riskSummary,
    createdAt: session.createdAt,
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function buildInitialPrompt(
  text: string,
  counterparty: string,
  contractType: string,
  ourRole: string,
  state: string,
  contractValue?: number,
): string {
  return `The user wants to review a contract interactively. Here are the details:

- Counterparty: ${counterparty}
- Contract type: ${contractType}
- Our role: ${ourRole}
- State (for stamp duty): ${state}
${contractValue ? `- Contract value: INR ${contractValue.toLocaleString("en-IN")}` : "- Contract value: not provided yet"}

FULL CONTRACT TEXT:
${text}

Start by:
1. Give a quick overview (document type, parties, page count, first impression)
2. Identify the top 3 risks
3. Run search_clause_patterns on any risky clauses you find
4. Use get_required_clauses for contract type "${contractType}"
5. Use get_stamp_duty for state "${state}"
6. Provide an overall risk score from 0-100

Present findings clearly with risk levels (CRITICAL / HIGH / MEDIUM / LOW).`;
}

async function runAgentTurnAndCollect(
  sessionId: string,
  prompt: string,
): Promise<void> {
  const session = getSession(sessionId);
  if (!session) return;

  return new Promise<void>((resolve) => {
    const emitter = runAgentTurn({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      sessionId: session.sdkSessionId,
    });

    emitter.on("event", (event: AgentEvent) => {
      // Forward all events to the pending queue
      pushEvent(sessionId, event);

      // Capture SDK session ID
      if (event.type === "session_id") {
        const data = event.data as { sessionId: string };
        updateSession(sessionId, { sdkSessionId: data.sessionId });
      }

      // Store assistant text as a message
      if (event.type === "done") {
        const data = event.data as { text: string; sessionId?: string };
        if (data.text) {
          addMessage(sessionId, "assistant", data.text);
        }
        if (data.sessionId) {
          updateSession(sessionId, { sdkSessionId: data.sessionId });
        }
      }
    });

    emitter.on("end", () => {
      resolve();
    });
  });
}

export { sessionRoutes };
