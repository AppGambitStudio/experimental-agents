// Interactive Copilot Mode — conversational contract review
// Uses SDK sessions for multi-turn persistence and AskUserQuestion for interaction

import { query } from "@anthropic-ai/claude-agent-sdk";
import { documentMcp } from "./mcp-servers/document-mcp.js";
import { legalKbMcp } from "./mcp-servers/legal-kb-mcp.js";
import { contractMcp } from "./mcp-servers/contract-mcp.js";
import { createInterface } from "readline";

const COPILOT_SYSTEM_PROMPT = `You are a Legal Contract Intelligence Copilot specializing in Indian law.
You work INTERACTIVELY with the user — this is a conversation, not a one-shot report.

YOUR PERSONALITY:
- You're a sharp, experienced Indian corporate lawyer who explains things in plain language
- You're conversational — ask questions, confirm understanding, dig deeper
- You celebrate when something looks good ("Section 8 confidentiality is well-drafted, no issues there")
- You're direct about risks ("This non-compete is void under Indian law. Full stop.")
- You adapt to the user's expertise — if they seem knowledgeable, go deeper; if not, simplify

YOUR INTERACTIVE WORKFLOW:

PHASE 1 — INTAKE (first message):
When the user provides a contract, start by:
1. Parse the document using parse_document
2. Give a QUICK overview (30 seconds to read):
   - Document type, parties, date, page count
   - First impression: "This is a Customer-heavy MSA" or "This looks fairly balanced"
   - 1-2 sentence preview of biggest concern
3. Ask 2-3 contextual questions using AskUserQuestion:
   - "Is this the only document in this deal, or are there related SOWs/NDAs?"
   - "What's your primary concern — IP protection, liability, cost, or something else?"
   - "Have you already negotiated any terms, or is this the first draft?"

PHASE 2 — DEEP ANALYSIS (after user responds):
Based on user's answers, analyze the contract:
1. Use search_clause_patterns for each risky section
2. Use get_required_clauses to check for missing clauses
3. Use get_stamp_duty for the relevant state
4. Use check_enforceability for key clause types

Present findings PROGRESSIVELY — don't dump everything at once:
- Start with the CRITICAL risks (1-2 items)
- After showing each critical risk, pause and ask: "Want me to explain this further, or shall I continue to the next finding?"
- Then HIGH risks, then MEDIUM
- End with missing clauses and stamp duty

PHASE 3 — DEEP DIVE (user-driven):
The user may ask:
- "Tell me more about the indemnity clause"
- "What's a reasonable liability cap for this contract?"
- "Can you draft alternative language for Section 9.3?"
- "How does this compare to industry standard?"
- "What should I push back on first?"

Answer these conversationally. Use the Legal KB tools to back up your answers with Indian law references.

PHASE 4 — NEGOTIATION SUPPORT:
When the user is ready:
- Generate a priority-ordered negotiation playbook
- Draft alternative clause language for each flagged item
- Suggest negotiation talking points in plain language
- If user says "they sent back v2", analyze the new version and compare

CRITICAL RULES:
- NEVER provide definitive legal advice. Always frame as "analysis" not "advice".
- ALWAYS include the disclaimer when giving final outputs.
- Be CONFIDENT on clear legal violations (Section 27 non-compete = void).
- Be CAUTIOUS on judgment calls. Say "recommend legal review" for gray areas.
- Use AskUserQuestion when you need user input — don't assume.
- If the user says "skip this" or "I'm OK with this clause", respect that and move on.
- Keep responses focused — don't write 500 words when 100 will do in conversation mode.

INDIAN LAW CONTEXT:
- Non-compete clauses (post-termination) are VOID under Section 27, Indian Contract Act, 1872.
- Unstamped/under-stamped agreements are INADMISSIBLE (Section 35, Stamp Act).
- DPDPA 2023 requires contracts to address personal data processing.
- Indian courts disfavor one-sided indemnity and unlimited liability.
- Moral rights under Indian Copyright Act Section 57 are inalienable.
- Arbitration clauses should specify seat (not just venue).
- Penalty clauses are not enforceable — Section 74 limits to reasonable compensation.`;

// Tool name display mapping
const TOOL_DISPLAY: Record<string, string> = {
  "mcp__document-mcp__parse_document": "📄 Parsing document",
  "mcp__document-mcp__extract_metadata": "📋 Extracting metadata",
  "mcp__legal-kb-mcp__search_clause_patterns": "⚖️  Checking Indian law patterns",
  "mcp__legal-kb-mcp__get_required_clauses": "📝 Checking required clauses",
  "mcp__legal-kb-mcp__get_stamp_duty": "🏛️  Calculating stamp duty",
  "mcp__legal-kb-mcp__check_enforceability": "🔍 Checking enforceability",
  "mcp__contract-mcp__create_contract": "📁 Creating contract record",
  "mcp__contract-mcp__add_version": "📎 Adding version",
  "mcp__contract-mcp__store_analysis": "💾 Storing analysis",
  "mcp__contract-mcp__get_previous_analysis": "📊 Loading previous analysis",
  "mcp__contract-mcp__get_contract_timeline": "📈 Loading timeline",
};

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

export interface CopilotOptions {
  filePath: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  state: string;
  contractValue?: number;
}

export async function startCopilot(options: CopilotOptions): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askUser = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(`${c.cyan}${c.bold}You: ${c.reset}`, (answer) => {
        resolve(answer.trim());
      });
    });

  console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════╗
║  Legal Contract Copilot — Interactive Mode                   ║
║  Analyzing: ${options.filePath.split("/").pop()?.slice(0, 46).padEnd(46)}║
║  Type 'quit' to exit, 'playbook' for negotiation playbook    ║
╚══════════════════════════════════════════════════════════════╝${c.reset}
`);

  // Build the initial prompt that kicks off the interactive session
  const initialPrompt = `The user wants to review a contract interactively. Here are the details:

- File path: ${options.filePath}
- Counterparty: ${options.counterparty}
- Contract type: ${options.contractType}
- Our role: ${options.ourRole}
- State (for stamp duty): ${options.state}
${options.contractValue ? `- Contract value: ₹${options.contractValue.toLocaleString("en-IN")}` : "- Contract value: not provided yet"}

Start by:
1. Parse the document using parse_document
2. Give a quick overview (document type, parties, page count, first impression)
3. Ask the user 2-3 contextual questions to understand their priorities before diving into full analysis

Remember: this is a conversation, not a report. Keep the first response concise — overview + questions only.`;

  let sessionId: string | undefined;
  let turnCount = 0;

  // Function to run a single turn of the conversation
  async function runTurn(userMessage: string): Promise<void> {
    const queryOptions: Parameters<typeof query>[0] = {
      prompt: userMessage,
      options: {
        systemPrompt: COPILOT_SYSTEM_PROMPT,
        mcpServers: {
          "document-mcp": documentMcp,
          "legal-kb-mcp": legalKbMcp,
          "contract-mcp": contractMcp,
        },
        model: "sonnet",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 15,
        ...(sessionId ? { resume: sessionId } : {}),
      },
    };

    let agentResponse = "";

    for await (const message of query(queryOptions)) {
      // Capture session ID from init
      if ("type" in message && message.type === "system" && "subtype" in message) {
        const sysMsg = message as { type: "system"; subtype: string; session_id?: string };
        if (sysMsg.subtype === "init" && sysMsg.session_id) {
          sessionId = sysMsg.session_id;
        }
      }

      // Show tool calls as progress
      if ("type" in message && message.type === "assistant" && "message" in message) {
        const assistantMsg = message as {
          type: "assistant";
          message: { content: Array<{ type: string; name?: string; text?: string }> };
        };
        const content = assistantMsg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_use" && block.name) {
              const display = TOOL_DISPLAY[block.name] ?? `🔧 ${block.name.replace(/mcp__[^_]+__/, "")}`;
              process.stdout.write(`${c.dim}  ${display}...${c.reset}\n`);
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
          num_turns?: number;
          total_cost_usd?: number;
        };
        if (resultMsg.subtype === "success" && resultMsg.result) {
          agentResponse = resultMsg.result;
        }
      }
    }

    turnCount++;

    if (agentResponse) {
      console.log(`\n${c.magenta}${c.bold}Copilot:${c.reset}\n${agentResponse}\n`);
    }
  }

  // Run the initial analysis
  try {
    await runTurn(initialPrompt);
  } catch (error) {
    console.error(`\n${c.red}Error during initial analysis:${c.reset}`, error);
    rl.close();
    return;
  }

  // Interactive loop
  while (true) {
    const userInput = await askUser("");

    if (!userInput) continue;

    if (userInput.toLowerCase() === "quit" || userInput.toLowerCase() === "exit") {
      console.log(`\n${c.dim}Session ended. ${turnCount} turns.${c.reset}`);
      if (sessionId) {
        console.log(`${c.dim}Session ID: ${sessionId} (can be resumed later)${c.reset}`);
      }
      break;
    }

    if (userInput.toLowerCase() === "playbook") {
      try {
        await runTurn(
          "Generate a complete negotiation playbook based on all the risks we've discussed. Priority-ordered, with specific talking points and alternative clause language for each item."
        );
      } catch (error) {
        console.error(`\n${c.red}Error:${c.reset}`, error);
      }
      continue;
    }

    if (userInput.toLowerCase() === "summary") {
      try {
        await runTurn(
          "Give me a concise summary of all findings so far — risk score, critical items, and top 3 things to negotiate first."
        );
      } catch (error) {
        console.error(`\n${c.red}Error:${c.reset}`, error);
      }
      continue;
    }

    if (userInput.toLowerCase() === "redline") {
      try {
        await runTurn(
          "Generate a redlined version — for each flagged clause, show the original text and the suggested replacement text side by side."
        );
      } catch (error) {
        console.error(`\n${c.red}Error:${c.reset}`, error);
      }
      continue;
    }

    try {
      await runTurn(userInput);
    } catch (error) {
      console.error(`\n${c.red}Error:${c.reset}`, error);
    }
  }

  rl.close();
}
