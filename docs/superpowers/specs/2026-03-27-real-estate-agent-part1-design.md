# Real Estate Transaction Agent — Part 1 Implementation Design

## Scope

Part 1 of 3. Foundation + Gujarat RERA portal verification. Demo-ready: give it a RERA project ID, it navigates the portal, extracts data, and generates a verification report.

**Parts overview:**
- **Part 1 (this):** Project scaffold + property-kb-mcp + browser-mcp (RERA only) + tracker-mcp + orchestrator (Phase 1) + copilot mode
- **Part 2:** Remaining 5 portals (AnyRoR, eCourts, GARVI, SMC, GSTN) + dossier system + cross-portal verification
- **Part 3:** Document analysis + Phases 2-5 + agreement review + total cost calculator

## Reference Documents

- Agent spec: `real-estate-transaction-agent-spec.md` (3,522 lines)
- Implementation reference: `implementation/legal-contract-agent/` (patterns to follow)
- Browser automation: [dev-browser](https://github.com/SawyerHood/dev-browser) (sandboxed Playwright)
- Framework playbook: `agent-framework-implementation-playbook.md` (Claude Agent SDK patterns)

## Architecture

```
implementation/real-estate-agent/
├── src/
│   ├── agent.ts                      # Orchestrator — Phase 1 Due Diligence
│   ├── copilot.ts                    # Interactive copilot mode
│   ├── cli.ts                        # One-shot CLI entry point
│   ├── copilot-cli.ts                # Interactive CLI entry point
│   ├── index.ts                      # Library exports
│   ├── mcp-servers/
│   │   ├── browser-mcp.ts            # dev-browser wrapper — portal automation tools
│   │   ├── property-kb-mcp.ts        # Gujarat property knowledge base tools
│   │   └── tracker-mcp.ts            # Purchase tracking + verification log
│   ├── portals/
│   │   ├── base-portal.ts            # Shared: launch dev-browser, screenshot, snapshotForAI
│   │   └── gujrera.ts                # Gujarat RERA portal navigation + extraction
│   ├── knowledge-base/
│   │   ├── jantri-rates.ts           # Surat zone-wise jantri rates
│   │   ├── stamp-duty.ts             # Gujarat stamp duty (reuse from legal agent)
│   │   ├── red-flags.ts              # 33 red flag patterns
│   │   └── required-documents.ts     # Document checklist per property type
│   └── types/
│       └── index.ts                  # Shared TypeScript types
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## MCP Servers (3)

### browser-mcp (2 tools in Part 1)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `search_rera_project` | Navigate Gujarat RERA portal and search for a project by RERA ID or project name | `{ query: string, search_type: "rera_id" \| "project_name" }` | `{ found: boolean, projects: ReraProject[], screenshot_path: string }` |
| `get_rera_project_details` | Get full details for a specific RERA project including builder info, timeline, complaints | `{ rera_id: string }` | `{ project: ReraProjectDetail, screenshots: string[], snapshot: string }` |

### property-kb-mcp (5 tools)

| Tool | Description |
|------|-------------|
| `get_jantri_rate` | Look up jantri (ready reckoner) rate for a Surat zone/area |
| `calculate_stamp_duty` | Calculate Gujarat stamp duty for given document type and value |
| `check_red_flags` | Check a set of property attributes against 33 known red flag patterns |
| `get_required_documents` | Get document checklist for property type (residential flat, commercial, plot) |
| `get_property_checklist` | Get phase-wise purchase checklist |

### tracker-mcp (4 tools)

| Tool | Description |
|------|-------------|
| `create_purchase` | Register a new property purchase for tracking |
| `log_verification` | Log a verification action with timestamp, source, result, screenshot path |
| `get_verification_log` | Get all verification actions for a purchase (append-only audit trail) |
| `update_phase` | Update purchase phase (due_diligence → document_review → ...) |

## Portal Automation Pattern

```typescript
// portals/base-portal.ts
// Shared dev-browser helpers

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

export interface PortalResult {
  success: boolean;
  data: unknown;
  screenshots: string[];
  errors: string[];
}

export function runDevBrowserScript(script: string): string {
  // Execute script in dev-browser's sandboxed QuickJS WASM environment
  return execSync(
    `dev-browser --headless <<'DEVBROWSER_SCRIPT'\n${script}\nDEVBROWSER_SCRIPT`,
    { encoding: "utf-8", timeout: 120000 }
  );
}

export function saveScreenshot(
  buffer: Buffer,
  purchaseId: string,
  portal: string,
  step: string
): string {
  const dir = resolve("output", purchaseId, "screenshots");
  mkdirSync(dir, { recursive: true });
  const filename = `${portal}-${step}-${Date.now()}.png`;
  const filepath = resolve(dir, filename);
  writeFileSync(filepath, buffer);
  return filepath;
}
```

```typescript
// portals/gujrera.ts
// Gujarat RERA portal automation

export async function searchReraProject(query: string, searchType: "rera_id" | "project_name") {
  const script = `
    const page = await browser.getPage("rera");
    await page.goto("https://gujrera.gujarat.gov.in/");

    // Wait for page load
    await page.waitForLoadState("networkidle");

    // Navigate to project search section
    // ... (portal-specific navigation)

    // Fill search field
    if ("${searchType}" === "rera_id") {
      await page.fill('input[name="rera_id"]', '${query}');
    } else {
      await page.fill('input[name="project_name"]', '${query}');
    }

    // Submit search
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    // Capture results
    const snapshot = await page.snapshotForAI();
    await saveScreenshot(await page.screenshot({ fullPage: true }), "rera-search-results.png");

    console.log(JSON.stringify({
      snapshot,
      screenshot: "rera-search-results.png"
    }));
  `;

  return runDevBrowserScript(script);
}
```

## System Prompt (orchestrator)

Follows the same pattern as Legal Contract Agent but focused on property verification:
- Gujarat-specific context (RERA rules, jantri rates, stamp duty)
- Anti-hallucination rules (cite portal results, not training data)
- Phase 1 only: Due Diligence (RERA verification + KB checks)
- Interactive copilot mode with contextual questions
- Disclaimer: not a substitute for professional property due diligence

## CLI Interface

```bash
# One-shot RERA verification
npm run analyze -- \
  --rera-id "PR/GJ/SURAT/SURAT CITY/SUDA/RAA..." \
  --state Gujarat

# Interactive copilot
npm run copilot -- \
  --rera-id "PR/GJ/SURAT/..." \
  --address "Diamond Bourse, Surat" \
  --type residential \
  --state Gujarat

# With property details for KB checks
npm run analyze -- \
  --rera-id "PR/GJ/SURAT/..." \
  --builder "XYZ Developers" \
  --type residential \
  --budget 5000000 \
  --state Gujarat
```

## Dependencies

```json
{
  "@anthropic-ai/claude-agent-sdk": "latest",
  "zod": "latest",
  "tsx": "latest",
  "typescript": "latest",
  "dotenv": "latest",
  "@types/node": "latest"
}
```

dev-browser installed globally: `npm install -g dev-browser && dev-browser install`

## Testing Strategy

1. **Unit tests for KB tools** — jantri rates, stamp duty calc, red flag matching (same pattern as legal agent's test-tools.ts)
2. **Portal test** — run `search_rera_project` against a known RERA project ID and verify data extraction
3. **Integration test** — full end-to-end: RERA ID → portal automation → KB checks → report generation
4. **User's real properties** — validate against Dhaval's actual Surat properties (commercial + residential)

## Implementation Order

1. Types and knowledge base files (can be done in parallel)
2. property-kb-mcp (no browser dependency — pure data)
3. base-portal.ts + dev-browser integration
4. gujrera.ts (Gujarat RERA portal automation)
5. browser-mcp (wraps portal modules as MCP tools)
6. tracker-mcp (in-memory purchase tracking)
7. agent.ts (orchestrator with system prompt)
8. copilot.ts (interactive mode)
9. CLI entry points
10. test-tools.ts (verification)
11. README.md

Steps 1-2 and 3-4 can be parallelized.

## What's NOT in Part 1

- AnyRoR, eCourts, GARVI, SMC, GSTN portals (Part 2)
- Document analysis / builder agreement review (Part 3)
- Full dossier PDF generation (Part 2)
- Phases 2-5 of purchase lifecycle (Part 3)
- Total cost calculator (Part 3)
- PostgreSQL / persistent storage (future)
