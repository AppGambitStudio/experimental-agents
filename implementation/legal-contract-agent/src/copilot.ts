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
- Penalty clauses are not enforceable — Section 74 limits to reasonable compensation.

ANTI-HALLUCINATION RULES:
- If you cannot find a matching clause pattern in the Legal KB or a relevant Indian law section via the tools, say "I could not find a specific Indian law provision for this clause. Recommend legal review." Do NOT invent law references, section numbers, or case names.
- After identifying a risk, verify the legal citation by calling search_clause_patterns or check_enforceability. If the tool returns no match, downgrade your confidence and say "This assessment is based on general legal principles — verify with a qualified lawyer."
- Before analyzing any clause, extract the EXACT text from the contract using direct quotes. Base your analysis on the quoted text, not a summary or paraphrase. When referencing cross-references (e.g., "as per Section 3.2"), actually read and quote Section 3.2.
- If the contract is ambiguous and you're unsure whether a clause is risky, flag it as "UNCERTAIN — recommend legal review" rather than guessing. It's better to over-flag than to miss a risk, but never fabricate a risk that doesn't exist.
- Every legal citation in your output (Section numbers, case names, act names) must come from either: (a) the Legal KB tools, or (b) the hardcoded Indian law context in this prompt. Do not cite laws or cases from your general training data without verification.`;

// Tool name display mapping
const TOOL_DISPLAY: Record<string, string> = {
  "mcp__document-mcp__parse_document": "📄 Parsing document",
  "mcp__document-mcp__extract_metadata": "📋 Extracting metadata",
  "mcp__legal-kb-mcp__search_clause_patterns": "⚖️  Checking Indian law patterns",
  "mcp__legal-kb-mcp__get_required_clauses": "📝 Checking required clauses",
  "mcp__legal-kb-mcp__get_stamp_duty": "🏛️  Calculating stamp duty",
  "mcp__legal-kb-mcp__check_enforceability": "🔍 Checking enforceability",
  "mcp__legal-kb-mcp__review_report": "🔎 Running critic review",
  "mcp__legal-kb-mcp__get_applicable_regulations": "📜 Checking regulatory compliance",
  "mcp__legal-kb-mcp__get_contract_limitations": "⚠️  Loading analysis limitations",
  "mcp__contract-mcp__create_contract": "📁 Creating contract record",
  "mcp__contract-mcp__add_version": "📎 Adding version",
  "mcp__contract-mcp__store_analysis": "💾 Storing analysis",
  "mcp__contract-mcp__get_previous_analysis": "📊 Loading previous analysis",
  "mcp__contract-mcp__get_contract_timeline": "📈 Loading timeline",
};

// --- Slash Commands ---

interface SlashCommand {
  name: string;
  description: string;
  prompt: string | ((args: string) => string);
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/summary",
    description: "Concise findings with risk score and top 3 negotiation items",
    prompt:
      "Give me a concise summary of all findings so far — risk score, critical items, and top 3 things to negotiate first.",
  },
  {
    name: "/risks",
    description: "All critical and high-risk clauses with law references",
    prompt:
      "List ALL critical and high-risk clauses found so far. For each: quote the original text, state the risk level, cite the applicable Indian law, and explain why it matters in plain language.",
  },
  {
    name: "/playbook",
    description: "Full negotiation playbook, priority-ordered",
    prompt:
      "Generate a complete negotiation playbook based on all the risks we've discussed. Priority-ordered, with specific talking points and alternative clause language for each item.",
  },
  {
    name: "/redline",
    description: "Redlined version with original vs suggested text",
    prompt:
      "Generate a redlined version — for each flagged clause, show the original text and the suggested replacement text side by side.",
  },
  {
    name: "/stamp-duty",
    description: "Calculate stamp duty for this contract",
    prompt:
      "Calculate the stamp duty for this contract using get_stamp_duty. Show the duty amount, whether e-stamping is available, registration requirements, and penalty for deficiency.",
  },
  {
    name: "/checklist",
    description: "Required clauses for this contract type",
    prompt:
      "Use get_required_clauses to show me the complete checklist of clauses required for this contract type. Mark which ones are present and which are missing.",
  },
  {
    name: "/enforceability",
    description: "Check enforceability of a specific clause type",
    prompt: (clauseType: string) =>
      clauseType
        ? `Use check_enforceability to analyze the enforceability of the "${clauseType}" clause under Indian law. Include applicable sections, case law, and practical implications.`
        : "Which clause type do you want to check enforceability for? Options: non_compete, indemnity, penalty, moral_rights, governing_law, arbitration, termination.",
  },
  {
    name: "/compare",
    description: "Compare with previous version (if version exists)",
    prompt:
      "Use get_previous_analysis to load the previous version's analysis. Compare it with the current analysis — what changed? What improved? What got worse? Show a diff of key changes.",
  },
  {
    name: "/dossier",
    description: "Final analysis report for legal team",
    prompt:
      "Generate a final analysis dossier suitable for sharing with the legal team. Include: executive summary, risk score, clause-by-clause analysis, missing clauses, stamp duty, regulatory compliance, negotiation playbook, and the full limitations disclaimer. Before presenting, run a critic review to validate completeness.",
  },
  {
    name: "/next-steps",
    description: "Top 5 prioritized actions",
    prompt:
      "Based on everything we've found so far, give me a prioritized list of the top 5 things I should do next. What's urgent? What can wait? What needs a lawyer? Be specific and actionable.",
  },
  {
    name: "/help",
    description: "Show all available commands",
    prompt: "", // handled separately
  },
];

function showHelp(): void {
  console.log(`\n${c.cyan}${c.bold}Available Commands:${c.reset}\n`);
  for (const cmd of SLASH_COMMANDS) {
    if (cmd.name === "/help") continue;
    console.log(`  ${c.green}${cmd.name.padEnd(22)}${c.reset}${cmd.description}`);
  }
  console.log(`  ${c.green}${"/quit".padEnd(22)}${c.reset}End the session`);
  console.log(`\n${c.dim}You can also type any question in plain language.${c.reset}\n`);
}

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
║  Type /help for commands, /quit to exit                      ║
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

    const inputLower = userInput.toLowerCase();

    // Legacy command support — map old commands to slash commands
    const legacyMap: Record<string, string> = {
      playbook: "/playbook",
      summary: "/summary",
      redline: "/redline",
      help: "/help",
    };
    const normalized = legacyMap[inputLower] ?? userInput;

    if (inputLower === "help" || inputLower === "/help") {
      showHelp();
      continue;
    }

    if (inputLower === "quit" || inputLower === "exit" || inputLower === "/quit") {
      console.log(`\n${c.dim}Session ended. ${turnCount} turns.${c.reset}`);
      if (sessionId) {
        console.log(`${c.dim}Session ID: ${sessionId} (can be resumed later)${c.reset}`);
      }
      break;
    }

    // Slash command routing
    const slashInput = normalized.startsWith("/") ? normalized : userInput;
    const slashCmd = slashInput.toLowerCase();
    const slashCommand = SLASH_COMMANDS.find(
      (sc) => slashCmd === sc.name || slashCmd.startsWith(sc.name + " ")
    );

    if (slashCommand) {
      const args = slashInput.slice(slashCommand.name.length).trim();
      const prompt =
        typeof slashCommand.prompt === "function"
          ? slashCommand.prompt(args)
          : slashCommand.prompt;
      try {
        await runTurn(prompt);
      } catch (error) {
        console.error(`\n${c.red}Error:${c.reset}`, error);
      }
      continue;
    }

    // Unknown slash command detection
    if (slashCmd.startsWith("/") && slashCmd !== "/help") {
      console.log(
        `\n${c.yellow}Unknown command: ${slashCmd}. Type /help for available commands.${c.reset}\n`
      );
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
