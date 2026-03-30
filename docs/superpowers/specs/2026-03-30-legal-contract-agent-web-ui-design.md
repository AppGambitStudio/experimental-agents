# Legal Contract Agent — Web UI Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Agent:** Legal Contract Intelligence Agent (India)

---

## Overview

A web UI for non-technical business teams to upload contracts, get AI-powered risk analysis against Indian law, and interactively negotiate better terms. Features smart document chunking for cost-efficient processing of large contracts (50-100+ pages). Progressive findings stream as each chunk completes.

## Architecture

```
┌─────────────────────────┐     SSE stream      ┌──────────────────────────────┐
│  Frontend (Vite+React)  │ ←─────────────────→  │  Backend (Hono API Server)   │
│  localhost:5173          │     REST + SSE       │  localhost:4101               │
│                         │                      │                              │
│  - File Upload          │                      │  - Claude Agent SDK          │
│  - Contract Details     │                      │  - document-mcp (in-process) │
│  - Processing View      │                      │  - legal-kb-mcp (in-process) │
│  - Chat UI              │                      │  - contract-mcp (in-process) │
│  - Risk Summary         │                      │  - Chunking pipeline         │
└─────────────────────────┘                      └──────────────────────────────┘
```

- **Frontend:** Vite + React SPA with Tailwind CSS. Same stack as real estate agent.
- **Backend:** Hono server wrapping Claude Agent SDK with 3 MCP servers in-process. Adds a document chunking pipeline for large contracts.
- **Startup:** Single `npm run dev` starts both frontend (Vite) and backend (Hono) concurrently.
- **Port:** API server on :4101 (real estate agent uses :4100).

## Document Processing Pipeline

### Phase 1: Parse & Structure

After upload, the server immediately:
1. Extracts full text via pdf-parse
2. Counts pages and words
3. Identifies clause boundaries using heading patterns:
   - Numbered clauses: `/^(\d+\.?\d*\.?\d*)\s+[A-Z]/` matches "1. DEFINITIONS", "3.2 Payment Terms"
   - Named sections: `/^(SCHEDULE|ANNEXURE|EXHIBIT|APPENDIX)\s+[A-Z]/`
   - All-caps headings: `/^[A-Z][A-Z\s]{3,}$/`
4. Builds a document map: clause titles, page ranges, word counts per clause

### Phase 2: Chunking Decision

```
IF total_pages <= 20:
  → Single pass (no chunking, send entire document)
ELSE:
  → Split at clause boundaries
  → IF any clause > 5 pages:
      → Sub-split at 3-5 page marks within that clause
  → Extract definitions section as shared context
  → Each chunk = clause text + definitions context prepended
```

### Phase 3: Per-Chunk Analysis

Each chunk is sent to Claude with:
- **Definitions context** (always prepended) — so references to defined terms resolve
- **Clause pattern matching** — `search_clause_patterns` per chunk
- **Enforceability check** — `check_enforceability` for key clause types
- Findings stream to frontend progressively as each chunk completes

### Phase 4: Consolidation

After all chunks are analyzed:
- Merge all clause findings into a single report
- Run `get_required_clauses` to check for missing clauses
- Run `get_applicable_regulations` to check regulatory compliance
- Calculate stamp duty via `get_stamp_duty`
- Run critic review via `review_report`
- Generate risk score (0-100) and grade (A-F)
- Present consolidated risk summary card

### Cost Efficiency

| Document Size | Full Doc Pass | Smart Chunking | Savings |
|---------------|--------------|----------------|---------|
| 5-page NDA | ~$0.02 | ~$0.02 (no split) | 0% |
| 25-page MSA | ~$0.08 | ~$0.05 | ~37% |
| 60-page Enterprise MSA | ~$0.15 | ~$0.06 | ~60% |
| 100-page + Schedules | ~$0.25+ | ~$0.08 | ~68% |

## User Flow

### Step 1 — Upload Contract

- Drag & drop zone or file browser button
- Accepts: PDF (DOCX and TXT in future)
- Max: 200 pages
- After upload: instantly shows file name, page count, word count, estimated processing time
- File uploaded via `POST /api/upload` (multipart), returns fileId + metadata

### Step 2 — Contract Details

- Counterparty name (text input)
- Your role — selectable chips: Vendor, Client, Developer, Employer, Tenant
- Contract type — selectable chips: MSA, NDA, Employment, Freelancer, Lease, SOW, Service Agreement
- State for stamp duty — dropdown: Gujarat, Maharashtra, Delhi, Karnataka
- Contract value — optional number input with Rs formatting
- "Start Analysis" button

### Step 3 — Processing (progressive)

After submit:
- Processing view appears with:
  - Document structure summary ("42 pages, 12 clauses, 3 schedules → 8 chunks")
  - Chunk progress bar ("Chunk 4/8: Analyzing Indemnity & Liability")
  - Per-chunk status: ✓ done, ⟳ analyzing, ○ pending
- Findings stream into the view as each chunk completes:
  - Finding cards with severity badges (Critical/High/Medium/Low)
  - Each card shows: clause number, title, risk level, one-line summary
- User can start reading findings while remaining chunks are still processing

### Step 4 — Chat (Interactive Review)

After all chunks complete:
- Risk summary card appears at top (score, grade, critical/high/medium counts)
- Chat opens for interactive Q&A
- User can ask: "Tell me more about Section 8.2", "Draft alternative language", "What should I negotiate first?"
- Quick action buttons: /risks, /playbook, /redline, /stamp-duty, /checklist, /dossier
- Slash commands resolved server-side (same pattern as real estate agent)

## Backend API

### Endpoints

**`POST /api/upload`**
Multipart file upload. Parses document, extracts structure.

Response:
```json
{
  "fileId": "file_abc123",
  "fileName": "acme-msa.pdf",
  "pageCount": 42,
  "wordCount": 18500,
  "clauses": [
    { "number": "1", "title": "DEFINITIONS", "pageStart": 1, "pageEnd": 4 },
    { "number": "2", "title": "SCOPE OF SERVICES", "pageStart": 5, "pageEnd": 8 }
  ],
  "chunks": 8,
  "estimatedTimeSeconds": 45
}
```

**`POST /api/sessions`**
Creates session with contract details + fileId. Starts chunked analysis.

Request:
```json
{
  "fileId": "file_abc123",
  "counterparty": "Acme Corp",
  "contractType": "msa",
  "ourRole": "developer",
  "state": "Gujarat",
  "contractValue": 6000000
}
```

Response:
```json
{
  "sessionId": "sess_abc123",
  "status": "created"
}
```

**`POST /api/sessions/:id/message`**
Send user message (same as real estate agent).

**`GET /api/sessions/:id/stream`**
SSE stream with extended event types:

```
event: structure
data: {"totalPages": 42, "totalClauses": 12, "chunks": 8, "estimatedTime": "~45 seconds"}

event: chunk_progress
data: {"current": 4, "total": 8, "label": "Indemnity & Liability", "status": "analyzing"}

event: chunk_progress
data: {"current": 4, "total": 8, "label": "Indemnity & Liability", "status": "done"}

event: finding
data: {"severity": "critical", "clause": "8.2", "title": "Unlimited indemnity", "summary": "No aggregate liability cap. Exposes you to unlimited financial risk."}

event: text
data: {"text": "I found 2 critical risks in this MSA..."}

event: risk_summary
data: {"score": 73, "grade": "D", "critical": 2, "high": 5, "medium": 3, "low": 1}

event: done
data: {"turns": 12, "costUsd": 0.06}
```

### Chunker (`server/chunker.ts`)

Pure function that takes document text and returns chunks:

```typescript
interface DocumentChunk {
  id: string;
  clauseNumber: string;
  clauseTitle: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  wordCount: number;
}

interface ChunkResult {
  totalPages: number;
  totalWords: number;
  clauses: Array<{ number: string; title: string; pageStart: number; pageEnd: number }>;
  definitionsText: string;      // extracted definitions section
  chunks: DocumentChunk[];      // the actual chunks to analyze
  isSinglePass: boolean;        // true if ≤ 20 pages (no chunking)
}

function chunkDocument(fullText: string, pageCount: number): ChunkResult
```

The chunker:
1. Splits text by clause heading patterns
2. If total pages ≤ 20: returns single chunk with full text, `isSinglePass: true`
3. If > 20 pages: returns multiple chunks at clause boundaries
4. Sub-splits any chunk > 5 pages at 3-5 page marks
5. Extracts definitions section separately for context injection

### Agent Bridge (`server/agent-bridge.ts`)

Same pattern as real estate agent — wraps `query()` into EventEmitter. Extended to:
- Accept a `chunks` option for chunked analysis
- Run per-chunk analysis in sequence (not parallel — avoids rate limits)
- Emit `chunk_progress` and `finding` events between chunks
- After all chunks: run consolidation (missing clauses, regulations, stamp duty, critic)

## Project Structure

```
implementation/legal-contract-agent/
├── server/                         # NEW — API Server
│   ├── index.ts                    # Hono server, CORS, routes, :4101
│   ├── routes/
│   │   ├── sessions.ts             # Session CRUD + SSE + slash commands
│   │   └── upload.ts               # File upload + parse + structure extraction
│   ├── agent-bridge.ts             # query() wrapper → SSE events (extended for chunks)
│   ├── session-store.ts            # In-memory session state
│   └── chunker.ts                  # Document chunking pipeline
├── web/                            # NEW — Frontend
│   ├── index.html
│   ├── package.json                # react, react-dom, vite, tailwindcss, react-markdown
│   ├── vite.config.ts              # Proxy /api → :4101
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 # Upload → Details → Processing → Chat state machine
│       ├── types.ts                # SSE event types, form data, message types
│       ├── api/
│       │   └── client.ts           # uploadFile(), createSession(), sendMessage()
│       └── components/
│           ├── FileUpload.tsx      # Drag & drop zone + file metadata display
│           ├── ContractDetails.tsx # Counterparty, role, type, state, value form
│           ├── ProcessingView.tsx  # Chunk progress bar + streaming finding cards
│           ├── Chat.tsx            # Chat container + input + quick actions
│           ├── MessageBubble.tsx   # Agent/user/system messages with markdown
│           ├── RiskSummary.tsx     # Risk score card (73/100, Grade D, severity counts)
│           ├── FindingCard.tsx     # Individual finding with severity badge + clause ref
│           ├── QuickActions.tsx    # /risks, /playbook, /redline, /stamp-duty buttons
│           └── SessionHeader.tsx   # Contract info bar (counterparty, type, pages)
├── src/                            # EXISTING — unchanged
│   ├── agent.ts
│   ├── copilot.ts
│   ├── mcp-servers/
│   ├── knowledge-base/
│   └── types/
├── package.json                    # Add dev scripts + hono + concurrently deps
└── .claude/skills/                 # EXISTING — unchanged
```

## Styling

- Tailwind CSS 4 with `@tailwindcss/typography` for markdown rendering
- Same clean/minimal design as real estate agent — consistency across agents
- Indigo accent color, white/gray background
- Mobile-responsive

## Key Behaviors

### Progressive Findings
As each chunk completes analysis:
1. `chunk_progress` event updates progress bar
2. `finding` events add finding cards to the processing view
3. User can read early findings while later chunks are still processing
4. After all chunks: `risk_summary` event triggers the summary card, then `text` with the full analysis

### Session Persistence
- Session ID + contract metadata saved to localStorage
- On reload: restore session, reconnect SSE, show chat with history
- "New Analysis" button to start fresh

### Error Handling
- Upload failures: show error with retry button
- Chunk analysis failure: skip chunk, note in report, continue with remaining chunks
- Large file warning: if > 100 pages, show estimated cost and processing time before starting

## What's NOT in v1

- No DOCX support (PDF only)
- No side-by-side original text vs redline view
- No version comparison (upload v2, diff against v1)
- No persistent database
- No authentication
- No PDF export of analysis report
- No multi-language support

## Development Workflow

```bash
# Install dependencies
cd implementation/legal-contract-agent
npm install                    # Backend deps
cd web && npm install          # Frontend deps

# Development
npm run dev                    # Starts both Vite (:5173) + Hono (:4101)

# Open browser
open http://localhost:5173
```
