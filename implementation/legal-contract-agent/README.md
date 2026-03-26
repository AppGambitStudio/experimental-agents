# Legal Contract Intelligence Agent (India)

AI-powered contract review agent that reads Indian contracts holistically, flags risks against Indian law, and helps you negotiate better terms — built on the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview).

## What It Does

Upload a contract PDF and the agent:

1. **Reads the entire document** — understands structure, cross-references, defined terms, and conditions within conditions
2. **Flags risks against Indian law** — non-compete enforceability (Section 27), stamp duty compliance, DPDPA 2023, moral rights, liability caps
3. **Explains in plain language** — designed for business teams, not lawyers
4. **Calculates stamp duty** — state-wise rates for Gujarat, Maharashtra, Delhi, Karnataka
5. **Identifies missing clauses** — what SHOULD be in the contract but isn't
6. **Generates negotiation playbooks** — priority-ordered talking points per flagged clause

## Two Modes

### One-Shot Analysis (`npm run analyze`)

Generates a complete risk report in one pass. Best for getting a comprehensive view quickly.

```bash
npm run analyze -- \
  --file ./contracts/acme-msa.pdf \
  --counterparty "Acme Corp" \
  --type msa \
  --role developer \
  --state Gujarat \
  --value 6000000
```

### Interactive Copilot (`npm run copilot`)

Conversational contract review — the agent asks questions, shows findings progressively, and responds to follow-ups. Best for deep analysis with back-and-forth.

```bash
npm run copilot -- \
  --file ./contracts/acme-msa.pdf \
  --counterparty "Acme Corp" \
  --type msa \
  --role developer \
  --state Gujarat
```

**Copilot commands during session:**

| Command | What it does |
|---------|-------------|
| `playbook` | Generate priority-ordered negotiation playbook |
| `summary` | Concise summary of all findings so far |
| `redline` | Suggested alternative language for flagged clauses |
| `quit` | End session (prints session ID for resumption) |

## Setup

### Prerequisites

- Node.js 20+ (use `nvm use 20` or later)
- An [Anthropic API key](https://console.anthropic.com/)

### Install

```bash
cd implementation/legal-contract-agent
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Verify

```bash
npm run typecheck
```

## CLI Options

| Option | Required | Description |
|--------|----------|-------------|
| `--file` | Yes | Path to the contract PDF or text file |
| `--counterparty` | Yes | Name of the other party |
| `--type` | Yes | Contract type: `msa`, `nda`, `employment`, `freelancer`, `lease`, `sow`, `service_agreement` |
| `--role` | Yes | Your role: `vendor`, `client`, `employer`, `tenant`, `developer` |
| `--state` | Yes | Indian state for stamp duty: `Gujarat`, `Maharashtra`, `Delhi`, `Karnataka` |
| `--value` | No | Contract value in INR (for stamp duty calculation) |

## Architecture

```
src/
├── agent.ts                    # One-shot analysis orchestrator
├── copilot.ts                  # Interactive copilot with session persistence
├── cli.ts                      # CLI for one-shot mode
├── copilot-cli.ts              # CLI for copilot mode
├── index.ts                    # Library exports
├── mcp-servers/
│   ├── document-mcp.ts         # PDF text extraction (pdf-parse v2)
│   ├── legal-kb-mcp.ts         # Indian law knowledge base (clause patterns, stamp duty, enforceability)
│   └── contract-mcp.ts         # Contract repository (version tracking, analysis storage)
├── knowledge-base/
│   ├── clause-patterns.ts      # 10 Indian law risk patterns
│   └── stamp-duty.ts           # State-wise stamp duty rates
└── types/
    └── index.ts                # Shared TypeScript types
```

### MCP Servers

The agent uses 3 in-process MCP servers built with `createSdkMcpServer()`:

| Server | Tools | Purpose |
|--------|-------|---------|
| `document-mcp` | `parse_document`, `extract_metadata` | PDF/text extraction via pdf-parse v2 |
| `legal-kb-mcp` | `search_clause_patterns`, `get_required_clauses`, `get_stamp_duty`, `check_enforceability` | Indian law knowledge base |
| `contract-mcp` | `create_contract`, `add_version`, `store_analysis`, `get_previous_analysis`, `get_contract_timeline` | Contract repository and version tracking |

### Knowledge Base (Prototype)

For this prototype, the knowledge base is hardcoded in TypeScript. In production, this would move to PostgreSQL + pgvector for semantic search.

**Clause patterns (10):**

| Pattern | Risk Level | Indian Law |
|---------|-----------|-----------|
| Post-termination non-compete | Critical | Section 27, Indian Contract Act — VOID |
| Unlimited indemnity | Critical | Sections 73-74, Indian Contract Act |
| No data protection clause | Critical | DPDPA 2023 |
| Foreign governing law | High | CPC Section 44A |
| One-sided termination | High | Indian Contract Act, Section 14 |
| Overly broad IP assignment | High | Indian Copyright Act, Section 17 |
| Auto-renewal without notice | Medium | Indian Contract Act, Section 23 |
| Moral rights waiver | Medium | Indian Copyright Act, Section 57 — inalienable |
| No liability cap | High | Indian Contract Act, Sections 73-74 |
| Excessively long term | Medium | Indian Contract Act, Section 23 |

**Stamp duty rates:** Gujarat, Maharashtra, Delhi, Karnataka across multiple document types.

**Enforceability rules:** Non-compete, moral rights waiver, penalty clauses, non-solicitation, arbitration.

## Example Output

Running against a 24-page MSA (Aumni Health - AppGambit):

```
Risk Score: 73/100 (Grade D — Major Risks)

Critical (2):
  - Pennsylvania governing law + no arbitration
  - Unlimited indemnification with no liability cap

High (5):
  - Moral rights waiver (void under Indian law)
  - 24-month non-compete (void under Section 27)
  - US work-for-hire doctrine (inapplicable to Indian contractor)
  - One-sided assignment rights
  - Overly broad Background Technology license

Medium (5):
  - Irrevocable attorney-in-fact
  - USD-only payment, no late payment interest
  - No DPDPA 2023 clause
  - Customer convenience termination, no WIP payment
  - Force majeure 30-day trigger (too short)

Stamp Duty: ₹25,000 (Gujarat, 0.5% capped)

Missing Clauses: 8 identified (arbitration, liability cap, DPDPA, etc.)
```

## Programmatic Usage

```typescript
import { analyzeContract } from "./src/index.js";

const result = await analyzeContract({
  filePath: "/path/to/contract.pdf",
  counterparty: "Acme Corp",
  contractType: "msa",
  ourRole: "developer",
  state: "Gujarat",
  contractValue: 6000000,
  onProgress: (event) => console.log(`[${event.type}] ${event.message}`),
});

console.log(result);
```

## Cost

Each analysis costs approximately ₹50-150 depending on contract length (10-50 pages). The Aumni MSA analysis (24 pages, 12 tool calls) cost ~$0.08.

## Spec

This implementation follows the [Legal/Contract Intelligence Agent spec](../../legal-contract-intelligence-agent-spec.md). The spec covers the full production architecture including PostgreSQL + pgvector knowledge base, version comparison, and multi-tenant support.

## Limitations (Prototype)

- **Knowledge base is hardcoded** — 10 clause patterns, 4 states for stamp duty. Production would use pgvector with 200+ patterns and all 30 states.
- **No version comparison** — contract repository is in-memory. Upload v2 in a new session and it won't remember v1 analysis.
- **English only** — no regional language OCR (Sarvam AI integration planned for production).
- **No persistent storage** — analysis results are in-memory. Session context persists via SDK sessions but analysis data doesn't survive process restart.
