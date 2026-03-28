// Agent Bridge — wraps Claude Agent SDK query() into an EventEmitter
// that emits structured events consumable by SSE routes.

import { EventEmitter } from "events";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { browserMcp } from "../src/mcp-servers/browser-mcp.js";
import { propertyKbMcp } from "../src/mcp-servers/property-kb-mcp.js";
import { trackerMcp } from "../src/mcp-servers/tracker-mcp.js";

// ---------------------------------------------------------------------------
// Tool display names — human-readable labels for all 24 MCP tools
// ---------------------------------------------------------------------------

const TOOL_DISPLAY: Record<string, string> = {
  // browser-mcp (portal automation)
  "mcp__browser-mcp__search_rera_project": "Searching GujRERA portal",
  "mcp__browser-mcp__get_rera_project_details": "Fetching RERA project details",
  "mcp__browser-mcp__take_portal_screenshot": "Taking portal screenshot",
  "mcp__browser-mcp__search_ecourts_cases": "Searching eCourts cases",
  "mcp__browser-mcp__get_ecourts_case_details": "Fetching eCourts case details",
  "mcp__browser-mcp__search_anyror_land_records": "Searching AnyRoR land records",
  "mcp__browser-mcp__get_anyror_record_details": "Fetching land record details",
  "mcp__browser-mcp__search_garvi_documents": "Searching GARVI documents",
  "mcp__browser-mcp__get_garvi_document_details": "Fetching GARVI document details",
  "mcp__browser-mcp__search_smc_tax": "Searching SMC tax records",
  "mcp__browser-mcp__get_smc_tax_details": "Fetching SMC tax details",
  "mcp__browser-mcp__search_gstn": "Searching GSTN records",
  "mcp__browser-mcp__get_gstn_details": "Fetching GSTN details",

  // property-kb-mcp (knowledge base)
  "mcp__property-kb-mcp__get_jantri_rate": "Looking up jantri rate",
  "mcp__property-kb-mcp__calculate_stamp_duty": "Calculating stamp duty",
  "mcp__property-kb-mcp__calculate_total_cost": "Calculating total cost",
  "mcp__property-kb-mcp__check_red_flags": "Checking red flag patterns",
  "mcp__property-kb-mcp__get_required_documents": "Getting document checklist",
  "mcp__property-kb-mcp__get_registration_guide": "Loading registration guide",
  "mcp__property-kb-mcp__get_post_purchase_checklist": "Loading post-purchase checklist",
  "mcp__property-kb-mcp__get_verification_limitations": "Loading verification limitations",
  "mcp__property-kb-mcp__review_report": "Running critic review on report",

  // playwright (headless browser — CAPTCHA fallback)
  "mcp__playwright__browser_navigate": "Navigating browser to portal",
  "mcp__playwright__browser_snapshot": "Reading page structure",
  "mcp__playwright__browser_click": "Clicking element on page",
  "mcp__playwright__browser_fill_form": "Filling form field",
  "mcp__playwright__browser_type": "Typing into field",
  "mcp__playwright__browser_take_screenshot": "Taking browser screenshot",
  "mcp__playwright__browser_wait_for": "Waiting for page element",
  "mcp__playwright__browser_tabs": "Listing browser tabs",
  "mcp__playwright__browser_evaluate": "Running script on page",
  "mcp__playwright__browser_press_key": "Pressing key",
  "mcp__playwright__browser_select_option": "Selecting dropdown option",

  // tracker-mcp (purchase tracking)
  "mcp__tracker-mcp__create_purchase": "Registering purchase",
  "mcp__tracker-mcp__log_verification": "Logging verification step",
  "mcp__tracker-mcp__get_verification_log": "Loading verification log",
  "mcp__tracker-mcp__update_phase": "Updating purchase phase",
  "mcp__tracker-mcp__get_purchase_summary": "Getting purchase summary",
  "mcp__tracker-mcp__track_checklist_item": "Tracking checklist progress",
};

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface AgentEvent {
  type: "session_id" | "tool_call" | "tool_result" | "text" | "done" | "error";
  sessionId?: string;
  tool?: string;
  toolLabel?: string;
  input?: unknown;
  text?: string;
  error?: string;
  costUsd?: number;
  numTurns?: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunTurnOptions {
  prompt: string;
  systemPrompt: string;
  sdkSessionId?: string;
}

// ---------------------------------------------------------------------------
// runAgentTurn — returns an EventEmitter that emits AgentEvent objects
// ---------------------------------------------------------------------------

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
            // Playwright MCP — headless browser for portal automation fallback
            // Runs its own Chromium instance, no Chrome extension needed
            "playwright": {
              type: "stdio" as const,
              command: "npx",
              args: ["@playwright/mcp@latest"],
            },
          },
          // Explicitly allow all MCP tools — required for Claude to call them
          allowedTools: [
            "mcp__browser-mcp__*",
            "mcp__property-kb-mcp__*",
            "mcp__tracker-mcp__*",
            "mcp__playwright__*",
          ],
          model: "sonnet",
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 15,
          ...(options.sdkSessionId ? { resume: options.sdkSessionId } : {}),
        },
      };

      for await (const message of query(queryOptions)) {
        // Capture session ID from system init
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
            emitter.emit("event", {
              type: "session_id",
              sessionId: sysMsg.session_id,
              timestamp: new Date().toISOString(),
            } satisfies AgentEvent);
          }
        }

        // Emit tool_call AND intermediate text from assistant messages
        if (
          "type" in message &&
          message.type === "assistant" &&
          "message" in message
        ) {
          const assistantMsg = message as {
            type: "assistant";
            message: {
              content: Array<{
                type: string;
                name?: string;
                input?: unknown;
                text?: string;
              }>;
            };
          };
          const content = assistantMsg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_use" && block.name) {
                emitter.emit("event", {
                  type: "tool_call",
                  tool: block.name,
                  toolLabel:
                    TOOL_DISPLAY[block.name] ??
                    `Tool: ${block.name.replace(/mcp__[^_]+__/, "")}`,
                  input: block.input,
                  timestamp: new Date().toISOString(),
                } satisfies AgentEvent);
              }
              // Stream intermediate text blocks as they arrive
              // This makes responses appear progressively instead of all-at-once
              if (block.type === "text" && block.text) {
                emitter.emit("event", {
                  type: "text",
                  text: block.text,
                  timestamp: new Date().toISOString(),
                } satisfies AgentEvent);
              }
            }
          }
        }

        // Emit done on result (text was already streamed from assistant messages)
        if ("type" in message && message.type === "result") {
          const resultMsg = message as {
            type: "result";
            subtype: string;
            result?: string;
            num_turns?: number;
            total_cost_usd?: number;
          };

          if (resultMsg.subtype === "success") {
            emitter.emit("event", {
              type: "done",
              numTurns: resultMsg.num_turns,
              costUsd: resultMsg.total_cost_usd,
              timestamp: new Date().toISOString(),
            } satisfies AgentEvent);
          } else {
            emitter.emit("event", {
              type: "error",
              error: `Agent returned non-success result: ${resultMsg.subtype}`,
              timestamp: new Date().toISOString(),
            } satisfies AgentEvent);
          }
        }
      }
    } catch (err) {
      emitter.emit("event", {
        type: "error",
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      } satisfies AgentEvent);
    }
  };

  // Fire async — caller attaches listeners before events fire
  execute();

  return emitter;
}
