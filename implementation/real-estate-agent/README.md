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

## Three Modes

### Web UI (`npm run dev`) — Recommended

Browser-based interface for non-technical users. 3-step guided wizard collects property details, then opens an interactive chat with the copilot. Responses stream in real-time.

```bash
# Install frontend dependencies (one-time)
cd web && npm install && cd ..

# Start both API server (:4100) and frontend (:5173)
npm run dev

# Open in browser
open http://localhost:5173
```

The wizard asks for address, property type, budget, and optionally RERA ID and builder name. After submitting, the chat interface shows portal verification progress and agent responses as they stream. Quick-action buttons provide shortcuts to `/summary`, `/risks`, `/cost`, `/dossier`.

**Requirements:** Chrome must be open for Chrome DevTools MCP fallback (CAPTCHA-blocked portals).

### One-Shot Analysis (`npm run analyze`)

Full due diligence report in one pass via CLI.

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

Terminal-based conversational property verification — same copilot as the web UI but in the terminal.

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

# Install backend + agent dependencies
npm install

# Install frontend dependencies
cd web && npm install && cd ..
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
├── server/                        # API server (Hono)
│   ├── index.ts                   # Hono app, CORS, routes, listen on :4100
│   ├── agent-bridge.ts            # Wraps SDK query() → EventEmitter for SSE
│   ├── session-store.ts           # In-memory session state
│   └── routes/sessions.ts         # REST + SSE endpoints, slash command resolution
├── web/                           # Frontend (Vite + React + Tailwind)
│   └── src/
│       ├── App.tsx                # Wizard → Chat state machine + SSE handling
│       └── components/
│           ├── Wizard.tsx         # 3-step intake form
│           ├── Chat.tsx           # Chat container + input + quick actions
│           ├── MessageBubble.tsx  # Agent (markdown) / user / system messages
│           ├── ToolProgress.tsx   # Portal check spinners
│           ├── QuickActions.tsx   # /summary, /risks, /cost, /dossier buttons
│           └── SessionHeader.tsx  # Property info bar
├── src/                           # Agent core
│   ├── agent.ts                   # Orchestrator + subagent definitions
│   ├── copilot.ts                 # System prompt, slash commands
│   ├── mcp-servers/
│   │   ├── browser-mcp.ts        # 7 tools wrapping 6 portal modules
│   │   ├── property-kb-mcp.ts    # Gujarat knowledge base (10 tools incl. critic)
│   │   └── tracker-mcp.ts        # Purchase tracking + verification log (7 tools)
│   ├── portals/                   # 6 portal automation modules
│   ├── knowledge-base/            # 9 KB modules (jantri, stamp duty, cost, etc.)
│   └── tests/                     # 139 tests (all passing)
.claude/skills/
├── gujarat-property-law/         # RERA, NA conversion, title rules
├── stamp-duty-calculator/        # Total cost with hidden charges
├── verification-limitations/     # MANDATORY safety disclaimer
├── registration-guide/           # Registration walkthrough
└── post-purchase-checklist/      # Post-registration formalities
```

### MCP Servers (4 servers — 3 in-process + 1 external)

| Server | Type | Tools | Purpose |
|--------|------|-------|---------|
| `browser-mcp` | In-process | 7 tools — portal automation scripts | Government portal automation via dev-browser |
| `property-kb-mcp` | In-process | 10 tools — knowledge base + critic | Gujarat KB: jantri, stamp duty, total cost, red flags, registration guide, post-purchase, limitations, critic review |
| `tracker-mcp` | In-process | 7 tools — purchase tracking | Purchase state, verification log, phase transitions, checklist progress |
| `playwright` | External (stdio) | 30+ tools — headless browser | Fallback browser automation via `@playwright/mcp`. Launches headless Chromium for CAPTCHA-blocked portals |

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

The agent uses two browser automation layers. The primary layer (dev-browser) runs sandboxed portal automation scripts. When a portal blocks automation (CAPTCHA, errors), the fallback layer ([Playwright MCP](https://github.com/microsoft/playwright-mcp)) launches a headless Chromium browser to navigate the portal interactively.

| Portal | Primary | Fallback | Status |
|--------|---------|----------|--------|
| Gujarat RERA | dev-browser | Playwright MCP | ✅ Working (modal dismissal, search via evaluate) |
| GSTN | dev-browser | Playwright MCP | ✅ Working (simple input, no CAPTCHA) |
| eCourts | dev-browser | Playwright MCP | ⚠️ CAPTCHA — Playwright fallback navigates and fills forms |
| AnyRoR | dev-browser | Playwright MCP | ⚠️ Portal intermittently unavailable |
| GARVI | dev-browser | Playwright MCP | Needs live testing |
| SMC Property Tax | dev-browser | Playwright MCP | Needs live testing |

**How the fallback works:** When a portal tool returns `captcha_required: true` or `portal_unavailable: true`, the agent automatically uses Playwright MCP tools to:
1. `browser_navigate` — open the portal URL in headless Chromium
2. `browser_snapshot` — read the page structure and element refs
3. `browser_fill_form` / `browser_select_option` — enter search criteria
4. `browser_click` / `browser_press_key` — submit forms
5. `browser_wait_for` — wait for results to load
6. `browser_snapshot` — extract results
7. `browser_take_screenshot` — capture evidence

Playwright MCP runs as an external stdio MCP server (`@playwright/mcp`) configured in the agent bridge. It launches its own Chromium instance — no Chrome installation or extension required.

**MCP Server Configuration (server/agent-bridge.ts):**
```typescript
mcpServers: {
  "browser-mcp": browserMcp,        // In-process: portal automation scripts
  "property-kb-mcp": propertyKbMcp, // In-process: Gujarat knowledge base
  "tracker-mcp": trackerMcp,        // In-process: purchase tracking
  "playwright": {                    // External: headless browser fallback
    type: "stdio",
    command: "npx",
    args: ["@playwright/mcp@latest"]
  }
},
allowedTools: [                      // Required: explicitly permit MCP tools
  "mcp__browser-mcp__*",
  "mcp__property-kb-mcp__*",
  "mcp__tracker-mcp__*",
  "mcp__playwright__*"
]
```

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
