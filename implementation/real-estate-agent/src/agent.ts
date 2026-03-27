// Real Estate Transaction Agent — Main Orchestrator
// Analyzes Gujarat property transactions, verifies RERA status, flags risks,
// calculates stamp duty, and generates due diligence reports.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { browserMcp } from "./mcp-servers/browser-mcp.js";
import { propertyKbMcp } from "./mcp-servers/property-kb-mcp.js";
import { trackerMcp } from "./mcp-servers/tracker-mcp.js";

const SYSTEM_PROMPT = `You are a Real Estate Transaction Agent specializing in Gujarat property verification.
You help first-time homebuyers navigate property purchases by performing due diligence checks against government portals and knowledge bases.

YOUR CAPABILITIES:
1. Verify RERA registration — search and validate projects on the GujRERA portal
2. Flag red flags — check property attributes against known risk patterns
3. Calculate stamp duty — Gujarat-specific rates with female buyer discounts
4. Look up jantri rates — government ready reckoner rates for Surat zones
5. Generate document checklists — property-type-specific lists of required documents
6. Maintain an audit trail — every verification step is logged with portal, result, and status

CURRENT FOCUS: Phase 1 — Due Diligence
In this phase, you verify the property's legal standing before the buyer commits. You do NOT handle document drafting, registration, or post-purchase tasks.

YOUR ANALYSIS PROCESS:
1. Create a purchase record via create_purchase to track this property
2. Search RERA portal via search_rera_project using the RERA ID or project name
3. Get detailed project info via get_rera_project_details using the RERA ID
4. Log each verification step via log_verification with portal name, action, query, result, and status
5. Check red flags via check_red_flags using findings from RERA verification
6. Calculate stamp duty via calculate_stamp_duty for the property type and value
7. Look up jantri rate via get_jantri_rate for the relevant Surat zone
8. Get required documents via get_required_documents for the property type
9. Generate a comprehensive due diligence report

YOUR DUE DILIGENCE REPORT SHOULD INCLUDE:
1. Property Overview — address, type, builder, RERA ID
2. RERA Verification — registration status, expiry date, project status, complaints
3. Red Flag Assessment — triggered flags with severity and recommended actions
4. Financial Analysis — stamp duty breakdown, jantri rate comparison, budget assessment
5. Document Checklist — what the buyer needs to collect
6. Overall Risk Rating — CLEAR / REVIEW / CAUTION / STOP
7. Recommended Next Steps — prioritized action items for the buyer
8. Disclaimer

CRITICAL RULES:
- NEVER provide definitive legal or investment advice. Always frame as "verification findings" not "advice".
- NEVER say "you should buy this" or "this is a good investment".
- ALWAYS include at the end: "This verification report is AI-assisted and does not substitute for professional due diligence by a property lawyer and chartered surveyor."
- Be DIRECT about critical red flags — "This property is NOT registered with RERA. Do NOT proceed."
- Be TRANSPARENT when portal data is unavailable — say so, don't guess.
- Use PLAIN LANGUAGE — the buyer is not a legal expert. Explain terms like "encumbrance", "NA conversion", "jantri rate".

ANTI-HALLUCINATION RULES:
- ONLY cite information that comes from tool results. If a tool call fails or returns no data, say "Could not verify — portal did not return data" instead of making up results.
- If you cannot find RERA registration via the portal, do NOT assume the project is registered or unregistered — say "RERA verification inconclusive. Manual check recommended at gujrera.gujarat.gov.in."
- Every fact in your report (RERA status, complaints count, expiry date) must be traceable to a specific tool call result.
- If the buyer asks about something outside your verification scope (loan eligibility, vastu, resale value), say "This is outside my verification scope. Consult a [relevant professional]."
- When uncertain about any finding, say "I don't know" or "Could not determine" rather than guessing. It is better to be honest about gaps than to fabricate certainty.

COMMUNICATION STYLE:
- Write for a first-time homebuyer who may not understand legal jargon
- Use bullet points and clear headers
- When explaining a red flag, include: what it means, why it matters, and what to do about it
- Include INR amounts formatted with commas (e.g., Rs 35,00,000)`;

export interface AnalyzePropertyOptions {
  reraId?: string;
  address: string;
  builderName?: string;
  propertyType: string;
  budget: number;
  state: string;
  onProgress?: (event: ProgressEvent) => void;
}

export interface ProgressEvent {
  type: "init" | "tool_call" | "tool_result" | "thinking" | "streaming" | "done";
  message: string;
  detail?: string;
  timestamp: string;
  turnNumber?: number;
  cost?: number;
  duration?: number;
}

export async function analyzeProperty(options: AnalyzePropertyOptions): Promise<string> {
  const prompt = `Perform due diligence on this property:
- Address: ${options.address}
${options.reraId ? `- RERA ID: ${options.reraId}` : "- RERA ID: not provided (search by project/builder name)"}
${options.builderName ? `- Builder: ${options.builderName}` : "- Builder: not provided"}
- Property type: ${options.propertyType}
- Budget: Rs ${options.budget.toLocaleString("en-IN")}
- State: ${options.state}

Steps:
1. Use create_purchase to register this property for tracking
2. Use search_rera_project to find the project on GujRERA portal${options.reraId ? ` (search for RERA ID: ${options.reraId})` : options.builderName ? ` (search for builder: ${options.builderName})` : ""}
3. If found, use get_rera_project_details to get full project information
4. Log each verification step using log_verification
5. Use check_red_flags based on your RERA findings
6. Use calculate_stamp_duty for property_type="${options.propertyType}", property_value=${options.budget}
7. Use get_jantri_rate to look up the government rate for the property zone
8. Use get_required_documents for property_type="${options.propertyType}"
9. Generate the full due diligence report`;

  const emit = options.onProgress ?? (() => {});
  const ts = () => new Date().toISOString();

  let result = "";
  let turnCount = 0;

  emit({ type: "init", message: "Starting property due diligence...", timestamp: ts() });

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: {
        "browser-mcp": browserMcp,
        "property-kb-mcp": propertyKbMcp,
        "tracker-mcp": trackerMcp,
      },
      model: "sonnet",
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
    },
  })) {
    // System init message
    if ("type" in message && message.type === "system" && "subtype" in message && message.subtype === "init") {
      emit({ type: "init", message: "Agent initialized, connected to MCP servers", timestamp: ts() });
    }

    // Assistant message — contains tool_use blocks and text
    if ("type" in message && message.type === "assistant" && "message" in message) {
      const assistantMsg = message as { type: "assistant"; message: { content: Array<{ type: string; name?: string; input?: Record<string, unknown>; text?: string }> } };
      const content = assistantMsg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            turnCount++;
            const toolName = block.name;
            const toolDisplayNames: Record<string, string> = {
              "mcp__browser-mcp__search_rera_project": "Searching GujRERA portal",
              "mcp__browser-mcp__get_rera_project_details": "Fetching RERA project details",
              "mcp__browser-mcp__take_portal_screenshot": "Taking portal screenshot",
              "mcp__property-kb-mcp__get_jantri_rate": "Looking up jantri rate",
              "mcp__property-kb-mcp__calculate_stamp_duty": "Calculating stamp duty",
              "mcp__property-kb-mcp__check_red_flags": "Checking red flag patterns",
              "mcp__property-kb-mcp__get_required_documents": "Getting document checklist",
              "mcp__tracker-mcp__create_purchase": "Registering purchase for tracking",
              "mcp__tracker-mcp__log_verification": "Logging verification step",
              "mcp__tracker-mcp__get_verification_log": "Loading verification log",
              "mcp__tracker-mcp__update_phase": "Updating purchase phase",
              "mcp__tracker-mcp__get_purchase_summary": "Getting purchase summary",
            };
            const displayName = toolDisplayNames[toolName] ?? `Calling tool: ${toolName.replace(/mcp__[^_]+__/, "")}`;

            const detail = block.input
              ? Object.entries(block.input)
                  .filter(([k]) => !["text", "result", "notes"].includes(k))
                  .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 50) : v}`)
                  .join(", ")
              : undefined;

            emit({
              type: "tool_call",
              message: displayName,
              detail: detail || undefined,
              timestamp: ts(),
              turnNumber: turnCount,
            });
          }

          if (block.type === "text" && block.text && !("result" in message)) {
            const preview = block.text.slice(0, 100).replace(/\n/g, " ");
            if (preview.length > 20) {
              emit({
                type: "streaming",
                message: preview + (block.text.length > 100 ? "..." : ""),
                timestamp: ts(),
              });
            }
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
      };

      if (resultMsg.subtype === "success" && resultMsg.result) {
        result = resultMsg.result;
        emit({
          type: "done",
          message: "Due diligence complete",
          timestamp: ts(),
          turnNumber: resultMsg.num_turns,
          cost: resultMsg.total_cost_usd,
          duration: resultMsg.duration_ms,
        });
      } else {
        emit({
          type: "done",
          message: `Analysis ended: ${resultMsg.subtype}`,
          timestamp: ts(),
          turnNumber: resultMsg.num_turns,
          cost: resultMsg.total_cost_usd,
          duration: resultMsg.duration_ms,
        });
      }
    }
  }

  return result;
}
