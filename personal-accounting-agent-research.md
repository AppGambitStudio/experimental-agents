# Deep Agent for Personal Accounting — Research Document

## Overview

This document outlines how to build a **deep personal accounting agent** using the **Claude Agent SDK**. The agent would autonomously handle financial data processing, categorization, reconciliation, reporting, and insights — acting as an AI-powered personal accountant.

---

## 1. Why Claude Agent SDK (vs. Raw Claude API)

| Feature | Claude API (Client SDK) | Claude Agent SDK |
|---------|------------------------|------------------|
| Tool execution | You implement the loop | Built-in, autonomous |
| File read/write | Manual implementation | Built-in tools (Read, Write, Edit) |
| Shell commands | Manual implementation | Built-in Bash tool |
| Web search | Manual implementation | Built-in WebSearch/WebFetch |
| Subagents | Not available | Built-in Agent tool |
| Session persistence | Manual state management | Built-in session resume/fork |
| MCP integrations | Manual | First-class support |
| Hooks (audit, validation) | Not available | PreToolUse, PostToolUse, etc. |

**Verdict**: The Agent SDK is ideal for a personal accounting agent because it needs to read/write files, execute commands, maintain session context, and orchestrate multiple specialized sub-tasks.

---

## 2. Architecture

### High-Level Design

```
                    +---------------------------+
                    |   Personal Accounting     |
                    |      Main Agent           |
                    |  (Orchestrator)           |
                    +---------------------------+
                         |        |        |
            +------------+   +---+---+   +------------+
            |                |           |             |
   +--------v------+  +-----v-----+  +--v---------+  +--v-----------+
   | Transaction   |  | Category  |  | Report     |  | Tax          |
   | Processor     |  | Classifier|  | Generator  |  | Assistant    |
   | (Subagent)    |  | (Subagent)|  | (Subagent) |  | (Subagent)   |
   +---------------+  +-----------+  +------------+  +--------------+
         |                  |              |                |
   +-----v------+    +-----v----+   +-----v-----+   +-----v------+
   | CSV/Excel  |    | Rules &  |   | Charts &  |   | Tax Rules  |
   | Bank Files |    | ML Model |   | Summaries |   | Deductions |
   +------------+    +----------+   +-----------+   +------------+
```

### Data Flow

1. **Ingest** — Import bank statements (CSV/Excel/PDF), receipts, invoices
2. **Process** — Parse, normalize, deduplicate transactions
3. **Classify** — Auto-categorize (groceries, rent, subscriptions, income, etc.)
4. **Reconcile** — Match transactions across accounts, flag anomalies
5. **Report** — Generate monthly/quarterly/annual summaries
6. **Advise** — Spending insights, budget recommendations, tax prep

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (main agent), claude-haiku-4-5 (classification subagents)
Storage:         SQLite (local) or PostgreSQL (multi-user)
File Formats:    CSV, Excel (.xlsx), PDF bank statements
MCP Servers:     Playwright (web scraping), custom finance MCP
Frontend:        React + WebSocket (optional dashboard)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install better-sqlite3        # Local DB
npm install xlsx                   # Excel parsing
npm install pdf-parse              # PDF extraction
```

---

## 4. Implementation Guide

### 4.1 Main Orchestrator Agent

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `You are a personal accounting agent. You help users:
- Import and process bank statements and financial documents
- Categorize transactions automatically
- Generate financial reports and summaries
- Track budgets and spending patterns
- Prepare tax-related summaries

You have access to specialized subagents for different tasks.
Always confirm before making any financial calculations that affect tax reporting.
Store all data in the ./accounting-data/ directory.`;

async function runAccountingAgent(userPrompt: string) {
  for await (const message of query({
    prompt: userPrompt,
    options: {
      cwd: "/path/to/accounting-workspace",
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 50,
      agents: {
        "transaction-processor": {
          description: "Processes and parses bank statements, CSV files, and financial documents into structured transaction data.",
          prompt: `You are a transaction processing specialist. Your job is to:
1. Read bank statement files (CSV, Excel, PDF)
2. Parse and normalize transaction data
3. Output structured JSON with: date, description, amount, type (debit/credit), account
4. Handle multiple bank formats (Chase, BofA, Amex, etc.)
5. Deduplicate transactions across files
Store processed data in ./accounting-data/transactions/`,
          tools: ["Read", "Write", "Bash", "Glob"],
        },
        "category-classifier": {
          description: "Classifies transactions into spending categories using rules and AI.",
          prompt: `You are a transaction categorization specialist. Your job is to:
1. Read processed transactions from ./accounting-data/transactions/
2. Classify each into categories: Housing, Food, Transport, Utilities, Entertainment, Healthcare, Shopping, Income, Transfers, Subscriptions, Other
3. Learn from user corrections to improve future classifications
4. Maintain a rules file at ./accounting-data/category-rules.json
5. Flag uncertain classifications for user review`,
          tools: ["Read", "Write", "Edit", "Glob", "Grep"],
        },
        "report-generator": {
          description: "Generates financial reports, summaries, charts, and budget analysis.",
          prompt: `You are a financial reporting specialist. Your job is to:
1. Read categorized transactions from ./accounting-data/
2. Generate monthly/quarterly/annual spending summaries
3. Create budget vs actual comparisons
4. Identify spending trends and anomalies
5. Output reports as Markdown files in ./accounting-data/reports/
6. Include tables, breakdowns by category, and month-over-month comparisons`,
          tools: ["Read", "Write", "Bash", "Glob", "Grep"],
        },
        "tax-assistant": {
          description: "Helps with tax preparation by identifying deductible expenses and generating tax summaries.",
          prompt: `You are a tax preparation assistant. Your job is to:
1. Review categorized transactions for tax-deductible expenses
2. Identify potential deductions (home office, medical, charitable, business)
3. Generate tax summary reports organized by deduction category
4. Flag transactions that need receipts or documentation
5. Output tax summaries to ./accounting-data/tax/
IMPORTANT: Always note that you provide estimates only, not professional tax advice.`,
          tools: ["Read", "Write", "Glob", "Grep"],
        },
      },
    },
  })) {
    if ("result" in message) {
      console.log(message.result);
    }
  }
}
```

### 4.2 Transaction Processing — Bank Statement Parsing

The transaction-processor subagent handles multiple bank formats:

```typescript
// Example: What the agent would create at ./accounting-data/parsers/chase.ts
interface Transaction {
  id: string;
  date: string;           // ISO 8601
  description: string;
  amount: number;         // negative = debit, positive = credit
  category?: string;
  account: string;
  bank: string;
  raw_description: string;
}

// The agent reads CSV files and produces normalized JSON:
// Input:  ./statements/chase-march-2026.csv
// Output: ./accounting-data/transactions/2026-03-chase.json
```

### 4.3 Category Classification with Learning

```typescript
// Category rules the agent maintains at ./accounting-data/category-rules.json
interface CategoryRules {
  rules: {
    pattern: string;      // regex or keyword match
    category: string;
    confidence: number;
  }[];
  user_overrides: {
    description: string;
    assigned_category: string;
    date_added: string;
  }[];
}

// Example rules:
// "NETFLIX" → Subscriptions (0.99)
// "WHOLE FOODS" → Food (0.95)
// "UBER" → Transport (0.85) — could be Uber Eats (Food)
```

### 4.4 Hooks for Audit & Security

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";

// Audit hook: log every file the agent reads or writes
const auditHook: HookCallback = async (input) => {
  const toolInput = (input as any).tool_input ?? {};
  const entry = {
    timestamp: new Date().toISOString(),
    tool: (input as any).tool_name,
    file: toolInput.file_path || toolInput.command || "unknown",
  };
  // Append to audit log
  const fs = await import("fs/promises");
  await fs.appendFile(
    "./accounting-data/audit.log",
    JSON.stringify(entry) + "\n"
  );
  return {};
};

// Security hook: prevent the agent from accessing sensitive paths
const securityHook: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "";
  const blocked = [".env", "credentials", "password", ".ssh", ".aws"];
  if (blocked.some((b) => filePath.toLowerCase().includes(b))) {
    return { error: `Access denied: ${filePath} is restricted` };
  }
  return {};
};

// Usage in query options:
// hooks: {
//   PostToolUse: [{ matcher: "Read|Write|Edit", hooks: [auditHook] }],
//   PreToolUse: [{ matcher: "Read|Bash", hooks: [securityHook] }],
// }
```

### 4.5 Session Persistence for Multi-Day Workflows

```typescript
import { query, listSessions } from "@anthropic-ai/claude-agent-sdk";

// Resume a previous accounting session
async function resumeAccounting(userPrompt: string) {
  // Find the latest accounting session
  const sessions = await listSessions({ limit: 20 });
  const lastSession = sessions.find((s) => s.tag === "accounting");

  if (lastSession) {
    // Resume with full context
    for await (const message of query({
      prompt: userPrompt,
      options: { resume: lastSession.sessionId },
    })) {
      if ("result" in message) console.log(message.result);
    }
  }
}

// Tag sessions for easy retrieval
// Use tagSession(sessionId, "accounting") after each run
```

---

## 5. MCP Integrations

MCP (Model Context Protocol) lets the agent connect to external financial services.

### 5.1 Custom Finance MCP Server

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Custom MCP tool: fetch transactions from a bank API
const fetchBankTransactions = tool(
  "fetch_bank_transactions",
  "Fetch recent transactions from a connected bank account via Plaid/API",
  {
    account_id: z.string().describe("The bank account identifier"),
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
  },
  async (args) => {
    // Integration with Plaid, Yodlee, or bank API
    const transactions = await fetchFromBankAPI(args);
    return {
      content: [{ type: "text", text: JSON.stringify(transactions) }],
    };
  }
);

// Custom MCP tool: currency conversion
const convertCurrency = tool(
  "convert_currency",
  "Convert an amount between currencies using live exchange rates",
  {
    amount: z.number(),
    from: z.string().describe("Source currency code (e.g., USD)"),
    to: z.string().describe("Target currency code (e.g., EUR)"),
  },
  async (args) => {
    const rate = await getExchangeRate(args.from, args.to);
    const converted = args.amount * rate;
    return {
      content: [{ type: "text", text: `${args.amount} ${args.from} = ${converted.toFixed(2)} ${args.to}` }],
    };
  }
);

const financeServer = createSdkMcpServer({
  name: "finance-tools",
  tools: [fetchBankTransactions, convertCurrency],
});

// Pass to query:
// options: { mcpServers: { finance: financeServer } }
```

### 5.2 Potential MCP Integrations

| MCP Server | Use Case |
|------------|----------|
| **Playwright** | Scrape bank websites for statements |
| **Google Sheets** | Sync with spreadsheet budgets |
| **Slack** | Send weekly spending summaries |
| **PostgreSQL** | Store transactions in a database |
| **Custom Plaid MCP** | Direct bank account access |
| **Email MCP** | Parse receipt emails automatically |

---

## 6. Example User Interactions

### Import & Process Statements

```
User: "Import all CSV files from ./bank-statements/ and categorize the transactions for March 2026"

Agent flow:
1. Glob for *.csv in ./bank-statements/
2. Dispatch transaction-processor subagent
3. Dispatch category-classifier subagent
4. Return summary: "Processed 247 transactions from 3 accounts.
   Top categories: Food (₹1,05,400), Housing (₹1,78,500), Transport (₹32,300)"
```

### Monthly Report

```
User: "Generate my monthly spending report for February 2026"

Agent flow:
1. Dispatch report-generator subagent
2. Reads categorized transactions
3. Generates ./accounting-data/reports/2026-02-summary.md
4. Returns: formatted table with category breakdowns,
   month-over-month comparison, budget alerts
```

### Tax Prep

```
User: "Help me prepare my 2025 tax deductions summary"

Agent flow:
1. Dispatch tax-assistant subagent
2. Scans all 2025 transactions for deductible categories
3. Generates ./accounting-data/tax/2025-deductions.md
4. Returns: organized deductions by category with totals,
   flags items needing receipts
```

### Budget Tracking

```
User: "Set a ₹15,000/month dining budget and alert me when I'm at 80%"

Agent flow:
1. Creates/updates ./accounting-data/budgets.json
2. Checks current month spending against budget
3. Returns current status and sets up tracking
```

---

## 7. Data Model

### Directory Structure

```
./accounting-data/
  /transactions/
    2026-03-chase.json
    2026-03-amex.json
    2026-03-bofa.json
  /reports/
    2026-02-summary.md
    2026-Q1-summary.md
  /tax/
    2025-deductions.md
  /receipts/
    (scanned receipt images)
  category-rules.json
  budgets.json
  accounts.json
  audit.log
```

### Transaction Schema

```json
{
  "id": "txn_abc123",
  "date": "2026-03-15",
  "description": "WHOLE FOODS MKT #10234",
  "raw_description": "WHOLE FOODS MKT #10234 SAN FRAN",
  "amount": -87.43,
  "category": "Food & Groceries",
  "subcategory": "Groceries",
  "account": "Chase Checking ****4521",
  "bank": "chase",
  "type": "debit",
  "tags": ["grocery", "weekly-shop"],
  "notes": "",
  "receipt_attached": false
}
```

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Sensitive financial data** | All data stays local (no cloud uploads); use PreToolUse hooks to block access to .env, credentials |
| **Incorrect categorization** | Flag low-confidence classifications; require user confirmation for tax-related items |
| **Agent accessing external APIs** | Use permissionMode: "default" to require approval for Bash/network operations |
| **Audit trail** | PostToolUse hooks log every file read/write to audit.log |
| **Data backups** | Agent creates periodic JSON backups before any bulk operations |
| **Tax accuracy disclaimer** | System prompt includes disclaimer that agent provides estimates, not professional tax advice |

---

## 9. Development Roadmap

### Phase 1 — MVP (Week 1-2)
- [ ] Basic CSV import and parsing (Chase, Amex formats)
- [ ] Rule-based transaction categorization
- [ ] Monthly spending summary report
- [ ] SQLite storage for transactions

### Phase 2 — Smart Classification (Week 3-4)
- [ ] AI-powered categorization with learning from corrections
- [ ] Multi-account reconciliation
- [ ] Budget tracking with alerts
- [ ] PDF bank statement parsing

### Phase 3 — Reports & Tax (Week 5-6)
- [ ] Quarterly/annual reports with trend analysis
- [ ] Tax deduction identification and summary
- [ ] Receipt matching (photo → transaction)
- [ ] Export to common accounting formats (QIF, OFX)

### Phase 4 — Integrations (Week 7-8)
- [ ] Plaid MCP for direct bank connections
- [ ] Email receipt parsing via MCP
- [ ] Google Sheets sync for shared budgets
- [ ] Slack notifications for spending alerts
- [ ] React dashboard with WebSocket streaming

---

## 10. Cost Estimates

| Operation | Model | Est. Tokens | Est. Cost |
|-----------|-------|-------------|-----------|
| Import 100 transactions | Haiku 4.5 | ~5K in / 2K out | ~₹1.70 |
| Categorize 100 transactions | Haiku 4.5 | ~10K in / 5K out | ~₹3.50 |
| Generate monthly report | Opus 4.6 | ~20K in / 5K out | ~₹20 |
| Tax deduction analysis | Opus 4.6 | ~50K in / 10K out | ~₹42 |
| Full monthly workflow | Mixed | ~100K total | ~₹85 |

**Optimization tips:**
- Use Haiku 4.5 for high-volume classification subagents
- Use Opus 4.6 for complex analysis and report generation
- Cache system prompts with `cache_control: { type: "ephemeral" }`
- Batch process transactions to reduce API calls

---

## 11. Getting Started — Quick Setup

```bash
# 1. Create project
mkdir personal-accounting-agent && cd personal-accounting-agent
npm init -y
npm install @anthropic-ai/claude-agent-sdk better-sqlite3 xlsx

# 2. Set API key
export ANTHROPIC_API_KEY=your-key-here

# 3. Create directory structure
mkdir -p accounting-data/{transactions,reports,tax,receipts}
mkdir -p bank-statements

# 4. Drop your bank CSV files into ./bank-statements/

# 5. Run the agent
npx tsx agent.ts "Import and categorize all transactions from ./bank-statements/"
```

---

## 12. References

- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Agent SDK Demo Agents](https://github.com/anthropics/claude-agent-sdk-demos) — Email agent, Research agent, Resume generator patterns
- [MCP Servers](https://github.com/modelcontextprotocol/servers)
- [Claude API Pricing](https://platform.claude.com/docs/en/pricing)
