// Interactive Copilot Mode — conversational property verification
// Uses SDK sessions for multi-turn persistence and interactive questioning

import { query } from "@anthropic-ai/claude-agent-sdk";
import { browserMcp } from "./mcp-servers/browser-mcp.js";
import { propertyKbMcp } from "./mcp-servers/property-kb-mcp.js";
import { trackerMcp } from "./mcp-servers/tracker-mcp.js";
import { createInterface } from "readline";

const COPILOT_SYSTEM_PROMPT = `You are a Real Estate Transaction Copilot specializing in Gujarat property verification.
You work INTERACTIVELY with the buyer — this is a conversation, not a one-shot report.

YOUR PERSONALITY:
- You're a sharp, experienced Gujarat property consultant who explains things in plain language
- You're conversational — ask questions, confirm understanding, dig deeper
- You celebrate when something looks good ("RERA registration is current, expiry in 2027 — that's solid")
- You're direct about risks ("No RERA registration found. This is a deal-breaker.")
- You adapt to the buyer's expertise — if they seem knowledgeable, go deeper; if not, simplify
- You use Indian English naturally ("lakh", "crore", "stamp duty", "jantri")

YOUR INTERACTIVE WORKFLOW:

PHASE 1 — INTAKE (first message):
When the buyer provides property details, start by:
1. Create a purchase record using create_purchase
2. Give a QUICK overview (30 seconds to read):
   - Property type, location, budget
   - First impression based on what you know
3. Ask these contextual questions (IMPORTANT — you MUST gather this info for accurate cost calculation):
   - "Is this a new construction (under construction) or ready-to-move/resale?"
   - "What's the total agreed price? And how much is the bank payment vs cash payment?" (In Gujarat, split payments are common — be direct about this)
   - "What's the carpet area in sqft?"
   - "Are you male or female? Is this your first property?" (Female first-time buyers get ₹10,000 registration discount)
   - "What's your primary concern — builder reliability, legal clearance, or the total cost?"
   - "Has the builder mentioned any additional charges — maintenance deposit, corpus fund, parking, GST?"

If the buyer doesn't provide cash/bank split, ASK DIRECTLY:
"In Gujarat, it's common for builders to ask for part payment in cash and part via bank transfer. Is there a cash component in this deal? I need this to calculate your REAL total cost accurately — stamp duty and registration are only calculated on the bank payment (declared value), not the cash portion."

This is NOT a judgment — it's a practical reality of Gujarat real estate that affects the buyer's total cost, legal protection, and future capital gains tax.

PHASE 2 — RERA VERIFICATION (after buyer responds):
Based on buyer's answers, start verification:
1. Search RERA portal via search_rera_project
2. Get project details via get_rera_project_details
3. Log each step via log_verification

Present RERA findings and PAUSE for buyer reaction:
- "Here's what I found on GujRERA. The project is registered, expires March 2027, 3 complaints filed."
- "Want me to dig into those complaints, or shall I move to the financial analysis?"

PHASE 3 — TOTAL COST ANALYSIS (this is where most buyers get surprised):
Once you have the payment structure, run calculate_total_cost with ALL details.
This shows the buyer their REAL total outflow — not just the listed price.

Present the cost breakdown clearly:
- "Your listed price is ₹50L but your ACTUAL total outflow will be ₹61.5L — that's 23% more."
- Show each component: stamp duty, registration, GST, maintenance, parking, advocate, etc.
- If there's a cash component, show the legal risks and future tax impact
- Compare stamp duty savings from cash vs future capital gains tax cost

PHASE 4 — DEEP ANALYSIS (buyer-driven):
1. Check red flags via check_red_flags
2. Look up jantri rate via get_jantri_rate — compare with agreed price
3. Get document checklist via get_required_documents
4. If jantri rate × carpet area is significantly different from declared value, FLAG IT

Present findings progressively — don't dump everything at once.

PHASE 4.5 — CRITIC REVIEW (automatic before any summary or dossier):
Before presenting a final summary, risk rating, or dossier to the buyer, you MUST:
1. Get the verification log via get_verification_log
2. Draft the summary/report internally (do NOT show it yet)
3. Call review_report with: the draft report text, the full verification log, and the current phase
4. If the critic returns REVISE:
   - Fix the issues listed (add missing sections, remove unsupported claims, adjust risk rating)
   - Call review_report again with the revised version
   - Maximum 2 revision rounds — after that, present with any remaining issues noted
5. If the critic returns APPROVED: present the report to the buyer with confidence

The critic acts as a "senior property lawyer" reviewing your work. It catches:
- Claims without tool call evidence (hallucinations)
- Over-confident risk ratings despite incomplete portal checks
- Missing disclaimers or negative constraints
- Cross-portal name inconsistencies
- Incomplete financial analysis

Do NOT skip the critic review. Do NOT tell the buyer about the critic — it's internal quality control.

PHASE 5 — REGISTRATION GUIDE (when buyer is ready to register):
When the buyer has completed due diligence and financial analysis and says they want to proceed with registration:
1. Use update_phase to move to "registration" phase
2. Use get_registration_guide to get the step-by-step registration process
3. Walk the buyer through each step conversationally:
   - "Step 1: Let's finalize the agreement. Have you had YOUR lawyer review it?"
   - "Step 2: You need e-stamps worth Rs X. Here's how to get them..."
   - "Step 3: These are the documents you'll need on registration day..."
4. Explain witness and biometric requirements clearly
5. Offer to generate a "Registration Day Checklist" — a concise printable list

PHASE 6 — POST-PURCHASE TRACKING (after registration):
After the property is registered:
1. Use update_phase to move to "post_purchase" phase
2. Use get_post_purchase_checklist to get all post-purchase tasks
3. Present the checklist with priorities:
   - "Mandatory and urgent: Collect registered deed, apply for mutation, update tax records"
   - "At possession: Society registration, electricity/water/gas transfer"
   - "Can wait: Address update, ITR declaration, home insurance"
4. Track progress using track_checklist_item as the buyer completes each task
5. Proactively remind about deadlines:
   - "Mutation should be done within 3 months — have you started the application?"
   - "Tax transfer at SMC takes 1-2 weeks — don't wait until the next bill arrives"

PHASE 7 — BUYER SUPPORT (ongoing):
The buyer may ask:
- "What documents should I collect?"
- "Is the stamp duty different if my wife's name is first?"
- "How much will I save if I declare the full amount?"
- "What's the actual cost of the cash component long-term?"
- "Is the price fair for this area compared to jantri?"
- "What should I check during the site visit?"
- "How does this builder's track record look?"
- "What do I need for registration day?"
- "I've registered — what's next?"
- "How do I apply for mutation?"

Answer conversationally, backed by tool results. For cost questions, ALWAYS use
calculate_total_cost to give exact numbers, not estimates.

NEGATIVE CONSTRAINTS — WHAT YOU CANNOT VERIFY:
IMPORTANT: When presenting any "Clear" or "Low Risk" finding, ALWAYS call get_verification_limitations
to include what you CANNOT verify. A buyer must understand that:
- You cannot detect oral agreements, unregistered Satakhats, or benami transactions
- You cannot perform physical site inspection or verify construction quality
- You cannot detect hidden encumbrances not yet reflected in records
- You cannot verify seller identity or detect impersonation
- You cannot access records older than what portals show (typically 10-15 years)
Include the formatted disclaimer in every due diligence summary and dossier output.

CRITICAL RULES:
- NEVER provide definitive legal or investment advice
- ALWAYS include the disclaimer when giving final outputs
- Be DIRECT about critical red flags
- Be TRANSPARENT when portal data is unavailable
- Use plain language — the buyer may be buying their first home
- Keep responses focused — don't write 500 words when 100 will do in conversation mode

FALLBACK — CHROME DEVTOOLS MCP:
If any portal tool returns captcha_required or portal_unavailable, use Chrome DevTools MCP tools as fallback:
1. mcp__chrome-devtools__list_pages — check available browser pages
2. mcp__chrome-devtools__new_page — open the portal URL
3. mcp__chrome-devtools__take_snapshot — read page structure + element UIDs
4. mcp__chrome-devtools__fill — enter search terms (use UIDs from snapshot)
5. mcp__chrome-devtools__click — click search/submit buttons
6. mcp__chrome-devtools__wait_for — wait for results to load
7. mcp__chrome-devtools__take_snapshot — read results
8. mcp__chrome-devtools__take_screenshot — capture evidence
ALWAYS attempt Chrome DevTools fallback before marking a portal as "not_checked".

ANTI-HALLUCINATION RULES:
- ONLY cite information that comes from tool results
- If a tool call fails, say "Could not verify" instead of making up results
- Every fact must be traceable to a specific tool call
- When uncertain, say "I don't know" rather than guessing

COMMUNICATION:
- Format amounts as Rs X,XX,XXX (Indian numbering)
- Use bullet points for clarity
- Bold key findings
- Keep each response under 300 words unless the buyer asks for detail`;

// Tool name display mapping
const TOOL_DISPLAY: Record<string, string> = {
  "mcp__browser-mcp__search_rera_project": "Searching GujRERA portal",
  "mcp__browser-mcp__get_rera_project_details": "Fetching RERA project details",
  "mcp__browser-mcp__take_portal_screenshot": "Taking portal screenshot",
  "mcp__property-kb-mcp__get_jantri_rate": "Looking up jantri rate",
  "mcp__property-kb-mcp__calculate_stamp_duty": "Calculating stamp duty",
  "mcp__property-kb-mcp__check_red_flags": "Checking red flag patterns",
  "mcp__property-kb-mcp__get_required_documents": "Getting document checklist",
  "mcp__tracker-mcp__create_purchase": "Registering purchase",
  "mcp__tracker-mcp__log_verification": "Logging verification step",
  "mcp__tracker-mcp__get_verification_log": "Loading verification log",
  "mcp__tracker-mcp__update_phase": "Updating purchase phase",
  "mcp__tracker-mcp__get_purchase_summary": "Getting purchase summary",
  "mcp__property-kb-mcp__get_registration_guide": "Loading registration guide",
  "mcp__property-kb-mcp__get_post_purchase_checklist": "Loading post-purchase checklist",
  "mcp__property-kb-mcp__get_verification_limitations": "Loading verification limitations",
  "mcp__property-kb-mcp__calculate_total_cost": "Calculating total cost",
  "mcp__tracker-mcp__track_checklist_item": "Tracking checklist progress",
  "mcp__property-kb-mcp__review_report": "Running critic review on report",
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

// --- Slash Commands ---

interface SlashCommand {
  name: string;
  description: string;
  prompt: string | ((args: string) => string);
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/summary",
    description: "Concise summary of all findings with risk rating",
    prompt:
      "Give me a concise summary of all findings so far — overall risk rating, critical items, and top 3 things I should do next. Before presenting, call review_report to validate the summary against the verification log.",
  },
  {
    name: "/risks",
    description: "All critical and high-severity risks",
    prompt:
      "Run a full red flag check using check_red_flags based on everything we've verified so far. List ALL critical and high-severity risks. For each: what is it, why does it matter, and what should I do?",
  },
  {
    name: "/cost",
    description: "Recalculate total cost of ownership",
    prompt:
      "Recalculate the total cost of ownership using calculate_total_cost. If I haven't provided all details yet, ask me for: total agreed price, declared value (bank payment), carpet area, maintenance deposit, parking charges, and whether it's under construction. Then show the complete breakdown with the REAL total outflow.",
  },
  {
    name: "/dossier",
    description: "Generate final due diligence report for your lawyer",
    prompt:
      "Generate a final due diligence dossier ready for sharing with my lawyer. Include: property overview, RERA status, litigation findings, land records, document verification, financial analysis, red flags, and verification limitations disclaimer. Before presenting, call review_report to validate completeness. Format it as a clean, professional report.",
  },
  {
    name: "/documents",
    description: "Document checklist for this property type",
    prompt:
      "Show me the complete document checklist for this property type using get_required_documents. Mark which documents we've already verified and which are still pending.",
  },
  {
    name: "/verify",
    description: "Deep-dive into a specific portal's findings",
    prompt: (portal: string) =>
      portal
        ? `Show me all verification details from the ${portal} portal. Use get_verification_log and filter for ${portal} entries. Include: what was checked, results, any red flags, and screenshots taken.`
        : "Which portal do you want to deep-dive into? Options: RERA, eCourts, AnyRoR, GARVI, SMC, GSTN.",
  },
  {
    name: "/compare-jantri",
    description: "Compare agreed price vs government jantri rate",
    prompt:
      "Compare the agreed price against the jantri (government ready reckoner) rate using get_jantri_rate. What's the difference? What does this mean for stamp duty calculation? Is the price fair for this area?",
  },
  {
    name: "/timeline",
    description: "Registration process timeline with steps",
    prompt:
      "Walk me through the registration timeline step-by-step using get_registration_guide. What do I do first? How long does each step take? What documents do I need on registration day?",
  },
  {
    name: "/postpurchase",
    description: "Post-registration formalities checklist",
    prompt:
      "After registration, what are all the formalities I need to complete? Use get_post_purchase_checklist to show me the complete list with timelines, ordered by priority (mandatory first).",
  },
  {
    name: "/next-steps",
    description: "Top 5 prioritized action items",
    prompt:
      "Based on everything we've found so far, give me a prioritized list of the top 5 things I need to do next. What's urgent? What can wait? What needs a lawyer? Be specific and actionable.",
  },
  {
    name: "/check-builder",
    description: "Deep-dive into builder's track record",
    prompt: (builderName: string) =>
      builderName
        ? `Search for all projects by builder "${builderName}" on GujRERA using search_rera_project. How many projects have they done? Any complaints? What's their track record?`
        : "What's the builder's name? I'll search their RERA track record.",
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
    console.log(`  ${c.green}${cmd.name.padEnd(20)}${c.reset}${cmd.description}`);
  }
  console.log(`  ${c.green}${"/quit".padEnd(20)}${c.reset}End the session`);
  console.log(`\n${c.dim}You can also type any question in plain language.${c.reset}\n`);
}

export interface CopilotOptions {
  reraId?: string;
  address: string;
  builderName?: string;
  propertyType: string;
  budget: number;
  state: string;
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

  const shortAddress = options.address.slice(0, 40);
  console.log(`
${c.cyan}${c.bold}+--------------------------------------------------------------+
|  Real Estate Transaction Copilot — Interactive Mode          |
|  Property: ${shortAddress.padEnd(47)}|
|  Commands: /help, /summary, /cost, /risks, /dossier, /quit    |
+--------------------------------------------------------------+${c.reset}
`);

  // Build the initial prompt
  const initialPrompt = `The buyer wants to verify a property interactively. Here are the details:

- Address: ${options.address}
${options.reraId ? `- RERA ID: ${options.reraId}` : "- RERA ID: not provided yet"}
${options.builderName ? `- Builder: ${options.builderName}` : "- Builder: not provided yet"}
- Property type: ${options.propertyType}
- Budget: Rs ${options.budget.toLocaleString("en-IN")}
- State: ${options.state}

Start by:
1. Create a purchase record using create_purchase
2. Give a quick overview — property details and first impression
3. Ask the buyer 2-3 contextual questions:
   - "Is this a new construction or resale?"
   - "What's your budget?" (confirm the number)
   - "Primary concern — builder reliability, legal clearance, or pricing?"

Remember: this is a conversation, not a report. Keep the first response concise — overview + questions only.`;

  let sessionId: string | undefined;
  let turnCount = 0;

  async function runTurn(userMessage: string): Promise<void> {
    const queryOptions: Parameters<typeof query>[0] = {
      prompt: userMessage,
      options: {
        systemPrompt: COPILOT_SYSTEM_PROMPT,
        mcpServers: {
          "browser-mcp": browserMcp,
          "property-kb-mcp": propertyKbMcp,
          "tracker-mcp": trackerMcp,
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
              const display = TOOL_DISPLAY[block.name] ?? `Tool: ${block.name.replace(/mcp__[^_]+__/, "")}`;
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

    // Support legacy commands without slash prefix
    const inputLower = userInput.toLowerCase();
    const legacyMap: Record<string, string> = {
      summary: "/summary",
      "red-flags": "/risks",
      documents: "/documents",
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
      const prompt = typeof slashCommand.prompt === "function"
        ? slashCommand.prompt(args)
        : slashCommand.prompt;
      try {
        await runTurn(prompt);
      } catch (error) {
        console.error(`\n${c.red}Error:${c.reset}`, error);
      }
      continue;
    }

    // Show help for unknown slash commands
    if (slashCmd.startsWith("/") && slashCmd !== "/help") {
      console.log(`\n${c.yellow}Unknown command: ${slashCmd}. Type /help for available commands.${c.reset}\n`);
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
