# Deep Agent for Legal/Contract Intelligence (India) — Research Document

## Overview

This document outlines how to build a **Legal/Contract Intelligence Agent** using the **Claude Agent SDK**. The agent reviews contracts holistically — reading dense legal paragraphs the way a lawyer would — flags risks against Indian law, explains them in plain language for business teams, generates redlined alternatives, and produces negotiation playbooks. It maintains a Legal Knowledge Base of Indian statutes, clause risk patterns, and state-wise stamp duty requirements in PostgreSQL with pgvector, enabling semantic search against the actual contract text. Every analysis is versioned, so when the counterparty sends v2 after negotiation, the agent diffs it against v1 and shows exactly what improved, what worsened, and what they didn't change. What currently requires a junior lawyer spending 2-4 hours per contract — reading, cross-referencing, flagging, drafting response — becomes a 5-minute upload-and-review with Indian-law-specific intelligence that most lawyers don't carry in their heads (like state-wise stamp duty rates or which non-compete clauses are void under Section 27).

**Target users:** Business teams (founders, procurement, HR, sales managers) who deal with contracts daily but lack legal expertise. Secondary: in-house legal teams at mid-size Indian companies.

**Target customers:** Indian SaaS companies, startups raising funding (reviewing SHA/SSA), IT services companies (reviewing MSAs), mid-size businesses with procurement teams, HR departments handling employment contracts, and legal-tech companies building contract review products.

---

## 1. Why This Agent Is Needed

### The Problem

Indian businesses sign contracts they don't fully understand:

| Pain Point | Detail |
|------------|--------|
| **Non-lawyers signing legal documents** | Founders sign investor agreements, procurement managers sign vendor MSAs, HR sends offer letters — none of them are lawyers. They read the commercial terms and skip the legal clauses. |
| **Indian law has unique traps** | Non-compete clauses are void (Section 27, Indian Contract Act). Unstamped agreements are inadmissible as evidence. Unregistered leases > 12 months are unenforceable. Most business people don't know this. |
| **Lawyer review is expensive and slow** | External counsel charges ₹15K-50K per contract review. In-house counsel (if they exist) is a bottleneck — 50+ contracts in queue, 3-5 day turnaround. Business can't wait. |
| **Template contracts from foreign counterparties** | US/UK companies send their standard templates to Indian subsidiaries/vendors. These contain clauses that are void, unenforceable, or illegal under Indian law — but nobody catches them. |
| **Stamp duty is a minefield** | Every state has different stamp duty rates for different document types. An agreement executed on ₹100 stamp paper in Maharashtra when it should be on ₹5,000 is inadmissible in court. Nobody checks this until litigation. |
| **Negotiation is one-sided** | When a startup receives an enterprise MSA, they sign as-is because they don't know what's negotiable. An indemnity clause with unlimited liability? They don't know that's unusual and can be capped. |
| **No institutional memory** | The company signed 200 contracts over 5 years. Nobody knows what obligations are in them, when they renew, what notice periods apply. |
| **New regulations keep changing** | DPDPA 2023 (data protection), Labor Codes 2020 (replacing 29 old laws), and IT Act amendments create new compliance requirements that existing contracts don't address. |
| **Regional language contracts** | Rental agreements in Marathi, government contracts in Hindi, sale deeds in regional languages — need OCR + legal understanding in local languages. |

### What Existing Tools Do vs. What This Agent Does

| Capability | Existing Tools (DocuSign, Ironclad, SpotDraft) | This Agent |
|-----------|------------------------------------------------|------------|
| Contract storage | ✅ Repository | ✅ Repository + version history + analysis per version |
| Clause extraction | ✅ Generic NLP extraction | ✅ Claude reads holistically — understands cross-references, conditions, nested exceptions |
| Risk flagging | ✅ Generic patterns (indemnity, termination) | ✅ Indian-law-specific: "This non-compete is VOID under Section 27" not just "non-compete detected" |
| Stamp duty check | ❌ Not addressed | ✅ State-wise stamp duty calculation with penalty warnings |
| DPDPA compliance | ❌ Not addressed | ✅ Checks for data protection clauses, consent requirements, cross-border transfer restrictions |
| Plain language explanation | ⚠️ Legal jargon output | ✅ "This means if their software causes a ₹1Cr loss to your client, YOU pay — not them. That's unusual." |
| Negotiation support | ❌ Not addressed | ✅ Redlined version + playbook: "Push back on unlimited indemnity. Industry standard is 1× annual contract value." |
| Version comparison | ⚠️ Text diff only | ✅ Legal-aware diff: "Indemnity cap added ✅ but they also added an auto-renewal clause 🔴" |
| Regional language support | ❌ English only | ✅ Sarvam AI OCR for Hindi, Marathi, Gujarati, Tamil contracts |
| Indian law KB | ❌ US/UK law focus | ✅ Indian Contract Act, DPDPA, Labor Codes, Stamp Act, FEMA, Companies Act — all searchable via pgvector |

### Why Claude Agent SDK

The Agent SDK is ideal because contract review requires:
- **Holistic document understanding** — Claude reads full contracts as unstructured text, understanding cross-references, conditions within conditions, and implications that span multiple clauses
- **Multi-model orchestration** — Opus for complex negotiation strategy and cross-clause reasoning, Sonnet for clause analysis and risk assessment, Haiku for classification and quick lookups
- **MCP tool architecture** — Legal KB, document parsing, and contract repository as separate MCP servers that can be updated independently
- **Agentic workflow** — the agent makes decisions: which clauses to flag, what risk level to assign, what alternative to suggest, whether two clauses contradict each other
- **Human-in-the-loop** — agent flags and recommends, human decides. Never auto-approves or provides definitive legal advice
- **Knowledge base integration** — Indian law statutes, clause patterns, and stamp duty rates stored as structured + vector data that the agent reasons over

---

## 2. Architecture

### High-Level Design

```
                    ┌───────────────────────────────────────┐
                    │   Legal/Contract Intelligence Agent     │
                    │        (Orchestrator)                   │
                    │                                        │
                    │   Claude Agent SDK + 3 MCP Servers     │
                    └──────────────┬────────────────────────┘
                                   │
         ┌───────────┬─────────────┼─────────────┬────────────┐
         │           │             │             │            │
   ┌─────▼─────┐ ┌──▼──────┐ ┌───▼────┐ ┌──────▼─────┐ ┌───▼────────┐
   │ Document  │ │ Legal   │ │ Negot- │ │ Stamp Duty │ │ Report     │
   │ Reader    │ │ Risk    │ │ iation │ │ & Execution│ │ Generator  │
   │ Engine    │ │ Analyzer│ │ Engine │ │ Advisor    │ │            │
   └─────┬─────┘ └──┬──────┘ └───┬────┘ └──────┬─────┘ └───┬────────┘
         │           │            │             │            │
   ┌─────▼───────────▼────────────▼─────────────▼────────────▼──┐
   │                    3 MCP Servers                            │
   │                                                             │
   │  document-mcp          legal-kb-mcp        contract-mcp    │
   │  (DocProof for         (Indian law KB      (Contract repo, │
   │   PDF parsing,         in PostgreSQL +     version history,│
   │   Sarvam AI for        pgvector —          clause library, │
   │   regional OCR,        statutes, rules,    analysis store, │
   │   text extraction)     precedents,         diff tracking)  │
   │                        clause patterns,                     │
   │                        stamp duty matrix)                   │
   └────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Purpose | MCP Server |
|-----------|---------|------------|
| **Document Reader Engine** | Converts uploaded PDF/DOCX to clean text via DocProof. For regional language contracts (Hindi, Marathi, Gujarati), uses Sarvam AI for OCR. Handles scanned docs, multi-column layouts, stamp paper headers. Output: clean, ordered text ready for Claude to read. | `document-mcp` |
| **Legal Risk Analyzer** | Claude reads the full document holistically — understanding structure, cross-references, conditions, and obligations. For each identified risk, queries the Legal KB via vector search to find relevant Indian law provisions. Rates severity. Checks for missing clauses that SHOULD be present. | `legal-kb-mcp` |
| **Negotiation Engine** | For flagged clauses, generates alternative language that's commercially reasonable and legally sound under Indian law. Produces a redlined version and a negotiation playbook with talking points per clause. | `legal-kb-mcp` + `contract-mcp` |
| **Stamp Duty & Execution Advisor** | Checks stamp duty requirements by state and document type. Advises on execution formalities — e-stamping availability, notarization requirements, registration obligations (e.g., leases > 12 months). Calculates penalty for under-stamped documents. | `legal-kb-mcp` |
| **Report Generator** | Produces output scaled to user's expertise — executive summary (3 sentences for founders), risk scorecard (for procurement), and detailed clause-by-clause analysis (for legal teams). Generates version diffs for negotiation rounds. | `contract-mcp` |

### End-to-End Analysis Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTRACT ANALYSIS LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. UPLOAD              2. PARSE                3. READ & UNDERSTAND    │
│  ┌──────────────┐      ┌──────────────────┐    ┌──────────────────┐   │
│  │ User uploads │      │ DocProof extracts│    │ Claude reads the │   │
│  │ PDF, DOCX,   │─────>│ clean text.      │───>│ FULL document    │   │
│  │ or scanned   │      │ Sarvam AI for    │    │ holistically:    │   │
│  │ image        │      │ regional langs.  │    │                  │   │
│  │              │      │ Preserves page/  │    │ • Document type  │   │
│  │ Metadata:    │      │ section structure│    │ • Parties & roles│   │
│  │ • Counterparty│     │                  │    │ • Defined terms  │   │
│  │ • Contract type│    │ Output: clean    │    │ • Obligations    │   │
│  │ • Our role    │     │ ordered text     │    │ • Rights         │   │
│  └──────────────┘      └──────────────────┘    │ • Conditions     │   │
│                                                 │ • Cross-refs     │   │
│                                                 │ • Schedules      │   │
│                                                 └────────┬─────────┘   │
│                                                          │              │
│  4. RISK ANALYSIS           5. CROSS-CLAUSE CHECK                       │
│  ┌──────────────────┐      ┌──────────────────────────┐                │
│  │ For each risk:   │      │ Check interactions:      │                │
│  │                  │      │                          │                │
│  │ • Query Legal KB │      │ • Indemnity vs liability │                │
│  │   (pgvector) for │      │   cap — do they          │                │
│  │   relevant Indian│      │   contradict?            │                │
│  │   law provisions │      │ • Termination vs notice  │                │
│  │ • Match against  │      │   period consistency     │                │
│  │   clause patterns│      │ • Non-compete vs garden  │                │
│  │ • Check stamp    │      │   leave clause           │                │
│  │   duty matrix    │      │ • IP assignment vs       │                │
│  │ • Rate severity  │      │   confidentiality scope  │                │
│  │   (Critical/High/│      │ • Payment terms vs       │                │
│  │    Medium/Low/OK)│      │   penalty clauses        │                │
│  └──────────────────┘      └──────────────────────────┘                │
│                                                                         │
│  6. MISSING CLAUSE CHECK    7. GENERATE OUTPUT                          │
│  ┌──────────────────┐      ┌──────────────────────────┐                │
│  │ What SHOULD be   │      │ Based on autonomy level: │                │
│  │ there but isn't? │      │                          │                │
│  │                  │      │ L1: Risk report only     │                │
│  │ • No data        │      │                          │                │
│  │   protection     │      │ L2: + Redlined version   │                │
│  │   clause (DPDPA) │      │   + Negotiation playbook │                │
│  │ • No governing   │      │   + Version diff (if v2+)│                │
│  │   law clause     │      │                          │                │
│  │ • No liability   │      │ L3: + Milestone alerts   │                │
│  │   cap            │      │   + Regulatory monitoring │                │
│  │ • No force       │      │                          │                │
│  │   majeure        │      │ ALL: Disclaimer that     │                │
│  │ • No IP clause   │      │ this is not legal advice │                │
│  │   in freelancer  │      │                          │                │
│  │   agreement      │      └──────────────────────────┘                │
│  └──────────────────┘                                                   │
│                                                                         │
│  8. VERSION TRACKING (ongoing)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ User uploads v2 → Agent diffs against v1 analysis:               │   │
│  │ • Clauses improved (risk removed/reduced)                        │   │
│  │ • Clauses worsened (new risk added)                              │   │
│  │ • NEW clauses not in v1 (needs fresh analysis)                   │   │
│  │ • Unresolved flags (what we flagged but they didn't change)      │   │
│  │ • Risk score trend (72 → 45 → 18 over 3 rounds)                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tiered Autonomy Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMY LEVELS                               │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 1  │  Agent: Analyze & Flag                                │
│ (Default)│  ──────────────────────────────────────────          │
│          │  Agent reads contract, identifies risks, generates    │
│          │  report. ALL outputs are read-only analysis.          │
│          │  No redline generation. No negotiation playbook.      │
│          │  User must manually decide what to negotiate.         │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 2  │  Agent: Analyze + Advise                              │
│ (Proven) │  ──────────────────────────────────────────          │
│          │  Everything in L1, plus: generates redlined version   │
│          │  with suggested changes, produces negotiation         │
│          │  playbook with talking points per clause, auto-       │
│          │  generates version diffs when new version uploaded.   │
│          │  Human approval for: sharing redline externally,      │
│          │  accepting any clause as-is despite risk flag.        │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 3  │  Agent: Full Copilot                                   │
│ (Full    │  ──────────────────────────────────────────          │
│  trust)  │  Everything in L2, plus: proactively monitors         │
│          │  contract milestones (renewal dates, notice periods), │
│          │  alerts on regulatory changes affecting existing      │
│          │  contracts, suggests template clauses from library.   │
│          │  Human approval for: any communication with           │
│          │  counterparty, final sign-off recommendations.        │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ ALL      │  ⛔ NEVER AUTO-EXECUTED (regardless of level)          │
│ LEVELS   │  - Providing definitive legal advice ("you should     │
│          │    sign this") — always frames as analysis, not advice│
│          │  - Sending contract or redlines to counterparty       │
│          │  - Approving or signing any contract                  │
│          │  - Modifying the Legal KB (statute updates need       │
│          │    legal team review)                                 │
│          │  - Overriding a critical risk flag                    │
│          │  - Sharing contract with third parties                │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Disclaimer behavior:** Every analysis output MUST include:
> "This analysis is AI-assisted and does not constitute legal advice. For critical contracts, high-value transactions, or disputes, consult a qualified Indian lawyer."

The agent is confident on clear-cut violations (Section 27 non-compete = void) but cautious on judgment calls (is this indemnity "reasonable"?). For gray areas: "this clause may be problematic — recommend legal review."

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Models:
  Orchestration: claude-opus-4-6 (cross-clause reasoning, negotiation strategy, complex risk assessment)
                 claude-sonnet-4-6 (document reading, clause analysis, redline generation, reports)
                 claude-haiku-4-5 (clause classification, quick lookups, stamp duty calculations)
MCP Servers:     3 custom — document-mcp, legal-kb-mcp, contract-mcp
Document Parse:  DocProof (PDF/DOCX → clean text extraction)
Regional OCR:    Sarvam AI (Hindi, Marathi, Gujarati, Tamil contract OCR)
Storage:         PostgreSQL + pgvector (Legal KB, contract analyses, clause patterns)
File Storage:    S3 (contract PDFs, generated reports, redlined versions)
Embeddings:      text-embedding-3-small (1536 dimensions) for Legal KB vector search
Frontend:        React web app — upload, review, track
API:             REST API for programmatic access and future integrations
Config:          JSON files (clause pattern library, stamp duty matrix, risk thresholds)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install pg                           # PostgreSQL
npm install pgvector                     # pgvector support
npm install zod                          # Schema validation
npm install dayjs                        # Date handling
npm install winston                      # Structured logging
npm install axios                        # HTTP client for DocProof/Sarvam APIs
npm install diff                         # Text diffing for version comparison
npm install pdf-lib                      # PDF manipulation for redlines
npm install mammoth                      # DOCX → HTML → text extraction
npm install openai                       # Embeddings API (text-embedding-3-small)
npm install bullmq ioredis               # Job queue for async processing
```

---

## 4. Legal Knowledge Base (PostgreSQL + pgvector)

### 4.1 Architecture — Three Layers

The Legal KB is the agent's "legal education" — what makes it Indian-law-aware rather than a generic contract reviewer.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEGAL KNOWLEDGE BASE — 3 LAYERS                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYER 1: STATUTES & RULES                                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ The actual law text — sections, sub-sections, provisos.          │   │
│  │ Updated when Parliament amends an act or govt issues new rules.  │   │
│  │                                                                  │   │
│  │ Examples:                                                        │   │
│  │ • Indian Contract Act 1872, Section 27 (restraint of trade)     │   │
│  │ • DPDPA 2023, Section 8 (grounds for processing personal data)  │   │
│  │ • Labor Code on Wages 2019, Section 17 (permissible deductions) │   │
│  │ • Arbitration Act 1996, Section 7 (what constitutes agreement)  │   │
│  │ • Indian Stamp Act 1899, Section 35 (inadmissibility)           │   │
│  │ • FEMA 1999, Section 6 (capital account transactions)           │   │
│  │                                                                  │   │
│  │ ~500-800 sections across 15-20 acts relevant to contracts        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  LAYER 2: CLAUSE PATTERNS                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Known risky/problematic clause patterns mapped to the laws they  │   │
│  │ violate. This is the agent's "experience" — what a senior        │   │
│  │ Indian corporate lawyer knows from reviewing 1000+ contracts.    │   │
│  │                                                                  │   │
│  │ Examples:                                                        │   │
│  │ • "Post-termination non-compete > 0 months" → VOID, Section 27  │   │
│  │ • "Unilateral termination without cause or notice" → Risky       │   │
│  │ • "Unlimited indemnity / hold harmless" → Flag, negotiate cap    │   │
│  │ • "Foreign governing law for India-India contract" → Impractical │   │
│  │ • "No data protection clause in SaaS agreement" → DPDPA gap     │   │
│  │ • "Auto-renewal without notice period" → Trap clause             │   │
│  │ • "IP vests with client for all work" → Check if too broad       │   │
│  │ • "Garden leave with non-compete" → May be enforceable           │   │
│  │                                                                  │   │
│  │ ~200-400 patterns across 25+ clause categories                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  LAYER 3: STAMP DUTY MATRIX                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ State-wise stamp duty rates for different document types.         │   │
│  │ Updated when state governments revise rates (typically annually). │   │
│  │                                                                  │   │
│  │ Examples:                                                        │   │
│  │ • Maharashtra, Service Agreement: 0.1% of value, max ₹25L       │   │
│  │ • Karnataka, Lease (< 10 yrs): 1% of total rent                 │   │
│  │ • Delhi, NDA: ₹100 fixed                                        │   │
│  │ • Tamil Nadu, Employment Agreement: ₹1 per ₹1000                │   │
│  │ • Gujarat, Partnership Deed: ₹500 fixed                         │   │
│  │                                                                  │   │
│  │ ~30 states × ~20 document types = ~600 entries                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Database Schema

```sql
CREATE EXTENSION vector;

-- ============================================================
-- LAYER 1: Indian Statutes & Rules
-- ============================================================
CREATE TABLE legal_statutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    act_name VARCHAR(255) NOT NULL,          -- "Indian Contract Act"
    act_year INTEGER NOT NULL,               -- 1872
    chapter VARCHAR(100),                    -- "Chapter II — Of Contracts Void or Voidable"
    section_number VARCHAR(20) NOT NULL,     -- "27"
    section_title VARCHAR(255),              -- "Agreement in restraint of trade void"
    full_text TEXT NOT NULL,                 -- Full text of the section including provisos/explanations
    embedding vector(1536),                  -- text-embedding-3-small
    effective_date DATE,
    amended_date DATE,                       -- Last amendment date
    amendment_notes TEXT,                    -- What changed in last amendment
    status VARCHAR(20) DEFAULT 'active',     -- active | repealed | superseded
    superseded_by UUID REFERENCES legal_statutes(id),
    tags TEXT[],                              -- ['contract', 'employment', 'non-compete', 'void']
    relevance_to_contracts TEXT,             -- Plain language: how this section affects contracts
    source_url TEXT,                         -- Link to India Code / Gazette
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key landmark judicial interpretations
CREATE TABLE legal_precedents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_name VARCHAR(500) NOT NULL,         -- "Niranjan Shankar Golikari v Century Spinning (1967)"
    court VARCHAR(100) NOT NULL,             -- "Supreme Court of India"
    year INTEGER NOT NULL,
    citation VARCHAR(255),                   -- "AIR 1967 SC 1098"
    statute_id UUID REFERENCES legal_statutes(id),
    section_interpreted VARCHAR(20),         -- "Section 27"
    key_principle TEXT NOT NULL,             -- Plain language summary of what was held
    relevance_to_contracts TEXT,             -- How this affects contract review
    embedding vector(1536),
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LAYER 2: Clause Risk Patterns
-- ============================================================
CREATE TABLE clause_categories (
    id VARCHAR(50) PRIMARY KEY,              -- 'non_compete', 'indemnity', 'termination', etc.
    display_name VARCHAR(100) NOT NULL,      -- "Non-Compete / Restraint of Trade"
    description TEXT,
    typical_location TEXT                     -- "Usually in Section 8-12 of employment agreements"
);

CREATE TABLE clause_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(50) REFERENCES clause_categories(id),
    pattern_name VARCHAR(255) NOT NULL,      -- "Post-termination non-compete (any duration)"
    risk_level VARCHAR(10) NOT NULL,         -- critical | high | medium | low
    risk_description TEXT NOT NULL,          -- Plain language: what's wrong
    risk_description_business TEXT NOT NULL, -- Even plainer: for non-lawyers
    applicable_statute_ids UUID[],           -- References legal_statutes (no FK constraint on arrays — enforce in application layer)
    applicable_contract_types TEXT[],        -- ['employment', 'freelancer', 'msa']
    example_risky_text TEXT NOT NULL,        -- Sample clause text that triggers this pattern
    suggested_alternative TEXT,              -- Replacement clause language
    negotiation_talking_point TEXT,          -- What to say to counterparty
    when_acceptable TEXT,                    -- Edge cases where this might be OK
    embedding vector(1536),                  -- Embedding of example_risky_text
    created_by VARCHAR(100),
    last_reviewed DATE,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- What clauses SHOULD exist in each contract type
CREATE TABLE required_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_type VARCHAR(50) NOT NULL,      -- 'nda', 'msa', 'employment', 'lease', etc.
    clause_category_id VARCHAR(50) REFERENCES clause_categories(id),
    requirement_level VARCHAR(20) NOT NULL,  -- 'mandatory' | 'recommended' | 'conditional'
    condition TEXT,                           -- When conditional: "If SaaS product handles PII"
    reason TEXT NOT NULL,                    -- Why this clause should exist
    applicable_law TEXT,                     -- Which law requires it
    template_text TEXT,                      -- Default clause text if missing
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LAYER 3: Stamp Duty Matrix
-- ============================================================
CREATE TABLE stamp_duty_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(50) NOT NULL,              -- "Maharashtra", "Karnataka", "Delhi"
    document_type VARCHAR(100) NOT NULL,     -- "Service Agreement", "Lease", "NDA"
    duty_type VARCHAR(20) NOT NULL,          -- "fixed" | "percentage" | "ad_valorem"
    duty_amount_fixed DECIMAL,               -- ₹ amount if fixed
    duty_rate_percentage DECIMAL,            -- % if percentage-based
    duty_base TEXT,                           -- "contract value" | "annual rent" | "consideration"
    max_cap DECIMAL,                         -- Maximum duty amount (if capped)
    min_amount DECIMAL,                      -- Minimum duty amount
    e_stamping_available BOOLEAN DEFAULT false,
    e_stamping_url TEXT,                     -- State e-stamping portal URL
    registration_required BOOLEAN DEFAULT false,
    registration_condition TEXT,             -- "If lease period > 12 months"
    penalty_for_deficiency TEXT,             -- "2% per month, max 4× duty amount"
    effective_date DATE NOT NULL,
    expiry_date DATE,                        -- When this rate was superseded
    gazette_notification TEXT,               -- Reference to state gazette notification
    notes TEXT,
    UNIQUE(state, document_type, effective_date)
);

-- ============================================================
-- VECTOR INDEXES
-- ============================================================
-- Note: IVFFlat lists should be ~sqrt(rows). Start low, increase as KB grows.
-- Alternative: use HNSW indexes which don't require training on row count.
CREATE INDEX idx_statutes_embedding ON legal_statutes
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
CREATE INDEX idx_patterns_embedding ON clause_patterns
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 15);
CREATE INDEX idx_precedents_embedding ON legal_precedents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Full-text search indexes (for keyword + vector hybrid search)
CREATE INDEX idx_statutes_fulltext ON legal_statutes USING GIN (to_tsvector('english', full_text));
CREATE INDEX idx_patterns_fulltext ON clause_patterns USING GIN (to_tsvector('english', example_risky_text));

-- Lookup indexes
CREATE INDEX idx_statutes_act ON legal_statutes(act_name, section_number);
CREATE INDEX idx_statutes_tags ON legal_statutes USING GIN (tags);
CREATE INDEX idx_patterns_category ON clause_patterns(category_id, risk_level);
CREATE INDEX idx_patterns_contract_types ON clause_patterns USING GIN (applicable_contract_types);
CREATE INDEX idx_stamp_duty_lookup ON stamp_duty_matrix(state, document_type) WHERE expiry_date IS NULL;
CREATE INDEX idx_required_clauses_type ON required_clauses(contract_type);
```

### 4.3 How Vector Search Powers the Analysis

```typescript
// When the agent identifies a potentially risky clause in the contract,
// it searches the Legal KB to find relevant law and known patterns.

async function analyzeClauseAgainstLegalKB(clauseText: string, contractType: string) {
  // 1. Generate embedding for the clause
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: clauseText,
  });
  const vector = embedding.data[0].embedding;

  // 2. Search clause patterns (Layer 2) — "have we seen this before?"
  const matchedPatterns = await db.query(`
    SELECT *, 1 - (embedding <=> $1::vector) AS similarity
    FROM clause_patterns
    WHERE $2 = ANY(applicable_contract_types) OR applicable_contract_types = '{}'
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [JSON.stringify(vector), contractType]);

  // 3. Search statutes (Layer 1) — "what does Indian law say?"
  const relevantStatutes = await db.query(`
    SELECT *, 1 - (embedding <=> $1::vector) AS similarity
    FROM legal_statutes
    WHERE status = 'active'
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [JSON.stringify(vector)]);

  // 4. Search precedents — "what have Indian courts said?"
  const relevantPrecedents = await db.query(`
    SELECT *, 1 - (embedding <=> $1::vector) AS similarity
    FROM legal_precedents
    ORDER BY embedding <=> $1::vector
    LIMIT 3
  `, [JSON.stringify(vector)]);

  // 5. Hybrid: also do keyword search for specific legal terms
  const keywordStatutes = await db.query(`
    SELECT * FROM legal_statutes
    WHERE to_tsvector('english', full_text) @@ plainto_tsquery('english', $1)
    AND status = 'active'
    LIMIT 5
  `, [extractLegalKeywords(clauseText)]);

  // 6. Merge and deduplicate results
  return {
    matched_patterns: matchedPatterns.rows.filter(r => r.similarity > 0.7),
    relevant_statutes: dedup([...relevantStatutes.rows, ...keywordStatutes.rows]),
    relevant_precedents: relevantPrecedents.rows.filter(r => r.similarity > 0.65),
  };
}
```

### 4.4 Seeding the Knowledge Base

The KB needs to be populated before the agent is useful. Sources:

| Layer | Source | Volume | How to Seed |
|-------|--------|--------|-------------|
| **Statutes** | India Code (indiacode.nic.in) — all central acts | ~500-800 relevant sections across ~20 acts | Parse HTML from India Code website, extract section-wise text, generate embeddings |
| **Statutes** | State amendments and rules | ~100-200 additional entries | Manual curation from state gazette notifications |
| **Precedents** | Indian Kanoon (indiankanoon.org) — landmark cases | ~100-200 key judgments on contract law | Curate top SC/HC judgments on non-compete, indemnity, arbitration, stamp duty |
| **Clause patterns** | Legal team curation | ~200-400 patterns | Senior Indian corporate lawyer reviews common clause types and creates pattern entries |
| **Required clauses** | Per contract type | ~100-150 entries | Map clause requirements per contract type from AICPA/legal best practices |
| **Stamp duty** | State stamp duty schedules | ~600 entries (30 states × 20 doc types) | Parse from state revenue department websites, updated annually |

**Maintenance cadence:**
- Statutes: Updated when Parliament passes amendments (1-2× per year per act)
- Precedents: Updated when landmark SC judgment is issued (~5-10 per year)
- Clause patterns: Reviewed quarterly by legal advisor, updated based on user feedback
- Stamp duty: Annual update per state (budget season: Feb-Apr)

---

## 5. Contract Analysis Versioning & Comparison

### Data Model

```sql
-- Contract with multiple versions
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,             -- "Acme Corp MSA 2026"
    counterparty VARCHAR(255),               -- "Acme Corporation Pvt. Ltd."
    contract_type VARCHAR(50),               -- 'msa', 'nda', 'employment', 'lease', etc.
    our_role VARCHAR(20),                    -- 'vendor', 'client', 'employer', 'tenant', etc.
    status VARCHAR(30) DEFAULT 'under_review',  -- under_review, negotiating, approved, signed, expired
    tags TEXT[],                              -- ['priority', 'renewal', 'enterprise']
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Each version of the contract
CREATE TABLE contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id),
    version_number INTEGER NOT NULL,
    version_label VARCHAR(100),              -- "Received from counterparty", "Post round 1 negotiation"
    document_text TEXT NOT NULL,             -- Full extracted text
    document_path VARCHAR(500),             -- S3 path to original PDF/DOCX
    document_hash VARCHAR(64),              -- SHA-256 of original file
    page_count INTEGER,
    word_count INTEGER,
    language_detected VARCHAR(20),           -- 'en', 'hi', 'mr', 'gu', etc.
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id, version_number)
);

-- Full analysis per version
CREATE TABLE contract_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID REFERENCES contract_versions(id),
    overall_risk_score INTEGER,              -- 0-100 (0 = clean, 100 = dangerous)
    risk_grade VARCHAR(2),                   -- A (0-20), B (21-40), C (41-60), D (61-80), F (81-100)
    total_clauses_identified INTEGER,
    clauses_flagged INTEGER,
    critical_count INTEGER,
    high_count INTEGER,
    medium_count INTEGER,
    low_count INTEGER,
    missing_clauses_count INTEGER,
    stamp_duty_applicable DECIMAL,
    stamp_duty_state VARCHAR(50),
    stamp_duty_adequate BOOLEAN,
    executive_summary TEXT,                  -- 3-5 sentence plain language summary
    detailed_analysis TEXT,                  -- Full clause-by-clause analysis
    negotiation_playbook TEXT,               -- Negotiation strategy and talking points
    redlined_text TEXT,                      -- Contract text with suggested changes marked
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    model_used VARCHAR(50),
    analysis_duration_seconds INTEGER
);

-- Individual clause analysis (per version)
CREATE TABLE clause_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES contract_analyses(id),
    clause_number VARCHAR(30),               -- "Section 8.2" or "Clause 14(b)"
    clause_title VARCHAR(255),               -- "Indemnification"
    clause_category VARCHAR(50),             -- Maps to clause_categories.id (not enforced as FK for flexibility)
    original_text TEXT NOT NULL,             -- Exact text from contract
    risk_level VARCHAR(10) NOT NULL,         -- critical, high, medium, low, ok
    risk_explanation TEXT NOT NULL,           -- Plain language explanation
    risk_explanation_business TEXT,           -- Even simpler for non-lawyers
    applicable_laws TEXT[],                  -- ["Indian Contract Act S.27", "DPDPA S.8(1)"]
    applicable_precedents TEXT[],            -- ["Niranjan Shankar v Century Spinning (SC)"]
    suggested_alternative TEXT,              -- Replacement language
    negotiation_point TEXT,                  -- What to say to counterparty
    is_missing_clause BOOLEAN DEFAULT false, -- True if this was expected but absent
    cross_references TEXT[],                 -- Other clauses this interacts with
    contradicts_clause VARCHAR(30),          -- If contradicts another clause
    status VARCHAR(20) DEFAULT 'flagged',    -- flagged, accepted_as_is, negotiated, resolved
    user_notes TEXT,                         -- User's own comments
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version-to-version diff
CREATE TABLE version_diffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_version_id UUID REFERENCES contract_versions(id),
    to_version_id UUID REFERENCES contract_versions(id),
    diff_summary TEXT NOT NULL,              -- "5 improvements, 1 new risk, 2 unresolved"
    risk_score_from INTEGER,
    risk_score_to INTEGER,
    risk_score_change INTEGER,               -- Negative = improved
    clauses_improved JSONB,                  -- [{clause: "8.2", from_risk: "critical", to_risk: "low", change: "indemnity cap added"}]
    clauses_worsened JSONB,                  -- [{clause: "14", change: "auto-renewal clause added"}]
    clauses_new JSONB,                       -- Clauses in v2 not present in v1
    clauses_removed JSONB,                   -- Clauses in v1 removed in v2
    clauses_unchanged_flagged JSONB,         -- Clauses we flagged but counterparty didn't change
    negotiation_effectiveness TEXT,          -- "Round 1 reduced risk by 38%. 2 critical issues remain."
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contracts_org ON contracts(organization_id);
CREATE INDEX idx_contracts_status ON contracts(organization_id, status);
CREATE INDEX idx_versions_contract ON contract_versions(contract_id);
CREATE INDEX idx_analyses_version ON contract_analyses(version_id);
CREATE INDEX idx_clause_analyses_analysis ON clause_analyses(analysis_id);
CREATE INDEX idx_clause_analyses_risk ON clause_analyses(analysis_id, risk_level);
CREATE INDEX idx_diffs_versions ON version_diffs(from_version_id, to_version_id);
```

---

## 6. MCP Server Specifications

### 6.1 MCP Server: `document-mcp` (Document Parsing)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `parse_document` | Extract clean text from PDF/DOCX | `{ file_path: string, language_hint?: string }` | `{ text: string, page_count: number, word_count: number, language: string, structure: DocumentStructure }` |
| `parse_regional_document` | OCR + extract from scanned regional language doc via Sarvam AI | `{ file_path: string, source_language: string }` | `{ text_original: string, text_english: string, confidence: number, language: string }` |
| `extract_metadata` | Extract document metadata (dates, parties, title) | `{ text: string }` | `{ title: string, date: string, parties: Party[], document_type: string }` |

### 6.2 MCP Server: `legal-kb-mcp` (Legal Knowledge Base)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `search_statutes` | Vector + keyword search for relevant Indian law provisions | `{ query: string, acts?: string[], tags?: string[] }` | `{ statutes: Statute[], count: number }` |
| `search_clause_patterns` | Find matching risky clause patterns | `{ clause_text: string, contract_type: string }` | `{ patterns: ClausePattern[], count: number }` |
| `search_precedents` | Find relevant judicial precedents | `{ query: string, statute_section?: string }` | `{ precedents: Precedent[], count: number }` |
| `get_required_clauses` | Get list of clauses that SHOULD exist for a contract type | `{ contract_type: string, conditions?: string[] }` | `{ required: RequiredClause[] }` |
| `get_stamp_duty` | Calculate stamp duty for document type and state | `{ state: string, document_type: string, contract_value?: number }` | `{ duty_amount: number, duty_type: string, e_stamping: boolean, registration_required: boolean, penalty_info: string }` |
| `check_enforceability` | Check if a specific clause type is enforceable under Indian law | `{ clause_type: string, clause_text: string }` | `{ enforceable: boolean, confidence: string, reason: string, relevant_law: string }` |

### 6.3 MCP Server: `contract-mcp` (Contract Repository & Analysis Store)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `create_contract` | Register a new contract for review | `{ title: string, counterparty: string, contract_type: string, our_role: string }` | `{ contract_id: string }` |
| `add_version` | Add a new version of the contract | `{ contract_id: string, document_path: string, document_text: string, label: string }` | `{ version_id: string, version_number: number }` |
| `store_analysis` | Store analysis results for a version | `{ version_id: string, analysis: ContractAnalysis }` | `{ analysis_id: string }` |
| `store_clause_analysis` | Store individual clause analysis | `{ analysis_id: string, clause: ClauseAnalysis }` | `{ clause_analysis_id: string }` |
| `get_previous_analysis` | Get analysis from previous version for comparison | `{ contract_id: string, version_number: number }` | `{ analysis: ContractAnalysis, clauses: ClauseAnalysis[] }` |
| `generate_version_diff` | Compare two version analyses | `{ from_version_id: string, to_version_id: string }` | `VersionDiff` |
| `search_contracts` | Search contract repository | `{ query?: string, contract_type?: string, status?: string, counterparty?: string }` | `{ contracts: Contract[], count: number }` |
| `get_contract_timeline` | Get all versions and analyses for a contract | `{ contract_id: string }` | `{ versions: VersionWithAnalysis[], risk_trend: number[] }` |

---

## 7. Orchestrator — Main Agent

```typescript
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a Legal Contract Intelligence Agent specializing in Indian law.
You help business teams (non-lawyers) understand contracts, identify legal risks, and negotiate better terms.

YOUR CAPABILITIES:
1. Read contracts holistically — understand structure, cross-references, conditions, obligations
2. Flag risks against Indian law — using the Legal Knowledge Base of statutes, patterns, and precedents
3. Explain risks in plain language — for founders, procurement, HR, not for lawyers
4. Generate redlined alternatives — suggested clause language that's commercially reasonable
5. Produce negotiation playbooks — talking points per flagged clause
6. Compare contract versions — show what improved, worsened, or remained unresolved
7. Check stamp duty requirements — state-wise calculation with penalty warnings
8. Identify missing clauses — what SHOULD be in the contract but isn't

YOUR READING APPROACH:
- Read the ENTIRE document first, then analyze. Don't extract clauses in isolation.
- Understand defined terms before interpreting clauses that use them.
- Check cross-references: "as per Section 3.2" → actually read Section 3.2.
- Look for conditions and exceptions: "notwithstanding", "subject to", "provided that".
- Identify the overall balance of the contract: who bears more risk?

CRITICAL RULES:
- NEVER provide definitive legal advice. Always frame as "analysis" not "advice".
- NEVER say "you should sign this" or "you should not sign this".
- ALWAYS include the disclaimer: "This analysis is AI-assisted and does not constitute legal advice."
- Be CONFIDENT on clear legal violations (Section 27 non-compete = void).
- Be CAUTIOUS on judgment calls (is this indemnity "reasonable"?). Say "recommend legal review".
- NEVER modify the Legal Knowledge Base without human approval.
- When uncertain about a clause's risk level, err on the side of flagging it.

INDIAN LAW CONTEXT:
- Non-compete clauses (post-termination) are VOID under Section 27, Indian Contract Act.
  Exception: during employment or for sale of goodwill.
- Unstamped/under-stamped agreements are INADMISSIBLE as evidence (Section 35, Stamp Act).
- Unregistered leases > 12 months are unenforceable against third parties.
- DPDPA 2023 requires explicit consent for processing personal data. Contracts handling PII
  MUST have data protection clauses.
- Indian courts strongly disfavor one-sided indemnity and unlimited liability.
- Arbitration clauses should specify seat (not just venue) for enforceability.
- FEMA compliance required if foreign party involved — check for repatriation clauses.

LANGUAGE:
- Primary output in English.
- Understand contracts in Hindi, Marathi, Gujarati, Tamil (via Sarvam AI OCR).
- Risk explanations should be in simple business English, not legalese.`;

async function analyzeContract(
  contractFile: string,
  contractType: string,
  counterparty: string,
  ourRole: string,
  state: string,
  autonomyLevel: 1 | 2 | 3,
) {
  const tools = [
    // Document tools
    { name: "parse_document", ...parseDocumentSchema },
    { name: "parse_regional_document", ...parseRegionalDocumentSchema },
    { name: "extract_metadata", ...extractMetadataSchema },

    // Legal KB tools
    { name: "search_statutes", ...searchStatutesSchema },
    { name: "search_clause_patterns", ...searchClausePatternsSchema },
    { name: "search_precedents", ...searchPrecedentsSchema },
    { name: "get_required_clauses", ...getRequiredClausesSchema },
    { name: "get_stamp_duty", ...getStampDutySchema },
    { name: "check_enforceability", ...checkEnforceabilitySchema },

    // Contract repo tools
    { name: "create_contract", ...createContractSchema },
    { name: "add_version", ...addVersionSchema },
    { name: "store_analysis", ...storeAnalysisSchema },
    { name: "store_clause_analysis", ...storeClauseAnalysisSchema },
    { name: "get_previous_analysis", ...getPreviousAnalysisSchema },
    { name: "generate_version_diff", ...generateVersionDiffSchema },
    { name: "search_contracts", ...searchContractsSchema },
    { name: "get_contract_timeline", ...getContractTimelineSchema },
  ];

  const userPrompt = `Analyze this contract:
  - File: ${contractFile}
  - Type: ${contractType}
  - Counterparty: ${counterparty}
  - Our role: ${ourRole}
  - State (for stamp duty): ${state}
  - Autonomy level: ${autonomyLevel}

  Steps:
  1. Parse the document to extract clean text
  2. Read the FULL document holistically
  3. For each identified risk, query the Legal KB
  4. Check for missing clauses required for this contract type
  5. Calculate stamp duty for ${state}
  6. Check for cross-clause contradictions
  7. Generate the analysis report

  ${autonomyLevel >= 2 ? "Also generate: redlined version and negotiation playbook." : ""}
  ${autonomyLevel >= 2 ? "If this is v2+, generate a version diff against the previous analysis." : ""}`;

  const messages = [{ role: "user" as const, content: userPrompt }];

  let response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  // Agentic loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeTool(toolUse.name, toolUse.input);
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      })
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    // Escalate to Opus for cross-clause reasoning and negotiation strategy
    const needsOpus = toolUseBlocks.some(t =>
      ["generate_version_diff", "check_enforceability"].includes(t.name)
    ) || autonomyLevel >= 2;

    response = await client.messages.create({
      model: needsOpus ? "claude-opus-4-6-20250514" : "claude-sonnet-4-6-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });
  }

  return response.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}
```

---

## 8. Indian Law — Key Rules the Agent Must Know

These rules are encoded in the Legal KB but also hardcoded into the agent's system prompt for critical items:

### 8.1 Non-Compete Enforceability (The #1 Trap)

| Scenario | Enforceable? | Law | Agent Action |
|----------|-------------|-----|-------------|
| Non-compete DURING employment | ✅ Yes | Employer can restrict moonlighting during employment | Flag as OK if reasonable |
| Non-compete AFTER termination (any duration) | ❌ No — VOID | Section 27, Indian Contract Act | Flag as CRITICAL: "This clause is void and unenforceable" |
| Non-solicitation of clients (post-termination) | ⚠️ Maybe | Courts have allowed narrow non-solicitation | Flag as MEDIUM: "May be enforceable if narrowly drafted" |
| Non-solicitation of employees (post-termination) | ⚠️ Maybe | More likely enforceable than non-compete | Flag as LOW: "Generally enforceable if reasonable" |
| Non-compete on sale of business/goodwill | ✅ Yes | Exception to Section 27 | Flag as OK |
| Garden leave with non-compete | ⚠️ Maybe | If paid during garden leave, courts may allow | Flag as MEDIUM: "More likely enforceable if garden leave is paid" |

### 8.2 Stamp Duty Traps

| Trap | Consequence | Agent Action |
|------|-------------|-------------|
| Agreement on plain paper (no stamp) | Inadmissible as evidence in court (Section 35, Stamp Act) | CRITICAL: "This agreement has no legal standing in court without proper stamping" |
| Under-stamped agreement | Inadmissible unless deficit + penalty paid (2% per month) | HIGH: "Under-stamped by ₹X. Penalty: ₹Y. Get it adjudicated before any dispute" |
| E-stamp vs physical stamp paper | Both valid where e-stamping is available | INFO: "Consider e-stamping for convenience" |
| Stamp duty paid in wrong state | Must be paid in state where agreement is executed | HIGH: "Maharashtra stamp duty paid but agreement executed in Karnataka — needs Karnataka stamp" |
| Lease > 12 months not registered | Unenforceable against third parties (Section 17, Registration Act) | HIGH: "Register this lease at the Sub-Registrar's office within 4 months" |

### 8.3 DPDPA 2023 Compliance

> **Note:** Section numbers below are from the Digital Personal Data Protection Act, 2023 as enacted. Verify against the latest gazette-notified version, as numbering shifted between the 2022 bill and the 2023 enacted version. The substantive requirements are stable regardless of numbering.

| Check | Requirement | Agent Action |
|-------|-------------|-------------|
| Data processing clause present? | Any contract involving personal data MUST address processing | CRITICAL if missing: "No data protection clause. DPDPA 2023 requires this." |
| Consent mechanism defined? | Section 6 — consent must be free, specific, informed, unconditional, with clear affirmative action | HIGH if missing: "How is data principal consent obtained? Must be specified." |
| Purpose limitation stated? | Section 5 (notice) + Section 6 (consent) — personal data processed only for stated purpose | MEDIUM if vague: "Purpose of data processing is too broad. Narrow it." |
| Data retention period? | Section 8 (duties of Data Fiduciary) — data must be erased when purpose is fulfilled | MEDIUM if missing: "No retention period. Add clause specifying data deletion timeline." |
| Cross-border transfer? | Section 16-17 — govt may restrict transfers to certain countries via notification | HIGH if foreign party: "Cross-border data transfer clause needed. Check if destination country is restricted." |
| Breach notification? | Section 8 (duties of Data Fiduciary) — must notify Data Protection Board of breach | MEDIUM if missing: "No breach notification clause. DPDPA requires prompt notification." |

### 8.4 Arbitration Clause Best Practices

| Issue | Best Practice | Agent Action |
|-------|-------------|-------------|
| No arbitration clause | Disputes go to court (slow — 5-10 years in India) | MEDIUM: "Consider adding arbitration clause for faster dispute resolution" |
| Seat not specified | Seat determines procedural law; venue is just location | HIGH: "Specify seat of arbitration (not just venue). Seat = which country's arbitration law applies" |
| Foreign seat for India-India contract | Indian parties can choose foreign seat but may face enforcement issues | MEDIUM: "Foreign seat is legally valid but enforcement in India may be slower" |
| Single arbitrator vs panel | Panel (3) is more expensive but perceived as fairer for high-value disputes | INFO: "Single arbitrator is cost-effective for disputes < ₹5Cr. Panel recommended for higher value." |
| Institutional vs ad-hoc | Institutional (SIAC, ICC, MCIA) is more structured | INFO: "MCIA (Mumbai) recommended for domestic disputes. SIAC for international." |

### 8.5 Employment Contract Specifics (India)

| Clause | Indian Law Position | Agent Action |
|--------|-------------------|-------------|
| At-will termination | Not recognized in India — reasonable notice required | HIGH: "India doesn't have at-will employment. Notice period must be specified." |
| Notice period > 3 months | Enforceable but may be challenged as unreasonable | MEDIUM: "3-month notice is standard. 6+ months may be challenged." |
| Bond / service agreement | Valid if employer invested in training, but penalty must be reasonable | HIGH if penalty > training cost: "Bond penalty ₹X exceeds estimated training cost. May be unenforceable." |
| Background verification clause | Legal, but must comply with privacy principles | LOW: "Add clause specifying what checks are performed and consent mechanism." |
| IP assignment (all inventions) | Valid during employment scope, overbroad if covers personal time | MEDIUM if too broad: "IP assignment should be limited to work done during employment and using company resources." |
| Moonlighting restriction | Enforceable during employment | OK if reasonable, flag if absolute blanket ban |

---

## 9. Example Analyses

### 9.1 SaaS Vendor MSA — Risk Report

```
CONTRACT: Acme Corp Master Services Agreement
TYPE: MSA (we are the vendor)
COUNTERPARTY: GlobalTech Inc.
STATE: Maharashtra
PAGES: 28 | VERSION: 1 (received from counterparty)

══════════════════════════════════════════════════
EXECUTIVE SUMMARY
══════════════════════════════════════════════════
Risk Score: 68/100 (Grade D — Significant Risk)

This is a counterparty-favorable MSA with several clauses that are either
unenforceable under Indian law or commercially one-sided. 3 critical issues
need immediate attention before signing.

⚠️ This analysis is AI-assisted and does not constitute legal advice.
For high-value contracts, consult a qualified Indian lawyer.

══════════════════════════════════════════════════
CRITICAL RISKS (3)
══════════════════════════════════════════════════

⛔ 1. UNLIMITED INDEMNITY (Section 11.2)
   Risk: CRITICAL | Category: Indemnity

   The clause: "Vendor shall indemnify, defend, and hold harmless Client
   from any and all claims, damages, losses, and expenses (including
   attorneys' fees) arising from Vendor's breach of this Agreement."

   What this means (plain language):
   If their customer sues them for something related to your work, YOU
   pay everything — no cap, no limit. If their client claims ₹100Cr in
   damages, you're on the hook for the full amount even if your contract
   is worth ₹50L/year.

   Indian law context:
   Indian courts disfavor unlimited indemnity (Voestalpine Schienen
   GmbH v. DMRC, Delhi HC). While not void, it's considered commercially
   unreasonable.

   Suggested alternative:
   "Vendor's aggregate liability under this Section shall not exceed
   the total fees paid by Client to Vendor in the 12 months preceding
   the claim."

   Negotiation talking point:
   "We're comfortable with indemnification but need a reasonable cap.
   Industry standard is 1× annual contract value. We propose limiting
   aggregate liability to fees paid in the preceding 12 months."

⛔ 2. NON-COMPETE CLAUSE (Section 14.3)
   Risk: CRITICAL | Category: Non-Compete

   The clause: "During the term of this Agreement and for a period of
   twenty-four (24) months following termination, Vendor shall not
   provide similar services to any competitor of Client."

   What this means (plain language):
   After this contract ends, you can't work with any of their competitors
   for 2 years. If they're in fintech, you can't serve ANY fintech company.

   Indian law context:
   THIS CLAUSE IS VOID under Section 27 of the Indian Contract Act, 1872.
   Post-termination non-competes are unenforceable in India. The Supreme
   Court has consistently upheld this (Niranjan Shankar Golikari v. Century
   Spinning, 1967; Superintendence Company of India v. Krishan Murgai, 1981).

   Suggested alternative:
   Remove entirely. If counterparty insists, replace with a narrow
   non-solicitation: "Vendor shall not directly solicit Client's employees
   or specific named accounts for a period of 12 months following termination."

   Negotiation talking point:
   "This clause is void under Indian law (Section 27, Indian Contract Act)
   and would not be enforceable in any Indian court. We're happy to agree
   to a non-solicitation of your specific employees and named accounts
   instead."

⛔ 3. NO DATA PROTECTION CLAUSE
   Risk: CRITICAL | Category: Missing Clause (DPDPA)

   This MSA involves processing end-user data but contains NO data
   protection clause. Under the Digital Personal Data Protection Act 2023
   (DPDPA), any entity processing personal data must:
   - Specify the purpose of processing (Section 4)
   - Define data retention and deletion timelines (Section 8(7))
   - Address breach notification obligations (Section 8(6))
   - Address cross-border data transfer (Section 16)

   Suggested addition:
   Add a Data Processing Addendum (DPA) as Schedule C covering:
   purpose limitation, processing instructions, sub-processor obligations,
   breach notification (72 hours), data deletion on termination, and
   audit rights.

══════════════════════════════════════════════════
HIGH RISKS (4)
══════════════════════════════════════════════════

🔴 4. GOVERNING LAW: State of Delaware (Section 18.1)
   Both parties are Indian entities but governing law is Delaware, USA.
   This creates unnecessary complexity and cost for dispute resolution.
   Recommend: Indian law with arbitration seated in Mumbai.

🔴 5. AUTO-RENEWAL WITHOUT NOTICE (Section 2.3)
   Contract auto-renews annually with no specified notice period for
   non-renewal. You could be locked in indefinitely.
   Recommend: Add "either party may terminate by providing 90 days
   written notice prior to renewal date."

🔴 6. UNILATERAL TERMINATION (Section 13.2)
   Client can terminate for convenience with 30 days notice.
   Vendor can only terminate for cause. This is one-sided.
   Recommend: Both parties should have equal termination rights.

🔴 7. IP ASSIGNMENT TOO BROAD (Section 9.1)
   "All intellectual property created in connection with the Services
   shall vest exclusively with Client." This could include your
   pre-existing IP, tools, and frameworks.
   Recommend: Carve out pre-existing IP and general knowledge.

══════════════════════════════════════════════════
STAMP DUTY
══════════════════════════════════════════════════
State: Maharashtra
Document type: Service Agreement
Contract value: ₹60,00,000/year (₹5,00,000/month × 12)
Applicable duty: 0.1% of contract value = ₹6,000
Max cap: ₹25,00,000 (not applicable)
E-stamping available: Yes (https://gras.mahakosh.gov.in)
Registration: Not required for service agreements

⚠️ Ensure agreement is executed on ₹6,000 e-stamp paper.
   Executing on ₹100 stamp paper = inadmissible in court.

══════════════════════════════════════════════════
NEGOTIATION PLAYBOOK
══════════════════════════════════════════════════
Priority order for negotiation (most impact first):
1. Remove non-compete → cite Section 27 (legally void anyway)
2. Cap indemnity → 1× annual fees is industry standard
3. Add data protection addendum → DPDPA compliance is mutual interest
4. Change governing law → Indian law + Mumbai arbitration
5. Add non-renewal notice period → 90 days
6. Balance termination rights → equal for both parties
7. Carve out pre-existing IP → protect your frameworks/tools
```

### 9.2 Version Diff — v1 vs v2

```
CONTRACT: Acme Corp MSA 2026
DIFF: v1 (Mar 10) → v2 (Mar 22, post-negotiation round 1)
RISK SCORE: 68 → 41 (27-point improvement)

═══════════════════════════════════════════════════
✅ IMPROVED (3 clauses)
═══════════════════════════════════════════════════

✅ Non-compete (Section 14.3): REMOVED entirely
   v1: 24-month non-compete → v2: Clause deleted
   Impact: Critical risk eliminated

✅ Indemnity (Section 11.2): CAP ADDED
   v1: Unlimited indemnity → v2: "...not to exceed aggregate fees
   paid in the preceding 12-month period"
   Impact: Critical → Low

✅ Governing Law (Section 18.1): CHANGED
   v1: State of Delaware → v2: Laws of India, courts in Mumbai
   Impact: High → OK

═══════════════════════════════════════════════════
🔴 WORSENED / NEW RISK (1 clause)
═══════════════════════════════════════════════════

🔴 NEW: Non-solicitation (Section 14.3 — replaced non-compete)
   "Vendor shall not solicit or hire any employee of Client for a
   period of 24 months following termination."
   Assessment: MEDIUM risk. Non-solicitation (unlike non-compete)
   MAY be enforceable in India. But 24 months is aggressive.
   Recommend: Negotiate down to 12 months and limit to employees
   you directly worked with.

═══════════════════════════════════════════════════
⚠️ UNCHANGED — STILL FLAGGED (3 clauses)
═══════════════════════════════════════════════════

⚠️ Data protection: Still missing. Push again — cite DPDPA 2023.
⚠️ Auto-renewal: Still no notice period. Raise again.
⚠️ IP assignment: Still too broad. Raise again.

═══════════════════════════════════════════════════
ROUND 2 STRATEGY
═══════════════════════════════════════════════════
Good progress on round 1 — the critical items (non-compete, indemnity
cap, governing law) are resolved. Round 2 should focus on:
1. Data protection addendum — frame as "mutual compliance obligation"
2. Non-solicitation duration — push for 12 months from 24
3. Auto-renewal notice — "standard commercial practice"
4. IP carve-out — "protects both parties' pre-existing work"
```

---

## 10. Cost Estimates (INR)

### Per-Contract Analysis Cost

| Component | Cost (₹) | Notes |
|-----------|----------|-------|
| Claude Sonnet — full document read + clause analysis | ₹30-80 | Depends on contract length (10-50 pages) |
| Claude Opus — cross-clause reasoning + negotiation strategy | ₹15-40 | Only for L2+ autonomy and complex contracts |
| Claude Haiku — clause classification, stamp duty lookup | ₹3-8 | Quick lookups |
| DocProof / Sarvam AI — document parsing | ₹5-15 | Higher for scanned/regional language docs |
| OpenAI Embeddings — vector search | ₹1-3 | ~5-10 embedding calls per analysis |
| **Total per contract** | **₹50-150** | |

### Monthly Cost at Scale

| Scale | Contracts/Month | Monthly Cost (₹) | Notes |
|-------|----------------|-------------------|-------|
| Small business | 10-20 | ₹500-3,000 | Founder reviewing key contracts |
| Mid-size company | 50-100 | ₹2,500-15,000 | Procurement + HR + legal team |
| Large enterprise | 200-500 | ₹10,000-75,000 | Multiple departments |
| Infrastructure (PostgreSQL + S3) | — | ₹3,000-8,000 | Fixed monthly cost |

### ROI Justification

| Benefit | Estimate |
|---------|----------|
| External lawyer cost per review | ₹15,000-50,000 |
| Agent cost per review | ₹50-150 |
| **Savings per contract** | **₹14,850-49,850 (99% reduction)** |
| Time saved per contract | 2-4 hours → 5 minutes |
| Risk reduction | Catches Indian-law-specific issues lawyers often miss (stamp duty, Section 27) |

---

## 11. Deployment & Rollout

### Phased Rollout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PHASES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: CORE ANALYSIS (Week 1-6)                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Document parsing pipeline (DocProof integration)               │   │
│  │ • Legal KB v1 — seed statutes (Indian Contract Act, Stamp Act,   │   │
│  │   DPDPA, IT Act) + 100 clause patterns + stamp duty for top 10  │   │
│  │   states                                                         │   │
│  │ • Level 1 analysis — risk report only                            │   │
│  │ • Contract types: NDA, MSA, Employment                           │   │
│  │ • Web UI for upload + report viewing                             │   │
│  │ • Test with 50 real contracts from pilot users                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 2: NEGOTIATION + VERSIONING (Week 7-12)                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Level 2 — redline generation + negotiation playbook            │   │
│  │ • Version tracking + diff generation                              │   │
│  │ • Expand Legal KB — add Labor Codes, FEMA, Companies Act,        │   │
│  │   Arbitration Act + 200 more clause patterns                     │   │
│  │ • Add contract types: Freelancer, Lease, Shareholder, DPA        │   │
│  │ • Sarvam AI integration for Hindi/Marathi contracts              │   │
│  │ • REST API for programmatic access                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 3: FULL COPILOT + SCALE (Week 13-20)                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Level 3 — milestone tracking, regulatory monitoring             │   │
│  │ • All 30 states stamp duty matrix                                 │   │
│  │ • Precedent database (100+ landmark cases)                        │   │
│  │ • Template clause library for common contracts                    │   │
│  │ • Regional language support (Gujarati, Tamil, Bengali)            │   │
│  │ • Multi-tenant for legal consultancies                            │   │
│  │ • Enterprise integration readiness (API-first, Salesforce later)  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Security & Privacy

| Concern | Mitigation |
|---------|-----------|
| **Contract confidentiality** | Contracts are highly sensitive business documents. All storage encrypted at rest (AES-256). All transit over TLS 1.3. Per-organization data isolation — no cross-tenant access. |
| **Legal KB integrity** | Statute and pattern updates require legal team review before entering the KB. Version history on all KB changes. Agent cannot modify KB autonomously. |
| **Analysis accuracy disclaimer** | Every output includes disclaimer that this is not legal advice. Critical risk flags are conservative (err on side of flagging). |
| **Document retention** | Configurable per organization. Default: contract documents retained for 7 years (standard Indian business retention). Analysis data retained indefinitely for version history. |
| **Access control** | Role-based: Admin (full), Legal Team (analyze + approve), Business User (upload + view), API User (programmatic access only). |
| **Audit trail** | Every upload, analysis, download, and share action logged with user, timestamp, and IP. |
| **Regional language processing** | Sarvam AI API calls use encrypted transport. No contract data cached by third-party APIs. |
| **PII in contracts** | Contracts may contain PII (names, addresses, PAN numbers). Agent never sends full contract text to external APIs — only sends extracted clause snippets for embedding generation. |

---

## 13. Example Conversations

### Upload and First Analysis

```
User: I just received this MSA from a potential client. Can you review it?
      [Uploads: GlobalTech-MSA-Draft-v1.pdf]
      We're the vendor. Contract is for our SaaS platform. Based in Maharashtra.

Agent: I've parsed the document — 28 pages, 18 sections, English.
      Analyzing now against Indian law...

      [2 minutes later]

      📊 ANALYSIS COMPLETE

      Risk Score: 68/100 (Grade D — Significant Risk)
      3 Critical | 4 High | 2 Medium | 9 OK

      ⛔ TOP 3 CRITICAL ISSUES:
      1. Unlimited indemnity — you're on the hook for unlimited damages
      2. 24-month non-compete — VOID under Indian law (Section 27)
      3. No data protection clause — required under DPDPA 2023

      📄 Full report generated. Shall I also generate a redlined version
      with suggested changes and a negotiation playbook?

User: Yes, give me the redline and playbook. I need to send comments back by Friday.

Agent: Here's your negotiation package:

      📝 REDLINED VERSION: [Download: GlobalTech-MSA-v1-Redlined.pdf]
      7 clauses marked with suggested alternatives.

      📋 NEGOTIATION PLAYBOOK:
      Priority order (negotiate these first):
      1. Non-compete → "This is void under Indian law. Propose non-solicitation instead."
      2. Indemnity cap → "Industry standard is 1× annual fees."
      3. Data protection → "Mutual compliance need — propose DPA as Schedule C."
      ...

      💰 STAMP DUTY: ₹6,000 e-stamp paper required in Maharashtra.

      ⚠️ This analysis is AI-assisted and does not constitute legal advice.
```

### Version Comparison After Negotiation

```
User: They sent back v2 after our comments. What changed?
      [Uploads: GlobalTech-MSA-v2-Revised.pdf]

Agent: Comparing v2 against v1 analysis...

      📊 RISK SCORE: 68 → 41 (27-point improvement — good progress!)

      ✅ IMPROVED (3):
      • Non-compete REMOVED entirely ✅
      • Indemnity capped at 12-month fees ✅
      • Governing law changed to Indian courts ✅

      🔴 NEW RISK (1):
      • Added 24-month non-solicitation clause — assess as MEDIUM
        (may be enforceable unlike non-compete, but 24 months is aggressive)

      ⚠️ UNCHANGED (3):
      • Still no data protection clause
      • Auto-renewal still has no notice period
      • IP assignment still too broad

      Round 1 was productive. For round 2, push hardest on the data
      protection addendum — frame it as "mutual DPDPA compliance, not
      a concession." Want me to generate an updated redline for round 2?
```
