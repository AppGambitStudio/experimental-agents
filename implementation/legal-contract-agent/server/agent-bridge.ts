// Agent bridge — wraps the Claude Agent SDK query() into an EventEmitter
// so the server can stream events to the frontend via SSE.

import { EventEmitter } from "events";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { documentMcp } from "../src/mcp-servers/document-mcp.js";
import { legalKbMcp } from "../src/mcp-servers/legal-kb-mcp.js";
import { contractMcp } from "../src/mcp-servers/contract-mcp.js";

// ── Tool display names ─────────────────────────────────────────────────────

export const TOOL_DISPLAY: Record<string, string> = {
  "mcp__document-mcp__parse_document": "Parsing document",
  "mcp__document-mcp__extract_metadata": "Extracting metadata",
  "mcp__legal-kb-mcp__search_clause_patterns": "Checking Indian law patterns",
  "mcp__legal-kb-mcp__get_required_clauses": "Checking required clauses",
  "mcp__legal-kb-mcp__get_stamp_duty": "Calculating stamp duty",
  "mcp__legal-kb-mcp__check_enforceability": "Checking enforceability",
  "mcp__legal-kb-mcp__review_report": "Running critic review",
  "mcp__legal-kb-mcp__get_applicable_regulations": "Checking regulatory compliance",
  "mcp__legal-kb-mcp__get_contract_limitations": "Loading analysis limitations",
  "mcp__contract-mcp__create_contract": "Creating contract record",
  "mcp__contract-mcp__add_version": "Adding version",
  "mcp__contract-mcp__store_analysis": "Storing analysis",
  "mcp__contract-mcp__get_previous_analysis": "Loading previous analysis",
  "mcp__contract-mcp__get_contract_timeline": "Loading timeline",
};

// ── Event types ────────────────────────────────────────────────────────────

export type AgentEventType =
  | "session_id"
  | "tool_call"
  | "text"
  | "done"
  | "error"
  | "chunk_progress"
  | "finding"
  | "risk_summary"
  | "structure";

export interface AgentEvent {
  type: AgentEventType;
  data: unknown;
}

// ── Run agent turn ─────────────────────────────────────────────────────────

export interface RunAgentTurnOptions {
  prompt: string;
  systemPrompt: string;
  sessionId?: string;
  maxTurns?: number;
}

/**
 * Runs a single agent turn and emits events as the SDK streams messages.
 * Returns an EventEmitter that emits AgentEvent objects on the "event" channel.
 * Also emits "end" when the turn completes.
 */
export function runAgentTurn(options: RunAgentTurnOptions): EventEmitter {
  const emitter = new EventEmitter();

  const run = async () => {
    try {
      const queryOptions: Parameters<typeof query>[0] = {
        prompt: options.prompt,
        options: {
          systemPrompt: options.systemPrompt,
          mcpServers: {
            "document-mcp": documentMcp,
            "legal-kb-mcp": legalKbMcp,
            "contract-mcp": contractMcp,
          },
          allowedTools: [
            "mcp__document-mcp__*",
            "mcp__legal-kb-mcp__*",
            "mcp__contract-mcp__*",
          ],
          model: "sonnet",
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: options.maxTurns ?? 50,
          ...(options.sessionId ? { resume: options.sessionId } : {}),
        },
      };

      let capturedSessionId: string | undefined;
      let fullText = "";

      for await (const message of query(queryOptions)) {
        // Capture session ID from init
        if (
          "type" in message &&
          message.type === "system" &&
          "subtype" in message
        ) {
          const sysMsg = message as {
            type: "system";
            subtype: string;
            session_id?: string;
          };
          if (sysMsg.subtype === "init" && sysMsg.session_id) {
            capturedSessionId = sysMsg.session_id;
            emitter.emit("event", {
              type: "session_id",
              data: { sessionId: capturedSessionId },
            } satisfies AgentEvent);
          }
        }

        // Stream tool calls and intermediate text blocks
        if (
          "type" in message &&
          message.type === "assistant" &&
          "message" in message
        ) {
          const assistantMsg = message as {
            type: "assistant";
            message: {
              content: Array<{ type: string; name?: string; text?: string }>;
            };
          };
          const content = assistantMsg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_use" && block.name) {
                const display =
                  TOOL_DISPLAY[block.name] ??
                  block.name.replace(/mcp__[^_]+__/, "");
                emitter.emit("event", {
                  type: "tool_call",
                  data: { tool: block.name, display },
                } satisfies AgentEvent);
              }
              if (block.type === "text" && block.text) {
                emitter.emit("event", {
                  type: "text",
                  data: { text: block.text },
                } satisfies AgentEvent);
              }
            }
          }
        }

        // Capture final result
        if ("type" in message && message.type === "result") {
          const resultMsg = message as {
            type: "result";
            subtype: string;
            result?: string;
          };
          if (resultMsg.subtype === "success" && resultMsg.result) {
            fullText = resultMsg.result;
          }
        }
      }

      emitter.emit("event", {
        type: "done",
        data: { text: fullText, sessionId: capturedSessionId },
      } satisfies AgentEvent);
      emitter.emit("end");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown agent error";
      emitter.emit("event", {
        type: "error",
        data: { error: message },
      } satisfies AgentEvent);
      emitter.emit("end");
    }
  };

  // Fire-and-forget — the caller listens via events
  run();

  return emitter;
}
