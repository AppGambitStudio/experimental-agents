# Legal Contract Agent Web UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web UI for the legal contract agent with file upload, smart document chunking for cost-efficient processing of large contracts, progressive findings streaming, and interactive chat — using Vite+React frontend + Hono API backend.

**Architecture:** Vite+React SPA talks to a Hono API server (:4101) via REST + SSE. The server wraps the Claude Agent SDK with 3 in-process MCP servers (document-mcp, legal-kb-mcp, contract-mcp). Large documents (>20 pages) are split at clause boundaries into 3-5 page chunks, each analyzed separately with definitions context injected. Findings stream progressively to the frontend as each chunk completes.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, Hono, Claude Agent SDK, SSE (EventSource), pdf-parse, TypeScript

---

## File Structure

```
implementation/legal-contract-agent/
├── server/                           # NEW — Hono API server
│   ├── index.ts                      # Server entry: Hono app, CORS, routes, :4101
│   ├── session-store.ts              # In-memory Map<sessionId, SessionState>
│   ├── chunker.ts                    # Document chunking pipeline (pure function)
│   ├── agent-bridge.ts               # Wraps query() → EventEmitter, chunk-aware
│   └── routes/
│       ├── upload.ts                 # POST /api/upload — multipart file + parse + structure
│       └── sessions.ts              # POST /api/sessions, POST /message, GET /stream
├── server/tests/
│   └── chunker.test.ts              # Tests for document chunking logic
├── web/                              # NEW — Vite+React frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts                # Dev server :5173, proxy /api → :4101
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                   # Upload → Details → Processing → Chat state machine
│       ├── types.ts                  # SSE events, form data, message types
│       └── components/
│           ├── FileUpload.tsx        # Drag & drop zone
│           ├── ContractDetails.tsx   # Counterparty, role, type, state, value
│           ├── ProcessingView.tsx    # Chunk progress bar + streaming findings
│           ├── Chat.tsx              # Chat container + input + quick actions
│           ├── MessageBubble.tsx     # Agent/user/system with markdown
│           ├── RiskSummary.tsx       # Score card (73/100, Grade D)
│           ├── FindingCard.tsx       # Individual finding with severity badge
│           ├── QuickActions.tsx      # Slash command buttons
│           └── SessionHeader.tsx     # Contract info bar
├── src/                              # EXISTING — unchanged
├── package.json                      # MODIFY — add scripts + deps
└── tsconfig.json                     # MODIFY — include server/
```

---

## Task 1: Document Chunker (TDD)

The chunker is the core new component — a pure function with no dependencies on the agent or MCP servers. Build and test it first.

**Files:**
- Create: `implementation/legal-contract-agent/server/chunker.ts`
- Create: `implementation/legal-contract-agent/server/tests/chunker.test.ts`

- [ ] **Step 1: Create chunker.ts with types and stub**

Create `server/chunker.ts`:

```typescript
// Document chunking pipeline for cost-efficient contract analysis
// Splits large contracts at clause boundaries with definitions context injection

export interface DocumentChunk {
  id: string;
  clauseNumber: string;
  clauseTitle: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  wordCount: number;
}

export interface ClauseInfo {
  number: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  wordCount: number;
}

export interface ChunkResult {
  totalPages: number;
  totalWords: number;
  clauses: ClauseInfo[];
  definitionsText: string;
  chunks: DocumentChunk[];
  isSinglePass: boolean;
}

const SINGLE_PASS_THRESHOLD = 20; // pages
const MAX_CHUNK_PAGES = 5;
const WORDS_PER_PAGE = 450; // approximate for contracts

// Heading patterns for clause boundary detection
const CLAUSE_PATTERNS = [
  /^(\d+\.?\d*\.?\d*)\s+[A-Z][A-Z\s]+/m,           // "1. DEFINITIONS", "3.2 PAYMENT TERMS"
  /^(SCHEDULE|ANNEXURE|EXHIBIT|APPENDIX)\s+[A-Z]/m,  // "SCHEDULE A", "ANNEXURE 1"
  /^[A-Z][A-Z\s]{5,}$/m,                              // "CONFIDENTIALITY", "LIMITATION OF LIABILITY"
];

/**
 * Split document text into logical chunks for analysis.
 * Small docs (≤ 20 pages) → single pass.
 * Large docs → split at clause boundaries, sub-split if > 5 pages.
 */
export function chunkDocument(fullText: string, pageCount: number): ChunkResult {
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;

  // Single pass for small documents
  if (pageCount <= SINGLE_PASS_THRESHOLD) {
    return {
      totalPages: pageCount,
      totalWords,
      clauses: [],
      definitionsText: "",
      chunks: [{
        id: "chunk_full",
        clauseNumber: "ALL",
        clauseTitle: "Full Document",
        text: fullText,
        pageStart: 1,
        pageEnd: pageCount,
        wordCount: totalWords,
      }],
      isSinglePass: true,
    };
  }

  // Extract clause boundaries
  const clauses = extractClauses(fullText, pageCount);

  // Extract definitions section for context injection
  const definitionsText = extractDefinitions(clauses);

  // Build chunks — sub-split large clauses
  const chunks = buildChunks(clauses);

  return {
    totalPages: pageCount,
    totalWords,
    clauses,
    definitionsText,
    chunks,
    isSinglePass: false,
  };
}

/**
 * Extract clause boundaries from document text using heading patterns.
 */
export function extractClauses(fullText: string, pageCount: number): ClauseInfo[] {
  const lines = fullText.split("\n");
  const clauses: ClauseInfo[] = [];
  let currentClause: { number: string; title: string; startLine: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = matchClauseHeading(line);
    if (match) {
      // Save previous clause
      if (currentClause) {
        const text = lines.slice(currentClause.startLine, i).join("\n");
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const pageStart = Math.floor((currentClause.startLine / lines.length) * pageCount) + 1;
        const pageEnd = Math.floor((i / lines.length) * pageCount) + 1;
        clauses.push({
          number: currentClause.number,
          title: currentClause.title,
          pageStart,
          pageEnd: Math.max(pageStart, pageEnd),
          text,
          wordCount,
        });
      }
      currentClause = { number: match.number, title: match.title, startLine: i };
    }
  }

  // Save last clause
  if (currentClause) {
    const text = lines.slice(currentClause.startLine).join("\n");
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const pageStart = Math.floor((currentClause.startLine / lines.length) * pageCount) + 1;
    clauses.push({
      number: currentClause.number,
      title: currentClause.title,
      pageStart,
      pageEnd: pageCount,
      text,
      wordCount,
    });
  }

  // If no clauses found, treat entire doc as one clause
  if (clauses.length === 0) {
    clauses.push({
      number: "1",
      title: "Full Document",
      pageStart: 1,
      pageEnd: pageCount,
      text: fullText,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
    });
  }

  return clauses;
}

function matchClauseHeading(line: string): { number: string; title: string } | null {
  // Numbered clause: "1. DEFINITIONS" or "3.2 Payment Terms"
  const numberedMatch = line.match(/^(\d+\.?\d*\.?\d*)\s+([A-Z].+)$/);
  if (numberedMatch) {
    return { number: numberedMatch[1], title: numberedMatch[2].trim() };
  }

  // Named section: "SCHEDULE A" or "ANNEXURE 1"
  const namedMatch = line.match(/^(SCHEDULE|ANNEXURE|EXHIBIT|APPENDIX)\s+(.+)$/i);
  if (namedMatch) {
    return { number: namedMatch[1], title: line.trim() };
  }

  // All-caps heading (at least 6 chars, standalone line)
  if (/^[A-Z][A-Z\s]{5,}$/.test(line) && line.length < 60) {
    return { number: "", title: line.trim() };
  }

  return null;
}

function extractDefinitions(clauses: ClauseInfo[]): string {
  const defClause = clauses.find(
    (c) =>
      c.title.toLowerCase().includes("definition") ||
      c.title.toLowerCase().includes("interpretation")
  );
  return defClause?.text ?? "";
}

function buildChunks(clauses: ClauseInfo[]): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkId = 0;

  for (const clause of clauses) {
    const pages = clause.pageEnd - clause.pageStart + 1;

    if (pages <= MAX_CHUNK_PAGES) {
      // Clause fits in one chunk
      chunks.push({
        id: `chunk_${++chunkId}`,
        clauseNumber: clause.number,
        clauseTitle: clause.title,
        text: clause.text,
        pageStart: clause.pageStart,
        pageEnd: clause.pageEnd,
        wordCount: clause.wordCount,
      });
    } else {
      // Sub-split large clause at ~WORDS_PER_PAGE * MAX_CHUNK_PAGES boundaries
      const words = clause.text.split(/\s+/);
      const wordsPerChunk = WORDS_PER_PAGE * MAX_CHUNK_PAGES;
      let offset = 0;
      let subPart = 1;

      while (offset < words.length) {
        const end = Math.min(offset + wordsPerChunk, words.length);
        const chunkText = words.slice(offset, end).join(" ");
        const chunkWords = end - offset;
        const pagesInChunk = Math.ceil(chunkWords / WORDS_PER_PAGE);
        const pageStart = clause.pageStart + Math.floor((offset / words.length) * pages);
        const pageEnd = Math.min(pageStart + pagesInChunk - 1, clause.pageEnd);

        chunks.push({
          id: `chunk_${++chunkId}`,
          clauseNumber: clause.number,
          clauseTitle: `${clause.title} (Part ${subPart})`,
          text: chunkText,
          pageStart,
          pageEnd: Math.max(pageStart, pageEnd),
          wordCount: chunkWords,
        });

        offset = end;
        subPart++;
      }
    }
  }

  return chunks;
}

/**
 * Estimate processing time based on chunk count.
 * ~5-8 seconds per chunk for Claude Sonnet analysis.
 */
export function estimateProcessingTime(chunkCount: number): number {
  return chunkCount * 7; // seconds, approximate
}
```

- [ ] **Step 2: Create chunker tests**

Create `server/tests/chunker.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkDocument, extractClauses, estimateProcessingTime } from "../chunker.js";

// Helper: generate fake contract text with clause headings
function makeContractText(clauseCount: number, wordsPerClause: number): string {
  const clauses: string[] = [];
  for (let i = 1; i <= clauseCount; i++) {
    const title = [
      "DEFINITIONS", "SCOPE OF SERVICES", "PAYMENT TERMS", "INTELLECTUAL PROPERTY",
      "CONFIDENTIALITY", "INDEMNIFICATION", "LIMITATION OF LIABILITY", "TERMINATION",
      "GOVERNING LAW", "DISPUTE RESOLUTION", "FORCE MAJEURE", "NOTICES",
    ][i - 1] ?? `CLAUSE ${i}`;
    const body = Array(wordsPerClause).fill("lorem ipsum dolor sit amet").join(" ");
    clauses.push(`${i}. ${title}\n\n${body}`);
  }
  return clauses.join("\n\n");
}

describe("chunkDocument", () => {
  it("returns single pass for small documents (≤ 20 pages)", () => {
    const text = makeContractText(5, 100);
    const result = chunkDocument(text, 10);
    assert.equal(result.isSinglePass, true);
    assert.equal(result.chunks.length, 1);
    assert.equal(result.chunks[0].clauseTitle, "Full Document");
  });

  it("splits large documents into multiple chunks", () => {
    const text = makeContractText(8, 500);
    const result = chunkDocument(text, 30);
    assert.equal(result.isSinglePass, false);
    assert.ok(result.chunks.length > 1);
  });

  it("extracts definitions text for context injection", () => {
    const text = "1. DEFINITIONS\n\nConfidential Information means...\n\n2. SCOPE\n\nThe services include...";
    const result = chunkDocument(text, 25);
    assert.ok(result.definitionsText.includes("Confidential Information"));
  });

  it("handles documents with no recognizable headings", () => {
    const text = "This is a plain text contract with no numbered headings. ".repeat(500);
    const result = chunkDocument(text, 25);
    assert.equal(result.isSinglePass, false);
    assert.ok(result.chunks.length >= 1);
  });

  it("returns correct page and word counts", () => {
    const text = makeContractText(3, 200);
    const result = chunkDocument(text, 5);
    assert.equal(result.totalPages, 5);
    assert.ok(result.totalWords > 0);
  });
});

describe("extractClauses", () => {
  it("detects numbered clause headings", () => {
    const text = "1. DEFINITIONS\nSome text\n\n2. SCOPE OF SERVICES\nMore text\n\n3. PAYMENT\nPayment text";
    const clauses = extractClauses(text, 10);
    assert.equal(clauses.length, 3);
    assert.equal(clauses[0].title, "DEFINITIONS");
    assert.equal(clauses[1].title, "SCOPE OF SERVICES");
    assert.equal(clauses[2].title, "PAYMENT");
  });

  it("detects SCHEDULE/ANNEXURE headings", () => {
    const text = "1. MAIN CLAUSE\nBody\n\nSCHEDULE A\nSchedule content\n\nANNEXURE 1\nAnnexure content";
    const clauses = extractClauses(text, 10);
    assert.ok(clauses.some((c) => c.title.includes("SCHEDULE")));
  });

  it("detects all-caps standalone headings", () => {
    const text = "CONFIDENTIALITY\nThis section covers...\n\nLIMITATION OF LIABILITY\nNeither party...";
    const clauses = extractClauses(text, 5);
    assert.ok(clauses.length >= 2);
  });

  it("returns single clause for unstructured text", () => {
    const text = "Just a block of text with no headings at all.";
    const clauses = extractClauses(text, 1);
    assert.equal(clauses.length, 1);
    assert.equal(clauses[0].title, "Full Document");
  });
});

describe("estimateProcessingTime", () => {
  it("estimates ~7 seconds per chunk", () => {
    assert.equal(estimateProcessingTime(1), 7);
    assert.equal(estimateProcessingTime(8), 56);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd implementation/legal-contract-agent
node --import tsx --test server/tests/chunker.test.ts
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add server/chunker.ts server/tests/chunker.test.ts
git commit -m "feat: add document chunker — clause boundary splitting with TDD"
```

---

## Task 2: Backend — Project Setup, Session Store, Upload Route

**Files:**
- Modify: `implementation/legal-contract-agent/package.json`
- Modify: `implementation/legal-contract-agent/tsconfig.json`
- Create: `implementation/legal-contract-agent/server/session-store.ts`
- Create: `implementation/legal-contract-agent/server/routes/upload.ts`

- [ ] **Step 1: Install backend dependencies**

```bash
cd implementation/legal-contract-agent
npm install hono @hono/node-server concurrently
```

- [ ] **Step 2: Update package.json scripts**

Add to the `scripts` section (keep existing scripts):

```json
{
  "dev": "concurrently --names server,web --prefix-colors blue,green \"npm run dev:server\" \"npm run dev:web\"",
  "dev:server": "tsx --watch server/index.ts",
  "dev:web": "cd web && npm run dev",
  "test": "node --import tsx --test src/tests/*.test.ts server/tests/*.test.ts"
}
```

- [ ] **Step 3: Update tsconfig.json**

Remove `rootDir` and update `include`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node"],
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*", "server/**/*"],
  "exclude": ["node_modules", "dist", "web"]
}
```

- [ ] **Step 4: Create session-store.ts**

Create `server/session-store.ts`:

```typescript
export interface SessionState {
  id: string;
  sdkSessionId?: string;
  fileId: string;
  fileName: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  state: string;
  contractValue?: number;
  pageCount: number;
  wordCount: number;
  chunkCount: number;
  messages: Array<{ role: "user" | "agent" | "system"; content: string; timestamp: string }>;
  findings: Array<{ severity: string; clause: string; title: string; summary: string }>;
  riskSummary?: { score: number; grade: string; critical: number; high: number; medium: number; low: number };
  createdAt: string;
  status: "created" | "analyzing" | "active" | "error";
}

const sessions = new Map<string, SessionState>();
let counter = 0;

export function createSession(
  data: Omit<SessionState, "id" | "messages" | "findings" | "createdAt" | "status">
): SessionState {
  const id = `sess_${Date.now()}_${++counter}`;
  const session: SessionState = {
    ...data,
    id,
    messages: [],
    findings: [],
    createdAt: new Date().toISOString(),
    status: "created",
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, update: Partial<SessionState>): void {
  const session = sessions.get(id);
  if (session) Object.assign(session, update);
}

export function addMessage(id: string, role: "user" | "agent" | "system", content: string): void {
  const session = sessions.get(id);
  if (session) session.messages.push({ role, content, timestamp: new Date().toISOString() });
}

export function addFinding(id: string, finding: SessionState["findings"][number]): void {
  const session = sessions.get(id);
  if (session) session.findings.push(finding);
}

// File storage — maps fileId to parsed document data
interface UploadedFile {
  id: string;
  fileName: string;
  filePath: string;
  text: string;
  pageCount: number;
  wordCount: number;
}

const files = new Map<string, UploadedFile>();
let fileCounter = 0;

export function storeFile(data: Omit<UploadedFile, "id">): UploadedFile {
  const id = `file_${Date.now()}_${++fileCounter}`;
  const file = { ...data, id };
  files.set(id, file);
  return file;
}

export function getFile(id: string): UploadedFile | undefined {
  return files.get(id);
}
```

- [ ] **Step 5: Create upload route**

Create `server/routes/upload.ts`:

```typescript
import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { storeFile } from "../session-store.js";
import { chunkDocument, estimateProcessingTime } from "../chunker.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file uploaded. Send a PDF file as 'file' field." }, 400);
  }

  const fileName = file.name;
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext !== "pdf" && ext !== "txt") {
    return c.json({ error: `Unsupported format: ${ext}. Supported: pdf, txt` }, 400);
  }

  try {
    // Save to temp directory
    const uploadDir = join(tmpdir(), "legal-contract-agent-uploads");
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, `${Date.now()}_${fileName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Parse document
    let text: string;
    let pageCount: number;

    if (ext === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      text = textResult.text;
      pageCount = textResult.total;
    } else {
      text = buffer.toString("utf-8");
      pageCount = Math.max(1, Math.ceil(text.split(/\s+/).length / 450));
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Run chunker to get structure
    const chunkResult = chunkDocument(text, pageCount);

    // Store file data
    const stored = storeFile({ fileName, filePath, text, pageCount, wordCount });

    return c.json({
      fileId: stored.id,
      fileName,
      pageCount,
      wordCount,
      clauses: chunkResult.clauses.map((cl) => ({
        number: cl.number,
        title: cl.title,
        pageStart: cl.pageStart,
        pageEnd: cl.pageEnd,
      })),
      chunks: chunkResult.chunks.length,
      isSinglePass: chunkResult.isSinglePass,
      estimatedTimeSeconds: estimateProcessingTime(chunkResult.chunks.length),
    });
  } catch (err) {
    return c.json({ error: `Failed to parse document: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});

export { app as uploadRoutes };
```

- [ ] **Step 6: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json server/session-store.ts server/routes/upload.ts
git commit -m "feat: add backend setup, session store, and file upload route"
```

---

## Task 3: Backend — Agent Bridge & Session Routes

**Files:**
- Create: `implementation/legal-contract-agent/server/agent-bridge.ts`
- Create: `implementation/legal-contract-agent/server/routes/sessions.ts`
- Create: `implementation/legal-contract-agent/server/index.ts`

- [ ] **Step 1: Create agent-bridge.ts**

Create `server/agent-bridge.ts` — wraps Claude Agent SDK `query()` into an EventEmitter. Supports both single-pass and chunked analysis.

```typescript
import { EventEmitter } from "events";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { documentMcp } from "../src/mcp-servers/document-mcp.js";
import { legalKbMcp } from "../src/mcp-servers/legal-kb-mcp.js";
import { contractMcp } from "../src/mcp-servers/contract-mcp.js";
import type { DocumentChunk } from "./chunker.js";

const TOOL_DISPLAY: Record<string, string> = {
  "mcp__document-mcp__parse_document": "Parsing document",
  "mcp__document-mcp__extract_metadata": "Extracting metadata",
  "mcp__legal-kb-mcp__search_clause_patterns": "Checking Indian law patterns",
  "mcp__legal-kb-mcp__get_required_clauses": "Checking required clauses",
  "mcp__legal-kb-mcp__get_stamp_duty": "Calculating stamp duty",
  "mcp__legal-kb-mcp__check_enforceability": "Checking enforceability",
  "mcp__legal-kb-mcp__get_applicable_regulations": "Checking regulatory compliance",
  "mcp__legal-kb-mcp__get_contract_limitations": "Loading analysis limitations",
  "mcp__legal-kb-mcp__review_report": "Running critic review",
  "mcp__contract-mcp__create_contract": "Creating contract record",
  "mcp__contract-mcp__add_version": "Adding version",
  "mcp__contract-mcp__store_analysis": "Storing analysis",
  "mcp__contract-mcp__get_previous_analysis": "Loading previous analysis",
  "mcp__contract-mcp__get_contract_timeline": "Loading timeline",
};

export interface AgentEvent {
  type: "session_id" | "tool_call" | "text" | "done" | "error" | "chunk_progress" | "finding" | "risk_summary" | "structure";
  [key: string]: unknown;
  timestamp: string;
}

export interface RunTurnOptions {
  prompt: string;
  systemPrompt: string;
  sdkSessionId?: string;
}

export function runAgentTurn(options: RunTurnOptions): EventEmitter {
  const emitter = new EventEmitter();

  const execute = async () => {
    try {
      const queryOptions: Parameters<typeof query>[0] = {
        prompt: options.prompt,
        options: {
          systemPrompt: options.systemPrompt,
          mcpServers: {
            "document-mcp": documentMcp,
            "legal-kb-mcp": legalKbMcp,
            "contract-mcp": contractMcp,
          },
          allowedTools: [
            "mcp__document-mcp__*",
            "mcp__legal-kb-mcp__*",
            "mcp__contract-mcp__*",
          ],
          model: "sonnet",
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 50,
          ...(options.sdkSessionId ? { resume: options.sdkSessionId } : {}),
        },
      };

      for await (const message of query(queryOptions)) {
        if ("type" in message && message.type === "system" && "subtype" in message) {
          const sysMsg = message as { type: "system"; subtype: string; session_id?: string };
          if (sysMsg.subtype === "init" && sysMsg.session_id) {
            emitter.emit("event", { type: "session_id", sessionId: sysMsg.session_id, timestamp: new Date().toISOString() } satisfies AgentEvent);
          }
        }

        if ("type" in message && message.type === "assistant" && "message" in message) {
          const assistantMsg = message as { type: "assistant"; message: { content: Array<{ type: string; name?: string; text?: string }> } };
          const content = assistantMsg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_use" && block.name) {
                emitter.emit("event", {
                  type: "tool_call",
                  tool: block.name,
                  toolLabel: TOOL_DISPLAY[block.name] ?? block.name.replace(/mcp__[^_]+__/, ""),
                  timestamp: new Date().toISOString(),
                } satisfies AgentEvent);
              }
              if (block.type === "text" && block.text) {
                emitter.emit("event", { type: "text", text: block.text, timestamp: new Date().toISOString() } satisfies AgentEvent);
              }
            }
          }
        }

        if ("type" in message && message.type === "result") {
          const resultMsg = message as { type: "result"; subtype: string; num_turns?: number; total_cost_usd?: number };
          if (resultMsg.subtype === "success") {
            emitter.emit("event", { type: "done", numTurns: resultMsg.num_turns, costUsd: resultMsg.total_cost_usd, timestamp: new Date().toISOString() } satisfies AgentEvent);
          } else {
            emitter.emit("event", { type: "error", error: `Agent: ${resultMsg.subtype}`, timestamp: new Date().toISOString() } satisfies AgentEvent);
          }
        }
      }
    } catch (err) {
      emitter.emit("event", { type: "error", error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() } satisfies AgentEvent);
    }
  };

  execute();
  return emitter;
}
```

- [ ] **Step 2: Create session routes**

Create `server/routes/sessions.ts`:

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createSession, getSession, updateSession, addMessage, addFinding, getFile } from "../session-store.js";
import { runAgentTurn, type AgentEvent } from "../agent-bridge.js";
import { chunkDocument } from "../chunker.js";

// Extract system prompt from copilot.ts
const copilotSource = readFileSync(resolve(import.meta.dirname ?? ".", "../../src/copilot.ts"), "utf-8");
const promptMatch = copilotSource.match(/const COPILOT_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/);
if (!promptMatch) throw new Error("Could not extract COPILOT_SYSTEM_PROMPT from src/copilot.ts");
const SYSTEM_PROMPT = promptMatch[1];

// Slash command resolution
const SLASH_COMMANDS: Record<string, string | ((args: string) => string)> = {
  "/summary": "Give me a concise summary of all findings so far — risk score, critical items, and top 3 things to negotiate first.",
  "/risks": "List ALL critical and high-risk clauses found so far. For each: quote the original text, state the risk level, cite the applicable Indian law, and explain why it matters in plain language.",
  "/playbook": "Generate a complete negotiation playbook based on all the risks we've discussed. Priority-ordered, with specific talking points and alternative clause language for each item.",
  "/redline": "Generate a redlined version — for each flagged clause, show the original text and the suggested replacement text side by side.",
  "/stamp-duty": "Calculate the stamp duty for this contract using get_stamp_duty. Show the duty amount, whether e-stamping is available, registration requirements, and penalty for deficiency.",
  "/checklist": "Use get_required_clauses to show me the complete checklist of clauses required for this contract type. Mark which ones are present and which are missing.",
  "/enforceability": (clauseType: string) => clauseType
    ? `Use check_enforceability to analyze the enforceability of the "${clauseType}" clause under Indian law.`
    : "Which clause type? Options: non_compete, indemnity, penalty, moral_rights, governing_law, arbitration, termination.",
  "/dossier": "Generate a final analysis dossier suitable for sharing with the legal team. Include: executive summary, risk score, clause-by-clause analysis, missing clauses, stamp duty, regulatory compliance, negotiation playbook, and the full limitations disclaimer. Before presenting, run a critic review.",
  "/next-steps": "Based on everything found so far, give me a prioritized list of the top 5 things I should do next.",
  "/help": "List all available commands: /summary, /risks, /playbook, /redline, /stamp-duty, /checklist, /enforceability, /dossier, /next-steps. Briefly describe each.",
};

function resolveSlashCommand(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) return message;
  const spaceIdx = trimmed.indexOf(" ");
  const cmd = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();
  const handler = SLASH_COMMANDS[cmd.toLowerCase()];
  if (!handler) return message;
  return typeof handler === "function" ? handler(args) : handler;
}

// Pending events per session
const pendingEvents = new Map<string, AgentEvent[]>();
function pushEvent(sessionId: string, event: AgentEvent): void {
  let queue = pendingEvents.get(sessionId);
  if (!queue) { queue = []; pendingEvents.set(sessionId, queue); }
  queue.push(event);
}
function drainEvents(sessionId: string): AgentEvent[] {
  const queue = pendingEvents.get(sessionId);
  if (!queue || queue.length === 0) return [];
  const events = [...queue];
  queue.length = 0;
  return events;
}

function startAgentTurn(sessionId: string, prompt: string, sdkSessionId?: string): void {
  const emitter = runAgentTurn({ prompt, systemPrompt: SYSTEM_PROMPT, sdkSessionId });
  emitter.on("event", (event: AgentEvent) => {
    if (event.type === "session_id") updateSession(sessionId, { sdkSessionId: event.sessionId as string, status: "active" });
    if (event.type === "text") addMessage(sessionId, "agent", event.text as string);
    if (event.type === "error") updateSession(sessionId, { status: "error" });
    pushEvent(sessionId, event);
  });
}

const app = new Hono();

// POST / — create session and start chunked analysis
app.post("/", async (c) => {
  const body = await c.req.json<{
    fileId: string;
    counterparty: string;
    contractType: string;
    ourRole: string;
    state: string;
    contractValue?: number;
  }>();

  const file = getFile(body.fileId);
  if (!file) return c.json({ error: "File not found. Upload first via POST /api/upload." }, 404);

  const chunkResult = chunkDocument(file.text, file.pageCount);

  const session = createSession({
    fileId: body.fileId,
    fileName: file.fileName,
    counterparty: body.counterparty,
    contractType: body.contractType,
    ourRole: body.ourRole,
    state: body.state,
    contractValue: body.contractValue,
    pageCount: file.pageCount,
    wordCount: file.wordCount,
    chunkCount: chunkResult.chunks.length,
  });

  updateSession(session.id, { status: "analyzing" });

  // Emit structure event
  pushEvent(session.id, {
    type: "structure",
    totalPages: file.pageCount,
    totalClauses: chunkResult.clauses.length,
    chunks: chunkResult.chunks.length,
    isSinglePass: chunkResult.isSinglePass,
    estimatedTime: `~${chunkResult.chunks.length * 7} seconds`,
    timestamp: new Date().toISOString(),
  });

  // Build the analysis prompt
  const contractContext = `Contract: ${file.fileName}
Counterparty: ${body.counterparty}
Type: ${body.contractType}
Our role: ${body.ourRole}
State: ${body.state}
${body.contractValue ? `Value: Rs ${body.contractValue.toLocaleString("en-IN")}` : ""}
Pages: ${file.pageCount} | Words: ${file.wordCount}`;

  if (chunkResult.isSinglePass) {
    // Small doc — single pass
    const prompt = `Analyze this contract comprehensively:\n\n${contractContext}\n\nFull contract text:\n\n${file.text}\n\nUse search_clause_patterns, get_required_clauses, check_enforceability, get_stamp_duty, get_applicable_regulations, and get_contract_limitations. Provide risk score, findings, and negotiation playbook.`;
    startAgentTurn(session.id, prompt);
  } else {
    // Large doc — chunked analysis
    const analyzeChunks = async () => {
      const definitions = chunkResult.definitionsText
        ? `\n\nDEFINITIONS CONTEXT (from contract):\n${chunkResult.definitionsText.slice(0, 3000)}\n\n---\n\n`
        : "";

      for (let i = 0; i < chunkResult.chunks.length; i++) {
        const chunk = chunkResult.chunks[i];
        pushEvent(session.id, {
          type: "chunk_progress",
          current: i + 1,
          total: chunkResult.chunks.length,
          label: chunk.clauseTitle,
          status: "analyzing",
          timestamp: new Date().toISOString(),
        });

        const chunkPrompt = `${contractContext}

You are analyzing chunk ${i + 1} of ${chunkResult.chunks.length} of a large contract.
${definitions}
CLAUSE: ${chunk.clauseNumber} — ${chunk.clauseTitle} (pages ${chunk.pageStart}-${chunk.pageEnd})

${chunk.text}

Analyze this clause for risks under Indian law. Use search_clause_patterns and check_enforceability. For each risk found, report: clause number, risk level (critical/high/medium/low), and a one-sentence summary. Be concise — this is one chunk of many.`;

        // Run agent turn for this chunk and wait for completion
        await new Promise<void>((resolve) => {
          const emitter = runAgentTurn({ prompt: chunkPrompt, systemPrompt: SYSTEM_PROMPT, sdkSessionId: getSession(session.id)?.sdkSessionId });
          emitter.on("event", (event: AgentEvent) => {
            if (event.type === "session_id") updateSession(session.id, { sdkSessionId: event.sessionId as string });
            if (event.type === "text") addMessage(session.id, "agent", event.text as string);
            pushEvent(session.id, event);
            if (event.type === "done" || event.type === "error") {
              pushEvent(session.id, {
                type: "chunk_progress",
                current: i + 1,
                total: chunkResult.chunks.length,
                label: chunk.clauseTitle,
                status: "done",
                timestamp: new Date().toISOString(),
              });
              resolve();
            }
          });
        });
      }

      // Consolidation — check missing clauses, stamp duty, regulations
      const consolidationPrompt = `All ${chunkResult.chunks.length} chunks of the contract have been analyzed.

${contractContext}

Now do the final consolidation:
1. Use get_required_clauses for contract type "${body.contractType}" — check which required clauses are missing
2. Use get_stamp_duty for state "${body.state}", document type "${body.contractType}"${body.contractValue ? `, value ${body.contractValue}` : ""}
3. Use get_applicable_regulations to check regulatory compliance
4. Use get_contract_limitations to include the analysis disclaimer
5. Provide: overall risk score (0-100), grade (A-F), and executive summary

Present the consolidated findings.`;

      startAgentTurn(session.id, consolidationPrompt, getSession(session.id)?.sdkSessionId);
    };

    analyzeChunks();
  }

  return c.json({ sessionId: session.id, status: "created" }, 201);
});

// POST /:id/message
app.post("/:id/message", async (c) => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  const body = await c.req.json<{ message: string }>();
  addMessage(id, "user", body.message);
  const prompt = resolveSlashCommand(body.message);
  startAgentTurn(id, prompt, session.sdkSessionId);
  return c.json({ status: "processing" });
});

// GET /:id/stream — SSE
app.get("/:id/stream", (c) => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) return c.json({ error: "Session not found" }, 404);

  return streamSSE(c, async (stream) => {
    let eventId = 0;
    for (const msg of session.messages) {
      await stream.writeSSE({ event: "history", data: JSON.stringify(msg), id: String(eventId++) });
    }
    while (true) {
      const events = drainEvents(id);
      for (const event of events) {
        try {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event), id: String(eventId++) });
        } catch { return; }
      }
      await stream.sleep(100);
    }
  });
});

// GET /:id
app.get("/:id", (c) => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json(session);
});

export { app as sessionRoutes };
```

- [ ] **Step 3: Create server entry point**

Create `server/index.ts`:

```typescript
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { uploadRoutes } from "./routes/upload.js";
import { sessionRoutes } from "./routes/sessions.js";

const app = new Hono();

app.use("/api/*", cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

app.route("/api/upload", uploadRoutes);
app.route("/api/sessions", sessionRoutes);
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

const port = Number(process.env.PORT) || 4101;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Legal Contract Agent API server running on http://localhost:${port}`);
});
```

- [ ] **Step 4: Verify typecheck + test health endpoint**

```bash
npx tsc --noEmit
npx tsx server/index.ts &
sleep 2
curl http://localhost:4101/api/health
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add server/agent-bridge.ts server/routes/sessions.ts server/index.ts
git commit -m "feat: add Hono server with agent bridge, session routes, SSE streaming, and chunked analysis"
```

---

## Task 4: Frontend — Scaffold + App Shell

**Files:**
- Create: `implementation/legal-contract-agent/web/` (package.json, vite.config.ts, tsconfig.json, index.html, src/main.tsx, src/App.tsx, src/types.ts, src/index.css)

- [ ] **Step 1: Create web/package.json**

```json
{
  "name": "legal-contract-agent-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-markdown": "^10.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.4",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.1",
    "tailwindcss": "^4.1.4",
    "typescript": "^5.8.3",
    "vite": "^6.3.2"
  }
}
```

- [ ] **Step 2: Create web/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4101" },
  },
});
```

- [ ] **Step 3: Create web/tsconfig.json, index.html, src/index.css, src/main.tsx**

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contract Review Copilot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/src/index.css`:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

.prose table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0.75rem 0; }
.prose thead { border-bottom: 2px solid #e5e7eb; }
.prose th { text-align: left; padding: 0.375rem 0.625rem; font-weight: 600; color: #374151; }
.prose td { padding: 0.375rem 0.625rem; border-bottom: 1px solid #f3f4f6; }
.prose tbody tr:hover { background-color: #f9fafb; }
```

`web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

- [ ] **Step 4: Create web/src/types.ts**

```typescript
export type AppPhase = "upload" | "details" | "processing" | "chat";

export interface UploadResult {
  fileId: string;
  fileName: string;
  pageCount: number;
  wordCount: number;
  clauses: Array<{ number: string; title: string; pageStart: number; pageEnd: number }>;
  chunks: number;
  isSinglePass: boolean;
  estimatedTimeSeconds: number;
}

export interface ContractDetails {
  fileId: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  state: string;
  contractValue?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
}

export interface Finding {
  severity: string;
  clause: string;
  title: string;
  summary: string;
}

export interface ChunkProgress {
  current: number;
  total: number;
  label: string;
  status: "analyzing" | "done";
}

export interface RiskSummary {
  score: number;
  grade: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ToolCallEvent {
  tool: string;
  display: string;
  status: "running" | "done";
}
```

- [ ] **Step 5: Create web/src/App.tsx**

```tsx
import { useState, useCallback, useRef } from "react";
import type { AppPhase, UploadResult, ContractDetails, ChatMessage, Finding, ChunkProgress, RiskSummary, ToolCallEvent } from "./types";
import FileUpload from "./components/FileUpload";
import ContractDetailsForm from "./components/ContractDetails";
import ProcessingView from "./components/ProcessingView";
import RiskSummaryCard from "./components/RiskSummary";
import SessionHeader from "./components/SessionHeader";
import Chat from "./components/Chat";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("upload");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [contractDetails, setContractDetails] = useState<ContractDetails | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [activeTools, setActiveTools] = useState<ToolCallEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentMsgIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connectSSE = useCallback((id: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`/api/sessions/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("structure", (e) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: "system",
        content: `Document: ${data.totalPages} pages, ${data.totalClauses} clauses → ${data.chunks} chunks. Estimated time: ${data.estimatedTime}`,
        timestamp: new Date().toISOString(),
      }]);
    });

    es.addEventListener("chunk_progress", (e) => {
      setChunkProgress(JSON.parse(e.data));
    });

    es.addEventListener("finding", (e) => {
      const f = JSON.parse(e.data);
      setFindings((prev) => [...prev, f]);
    });

    es.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      setIsProcessing(true);
      setActiveTools((prev) => [...prev, { tool: data.tool, display: data.toolLabel ?? data.tool, status: "running" }]);
    });

    es.addEventListener("text", (e) => {
      const data = JSON.parse(e.data);
      const newText = data.text ?? "";
      if (!newText) return;
      setActiveTools([]);
      const msgId = currentMsgIdRef.current;
      if (msgId) {
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: m.content + newText } : m));
      } else {
        const newId = crypto.randomUUID();
        currentMsgIdRef.current = newId;
        setMessages((prev) => [...prev, { id: newId, role: "agent" as const, content: newText, timestamp: new Date().toISOString() }]);
      }
      if (phase === "processing") setPhase("chat");
    });

    es.addEventListener("risk_summary", (e) => {
      setRiskSummary(JSON.parse(e.data));
    });

    es.addEventListener("done", () => {
      setActiveTools([]);
      setIsProcessing(false);
      currentMsgIdRef.current = null;
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "system", content: `Error: ${data.error ?? "Unknown"}`, timestamp: new Date().toISOString() }]);
      }
      setActiveTools([]);
      setIsProcessing(false);
    });

    es.addEventListener("history", (e) => {
      const msg = JSON.parse(e.data);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: msg.role ?? "system", content: msg.content, timestamp: new Date().toISOString() }]);
    });

    return es;
  }, [phase]);

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
    setPhase("details");
  };

  const handleDetailsSubmit = async (details: ContractDetails) => {
    setContractDetails(details);
    setPhase("processing");
    setIsProcessing(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const { sessionId: id } = await res.json();
      setSessionId(id);
      localStorage.setItem("lc_sessionId", id);
      localStorage.setItem("lc_uploadResult", JSON.stringify(uploadResult));
      localStorage.setItem("lc_contractDetails", JSON.stringify(details));
      connectSSE(id);
    } catch (err) {
      setPhase("details");
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;
    currentMsgIdRef.current = null;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content, timestamp: new Date().toISOString() }]);
    setIsProcessing(true);
    try {
      await fetch(`/api/sessions/${sessionId}/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content }) });
    } catch { setIsProcessing(false); }
  };

  const handleNewSession = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    localStorage.removeItem("lc_sessionId");
    localStorage.removeItem("lc_uploadResult");
    localStorage.removeItem("lc_contractDetails");
    setPhase("upload");
    setUploadResult(null);
    setContractDetails(null);
    setSessionId(null);
    setMessages([]);
    setFindings([]);
    setChunkProgress(null);
    setRiskSummary(null);
    setActiveTools([]);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Contract Review Copilot</h1>
            <p className="text-sm text-gray-500">Indian Law Risk Analysis</p>
          </div>
          {(phase === "processing" || phase === "chat") && (
            <button onClick={handleNewSession} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100">New Analysis</button>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {phase === "upload" && <FileUpload onUploadComplete={handleUploadComplete} />}
        {phase === "details" && uploadResult && <ContractDetailsForm uploadResult={uploadResult} onSubmit={handleDetailsSubmit} />}
        {phase === "processing" && (
          <ProcessingView chunkProgress={chunkProgress} findings={findings} activeTools={activeTools} messages={messages} />
        )}
        {phase === "chat" && contractDetails && (
          <>
            <SessionHeader uploadResult={uploadResult} details={contractDetails} />
            {riskSummary && <RiskSummaryCard summary={riskSummary} />}
            <Chat messages={messages} activeTools={activeTools} isProcessing={isProcessing} onSendMessage={handleSendMessage} />
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Install frontend deps**

```bash
cd web && npm install && npm install @tailwindcss/typography && cd ..
```

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: add frontend scaffold — Vite+React+Tailwind with App shell and types"
```

---

## Task 5: Frontend — Upload + Contract Details Components

**Files:**
- Create: `web/src/components/FileUpload.tsx`
- Create: `web/src/components/ContractDetails.tsx`

- [ ] **Step 1: Create FileUpload.tsx**

A drag & drop component that uploads the PDF, shows page/word count after processing.

- [ ] **Step 2: Create ContractDetails.tsx**

Form with counterparty, role chips, type chips, state dropdown, value input, and "Start Analysis" button.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/FileUpload.tsx web/src/components/ContractDetails.tsx
git commit -m "feat: add FileUpload and ContractDetails components"
```

---

## Task 6: Frontend — Processing View + Chat Components

**Files:**
- Create: `web/src/components/ProcessingView.tsx`
- Create: `web/src/components/FindingCard.tsx`
- Create: `web/src/components/RiskSummary.tsx`
- Create: `web/src/components/Chat.tsx`
- Create: `web/src/components/MessageBubble.tsx`
- Create: `web/src/components/QuickActions.tsx`
- Create: `web/src/components/SessionHeader.tsx`

- [ ] **Step 1: Create ProcessingView.tsx** — chunk progress bar + streaming finding cards
- [ ] **Step 2: Create FindingCard.tsx** — severity badge + clause ref + summary
- [ ] **Step 3: Create RiskSummary.tsx** — score card (73/100, Grade D)
- [ ] **Step 4: Create Chat.tsx, MessageBubble.tsx, QuickActions.tsx, SessionHeader.tsx** — same pattern as real estate agent but with contract-specific quick actions (/risks, /playbook, /redline, /stamp-duty, /checklist, /dossier)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/
git commit -m "feat: add ProcessingView, FindingCard, RiskSummary, Chat components"
```

---

## Task 7: End-to-End Integration Test

- [ ] **Step 1: Start both servers**

```bash
cd implementation/legal-contract-agent
npm run dev
```

- [ ] **Step 2: Test upload flow**

Open `http://localhost:5173`. Upload a test PDF. Verify page count and word count appear.

- [ ] **Step 3: Test contract details → processing → chat**

Fill details, click "Start Analysis". Verify chunk progress bar, streaming findings, then chat opens with risk summary.

- [ ] **Step 4: Test chat interaction**

Send a message, verify response streams. Test quick action buttons (/risks, /playbook).

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: complete legal contract agent web UI — upload, chunking, progressive findings, chat"
git push
```
