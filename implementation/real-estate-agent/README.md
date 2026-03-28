# Real Estate Transaction Agent (Gujarat)

AI-powered property purchase companion for Gujarat — verifies RERA registration, searches court disputes, checks land records, calculates stamp duty, and generates due diligence reports with evidence. Built on the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) with [dev-browser](https://github.com/SawyerHood/dev-browser) for sandboxed government portal automation.

## What It Does

Give it a RERA project ID and the agent:

1. **Navigates Gujarat RERA portal** — extracts project details, builder info, construction progress, compliance status, unit inventory
2. **Searches eCourts** — looks for litigation involving the builder/seller (falls back to Claude Browser MCP if CAPTCHA detected)
3. **Checks AnyRoR land records** — verifies ownership, survey details, mutation history
4. **Verifies builder's GST registration** — confirms active status via GSTN
5. **Calculates stamp duty** — Gujarat rates (3.5% residential, 4.9% commercial) with female buyer discount
6. **Looks up jantri rates** — zone-wise ready reckoner rates for Surat
7. **Checks 20 red flag patterns** — RERA issues, land disputes, financial red flags, builder track record
8. **Generates document checklist** — what you need before signing (varies by property type)
9. **Produces verification log** — timestamped, append-only audit trail of every check performed
10. **Creates dossier summary** — cross-portal verification matrix with overall risk assessment

## Two Modes

### One-Shot Analysis (`npm run analyze`)

Full due diligence report in one pass.

```bash
npm run analyze -- \
  --rera-id "PR/GJ/SURAT/SURAT CITY/Surat Municipal Corporation/CAA10499/A1C/311224/311232" \
  --address "Vesu, Surat" \
  --builder "AVADH KONTINA" \
  --type commercial_office \
  --budget 5000000 \
  --state Gujarat
```

### Interactive Copilot (`npm run copilot`)

Conversational property verification — agent asks questions, shows findings progressively, responds to follow-ups.

```bash
npm run copilot -- \
  --rera-id "PR/GJ/SURAT/..." \
  --address "Vesu, Surat" \
  --type residential_flat \
  --budget 7500000 \
  --state Gujarat
```

**Copilot commands during session:** Type `/help` for the full list, or use any of the 11 slash commands (`/summary`, `/risks`, `/cost`, `/dossier`, `/verify <portal>`, etc.). Legacy commands (`summary`, `red-flags`, `documents`) still work.

## Setup

### Prerequisites

- Node.js 20+ (`nvm use 20`)
- [dev-browser](https://github.com/SawyerHood/dev-browser) installed globally
- [Anthropic API key](https://console.anthropic.com/)

### Install

```bash
cd implementation/real-estate-agent

# Install dev-browser (one-time)
npm install -g dev-browser
dev-browser install

# Install project dependencies
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
| `--address` | Yes | Property address |
| `--type` | Yes | `residential_flat`, `commercial_office`, `plot`, `row_house`, `villa` |
| `--budget` | Yes | Expected price in INR |
| `--state` | Yes | Indian state (currently: `Gujarat`) |
| `--rera-id` | No | RERA registration ID (strongly recommended) |
| `--builder` | No | Builder/developer name (for eCourts search) |

## Architecture

```
src/
├── agent.ts                      # Orchestrator + subagent definitions
├── copilot.ts                    # Interactive copilot with slash commands
├── dossier.ts                    # Dossier generation + cross-portal verification
├── cli.ts + copilot-cli.ts       # CLI entry points
├── index.ts                      # Library exports
├── mcp-servers/
│   ├── browser-mcp.ts            # 7 tools wrapping 6 portal modules
│   ├── property-kb-mcp.ts        # Gujarat knowledge base (10 tools incl. critic)
│   └── tracker-mcp.ts            # Purchase tracking + verification log (7 tools)
├── portals/
│   ├── base-portal.ts            # dev-browser helpers (sandboxed execution)
│   ├── gujrera.ts                # Gujarat RERA portal ✅ (working)
│   ├── ecourts.ts                # eCourts dispute search (CAPTCHA fallback)
│   ├── anyror.ts                 # AnyRoR land records (portal flaky)
│   ├── garvi.ts                  # GARVI registration + jantri
│   ├── smc-tax.ts                # Surat Municipal Corporation property tax
│   └── gstn.ts                   # GSTN builder GST verification ✅ (working)
├── knowledge-base/
│   ├── jantri-rates.ts           # 7 Surat zones with rates
│   ├── stamp-duty.ts             # Gujarat rates + calculator
│   ├── total-cost.ts             # Full ownership cost with hidden charges
│   ├── registration-guide.ts     # 10-step registration process
│   ├── post-purchase.ts          # 12 post-purchase tasks
│   ├── negative-constraints.ts   # 14 verification blind spots
│   ├── critic.ts                 # Reflection/critic agent (report review)
│   ├── red-flags.ts              # 20 patterns across 5 categories
│   └── required-documents.ts     # Checklists for 4 property types
├── tests/                        # 139 tests (all passing)
└── types/index.ts
.claude/skills/
├── gujarat-property-law/         # RERA, NA conversion, title rules
├── stamp-duty-calculator/        # Total cost with hidden charges
├── verification-limitations/     # MANDATORY safety disclaimer
├── registration-guide/           # Registration walkthrough
└── post-purchase-checklist/      # Post-registration formalities
```

### MCP Servers (3 servers, 24 tools)

| Server | Tools | Purpose |
|--------|-------|---------|
| `browser-mcp` | 7 tools — `search_rera_project`, `get_rera_project_details`, `take_portal_screenshot`, `search_ecourts`, `search_anyror_land_record`, `search_anyror_by_owner`, `search_garvi_document`, `lookup_garvi_jantri`, `check_smc_property_tax`, `verify_gstin` | Government portal automation via dev-browser |
| `property-kb-mcp` | 10 tools — `get_jantri_rate`, `calculate_stamp_duty`, `check_red_flags`, `get_required_documents`, `calculate_total_cost`, `get_registration_guide`, `get_post_purchase_checklist`, `get_verification_limitations`, `review_report` | Gujarat knowledge base + critic review |
| `tracker-mcp` | 7 tools — `create_purchase`, `log_verification`, `get_verification_log`, `update_phase`, `get_purchase_summary`, `track_checklist_item` | Purchase tracking + verification audit trail + post-purchase progress |

### Slash Commands (Interactive Copilot)

| Command | Description |
|---------|-------------|
| `/summary` | Findings summary with risk rating (runs critic review) |
| `/risks` | All critical and high-severity risks |
| `/cost` | Total ownership cost calculator |
| `/dossier` | Final due diligence report for your lawyer |
| `/documents` | Property document checklist |
| `/verify <portal>` | Deep-dive into specific portal findings |
| `/compare-jantri` | Agreed price vs government rate |
| `/timeline` | Registration steps with timing |
| `/postpurchase` | Post-registration checklist |
| `/next-steps` | Top 5 prioritized action items |
| `/check-builder <name>` | Builder's RERA track record |

### Subagents (Parallel Verification)

| Agent | Model | Purpose |
|-------|-------|---------|
| `litigation-checker` | Sonnet | eCourts litigation search |
| `land-record-checker` | Sonnet | AnyRoR ownership + encumbrance |
| `document-checker` | Sonnet | GARVI documents + jantri rates |
| `tax-gstn-checker` | Sonnet | SMC tax + GST verification |
| `critic-reviewer` | Opus | Report quality review (reflection pattern) |

### Agent Skills (Auto-Invoked)

| Skill | Trigger |
|-------|---------|
| `gujarat-property-law` | Questions about RERA, NA conversion, title chain, legality |
| `stamp-duty-calculator` | Price discussions, "how much will I pay", cost questions |
| `verification-limitations` | Before any "Clear" or "Low Risk" assessment (mandatory) |
| `registration-guide` | "Ready to register", registration process questions |
| `post-purchase-checklist` | After registration, "what's next" questions |

### Two-Tier Browser Automation

| Portal | Primary | Fallback | Status |
|--------|---------|----------|--------|
| Gujarat RERA | dev-browser | — | ✅ Working (modal dismissal, search via evaluate) |
| GSTN | dev-browser | — | ✅ Working (simple input, no CAPTCHA) |
| eCourts | dev-browser | Claude Browser MCP | ⚠️ CAPTCHA blocks full automation |
| AnyRoR | dev-browser | Claude Browser MCP | ⚠️ Portal intermittently unavailable |
| GARVI | dev-browser | Claude Browser MCP | Needs live testing |
| SMC Property Tax | dev-browser | Claude Browser MCP | Needs live testing |

**How the fallback works:** When a portal tool returns `captcha_required: true` or `portal_unavailable: true`, the agent informs the user and suggests using interactive copilot mode where Claude Browser MCP can visually navigate the portal.

### Knowledge Base

| Data | Count | Source |
|------|-------|--------|
| Jantri rates | 7 Surat zones (residential + commercial) | Gujarat Town Planning Dept |
| Stamp duty | Gujarat rates (3.5% residential, 4.9% commercial) | Gujarat Stamp Act |
| Total cost components | 13 line items (stamp duty → broker commission) | Industry practice |
| Red flag patterns | 20 across 5 categories (RERA, land, legal, financial, builder) | Legal expertise |
| Document checklists | 5 property types (14-20 docs each) | Property law best practices |
| Registration steps | 10 steps (agreement → deed collection) | Gujarat Sub-Registrar process |
| Post-purchase tasks | 12 tasks across 5 categories | Gujarat municipal/legal requirements |
| Negative constraints | 14 documented blind spots | Verification scope analysis |

## Output Structure

Every analysis creates a timestamped output directory:

```
output/{purchase-id}/
├── verification-log.json         # Append-only audit trail of every check
├── dossier-summary.md            # Cross-portal verification report
└── screenshots/
    └── gujrera/
        ├── 01-search-results.png  # RERA search results page
        └── 02-project-details.png # Full project detail page
```

### Verification Log

Each entry in `verification-log.json`:

```json
{
  "id": "v-001",
  "purchaseId": "28130351",
  "timestamp": "2026-03-27T10:36:16Z",
  "portal": "GujRERA",
  "action": "RERA Project Search",
  "query": "CAA10499",
  "result": { "found": true, "projectName": "AVADH KONTINA" },
  "status": "verified",
  "screenshotPath": "output/28130351/screenshots/gujrera/01-search-results.png"
}
```

## Example Output

Tested against a real RERA project in Surat (AVADH KONTINA, commercial, Vesu):

```
Risk Assessment: REVIEW RECOMMENDED
RERA Status: ✅ Registered, 100% construction complete
Compliance: ✅ 10/13 quarterly, 3/3 annual, NIL defaulted
eCourts: ❌ CAPTCHA — manual check needed
AnyRoR: ⚠️ Not checked (portal input format)
Stamp Duty: ✅ 4.9% = ₹2,45,000 (commercial)
Jantri Rate: ✅ ₹5,500-8,000/sqft (Vesu commercial)
Red Flags: ✅ No critical flags (OC/CC status pending)
Documents: 13 items checklist for commercial office

Verification entries: 11 | Time: ~3 minutes | Cost: ~$0.12
```

## Programmatic Usage

```typescript
import { analyzeProperty } from "./src/index.js";

const result = await analyzeProperty({
  reraId: "PR/GJ/SURAT/...",
  address: "Vesu, Surat",
  builderName: "AVADH KONTINA",
  propertyType: "commercial_office",
  budget: 5000000,
  state: "Gujarat",
  onProgress: (event) => console.log(`[${event.type}] ${event.message}`),
});

console.log(result);
```

## Cost

| Component | Per Analysis |
|-----------|-------------|
| Claude API (Sonnet) | ~₹8-15 (~$0.10-0.18) |
| dev-browser compute | Negligible (local) |
| Total | ~₹10-20 per property |

Compare: property lawyer due diligence = ₹10,000-50,000.

## Spec

This implementation follows the [Real Estate Transaction Agent spec](../../real-estate-transaction-agent-spec.md) (3,522 lines). The spec covers the full production architecture including all 5 purchase phases, PostgreSQL storage, dossier PDF generation, and state expansion.

## Implementation Status

| Part | Status | What's Included |
|------|--------|----------------|
| Part 1 | ✅ Complete | Project scaffold, RERA portal automation, Gujarat KB, tracker, copilot |
| Part 2 | ✅ Complete | 5 remaining portals (eCourts, AnyRoR, GARVI, SMC, GSTN), dossier system, cross-portal verification |
| Part 3 | ✅ Complete | Total cost calculator, registration guide, post-purchase checklist, negative constraints |
| Part 4 | ✅ Complete | Reflection/critic agent, slash commands, subagent definitions, agent skills |
| Part 5 | Planned | Document analysis (PDF parsing), builder agreement review, parallel portal execution |

## Limitations (Current)

- **Gujarat only** — portal modules are Gujarat-specific. Architecture supports state expansion.
- **eCourts CAPTCHA** — automated search blocked by CAPTCHA. Use copilot mode for manual fallback.
- **AnyRoR intermittent** — some AnyRoR pages return "Application Error". Portal reliability varies.
- **No document analysis** — builder agreements, title deeds not analyzed yet (Part 3).
- **In-memory storage** — purchase tracking is in-memory + JSON files. No PostgreSQL yet.
- **No dossier PDF** — generates markdown, not PDF. PDF generation planned for Part 3.
- **GSTN/SMC/GARVI** — built but need live testing with real IDs for full validation.
