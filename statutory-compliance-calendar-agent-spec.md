# Deep Agent for Statutory Compliance Calendar (India) — Research Document

## Overview

This document outlines how to build a **Statutory Compliance Calendar Agent** using the **Claude Agent SDK**. The agent autonomously tracks, alerts, prepares, and assists in filing 30+ recurring statutory compliance obligations across GST, Income Tax, TDS/TCS, PF, ESI, Professional Tax, ROC/MCA, and state-level filings — purpose-built for Indian businesses operating across multiple states.

---

## 1. Why This Agent Is Needed

### The Problem

Indian businesses face a **compliance minefield**:

| Pain Point | Detail |
|------------|--------|
| **30+ recurring deadlines** | GST (monthly/quarterly), TDS (monthly + quarterly), PF/ESI (monthly), ROC (annual), PT (state-specific) |
| **Multi-state complexity** | A company operating in 5 states has 5 different Professional Tax calendars, Shop & Establishment renewals, and Labour Welfare Fund rules |
| **Penalty exposure** | Late GST filing: ₹50/day (CGST+SGST). Late TDS: 1.5%/month interest + ₹200/day u/s 234E. ROC: ₹100/day |
| **Manual tracking** | Most CAs and SMEs use Excel sheets or generic calendar reminders — no automated data prep |
| **Frequent regulation changes** | Government regularly shifts deadlines, adds new forms, or changes thresholds |

### Why Claude Agent SDK

The Agent SDK is ideal because this agent needs to:
- **Orchestrate multiple subagents** — one per compliance domain (GST, TDS, ROC, etc.)
- **Read/write structured data** — compliance calendars, filing checklists, document inventories
- **Execute shell commands** — run scripts for data extraction, API calls to government portals
- **Maintain session context** — multi-day workflows (prepare → review → file)
- **Use MCP integrations** — connect to Tally, Zoho Books, government APIs
- **Send notifications** — Slack/WhatsApp alerts for upcoming deadlines

---

## 2. Architecture

### High-Level Design

```
                    +----------------------------------+
                    |   Compliance Calendar            |
                    |      Main Agent                  |
                    |  (Orchestrator + Scheduler)      |
                    +----------------------------------+
                         |       |       |        |
          +--------------+  +----+---+  +--+------+---+
          |                 |          |               |
  +-------v--------+ +-----v----+ +---v----------+ +--v-----------+
  | GST Compliance | | TDS/TCS  | | PF & ESI     | | ROC/MCA      |
  | Agent          | | Agent    | | Agent        | | Agent        |
  | (Subagent)     | | (Subag.) | | (Subagent)   | | (Subagent)   |
  +----------------+ +----------+ +--------------+ +--------------+
          |                 |          |               |
  +-------v--------+ +-----v----+ +---v----------+ +--v-----------+
  | Professional   | | Labour   | | Shop & Est.  | | Notification |
  | Tax Agent      | | Welfare  | | Agent        | | Agent        |
  | (Subagent)     | | (Subag.) | | (Subagent)   | | (Subagent)   |
  +----------------+ +----------+ +--------------+ +--------------+
```

### Data Flow

1. **Configure** — Set up entity profile (GSTINs, TANs, CINs, PF codes, states of operation)
2. **Generate Calendar** — Build compliance calendar based on entity type, turnover thresholds, and states
3. **Monitor** — Daily scan for upcoming deadlines (T-7, T-3, T-1 alerts)
4. **Prepare** — Auto-generate filing checklists, pull data from accounting software
5. **Assist** — Pre-fill return data, validate before submission
6. **Track** — Log filing status, acknowledgement numbers, payment challans
7. **Adapt** — Monitor for government notifications changing deadlines/rules

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (orchestrator, complex analysis)
                 claude-sonnet-4-6 (return preparation, validation)
                 claude-haiku-4-5 (notifications, simple lookups)
Storage:         PostgreSQL (multi-entity) or SQLite (single entity)
Queue:           BullMQ + Redis (for scheduled deadline checks)
MCP Servers:     Custom Tally MCP, GST API MCP, Slack/WhatsApp MCP
Frontend:        React dashboard (optional)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install pg                          # PostgreSQL
npm install bullmq ioredis              # Job scheduling
npm install xlsx                        # Excel export
npm install pdf-lib                     # PDF generation for challans
npm install dayjs                       # Date handling with Indian calendar
```

---

## 4. Compliance Domain Coverage

### 4.1 GST Compliance

| Return | Frequency | Due Date | Applicable To |
|--------|-----------|----------|---------------|
| **GSTR-1** | Monthly | 11th of next month | Turnover > ₹5 Cr |
| **GSTR-1** | Quarterly (QRMP) | 13th of month after quarter | Turnover ≤ ₹5 Cr |
| **GSTR-3B** | Monthly | 20th of next month | Turnover > ₹5 Cr |
| **GSTR-3B** | Quarterly (QRMP) | 22nd/24th of month after quarter | Turnover ≤ ₹5 Cr (date varies by state) |
| **IFF** | Monthly (optional under QRMP) | 13th of next month | B2B invoices in non-quarter months |
| **GSTR-9** | Annual | 31st December | All regular taxpayers |
| **GSTR-9C** | Annual | 31st December | Turnover > ₹5 Cr |
| **CMP-08** | Quarterly | 18th of month after quarter | Composition dealers |
| **GSTR-8** | Monthly | 10th of next month | E-commerce operators |

### 4.2 TDS/TCS Compliance

| Filing | Frequency | Due Date | Form |
|--------|-----------|----------|------|
| **TDS Payment** | Monthly | 7th of next month | Challan 281 |
| **TDS Return** | Quarterly | 31st of month after quarter | 24Q (Salary), 26Q (Non-salary), 27Q (NRI) |
| **TCS Return** | Quarterly | 15th of month after quarter | 27EQ |
| **TDS Certificate** | Quarterly | 15 days after TDS return due date | Form 16A |
| **Form 16** | Annual | 15th June | Salary TDS |

### 4.3 PF & ESI

| Filing | Frequency | Due Date |
|--------|-----------|----------|
| **PF Payment** | Monthly | 15th of next month |
| **PF ECR Filing** | Monthly | 15th of next month |
| **PF Annual Return** | Annual | 25th April |
| **ESI Payment** | Monthly | 15th of next month |
| **ESI Return** | Half-yearly | 12th May / 11th November |

### 4.4 ROC/MCA Filings

| Filing | Frequency | Due Date | Form |
|--------|-----------|----------|------|
| **Annual Return** | Annual | Within 60 days of AGM | MGT-7/MGT-7A |
| **Financial Statements** | Annual | Within 30 days of AGM | AOC-4 |
| **AGM** | Annual | Within 6 months of FY end (30th Sep) | — |
| **DIR-3 KYC** | Annual | 30th September | DIR-3 KYC |
| **DPT-3** | Annual | 30th June | DPT-3 |
| **MSME-1** | Half-yearly | 31st Oct / 30th Apr | MSME-1 |
| **Beneficial Ownership** | Annual/Event | Within 30 days of change | BEN-2 |

### 4.5 Professional Tax (State-wise)

| State | Frequency | Due Date | Threshold |
|-------|-----------|----------|-----------|
| **Maharashtra** | Monthly | Last day of month | Salary > ₹10,000/month |
| **Karnataka** | Monthly | 20th of next month | Salary > ₹15,000/month |
| **West Bengal** | Monthly | 21st of next month | Salary > ₹10,000/month |
| **Gujarat** | Monthly | 15th of next month | Salary > ₹12,000/month |
| **Tamil Nadu** | Half-yearly | April & October | Salary > ₹21,000/half-year |
| **Andhra Pradesh** | Monthly | 10th of next month | Salary > ₹15,000/month |
| **Telangana** | Monthly | 10th of next month | Salary > ₹15,000/month |

### 4.6 Other Compliances

| Filing | Frequency | Due Date |
|--------|-----------|----------|
| **Income Tax Return** | Annual | 31st July (non-audit) / 31st Oct (audit) |
| **Tax Audit Report** | Annual | 30th September |
| **Transfer Pricing Report** | Annual | 30th November |
| **Advance Tax** | Quarterly | 15th Jun, Sep, Dec, Mar |
| **Labour Welfare Fund** | State-specific | Half-yearly/Annual |
| **Shop & Establishment** | Annual renewal | State-specific |
| **FSSAI Renewal** | Annual | Before expiry |
| **Trade License** | Annual | Municipal-specific |

---

## 5. Implementation Guide

### 5.1 Main Orchestrator Agent

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `You are a Statutory Compliance Calendar Agent for Indian businesses.
You help organizations track, prepare for, and complete their regulatory filing obligations.

Your responsibilities:
- Maintain an accurate compliance calendar based on entity profile
- Send timely alerts (T-7, T-3, T-1) for upcoming deadlines
- Generate filing checklists with required documents and data
- Pre-validate return data before filing
- Track filing status and maintain acknowledgement records
- Monitor government notifications for deadline changes

CRITICAL RULES:
- Always verify current due dates against the latest government notifications
- Flag if a deadline has been extended by CBDT/CBIC/MCA notification
- Never auto-file returns — always require human confirmation before submission
- Clearly state penalties for late filing to convey urgency
- All dates follow Indian Standard Time (IST)
- Financial year runs April 1 to March 31

Store all data in ./compliance-data/ directory.`;

async function runComplianceAgent(userPrompt: string) {
  for await (const message of query({
    prompt: userPrompt,
    options: {
      cwd: "/path/to/compliance-workspace",
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
      permissionMode: "default",
      maxTurns: 50,
      agents: {
        "gst-agent": {
          description: "Handles all GST compliance — GSTR-1, GSTR-3B, GSTR-9, IFF, reconciliation with GSTR-2A/2B.",
          model: "claude-sonnet-4-6",
          prompt: GST_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        },
        "tds-agent": {
          description: "Handles TDS/TCS compliance — monthly payments, quarterly returns (24Q/26Q/27Q/27EQ), Form 16/16A.",
          model: "claude-sonnet-4-6",
          prompt: TDS_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        },
        "pf-esi-agent": {
          description: "Handles PF and ESI compliance — monthly ECR, payments, half-yearly ESI returns.",
          model: "claude-haiku-4-5",
          prompt: PF_ESI_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Glob", "Grep"],
        },
        "roc-agent": {
          description: "Handles MCA/ROC filings — AGM, AOC-4, MGT-7, DIR-3 KYC, DPT-3, MSME-1.",
          model: "claude-sonnet-4-6",
          prompt: ROC_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Glob", "Grep"],
        },
        "professional-tax-agent": {
          description: "Handles state-wise Professional Tax compliance across all states of operation.",
          model: "claude-haiku-4-5",
          prompt: PT_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Glob", "Grep"],
        },
        "notification-agent": {
          description: "Sends deadline alerts via Slack/WhatsApp, generates daily/weekly compliance summaries.",
          model: "claude-haiku-4-5",
          prompt: NOTIFICATION_AGENT_PROMPT,
          tools: ["Read", "Write", "Bash", "Glob"],
        },
        "deadline-monitor-agent": {
          description: "Monitors CBDT, CBIC, and MCA websites for deadline extensions and regulation changes.",
          model: "claude-sonnet-4-6",
          prompt: DEADLINE_MONITOR_PROMPT,
          tools: ["Read", "Write", "Bash", "Glob", "Grep", "WebSearch", "WebFetch"],
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

### 5.2 GST Subagent — Detailed Prompt

```typescript
const GST_AGENT_PROMPT = `You are a GST compliance specialist agent for Indian businesses.

YOUR RESPONSIBILITIES:
1. Track all GST return deadlines based on entity's GSTIN(s) and turnover
2. Determine QRMP vs Monthly scheme eligibility
3. Generate GSTR-1 preparation checklist (B2B invoices, B2C summary, CDN, exports)
4. Reconcile sales data with GSTR-2A/2B for ITC claims
5. Prepare GSTR-3B summary (output tax, ITC, net liability, cash/credit ledger)
6. Flag ITC mismatches above threshold (e.g., >₹500 difference)
7. Track GSTR-9/9C annual return preparation
8. Calculate interest on late filing: 18% p.a. on net tax liability

DATA SOURCES:
- Entity profile: ./compliance-data/entity-profile.json
- Sales register: ./compliance-data/gst/sales-register/
- Purchase register: ./compliance-data/gst/purchase-register/
- GSTR-2A/2B downloads: ./compliance-data/gst/gstr-2a/
- Previous returns: ./compliance-data/gst/filed-returns/

OUTPUT:
- Filing checklist: ./compliance-data/gst/checklists/{period}-checklist.md
- Reconciliation report: ./compliance-data/gst/reconciliation/{period}-recon.md
- Return summary: ./compliance-data/gst/summaries/{period}-summary.json

IMPORTANT:
- GSTR-3B due dates differ by state for QRMP scheme (Category A: 22nd, Category B: 24th)
- Check for government extensions before flagging overdue
- Always compute late fee: ₹50/day (₹25 CGST + ₹25 SGST), max ₹10,000
- NIL returns also have deadlines — flag them`;
```

### 5.3 TDS Subagent — Detailed Prompt

```typescript
const TDS_AGENT_PROMPT = `You are a TDS/TCS compliance specialist agent.

YOUR RESPONSIBILITIES:
1. Track monthly TDS payment deadlines (7th of next month; March: 30th April)
2. Verify TDS deduction rates per section (192, 194A, 194C, 194H, 194I, 194J, 194Q, etc.)
3. Prepare quarterly TDS return data (24Q for salary, 26Q for non-salary, 27Q for NRI payments)
4. Generate Form 16/16A after quarterly filing
5. Track TCS collection and quarterly 27EQ return
6. Calculate late filing fees: ₹200/day u/s 234E (max = TDS amount)
7. Calculate interest: 1% per month (late deduction), 1.5% per month (late payment)

SECTION QUICK REFERENCE:
- 192: Salary — Slab rates
- 194A: Interest (non-bank) — 10%
- 194C: Contractor payments — 1% (individual/HUF) / 2% (others)
- 194H: Commission/Brokerage — 5%
- 194I: Rent — 2% (plant/machinery) / 10% (land/building)
- 194J: Professional/Technical fees — 2% (technical) / 10% (professional)
- 194Q: Purchase of goods (>₹50L) — 0.1%
- 194R: Perquisites/Benefits — 10%
- 206C(1H): Sale of goods (>₹50L) — 0.1% TCS

THRESHOLDS TO TRACK:
- Lower deduction certificate (Section 197) — verify validity period
- No deduction if payee provides Form 15G/15H (interest income)
- Higher rate (20%) if PAN not available

DATA SOURCES:
- Payment register: ./compliance-data/tds/payments/
- Vendor master: ./compliance-data/tds/vendors.json
- Employee salary data: ./compliance-data/tds/salary/
- Filed returns: ./compliance-data/tds/filed-returns/`;
```

### 5.4 Entity Profile Configuration

```typescript
// Entity profile at ./compliance-data/entity-profile.json
interface EntityProfile {
  // Basic Information
  entity_name: string;
  entity_type: "private_limited" | "llp" | "partnership" | "proprietorship" | "public_limited" | "opc";
  pan: string;
  cin?: string;              // For companies
  llpin?: string;            // For LLPs
  date_of_incorporation: string;
  financial_year_end: string; // Usually "03-31"

  // GST
  gst: {
    gstins: {
      gstin: string;
      state: string;
      state_code: string;
      registration_type: "regular" | "composition" | "sez" | "casual";
      filing_frequency: "monthly" | "quarterly_qrmp";
      qrmp_category?: "A" | "B";  // A = 22nd, B = 24th for GSTR-3B
    }[];
    aggregate_turnover_prev_fy: number;  // Determines monthly vs quarterly
    is_ecommerce_operator: boolean;
  };

  // TDS/TCS
  tds: {
    tans: {
      tan: string;
      branch?: string;
    }[];
    is_tax_auditable: boolean;  // Section 44AB — turnover > ₹1 Cr (₹10 Cr for digital)
  };

  // PF & ESI
  pf: {
    establishment_code: string;
    total_employees: number;
    is_covered: boolean;       // Mandatory if ≥ 20 employees
  };
  esi: {
    employer_code: string;
    is_covered: boolean;       // Mandatory if ≥ 10 employees, wages ≤ ₹21,000/month
  };

  // ROC/MCA
  roc: {
    roc_jurisdiction: string;
    agm_due_by: string;        // Within 6 months of FY end
    board_meeting_frequency: "quarterly"; // At least once every 120 days
    has_deposits: boolean;     // DPT-3 applicability
    has_msme_vendors: boolean; // MSME-1 applicability
  };

  // State-level Compliances
  states_of_operation: {
    state: string;
    professional_tax: {
      registration_number: string;
      frequency: "monthly" | "half_yearly" | "annual";
      due_date_rule: string;
    };
    shop_establishment: {
      registration_number: string;
      renewal_date: string;
      issuing_authority: string;
    };
    labour_welfare_fund?: {
      frequency: "half_yearly" | "annual";
      contribution_employee: number;
      contribution_employer: number;
    };
  }[];

  // Contacts for Notifications
  contacts: {
    role: "director" | "ca" | "cs" | "cfo" | "accountant" | "admin";
    name: string;
    email: string;
    phone?: string;
    slack_id?: string;
    notify_for: string[];  // ["gst", "tds", "roc", "all"]
  }[];
}
```

### 5.5 Compliance Calendar Engine

```typescript
import dayjs from "dayjs";

interface ComplianceDeadline {
  id: string;
  domain: "gst" | "tds" | "pf" | "esi" | "roc" | "professional_tax" | "income_tax" | "other";
  filing_name: string;
  form_number?: string;
  period: string;             // "2026-03" or "FY2025-26" or "Q4-2025-26"
  due_date: string;           // ISO date
  original_due_date: string;  // Before any extensions
  extended_by?: string;       // Notification number if extended
  entity_gstin_tan?: string;  // Applicable registration
  state?: string;             // For state-level filings
  status: "upcoming" | "due_soon" | "overdue" | "filed" | "not_applicable";
  priority: "critical" | "high" | "medium" | "low";
  filing_acknowledgement?: string;
  challan_number?: string;
  amount_paid?: number;
  late_fee_applicable?: number;
  interest_applicable?: number;
  checklist_path?: string;
  notes?: string;
}

interface ComplianceCalendar {
  entity_pan: string;
  generated_at: string;
  period: string;              // "2026-03" or "FY2025-26"
  deadlines: ComplianceDeadline[];
  summary: {
    total: number;
    upcoming: number;
    due_soon: number;
    overdue: number;
    filed: number;
  };
}

// Priority rules:
// critical = due within 1 day or overdue with penalty
// high = due within 3 days
// medium = due within 7 days
// low = due in 7+ days
```

### 5.6 Scheduled Deadline Monitoring

```typescript
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis({ maxRetriesPerRequest: null });

// Daily job: scan upcoming deadlines and trigger alerts
const complianceQueue = new Queue("compliance-checks", { connection: redis });

// Schedule daily check at 9 AM IST
await complianceQueue.add(
  "daily-deadline-check",
  {},
  {
    repeat: { pattern: "30 3 * * *" }, // 3:30 UTC = 9:00 AM IST
  }
);

// Weekly summary every Monday at 10 AM IST
await complianceQueue.add(
  "weekly-summary",
  {},
  {
    repeat: { pattern: "30 4 * * 1" }, // Monday 4:30 UTC = 10:00 AM IST
  }
);

const worker = new Worker(
  "compliance-checks",
  async (job) => {
    if (job.name === "daily-deadline-check") {
      // Run the compliance agent to check deadlines
      await runComplianceAgent(
        "Check all upcoming deadlines for the next 7 days. " +
        "Send T-7, T-3, and T-1 alerts as appropriate. " +
        "Flag any overdue filings with penalty calculations."
      );
    }

    if (job.name === "weekly-summary") {
      await runComplianceAgent(
        "Generate a weekly compliance summary for all entities. " +
        "Include: completed filings this week, upcoming next week, " +
        "overdue items with accumulated penalties, and any recent " +
        "government notifications about deadline extensions."
      );
    }
  },
  { connection: redis }
);
```

### 5.7 Hooks for Compliance Audit Trail

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";

// Audit hook: log every compliance action
const complianceAuditHook: HookCallback = async (input) => {
  const toolInput = (input as any).tool_input ?? {};
  const entry = {
    timestamp: new Date().toISOString(),
    tool: (input as any).tool_name,
    action: toolInput.file_path || toolInput.command || "unknown",
    agent: (input as any).agent_name || "orchestrator",
  };
  const fs = await import("fs/promises");
  await fs.appendFile(
    "./compliance-data/audit-trail.jsonl",
    JSON.stringify(entry) + "\n"
  );
  return {};
};

// Safety hook: prevent modification of filed returns
const filedReturnProtection: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "";
  if (filePath.includes("/filed-returns/") && ["Write", "Edit"].includes((input as any).tool_name)) {
    return { error: "Cannot modify filed returns. These are immutable audit records." };
  }
  return {};
};

// Sensitive data hook: mask PAN, Aadhaar in logs
const sensitiveDataHook: HookCallback = async (input) => {
  const toolInput = (input as any).tool_input ?? {};
  const blocked = [".env", "credentials", "password", ".ssh", ".aws", "aadhaar"];
  const filePath = toolInput.file_path ?? "";
  if (blocked.some((b) => filePath.toLowerCase().includes(b))) {
    return { error: `Access denied: ${filePath} contains sensitive data` };
  }
  return {};
};
```

---

## 6. MCP Integrations

### 6.1 Tally ERP MCP Server

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Tally integration — most Indian SMEs use Tally
const fetchTallySalesRegister = tool(
  "fetch_tally_sales",
  "Fetch sales register from Tally ERP for a given period (for GSTR-1 preparation)",
  {
    company_name: z.string(),
    from_date: z.string().describe("DD-MM-YYYY"),
    to_date: z.string().describe("DD-MM-YYYY"),
    report_type: z.enum(["sales_register", "purchase_register", "ledger", "day_book"]),
  },
  async (args) => {
    // Tally exposes data via XML API on port 9000 (Tally Gateway)
    const xmlRequest = buildTallyXMLRequest(args);
    const response = await fetch("http://localhost:9000", {
      method: "POST",
      body: xmlRequest,
      headers: { "Content-Type": "application/xml" },
    });
    const data = await response.text();
    const parsed = parseTallyXML(data);
    return { content: [{ type: "text", text: JSON.stringify(parsed) }] };
  }
);

const fetchTallyOutstandings = tool(
  "fetch_tally_outstandings",
  "Fetch outstanding receivables/payables from Tally (for MSME-1 compliance)",
  {
    company_name: z.string(),
    as_on_date: z.string(),
    type: z.enum(["receivable", "payable"]),
    msme_only: z.boolean().describe("Filter for MSME registered vendors only"),
  },
  async (args) => {
    const data = await fetchFromTally(args);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

const tallyServer = createSdkMcpServer({
  name: "tally-erp",
  tools: [fetchTallySalesRegister, fetchTallyOutstandings],
});
```

### 6.2 GST Portal API MCP Server

```typescript
const fetchGSTR2A = tool(
  "fetch_gstr_2a",
  "Download GSTR-2A/2B data from GST portal API for ITC reconciliation",
  {
    gstin: z.string().describe("15-digit GSTIN"),
    return_period: z.string().describe("MMYYYY format"),
    return_type: z.enum(["GSTR2A", "GSTR2B"]),
  },
  async (args) => {
    // Uses GST Suvidha Provider (GSP) API
    const token = await getGSPAuthToken();
    const response = await fetch(
      `https://gsp-api.example.com/gstr/${args.return_type.toLowerCase()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gstin: args.gstin,
          ret_period: args.return_period,
        }),
      }
    );
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const validateGSTIN = tool(
  "validate_gstin",
  "Validate a GSTIN and fetch taxpayer details from GST portal",
  {
    gstin: z.string().describe("15-digit GSTIN to validate"),
  },
  async (args) => {
    const response = await fetch(
      `https://gsp-api.example.com/taxpayer/${args.gstin}`
    );
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const gstServer = createSdkMcpServer({
  name: "gst-portal",
  tools: [fetchGSTR2A, validateGSTIN],
});
```

### 6.3 Notification MCP (Slack + WhatsApp)

```typescript
const sendSlackAlert = tool(
  "send_compliance_alert",
  "Send compliance deadline alert to Slack channel",
  {
    channel: z.string(),
    deadline: z.string().describe("Filing name and due date"),
    priority: z.enum(["critical", "high", "medium"]),
    penalty_info: z.string().optional(),
    checklist_link: z.string().optional(),
  },
  async (args) => {
    const emoji = { critical: "🔴", high: "🟡", medium: "🔵" };
    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji[args.priority]} *Compliance Alert*\n${args.deadline}`,
          },
        },
        ...(args.penalty_info ? [{
          type: "section",
          text: { type: "mrkdwn", text: `⚠️ *Penalty if missed:* ${args.penalty_info}` },
        }] : []),
      ],
    };
    await postToSlack(args.channel, message);
    return { content: [{ type: "text", text: "Alert sent" }] };
  }
);

// WhatsApp via Twilio or WhatsApp Business API for CA/Director alerts
const sendWhatsAppAlert = tool(
  "send_whatsapp_alert",
  "Send urgent compliance alert via WhatsApp (for critical/overdue items)",
  {
    phone: z.string().describe("Phone number with country code"),
    message: z.string(),
  },
  async (args) => {
    await sendViaWhatsApp(args.phone, args.message);
    return { content: [{ type: "text", text: "WhatsApp alert sent" }] };
  }
);

const notificationServer = createSdkMcpServer({
  name: "notifications",
  tools: [sendSlackAlert, sendWhatsAppAlert],
});
```

### 6.4 Potential MCP Integrations

| MCP Server | Use Case |
|------------|----------|
| **Tally ERP** | Pull sales/purchase registers, outstanding reports |
| **Zoho Books** | Alternative accounting software integration |
| **GST Suvidha Provider** | GSTR-2A/2B download, return filing status |
| **TRACES** | TDS return filing status, Form 26AS download |
| **MCA Portal** | ROC filing status, DIN/DPIN verification |
| **EPFO Portal** | PF ECR filing, UAN management |
| **Slack** | Team alerts and weekly summaries |
| **WhatsApp Business** | Urgent alerts to directors/CAs |
| **Google Calendar** | Sync deadlines to team calendars |
| **PostgreSQL** | Multi-entity compliance data storage |

---

## 7. Example User Interactions

### Setup Entity Profile

```
User: "Set up compliance tracking for ABC Pvt Ltd. We have GSTIN 27AABCA1234F1ZM
       in Maharashtra and GSTIN 29AABCA1234F1ZP in Karnataka. TAN is MUMA12345B.
       We have 35 employees. Revenue is about ₹8 Cr."

Agent flow:
1. Creates entity profile with provided registrations
2. Determines: monthly GST filer (>₹5 Cr), PF applicable (>20 employees)
3. Sets up Maharashtra and Karnataka Professional Tax tracking
4. Generates compliance calendar for current month
5. Returns: "Set up complete. You have 12 upcoming deadlines this month.
   Next due: GSTR-1 for March 2026 → April 11, 2026 (18 days away)"
```

### Monthly Compliance Dashboard

```
User: "What's due this week?"

Agent flow:
1. Reads compliance calendar
2. Filters deadlines for next 7 days
3. Returns:
   "📋 Compliance Due This Week (March 24-31, 2026):

   🔴 CRITICAL:
   - TDS Payment (March) → Due: March 30 | Est. ₹2.4L
   - Professional Tax Maharashtra → Due: March 31

   🟡 HIGH:
   - PF ECR Filing (March) → Due: April 1 (prepare now)

   ✅ COMPLETED THIS MONTH:
   - GSTR-1 (Feb) → Filed March 10 | ARN: AA270326123456R
   - GSTR-3B (Feb) → Filed March 18 | Paid ₹1.2L via challan"
```

### GST Reconciliation

```
User: "Reconcile our February purchase register with GSTR-2B"

Agent flow:
1. Dispatches gst-agent subagent
2. Reads purchase register from ./compliance-data/gst/purchase-register/2026-02.json
3. Reads GSTR-2B from ./compliance-data/gst/gstr-2b/022026.json
4. Generates reconciliation report:
   "📊 GSTR-2B Reconciliation — February 2026

   Total invoices in books: 142 | Total in GSTR-2B: 138
   Matched: 135 | Mismatched: 3 | In books only: 4 | In 2B only: 3

   ⚠️ ITC at risk: ₹42,300 (4 invoices not in GSTR-2B)
   - Vendor: XYZ Traders | GSTIN: 27AABCX1234F1ZM | ₹18,000
   - Vendor: PQR Services | GSTIN: 29AABCP5678F1ZP | ₹24,300

   Recommended action: Contact vendors to upload their GSTR-1 before April 11"
```

### Penalty Calculator

```
User: "We missed filing GSTR-3B for January. What's the damage?"

Agent flow:
1. Calculates days overdue (Jan GSTR-3B due Feb 20 → today March 24 = 32 days)
2. Computes:
   "⚠️ GSTR-3B January 2026 — Overdue by 32 days

   Late Fee: ₹50/day × 32 = ₹1,600 (₹800 CGST + ₹800 SGST)
   Interest: 18% p.a. on net tax liability
   - If net liability is ₹1,00,000 → Interest = ₹1,577

   Total estimated penalty: ₹3,177

   🔴 ACTION REQUIRED: File immediately. Late fee increases daily.
   Note: NIL return late fee is capped at ₹500 (₹250 CGST + ₹250 SGST)"
```

### Government Extension Check

```
User: "Has CBDT extended the TDS return deadline for Q3?"

Agent flow:
1. Dispatches deadline-monitor-agent
2. Searches CBDT circulars and press releases
3. Checks incometaxindia.gov.in for notifications
4. Returns: "No extension found for Q3 FY2025-26 TDS returns.
   - 24Q/26Q due date: January 31, 2026 (already passed)
   - 27Q due date: January 31, 2026 (already passed)
   Last CBDT extension was Circular No. XX dated [date] for [specific form].
   Source: [notification URL]"
```

---

## 8. Data Model

### Directory Structure

```
./compliance-data/
  entity-profile.json               # Entity registration details
  calendar/
    2026-03-calendar.json            # Monthly compliance calendar
    2025-26-annual-calendar.json     # FY annual calendar
  gst/
    sales-register/                  # Monthly sales data
    purchase-register/               # Monthly purchase data
    gstr-2a/                         # Downloaded GSTR-2A/2B
    reconciliation/                  # ITC reconciliation reports
    checklists/                      # Filing preparation checklists
    filed-returns/                   # Acknowledgements & ARNs (immutable)
    summaries/                       # Return summaries
  tds/
    payments/                        # Monthly TDS payment records
    vendors.json                     # Vendor master with PAN, section
    salary/                          # Employee salary data for 24Q
    filed-returns/                   # Quarterly return acknowledgements
    certificates/                    # Form 16/16A records
  pf-esi/
    ecr/                             # Monthly ECR data
    payments/                        # Challan records
    returns/                         # Filed return records
  roc/
    filings/                         # Annual return records
    board-meetings/                  # Board meeting tracker
    agm/                             # AGM records
  professional-tax/
    maharashtra/                     # State-wise PT records
    karnataka/
  notifications/
    government-circulars/            # Tracked deadline changes
    alerts-sent/                     # Log of all alerts dispatched
  audit-trail.jsonl                  # Immutable audit log
```

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Sensitive financial data (PAN, TAN, GSTIN)** | All data stays local; PreToolUse hooks block access to .env, credentials, Aadhaar files |
| **Filed return immutability** | Write hooks prevent modification of files in /filed-returns/ directories |
| **Incorrect deadline calculation** | Agent cross-references government portal before flagging; system prompt mandates verification |
| **Auto-filing risk** | Agent NEVER auto-files — always requires explicit human confirmation |
| **Stale deadline info** | Deadline monitor agent runs weekly to check for government notification changes |
| **Multi-entity data isolation** | Each entity gets its own directory; hooks enforce access boundaries |
| **Audit compliance** | PostToolUse hooks log every read/write to audit-trail.jsonl |
| **Data backup** | Agent creates JSON backups before any calendar regeneration |

---

## 10. Development Roadmap

### Phase 1 — Core Calendar (Week 1-2)
- [ ] Entity profile setup and validation
- [ ] Compliance calendar generator for GST + TDS
- [ ] Basic deadline alerting (T-7, T-3, T-1)
- [ ] Slack notification integration
- [ ] Filing status tracking (upcoming/filed/overdue)

### Phase 2 — GST Deep Dive (Week 3-4)
- [ ] Tally ERP MCP integration for sales/purchase data
- [ ] GSTR-1 preparation checklist with data validation
- [ ] GSTR-2A/2B reconciliation engine
- [ ] GSTR-3B summary pre-computation
- [ ] ITC mismatch detection and vendor follow-up alerts

### Phase 3 — TDS + PF/ESI (Week 5-6)
- [ ] TDS payment tracker with section-wise breakdown
- [ ] Quarterly TDS return data preparation (24Q/26Q/27Q)
- [ ] PF ECR data generation from salary records
- [ ] ESI contribution calculator
- [ ] Form 16/16A generation tracking

### Phase 4 — ROC + State Compliances (Week 7-8)
- [ ] ROC filing calendar (AOC-4, MGT-7, DIR-3 KYC, DPT-3)
- [ ] AGM and Board meeting tracker
- [ ] State-wise Professional Tax across all registered states
- [ ] Shop & Establishment renewal tracking
- [ ] Labour Welfare Fund tracking

### Phase 5 — Intelligence Layer (Week 9-10)
- [ ] Government notification monitoring (CBDT/CBIC/MCA circulars)
- [ ] Automatic deadline extension detection and calendar updates
- [ ] Penalty calculator for overdue filings
- [ ] WhatsApp alerts for critical deadlines
- [ ] Multi-entity support with data isolation
- [ ] Weekly/monthly compliance summary reports

### Phase 6 — Integrations & Dashboard (Week 11-12)
- [ ] Zoho Books / QuickBooks MCP integration
- [ ] GSP API integration for return filing status
- [ ] TRACES integration for Form 26AS
- [ ] React dashboard with calendar view
- [ ] Google Calendar sync
- [ ] CA/CS collaboration features (assign filings, review workflow)

---

## 11. Cost Estimates

| Operation | Model | Est. Tokens | Est. Cost |
|-----------|-------|-------------|-----------|
| Daily deadline check | Haiku 4.5 | ~3K in / 1K out | ~₹0.85 |
| Weekly compliance summary | Sonnet 4.6 | ~15K in / 5K out | ~₹7 |
| GST reconciliation (150 invoices) | Sonnet 4.6 | ~30K in / 10K out | ~₹13 |
| GSTR-1 preparation checklist | Sonnet 4.6 | ~20K in / 8K out | ~₹9 |
| Penalty calculation | Haiku 4.5 | ~2K in / 1K out | ~₹0.85 |
| Government notification scan | Sonnet 4.6 | ~10K in / 3K out | ~₹4 |
| Full monthly compliance cycle | Mixed | ~150K total | ~₹125 |

**Optimization tips:**
- Use Haiku 4.5 for simple lookups, notifications, and alerts
- Use Sonnet 4.6 for return preparation, reconciliation, and validation
- Reserve Opus 4.6 for orchestration and complex multi-domain analysis
- Cache entity profile and calendar data in system prompts
- Batch process deadline checks instead of per-filing scans

---

## 12. Getting Started — Quick Setup

```bash
# 1. Create project
mkdir statutory-compliance-agent && cd statutory-compliance-agent
npm init -y
npm install @anthropic-ai/claude-agent-sdk pg bullmq ioredis xlsx dayjs

# 2. Set API key
export ANTHROPIC_API_KEY=your-key-here

# 3. Create directory structure
mkdir -p compliance-data/{calendar,gst/{sales-register,purchase-register,gstr-2a,reconciliation,checklists,filed-returns,summaries},tds/{payments,salary,filed-returns,certificates},pf-esi/{ecr,payments,returns},roc/{filings,board-meetings,agm},professional-tax,notifications/{government-circulars,alerts-sent}}

# 4. Set up entity profile
# Edit compliance-data/entity-profile.json with your company details

# 5. Run the agent
npx tsx agent.ts "Set up compliance tracking for our entity and generate this month's calendar"

# 6. Start the scheduler (for daily/weekly checks)
npx tsx scheduler.ts
```

---

## 13. Key Indian Regulatory References

| Authority | Portal | Relevant For |
|-----------|--------|-------------|
| **CBIC** (Central Board of Indirect Taxes) | cbic.gov.in | GST rules, notifications, rate changes |
| **GST Portal** | gst.gov.in | Return filing, GSTIN verification |
| **CBDT** (Central Board of Direct Taxes) | incometaxindia.gov.in | TDS/TCS, Income Tax, Form 26AS |
| **TRACES** | tdscpc.gov.in | TDS return status, certificates |
| **MCA** (Ministry of Corporate Affairs) | mca.gov.in | ROC filings, company master |
| **EPFO** | epfindia.gov.in | PF filings, ECR, UAN |
| **ESIC** | esic.gov.in | ESI returns, contributions |
| **State GST Portals** | Various | State-specific PT, LWF |

---

## 14. References

- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Agent SDK Demo Agents](https://github.com/anthropics/claude-agent-sdk-demos)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)
- [GST Return Filing Guide](https://tutorial.gst.gov.in/)
- [TRACES — TDS Guide](https://contents.tdscpc.gov.in/)
- [MCA Filing Requirements](https://www.mca.gov.in/MinistryV2/compliancerequirement.html)
- [EPFO Employer Guide](https://www.epfindia.gov.in/site_en/For_Employers.php)
