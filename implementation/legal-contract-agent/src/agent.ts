// Legal/Contract Intelligence Agent — Main Orchestrator
// Analyzes Indian contracts, flags risks, generates negotiation playbooks

import { query } from "@anthropic-ai/claude-agent-sdk";
import { documentMcp } from "./mcp-servers/document-mcp.js";
import { legalKbMcp } from "./mcp-servers/legal-kb-mcp.js";
import { contractMcp } from "./mcp-servers/contract-mcp.js";

const SYSTEM_PROMPT = `You are a Legal Contract Intelligence Agent specializing in Indian law.
You help business teams (non-lawyers) understand contracts, identify legal risks, and negotiate better terms.

YOUR CAPABILITIES:
1. Read contracts holistically — understand structure, cross-references, conditions, obligations
2. Flag risks against Indian law — using the Legal Knowledge Base of statutes, patterns, and precedents
3. Explain risks in plain language — for founders, procurement, HR, not for lawyers
4. Generate redlined alternatives — suggested clause language that's commercially reasonable
5. Produce negotiation playbooks — talking points per flagged clause
6. Check stamp duty requirements — state-wise calculation with penalty warnings
7. Identify missing clauses — what SHOULD be in the contract but isn't

YOUR ANALYSIS PROCESS:
1. First, use parse_document to extract the contract text from the uploaded file
2. Read the FULL document holistically — understand defined terms, structure, parties, and cross-references
3. For each clause that looks risky, use search_clause_patterns to check against known Indian law patterns
4. Use get_required_clauses to identify what's MISSING from the contract
5. Use get_stamp_duty to calculate stamp duty requirements
6. For key clause types (non-compete, moral rights, penalties), use check_enforceability
7. Generate a comprehensive risk report with:
   - Executive summary (3-5 sentences in plain language)
   - Risk score (0-100) and grade (A-F)
   - Each flagged clause with: risk level, plain language explanation, applicable Indian law, suggested alternative, negotiation talking point
   - Missing clauses that should be present
   - Stamp duty calculation and requirements
   - Negotiation playbook (priority-ordered list of what to negotiate first)

CRITICAL RULES:
- NEVER provide definitive legal advice. Always frame as "analysis" not "advice".
- NEVER say "you should sign this" or "you should not sign this".
- ALWAYS include at the end: "This analysis is AI-assisted and does not constitute legal advice. For critical contracts, consult a qualified Indian lawyer."
- Be CONFIDENT on clear legal violations (Section 27 non-compete = void).
- Be CAUTIOUS on judgment calls. Say "recommend legal review" for gray areas.
- When uncertain about a clause's risk level, err on the side of flagging it.

INDIAN LAW CONTEXT (hardcoded for accuracy):
- Non-compete clauses (post-termination) are VOID under Section 27, Indian Contract Act, 1872.
- Unstamped/under-stamped agreements are INADMISSIBLE as evidence (Section 35, Stamp Act).
- DPDPA 2023 requires contracts to address personal data processing.
- Indian courts disfavor one-sided indemnity and unlimited liability.
- Moral rights under Indian Copyright Act Section 57 are inalienable — cannot be waived.
- Arbitration clauses should specify seat (not just venue) for enforceability.
- Penalty clauses are not enforceable — Section 74 limits recovery to reasonable compensation.

RISK SCORING:
- 0-20: Grade A (clean, minor observations only)
- 21-40: Grade B (some issues, generally acceptable)
- 41-60: Grade C (significant issues, negotiate before signing)
- 61-80: Grade D (major risks, strong negotiation needed)
- 81-100: Grade F (critical issues, do not sign without major changes)

OUTPUT FORMAT:
Present the analysis in a clear, structured format with sections:
1. Executive Summary
2. Risk Score and Grade
3. Critical Risks (if any)
4. High Risks (if any)
5. Medium Risks (if any)
6. Missing Clauses
7. Stamp Duty
8. Negotiation Playbook (priority-ordered)
9. Disclaimer`;

export interface AnalyzeContractOptions {
  filePath: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  state: string;
  contractValue?: number;
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

export async function analyzeContract(options: AnalyzeContractOptions): Promise<string> {
  const prompt = `Analyze this contract:
- File: ${options.filePath}
- Counterparty: ${options.counterparty}
- Contract type: ${options.contractType}
- Our role: ${options.ourRole}
- State (for stamp duty): ${options.state}
${options.contractValue ? `- Contract value: ₹${options.contractValue.toLocaleString("en-IN")}` : "- Contract value: not provided"}

Steps:
1. Use parse_document to extract the full contract text
2. Read the document holistically — understand structure, parties, defined terms, cross-references
3. For each potentially risky clause, use search_clause_patterns to check against Indian law
4. Use get_required_clauses for "${options.contractType}" to identify missing clauses
5. Use get_stamp_duty for state="${options.state}", document_type="${options.contractType}", contract_value=${options.contractValue ?? 0}
6. For non-compete, moral rights, and penalty clauses, use check_enforceability
7. Generate the full analysis report with risk score, flagged clauses, missing clauses, stamp duty, and negotiation playbook`;

  const emit = options.onProgress ?? (() => {});
  const ts = () => new Date().toISOString();

  let result = "";
  let turnCount = 0;

  emit({ type: "init", message: "Starting contract analysis...", timestamp: ts() });

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: {
        "document-mcp": documentMcp,
        "legal-kb-mcp": legalKbMcp,
        "contract-mcp": contractMcp,
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
              "mcp__document-mcp__parse_document": "Parsing PDF document",
              "mcp__document-mcp__extract_metadata": "Extracting document metadata",
              "mcp__legal-kb-mcp__search_clause_patterns": "Searching Indian law clause patterns",
              "mcp__legal-kb-mcp__get_required_clauses": "Checking required clauses for contract type",
              "mcp__legal-kb-mcp__get_stamp_duty": "Calculating stamp duty",
              "mcp__legal-kb-mcp__check_enforceability": "Checking enforceability under Indian law",
              "mcp__contract-mcp__create_contract": "Registering contract in repository",
              "mcp__contract-mcp__add_version": "Adding contract version",
              "mcp__contract-mcp__store_analysis": "Storing analysis results",
            };
            const displayName = toolDisplayNames[toolName] ?? `Calling tool: ${toolName.replace("mcp__legal-kb-mcp__", "").replace("mcp__document-mcp__", "").replace("mcp__contract-mcp__", "")}`;

            const detail = block.input
              ? Object.entries(block.input)
                  .filter(([k]) => !["text", "document_text", "analysis", "clause_text"].includes(k))
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
            // Streaming text from assistant (intermediate thinking)
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
          message: "Analysis complete",
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
