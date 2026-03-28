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

**Copilot commands during session:** Type `/help` for the full list, or use any of the 11 slash commands (`/summary`, `/risks`, `/playbook`, `/redline`, `/stamp-duty`, etc.). Legacy commands (`playbook`, `summary`, `redline`) still work.

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
├── agent.ts                    # Orchestrator + subagent definitions
├── copilot.ts                  # Interactive copilot with slash commands
├── cli.ts                      # CLI for one-shot mode
├── copilot-cli.ts              # CLI for copilot mode
├── index.ts                    # Library exports
├── mcp-servers/
│   ├── document-mcp.ts         # PDF text extraction (pdf-parse v2)
│   ├── legal-kb-mcp.ts         # Indian law knowledge base (7 tools incl. critic)
│   └── contract-mcp.ts         # Contract repository (version tracking, analysis storage)
├── knowledge-base/
│   ├── clause-patterns.ts      # 10 Indian law risk patterns
│   ├── stamp-duty.ts           # State-wise stamp duty rates (4 states)
│   ├── regulatory-compliance.ts # 7 Indian regulations (DPDPA, FEMA, Labor Codes, etc.)
│   ├── negative-constraints.ts # 10 analysis limitations with disclaimer
│   └── critic.ts               # Reflection/critic agent (report review)
├── tests/                      # 36 tests (all passing)
└── types/
    └── index.ts                # Shared TypeScript types
.claude/skills/
├── indian-contract-law/        # Section 27, 57, 73-74, DPDPA rules
├── data-protection/            # DPDPA 2023 + IT Act compliance
├── stamp-duty-calculator/      # Multi-state stamp duty
├── negotiation-playbook/       # Playbook strategy and tactics
└── analysis-limitations/       # MANDATORY safety disclaimer
```

### MCP Servers (3 servers, 14 tools)

| Server | Tools | Purpose |
|--------|-------|---------|
| `document-mcp` | 2 tools — `parse_document`, `extract_metadata` | PDF/text extraction via pdf-parse v2 |
| `legal-kb-mcp` | 7 tools — `search_clause_patterns`, `get_required_clauses`, `get_stamp_duty`, `check_enforceability`, `get_applicable_regulations`, `get_contract_limitations`, `review_report` | Indian law knowledge base + regulatory compliance + critic review |
| `contract-mcp` | 5 tools — `create_contract`, `add_version`, `store_analysis`, `get_previous_analysis`, `get_contract_timeline` | Contract repository and version tracking |

### Slash Commands (Interactive Copilot)

| Command | Description |
|---------|-------------|
| `/summary` | Concise findings with risk score (runs critic review) |
| `/risks` | All critical and high-risk clauses with law references |
| `/playbook` | Full negotiation playbook, priority-ordered |
| `/redline` | Original vs suggested text, side by side |
| `/stamp-duty` | Calculate stamp duty for this contract |
| `/checklist` | Required clauses for this contract type |
| `/enforceability <type>` | Check if a clause type is enforceable |
| `/compare` | Compare with previous version |
| `/dossier` | Final analysis report for legal team |
| `/next-steps` | Top 5 prioritized actions |

### Subagents (Parallel Analysis)

| Agent | Model | Purpose |
|-------|-------|---------|
| `clause-analyzer` | Sonnet | Individual clause scanning against Indian law |
| `risk-assessor` | Sonnet | Aggregate risk scoring and grading |
| `negotiation-advisor` | Opus | Playbook generation with talking points |
| `critic-reviewer` | Opus | Report quality review (reflection pattern) |

### Agent Skills (Auto-Invoked)

| Skill | Trigger |
|-------|---------|
| `indian-contract-law` | Questions about enforceability, Section 27, penalties, IP |
| `data-protection` | Contract involves personal data, DPDPA compliance |
| `stamp-duty-calculator` | Cost questions, stamping, registration |
| `negotiation-playbook` | "How should I negotiate?", pushback strategy |
| `analysis-limitations` | Before any final report (mandatory safety disclaimer) |

### Knowledge Base

The knowledge base drives the agent's Indian law intelligence. Currently hardcoded in TypeScript for the prototype, designed to be extended to a database + vector store in production.

**Current (Prototype) — Hardcoded in TypeScript:**

| Data | Count | Source |
|------|-------|--------|
| Clause risk patterns | 10 patterns across 7 categories | Indian Contract Act, Copyright Act, DPDPA |
| Stamp duty rates | 4 states × 5 document types | State Stamp Acts |
| Enforceability rules | 5 clause types | Indian case law + statutes |
| Required clauses per type | 5 contract types (6-10 clauses each) | Legal best practices |
| Regulatory requirements | 7 regulations (DPDPA, FEMA, Labor Codes, etc.) | Central Acts |
| Analysis limitations | 10 documented blind spots | Verification scope analysis |

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

### Extending the Knowledge Base

The knowledge base is designed to scale from hardcoded TypeScript to a full database + vector store. Here's the migration path:

**Phase 1 (Current): Static TypeScript files**
- Quick to iterate, easy to read and debug
- Limited to what's hardcoded — 10 patterns, 4 states
- Good for prototype and validation

**Phase 2: JSON/YAML config files**
- Move clause patterns, stamp duty, and enforceability rules to JSON files
- Editable without code changes — legal team can update patterns directly
- Load at startup: `const patterns = JSON.parse(readFileSync("./data/clause-patterns.json"))`

**Phase 3: PostgreSQL + pgvector (Production)**
- Full semantic search — agent finds relevant patterns even when clause wording is different
- Schema defined in the [agent spec](../../legal-contract-intelligence-agent-spec.md#4-legal-knowledge-base-postgresql--pgvector):

```
┌─────────────────────────────────────────────────┐
│  Layer 1: legal_statutes                        │
│  ~500-800 sections across 20 Indian acts        │
│  + embeddings for vector search                 │
├─────────────────────────────────────────────────┤
│  Layer 2: clause_patterns                       │
│  ~200-400 risk patterns with embeddings         │
│  + suggested alternatives + negotiation points  │
├─────────────────────────────────────────────────┤
│  Layer 3: stamp_duty_matrix                     │
│  30 states × 20 document types = ~600 entries   │
├─────────────────────────────────────────────────┤
│  Layer 4: legal_precedents                      │
│  ~100-200 landmark SC/HC judgments              │
│  + embeddings for semantic case search          │
└─────────────────────────────────────────────────┘
```

To migrate `legal-kb-mcp` to PostgreSQL + pgvector:

1. Replace the hardcoded keyword matching in `search_clause_patterns` with:
   ```typescript
   // Current: keyword matching
   const matches = CLAUSE_PATTERNS.filter(p => keywords.some(kw => text.includes(kw)));

   // Production: vector similarity search
   const embedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: clauseText });
   const matches = await db.query(`
     SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM clause_patterns
     WHERE similarity > 0.7
     ORDER BY similarity DESC LIMIT 5
   `, [embedding]);
   ```

2. Replace the hardcoded stamp duty arrays with database queries
3. Add the `legal_statutes` and `legal_precedents` tables for full Indian law coverage
4. The MCP tool interfaces stay the same — only the handler implementations change

**Data sources for seeding the production KB:**
- Indian statutes: [India Code](https://indiacode.nic.in/) (all central acts)
- Precedents: [Indian Kanoon](https://indiankanoon.org/) (landmark judgments)
- Stamp duty: State revenue department websites (updated annually)
- Clause patterns: Curated by a senior Indian corporate lawyer

## Example Output

Running against a 24-page MSA (real contract test):

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

Each analysis costs approximately ₹50-150 depending on contract length (10-50 pages). A 24-page MSA test (12 tool calls) cost ~$0.08.

## Spec

This implementation follows the [Legal/Contract Intelligence Agent spec](../../legal-contract-intelligence-agent-spec.md). The spec covers the full production architecture including PostgreSQL + pgvector knowledge base, version comparison, and multi-tenant support.

## Implementation Status

| Part | Status | What's Included |
|------|--------|----------------|
| Part 1 | ✅ Complete | Project scaffold, PDF parsing, clause pattern matching, stamp duty, copilot |
| Part 2 | ✅ Complete | Regulatory compliance (DPDPA, FEMA, Labor Codes), negative constraints, critic agent |
| Part 3 | ✅ Complete | Slash commands, subagent definitions, agent skills, proper test suite |
| Part 4 | Planned | Version comparison (diff two contract versions), PostgreSQL + pgvector KB |

## Limitations (Prototype)

- **Knowledge base is hardcoded** — 10 clause patterns, 4 states for stamp duty. Production would use pgvector with 200+ patterns and all 30 states.
- **No version comparison** — contract repository is in-memory. Upload v2 in a new session and it won't remember v1 analysis.
- **English only** — no regional language OCR (Sarvam AI integration planned for production).
- **No persistent storage** — analysis results are in-memory. Session context persists via SDK sessions but analysis data doesn't survive process restart.
