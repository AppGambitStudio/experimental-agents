# Deep Agent for Real Estate Transaction (Gujarat, India) — Research Document

## Overview

This document outlines how to build a **Real Estate Transaction Agent** using the **Claude Agent SDK**. The agent is an end-to-end purchase companion that guides individual property buyers in Gujarat through the entire real estate transaction lifecycle — from initial due diligence through post-purchase formalities. It uses browser automation (Puppeteer/Playwright) to navigate Gujarat government portals (AnyRoR, Gujarat RERA, eCourts, GARVI, SMC Property Tax, GSTN), extracts and cross-references data from these sources, reviews builder agreements for buyer-unfavorable clauses, calculates total cost of ownership including hidden charges, and maintains a comprehensive evidence-backed purchase dossier. What currently requires a buyer to blindly trust a builder, hire multiple professionals (lawyer, CA, broker), and spend weeks navigating opaque government portals becomes a single intelligent assistant that verifies every claim with government records, explains findings in plain language, and ensures nothing falls through the cracks.

For most Indians, buying property is the largest financial decision of their lifetime — often 10-20x their annual income. Yet the process is riddled with information asymmetry: builders know everything, buyers know almost nothing. A residential flat might have had a decade-long legal dispute that a first-time buyer would never discover. RERA registration might be expired but the builder is still selling. Stamp duty calculations involve multiple payment streams that even experienced buyers find confusing. This agent levels the playing field with government-source verification that even a lawyer might skip.

**Target users:** Individual property buyers in Gujarat — first-time or infrequent buyers (1-3 property purchases in a lifetime) who lack expertise in legal verification, government portal navigation, and agreement review. These are IT professionals, business owners, salaried employees — people who are financially capable of buying property but not equipped to verify what they're buying.

**Target customers:** Real estate advisory firms, legal-tech startups offering property verification services, property aggregation platforms looking to add verification as a premium feature, and fintech companies offering home loan products that need property due diligence.

---

## 1. Why This Agent Is Needed

### The Problem

Property buying in India is an information-asymmetry nightmare:

| Pain Point | Detail |
|------------|--------|
| **Document collection is a maze** | A typical property purchase involves 15-20 different documents (7/12 extract, 8A extract, encumbrance certificate, title deed, RERA certificate, OC, CC, NOCs). Most buyers don't know which documents to ask for, where to get them, or how to read them. Online resources are unstructured and contradictory. |
| **RERA verification requires blind trust** | Buyers are told to "check RERA" but the Gujarat RERA portal is difficult to navigate. Even when they find the project, they don't know what to look for — expired registration, complaints filed, carpet area mismatches. Most end up trusting the builder's word. |
| **Dispute history is nearly impossible to find** | A residential flat might have had a years-long legal dispute between the builder and landowner. This information exists in eCourts but requires knowing exactly who to search for, with multiple spelling variations. Buyers discover disputes only after purchase — sometimes years later. |
| **Stamp duty is confusing** | Gujarat stamp duty involves jantri rates (government ready reckoner), market value declarations, different rates for male/female buyers, residential/commercial classification, and multiple payment streams (bank transfer, demand draft, various deposits). Even CAs get confused. |
| **Home loan documentation is overwhelming** | Banks require 20-30 documents for home loan processing. The list varies by bank. Documents have specific format requirements. Missing one document delays the entire process by weeks. Nobody provides a clear, sequenced checklist. |
| **Builder agreements are one-sided** | A standard Gujarat builder agreement is 40-60 pages of legal text heavily favoring the builder. Buyers sign without understanding clauses on possession delay penalty (often ₹2/sqft/month — absurdly low), carpet area vs super built-up area calculation, specification change rights, and force majeure definitions that let the builder delay indefinitely. |
| **Total cost is never what it seems** | A flat "priced" at ₹50 lakh actually costs ₹60-65 lakh after stamp duty, registration, GST, legal fees, maintenance deposit, parking, club house charges, and sundry deposits. Buyers budget for the "price" and scramble when the real number hits. |
| **Land record verification requires domain expertise** | A 7/12 extract from AnyRoR contains owner names, survey numbers, land type, mutation history — all in Gujarati. Verifying that the seller actually owns the land, that it's not agricultural (NA conversion required), and that mutations are up-to-date requires expertise most buyers lack. |
| **No single source of truth** | Information is scattered across 6+ government portals, each with different interfaces, CAPTCHA challenges, and data formats. Cross-referencing (does the seller name on 7/12 match RERA? does the property address in eCourts match?) requires manual effort. |
| **Post-purchase formalities are forgotten** | After registration, buyers need to: mutate property records (8A update), update property tax records, register with society, apply for utility connections, update home loan records. Most buyers miss half of these, creating problems years later. |

### What Existing Tools Do vs. What This Agent Does

| Capability | Existing Platforms (99acres, MagicBricks, Housing.com, NoBroker) | This Agent |
|-----------|----------------------------------------------------------------|------------|
| Property discovery | Listings with photos, price, location | Not in scope — this agent starts AFTER you've found a property |
| Builder reputation | Star ratings, user reviews (easily gamed) | Government-source verification: RERA status, eCourts litigation, GST registration status |
| RERA verification | Some show RERA number (user must verify themselves) | Full RERA portal automation: registration status, expiry date, complaints, carpet area cross-check |
| Legal due diligence | Not addressed | Browser automation across AnyRoR, eCourts, GARVI — land records, dispute history, registered deeds |
| Agreement review | Not addressed | AI-powered clause-by-clause analysis with Gujarat-specific red flags |
| Stamp duty calculation | Basic calculator (often inaccurate) | Jantri-based calculation with zone-wise rates, male/female differentiation, exemptions |
| Total cost breakdown | Not addressed | Complete cost with ALL charges — stamp duty, registration, GST, deposits, legal, brokerage |
| Document checklist | Generic PDF guides | Sequenced, phase-wise checklist with verification status tracking |
| Post-purchase guidance | Not addressed | Step-by-step mutation, tax update, utility transfer, society registration |
| Evidence trail | No evidence | Screenshot-backed dossier with SHA-256 hashed verification log |
| Dispute history | Not addressed | Multi-strategy eCourts search with name variations, cross-referencing seller, builder, and society |

### Why Claude Agent SDK

The Agent SDK is ideal because property verification requires:
- **Browser automation via Puppeteer/Playwright** — navigate government portals that have no APIs, fill forms, solve CAPTCHAs (with human help), extract data from rendered HTML
- **Multi-modal understanding** — parse Gujarati-language land records, read scanned title deeds, interpret government portal layouts
- **Multi-model orchestration** — Opus for agreement review and cross-reference reasoning, Sonnet for portal data analysis, Haiku for checklists and calculations
- **MCP tool architecture** — browser automation, property knowledge base, document parsing, and purchase tracking as separate servers that compose into workflows
- **Human-in-the-loop** — property purchase decisions MUST remain with the buyer. The agent verifies and informs, never recommends buy/don't buy
- **Long-running agentic workflows** — due diligence across 6 portals may take 15-30 minutes of automated portal navigation per property
- **Evidence-backed reasoning** — every finding must be traceable to a government portal screenshot, not just Claude's analysis

---

## 2. Architecture

### High-Level Design

```
                    ┌───────────────────────────────────────────┐
                    │   Real Estate Transaction Agent             │
                    │      (Purchase Orchestrator)                │
                    │                                             │
                    │   Claude Agent SDK + 4 MCP Servers          │
                    │   + Puppeteer/Playwright Browser Engine     │
                    └──────────────────┬────────────────────────┘
                                       │
         ┌───────────┬─────────────────┼──────────────┬────────────┐
         │           │                 │              │            │
   ┌─────▼─────┐ ┌──▼──────────┐ ┌───▼──────┐ ┌────▼────────┐ ┌─▼───────────┐
   │ Due       │ │ Document    │ │ Cost     │ │ Registration│ │ Purchase    │
   │ Diligence │ │ Analyzer   │ │ Intelli- │ │ Guide       │ │ Tracker     │
   │ Agent     │ │ Agent      │ │ gence    │ │ Agent       │ │ Agent       │
   │           │ │            │ │ Agent    │ │             │ │             │
   │ (Browser  │ │ (Agreement │ │ (Stamp   │ │ (Step-by-   │ │ (Dossier,  │
   │  automa-  │ │  /deed     │ │  duty,   │ │  step       │ │  checklist, │
   │  tion for │ │  review)   │ │  jantri, │ │  registra-  │ │  payments,  │
   │  portals) │ │            │ │  total   │ │  tion       │ │  timeline)  │
   │           │ │            │ │  cost)   │ │  process)   │ │             │
   └─────┬─────┘ └──┬─────────┘ └───┬──────┘ └────┬────────┘ └─┬───────────┘
         │          │               │              │            │
   ┌─────▼──────────▼───────────────▼──────────────▼────────────▼──┐
   │                    4 MCP Servers                               │
   │                                                                │
   │  browser-mcp            property-kb-mcp     document-mcp      │
   │  (Puppeteer/Playwright  (Gujarat property   (DocProof for     │
   │   for portal naviga-    knowledge — jantri  PDF parsing,      │
   │   tion: AnyRoR, RERA,   rates, stamp duty,  Sarvam AI for    │
   │   eCourts, GARVI, SMC,  registration fees,  Gujarati title   │
   │   GSTN — screenshot     red flag patterns,  deeds, agreement │
   │   capture, data         document checklist, analysis)         │
   │   extraction)           RERA rules)                           │
   │                                                                │
   │  tracker-mcp                                                   │
   │  (Purchase tracking — dossier management, phase transitions,  │
   │   verification log, payment tracking, checklist status,       │
   │   dossier PDF generation, S3 storage)                         │
   │                                                                │
   └──────────────────────────┬────────────────────────────────────┘
                              │
   ┌──────────────────────────▼────────────────────────────────────┐
   │                    Storage Layer                               │
   │                                                                │
   │  PostgreSQL              S3                                    │
   │  (Property KB,           (Purchase dossiers — screenshots,    │
   │   purchase tracking,     documents, verification evidence,    │
   │   verification logs,     generated reports, agreement         │
   │   payment records,       copies, dossier summary PDFs)        │
   │   phase history)                                               │
   └───────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Purpose | MCP Server |
|-----------|---------|------------|
| **Due Diligence Agent** | Automates browser navigation across 6 Gujarat government portals. For each property, runs AnyRoR (land records), RERA (project verification), eCourts (dispute search), GARVI (registered deeds), SMC/municipal tax (ownership + payment), GSTN (builder verification). Captures screenshots at every data point. Cross-references findings (seller name on 7/12 vs RERA vs eCourts). Produces structured due diligence report with risk score. | `browser-mcp` |
| **Document Analyzer Agent** | Reviews builder agreements, sale deeds, allotment letters, and other property documents. Flags buyer-unfavorable clauses (possession delay penalty, carpet area calculation, specification change rights, force majeure). Compares against Gujarat RERA rules. Explains each flagged clause in plain language. Suggests counter-positions. | `document-mcp` + `property-kb-mcp` |
| **Cost Intelligence Agent** | Calculates total cost of property ownership. Looks up jantri (ready reckoner) rates by zone. Computes stamp duty, registration fee, GST. Adds maintenance deposit, parking, club house, legal fees, brokerage. Shows jantri vs market rate comparison. Produces comprehensive cost breakdown so the buyer knows the ACTUAL number. | `property-kb-mcp` |
| **Registration Guide Agent** | Provides step-by-step guidance for property registration at the Gujarat Sub-Registrar's office. Covers e-stamping, document preparation, registration appointment, biometric verification, and post-registration steps. Tailored to the specific property type and Sub-Registrar jurisdiction. | `property-kb-mcp` + `tracker-mcp` |
| **Purchase Tracker Agent** | Maintains the master purchase dossier: all screenshots, verification results, documents collected, payments made, checklist items completed. Tracks the purchase through 5 lifecycle phases. Generates dossier summary PDF on demand. Manages S3 storage and lifecycle policies. | `tracker-mcp` |

### Purchase Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PURCHASE LIFECYCLE — 5 PHASES                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: DUE DILIGENCE                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • AnyRoR land record verification (7/12, 8A)                    │   │
│  │ • Gujarat RERA project verification                              │   │
│  │ • eCourts dispute search (seller, builder, society, property)    │   │
│  │ • GARVI registered deed search                                   │   │
│  │ • Municipal property tax verification                            │   │
│  │ • Builder GSTN verification                                      │   │
│  │ • Cross-reference all findings                                   │   │
│  │ • Generate due diligence report with risk score                  │   │
│  │                                                                  │   │
│  │ Output: Due Diligence Report + Risk Score                        │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│                    ┌────────────▼────────────┐                          │
│                    │   🔒 HUMAN CHECKPOINT 1  │                          │
│                    │                          │                          │
│                    │ "Due diligence complete.  │                          │
│                    │  Risk score: 35/100.      │                          │
│                    │  2 yellow flags found.    │                          │
│                    │  Review the report and    │                          │
│                    │  confirm to proceed to    │                          │
│                    │  document review."        │                          │
│                    └────────────┬────────────┘                          │
│                                 │                                       │
│  PHASE 2: DOCUMENT REVIEW & AGREEMENT                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Collect and verify all required documents from builder/seller   │   │
│  │ • Review builder agreement clause-by-clause                      │   │
│  │ • Flag buyer-unfavorable clauses with plain-language explanation  │   │
│  │ • Compare carpet area (agreement vs RERA registered)             │   │
│  │ • Check payment schedule against construction milestones         │   │
│  │ • Verify allotment letter terms against agreement                │   │
│  │ • Generate document completeness checklist                       │   │
│  │                                                                  │   │
│  │ Output: Agreement Review Report + Document Checklist             │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│                    ┌────────────▼────────────┐                          │
│                    │   🔒 HUMAN CHECKPOINT 2  │                          │
│                    │                          │                          │
│                    │ "Agreement review done.   │                          │
│                    │  Found 6 clauses that     │                          │
│                    │  need attention — 2 are   │                          │
│                    │  critical (penalty clause  │                          │
│                    │  + carpet area mismatch).  │                          │
│                    │  Review findings before    │                          │
│                    │  proceeding to financials."│                          │
│                    └────────────┬────────────┘                          │
│                                 │                                       │
│  PHASE 3: FINANCIAL ANALYSIS                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Calculate total cost of ownership                              │   │
│  │ • Look up jantri rate for property zone                          │   │
│  │ • Compute stamp duty (with male/female buyer differentiation)    │   │
│  │ • Calculate registration fee                                     │   │
│  │ • Compute GST (if under-construction)                            │   │
│  │ • Add all deposits, charges, and fees                            │   │
│  │ • Show jantri vs market rate comparison                          │   │
│  │ • Home loan documentation checklist (bank-specific if known)     │   │
│  │                                                                  │   │
│  │ Output: Total Cost Breakdown + Home Loan Doc Checklist           │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│                    ┌────────────▼────────────┐                          │
│                    │   🔒 HUMAN CHECKPOINT 3  │                          │
│                    │                          │                          │
│                    │ "Total cost analysis      │                          │
│                    │  ready. Listed price is    │                          │
│                    │  ₹50,00,000 but actual     │                          │
│                    │  outflow is ₹62,47,800.    │                          │
│                    │  Review the breakdown      │                          │
│                    │  before proceeding to      │                          │
│                    │  registration."            │                          │
│                    └────────────┬────────────┘                          │
│                                 │                                       │
│  PHASE 4: REGISTRATION & EXECUTION                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Step-by-step registration guide (Sub-Registrar specific)       │   │
│  │ • E-stamping process and payment                                 │   │
│  │ • Document preparation checklist for registration day            │   │
│  │ • Biometric verification requirements                            │   │
│  │ • Witness requirements                                           │   │
│  │ • Post-registration document collection                          │   │
│  │ • Track registration appointment and completion                  │   │
│  │                                                                  │   │
│  │ Output: Registration Guide + Registration Day Checklist          │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│                    ┌────────────▼────────────┐                          │
│                    │   🔒 HUMAN CHECKPOINT 4  │                          │
│                    │                          │                          │
│                    │ "Registration complete!    │                          │
│                    │  Document number: [X].     │                          │
│                    │  Now starting post-        │                          │
│                    │  purchase formalities.     │                          │
│                    │  Confirm to proceed."      │                          │
│                    └────────────┬────────────┘                          │
│                                 │                                       │
│  PHASE 5: POST-PURCHASE                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Property mutation (8A record update at Mamlatdar office)       │   │
│  │ • Property tax record update (municipal corporation)             │   │
│  │ • Society/apartment association registration                     │   │
│  │ • Utility connections transfer (electricity, water, gas)         │   │
│  │ • Home loan account setup verification                           │   │
│  │ • Home insurance recommendation                                  │   │
│  │ • Final dossier generation with all evidence                     │   │
│  │                                                                  │   │
│  │ Output: Post-Purchase Checklist + Final Dossier PDF              │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│                    ┌────────────▼────────────┐                          │
│                    │      ✅ COMPLETE          │                          │
│                    │                          │                          │
│                    │ "Purchase process         │                          │
│                    │  complete. Dossier saved   │                          │
│                    │  with 47 verification      │                          │
│                    │  screenshots and all       │                          │
│                    │  documents. You can access  │                          │
│                    │  this anytime."             │                          │
│                    └─────────────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tiered Autonomy Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMY LEVELS                               │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 1  │  Agent: Research & Report                             │
│ (Default)│  ──────────────────────────────────────────          │
│          │  Agent runs due diligence across all portals,         │
│          │  generates verification report with risk score,       │
│          │  captures screenshot evidence. ALL outputs are        │
│          │  read-only reports. No agreement review.              │
│          │  No cost calculation. No registration guidance.       │
│          │  User must take action on every finding.              │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 2  │  Agent: Research + Advise + Track                     │
│ (Proven) │  ──────────────────────────────────────────          │
│          │  Everything in L1, plus: reviews builder agreement    │
│          │  and flags unfavorable clauses, calculates total      │
│          │  cost breakdown, maintains purchase dossier with      │
│          │  evidence, tracks document collection checklist,      │
│          │  provides plain-language explanations of findings.    │
│          │  Human approval for: proceeding past each phase       │
│          │  checkpoint, accepting any yellow/red flag finding.   │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 3  │  Agent: Full Purchase Companion                       │
│ (Full    │  ──────────────────────────────────────────          │
│  trust)  │  Everything in L2, plus: step-by-step registration   │
│          │  guidance, post-purchase formalities tracking,        │
│          │  home loan document preparation, proactive alerts     │
│          │  (RERA registration expiry, construction milestone    │
│          │  dates), payment schedule tracking against builder    │
│          │  milestones, dossier PDF generation.                  │
│          │  Human approval for: phase transitions, accepting     │
│          │  critical risk findings, any payment-related action.  │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ ALL      │  ⛔ NEVER AUTO-EXECUTED (regardless of level)          │
│ LEVELS   │                                                      │
│          │  - Recommending "buy" or "don't buy" — the agent     │
│          │    presents evidence, the buyer decides               │
│          │  - Making any payment or financial transaction        │
│          │  - Signing or digitally executing any document        │
│          │  - Submitting forms on government portals on          │
│          │    behalf of the buyer                                │
│          │  - Skipping or overriding any verification step       │
│          │  - Contacting the builder, seller, or any third      │
│          │    party on behalf of the buyer                       │
│          │  - Sharing buyer's personal information or financial  │
│          │    details with any system                            │
│          │  - Providing legal advice — always frames as          │
│          │    "verification findings" not "legal opinion"        │
│          │  - Dismissing a red flag without buyer acknowledgment │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Disclaimer behavior:** Every report and finding MUST include:
> "This verification is AI-assisted using publicly available government records. It does not constitute legal advice or a legal opinion. For high-value transactions, property disputes, or title issues, consult a qualified property lawyer in Gujarat."

The agent is confident on clear-cut red flags (expired RERA registration, active litigation, seller name not matching 7/12) but cautious on judgment calls (is this jantri rate discrepancy within normal range?). For gray areas: "this finding may need further investigation — recommend verification by a property lawyer."

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Models:
  Orchestration: claude-opus-4-6 (agreement review, cross-reference reasoning across portals,
                                   risk assessment, complex due diligence findings)
                 claude-sonnet-4-6 (portal data extraction, due diligence reports,
                                    cost calculations, document analysis)
                 claude-haiku-4-5 (checklists, simple lookups, jantri rate retrieval,
                                   payment tracking, status updates)
MCP Servers:     4 custom — browser-mcp, property-kb-mcp, document-mcp, tracker-mcp
Browser Auto:    Puppeteer (primary) / Playwright (fallback) for government portal navigation
Document Parse:  DocProof (PDF → clean text, handles scanned documents)
Regional OCR:    Sarvam AI (Gujarati title deeds, old sale deeds, government notices)
Storage:         PostgreSQL (property KB, purchase tracking, verification logs)
File Storage:    S3 (dossier screenshots, documents, generated reports)
Embeddings:      text-embedding-3-small (1536 dimensions) for property KB vector search
CAPTCHA:         Human-in-the-loop (agent pauses, shows CAPTCHA to user) + 2Captcha fallback
PDF Generation:  pdf-lib (dossier summary PDF, cost breakdown report)
Config:          JSON files (jantri rate tables, stamp duty matrix, red flag patterns)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install puppeteer                    # Browser automation (primary)
npm install playwright                   # Browser automation (fallback)
npm install pg                           # PostgreSQL
npm install pgvector                     # Vector search for property KB
npm install zod                          # Schema validation
npm install dayjs                        # Date handling
npm install winston                      # Structured logging
npm install axios                        # HTTP client for DocProof/Sarvam APIs
npm install pdf-lib                      # PDF generation for dossier
npm install sharp                        # Screenshot processing and optimization
npm install crypto-js                    # Hashing for verification log integrity
npm install bullmq ioredis               # Job queue for background portal checks
npm install openai                       # Embeddings API (text-embedding-3-small)
npm install @aws-sdk/client-s3           # S3 for dossier storage
```

---

## 4. Gujarat Government Portal Integration

This is the core differentiator — the agent navigates government portals that have no APIs, extracts structured data from rendered HTML, captures screenshot evidence, and cross-references findings across portals. Each portal section below specifies: what data is available, the navigation flow for browser automation, data extraction strategy, CAPTCHA handling, screenshot capture points, and red flags to detect.

### 4.1 AnyRoR Gujarat (anyror.gujarat.gov.in)

**What:** Land ownership records for all of Gujarat. The 7/12 extract (Satbara Utara) shows current ownership, survey number, area, land type, and crop details. The 8A extract (Khatavahi) shows mutation history — the chain of ownership transfers.

**Why critical:** This is the foundational verification. If the seller's name doesn't appear on the 7/12 extract as owner, the entire transaction is suspect.

**Navigation Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AnyRoR NAVIGATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: Navigate to anyror.gujarat.gov.in                              │
│          ↓                                                              │
│  Step 2: Select "View Land Record — Rural" or "View Land Record —      │
│          Urban" based on property type                                  │
│          ↓                                                              │
│  Step 3: Select District from dropdown (e.g., "SURAT")                 │
│          ↓                                                              │
│  Step 4: Select Taluka from dropdown (e.g., "SURAT CITY")              │
│          ↓                                                              │
│  Step 5: Select Village from dropdown (e.g., "ATHWA")                  │
│          ↓                                                              │
│  Step 6: Enter Survey Number / Block Number / Entry Number             │
│          (Multiple input fields — depends on record type)              │
│          ↓                                                              │
│  Step 7: Solve CAPTCHA                                                  │
│          ⏸️  HUMAN: Agent shows CAPTCHA image, user solves              │
│          ↓                                                              │
│  Step 8: Click "Get Details" / "View"                                   │
│          ↓                                                              │
│  Step 9: Extract data from rendered HTML table                          │
│          📸 Screenshot: Full page with 7/12 data                        │
│          ↓                                                              │
│  Step 10: Navigate to 8A (mutation) tab if available                    │
│           📸 Screenshot: Mutation history table                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Extracted:**

| Field | Source | How Extracted |
|-------|--------|---------------|
| Owner name(s) | 7/12 extract HTML table | Text extraction from `<td>` elements, may be in Gujarati — transliterate |
| Survey number | 7/12 extract | Direct text extraction |
| Block number | 7/12 extract | Direct text extraction |
| Total area (sq.m / vigha) | 7/12 extract | Text extraction + unit parsing |
| Land type | 7/12 extract | e.g., "NA" (Non-Agricultural), "Agricultural", "Residential", "Commercial" |
| Khatavahi number | 7/12 extract | Direct extraction |
| Tenancy rights | 7/12 extract | Check if any tenancy noted |
| Mutation entries | 8A extract | Table rows — each entry has: date, type (sale/inheritance/gift), parties, entry number |
| Latest mutation date | 8A extract | Most recent entry in mutation table |
| Government land flag | 7/12 extract | Check for "government" or "sarkar" in owner field |
| Encumbrance notes | 7/12 extract | Any loans, liens, or restrictions noted |

**CAPTCHA Handling Strategy:**

AnyRoR uses image-based CAPTCHA (distorted text, 5-6 characters). Strategy:
1. **Primary:** Agent captures screenshot of CAPTCHA image, presents to user: "Please solve this CAPTCHA for me to access land records."
2. **Fallback:** If user enables, 2Captcha API for automated solving (adds ₹0.50 per solve, 15-30 second delay).
3. **Retry:** If CAPTCHA solve fails, agent retries with fresh CAPTCHA (up to 3 attempts).

**Screenshot Capture Points:**
- Full 7/12 extract page (primary evidence)
- 8A mutation history page
- CAPTCHA screen (audit trail)
- Any error pages (for debugging)

**Red Flags to Detect:**

| Red Flag | Detection Method | Severity |
|----------|-----------------|----------|
| Seller name does not match 7/12 owner | String comparison (fuzzy match for transliteration differences) | CRITICAL |
| Multiple owners but only one signing | Count owners on 7/12 vs parties in sale agreement | CRITICAL |
| Property marked as agricultural land | Land type field check — "Agricultural" when being sold as residential/commercial | CRITICAL |
| Government land / Sarkar land noted | Owner field contains "Gujarat Government", "Sarkar", or similar | CRITICAL |
| Pending mutation (sale not yet recorded) | Recent mutation entry shows "pending" or no mutation for claimed prior sale | HIGH |
| Tenancy rights recorded | Tenancy field is non-empty | HIGH |
| Area mismatch vs agreement | Compare area on 7/12 vs area stated in builder agreement | HIGH |
| Encumbrance / lien recorded | Encumbrance field is non-empty | HIGH |
| Very old latest mutation | Latest mutation is 10+ years old for claimed recent purchase | MEDIUM |
| NA conversion not visible | Land type still shows agricultural but property is being sold as residential plot/flat | CRITICAL |

### 4.2 Gujarat RERA (gujrera.gujarat.gov.in)

**What:** Gujarat Real Estate Regulatory Authority portal. All real estate projects in Gujarat must be registered under RERA. The portal shows project registration details, builder information, approved plans, construction progress, complaint history, and completion timelines.

**Why critical:** RERA is the buyer's primary protection. An unregistered project or one with expired registration means zero regulatory protection. Complaints filed by other buyers indicate patterns of builder misconduct.

**Navigation Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GUJARAT RERA NAVIGATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SEARCH BY PROJECT NAME:                                                │
│  Step 1: Navigate to gujrera.gujarat.gov.in                             │
│  Step 2: Click "Search Project" / "Project Search"                      │
│  Step 3: Enter project name in search field                             │
│          (Try exact name, then partial match)                           │
│  Step 4: Select District filter (e.g., "Surat")                        │
│  Step 5: Click Search                                                   │
│  Step 6: Select matching project from results list                      │
│          📸 Screenshot: Search results page                              │
│  Step 7: View Project Details page                                      │
│          📸 Screenshot: Full project details                             │
│                                                                         │
│  SEARCH BY RERA NUMBER:                                                  │
│  Step 1: Navigate to gujrera.gujarat.gov.in                             │
│  Step 2: Enter RERA registration number directly                        │
│          (Format: PR/GJ/SURAT/SURAT CITY/SUDA/RAA0XXXX/XXXXXXXX)      │
│  Step 3: View Project Details                                           │
│          📸 Screenshot: Full project details                             │
│                                                                         │
│  FOR EACH PROJECT — NAVIGATE SUB-PAGES:                                 │
│  Step 8: View "Promoter Details" tab                                    │
│          📸 Screenshot: Builder/promoter information                     │
│  Step 9: View "Project Details" tab                                     │
│          📸 Screenshot: Registered carpet area, tower details            │
│  Step 10: View "Complaints" or "Grievance" section                      │
│           📸 Screenshot: Complaints count and status                     │
│  Step 11: View "Quarterly Updates" / "Progress" section                 │
│           📸 Screenshot: Latest construction progress update             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Extracted:**

| Field | Source | How Extracted |
|-------|--------|---------------|
| RERA registration number | Project details page | Direct text extraction |
| Registration date | Project details page | Date parsing |
| Registration expiry date | Project details page | Date parsing — KEY field |
| Project status | Project details page | "Registered" / "Expired" / "Revoked" |
| Promoter/Builder name | Promoter details tab | Text extraction |
| Promoter address | Promoter details tab | Text extraction |
| Total units | Project details tab | Numeric extraction |
| Registered carpet area per unit | Project details tab | Numeric extraction — cross-check with agreement |
| Number of towers/buildings | Project details tab | Numeric extraction |
| Completion date (proposed) | Project details | Date parsing |
| Complaints count | Complaints section | Count of entries |
| Complaint summaries | Complaints section | Text extraction per complaint |
| Latest quarterly update | Progress section | Date + status extraction |
| Approved layout plan | Project details | Check if uploaded/available |
| Sanctioned FSI | Project details | Numeric extraction |

**Red Flags to Detect:**

| Red Flag | Detection Method | Severity |
|----------|-----------------|----------|
| RERA registration expired | Expiry date < current date | CRITICAL |
| Project not found on RERA portal | Search returns no results for given project/builder | CRITICAL |
| Registration revoked | Status = "Revoked" | CRITICAL |
| Multiple complaints filed | Complaints count > 3 | HIGH |
| Complaint pattern — same issue repeated | NLP analysis of complaint text (e.g., all about delays) | HIGH |
| Carpet area mismatch | RERA registered carpet area != what builder is selling in agreement | CRITICAL |
| Completion date already passed | Proposed completion date < current date but project not complete | HIGH |
| No quarterly updates for 6+ months | Latest update date is stale | MEDIUM |
| Carpet area vs super built-up discrepancy | Compare RERA carpet area vs super built-up area in brochure (should be 25-35% difference, not 50%+) | HIGH |
| Multiple projects by same builder with issues | Cross-check builder's other projects on RERA | MEDIUM |
| Sanctioned plan mismatch | Number of floors sanctioned vs what builder is selling | HIGH |

### 4.3 eCourts (ecourts.gov.in)

**What:** National portal for searching pending and disposed court cases across all Indian courts. The agent searches for cases involving the property address, seller name, builder name, and society/project name to find any active or historical disputes.

**Why critical:** This is the verification that most buyers skip entirely. A property might have had years of litigation between the original landowner and builder, between two claimants, or between the builder and regulatory authorities. Historical disputes — even if disposed — can indicate risk patterns.

**Navigation Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    eCOURTS SEARCH STRATEGY                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  The agent runs MULTIPLE searches because court records have            │
│  inconsistent naming. Each search is a separate browser session.        │
│                                                                         │
│  SEARCH 1: Seller Name                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Navigate to ecourts.gov.in/services                      │   │
│  │ Step 2: Select "Case Status" → "Party Name"                      │   │
│  │ Step 3: Select State: "Gujarat"                                  │   │
│  │ Step 4: Select District: e.g., "Surat"                           │   │
│  │ Step 5: Select Court Complex / Establishment                     │   │
│  │ Step 6: Enter party name: seller's full name                     │   │
│  │ Step 7: Solve CAPTCHA                                            │   │
│  │         ⏸️  HUMAN: Agent shows CAPTCHA, user solves               │   │
│  │ Step 8: View results                                             │   │
│  │         📸 Screenshot: Results page                               │   │
│  │ Step 9: For each result — check case details                     │   │
│  │         📸 Screenshot: Case detail page for relevant cases        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  SEARCH 2: Seller Name (variation — without middle name)                │
│  SEARCH 3: Builder/Developer company name                               │
│  SEARCH 4: Builder's key person (director/partner name)                 │
│  SEARCH 5: Society / Association name                                   │
│  SEARCH 6: Project name (if distinctive enough)                         │
│                                                                         │
│  For each search, also check:                                           │
│  - High Court of Gujarat (via HC-specific search)                       │
│  - National Consumer Disputes Redressal Commission (for consumer cases) │
│                                                                         │
│  TOTAL: 6-10 searches per property, each with CAPTCHA                   │
│                                                                         │
│  Name variation strategy:                                                │
│  Input: "Rajeshbhai Kantilal Patel"                                     │
│  Search variations:                                                      │
│  • "Rajeshbhai Kantilal Patel" (full name)                              │
│  • "Rajesh Kantilal Patel" (without -bhai suffix)                       │
│  • "Rajesh K Patel" (abbreviated middle name)                           │
│  • "R K Patel" (initials — may produce too many results, use as last    │
│    resort and filter by case details)                                   │
│  • "Rajesh Patel" (first + last only)                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Extracted Per Case:**

| Field | Source | How Extracted |
|-------|--------|---------------|
| Case number | Results table | Direct extraction (e.g., "CS/123/2019") |
| Case type | Results table | e.g., Civil Suit, Criminal Case, Consumer Complaint, Writ Petition |
| Filing date | Case detail page | Date parsing |
| Parties (petitioner vs respondent) | Case detail page | Text extraction |
| Case status | Results table | "Pending" / "Disposed" |
| Disposal date (if disposed) | Case detail page | Date parsing |
| Next hearing date (if pending) | Case detail page | Date parsing |
| Court name | Results table | Text extraction |
| Case subject/description | Case detail page | Text extraction — NLP to determine property-relatedness |

**Red Flags to Detect:**

| Red Flag | Detection Method | Severity |
|----------|-----------------|----------|
| Active civil litigation involving seller | Pending case with seller as party + case type is property-related | CRITICAL |
| Active criminal case involving builder | Pending criminal case with builder as accused | CRITICAL |
| Recently disposed property case | Disposed within last 2 years — check disposal order for implications | HIGH |
| Consumer complaint against builder | NCDRC/State Commission case against builder | HIGH |
| Multiple cases against same builder | Builder appears in 3+ cases across searches | HIGH |
| Title dispute case | Case description mentions "title", "ownership", "possession" | CRITICAL |
| Injunction/stay order on property | Case orders mention injunction on the property or survey number | CRITICAL |
| Builder is respondent in RERA case | RERA tribunal case against builder | MEDIUM |
| Cheque bounce cases against builder | NI Act cases suggest financial trouble | MEDIUM |
| Cases filed by multiple buyers | Multiple individual complainants against same builder suggest systemic issues | HIGH |

**Note on eCourts limitations:**
- eCourts data is not always up-to-date — there can be a lag of weeks to months
- Not all courts have digitized older records
- Name-based search can produce false positives (common names like "Patel" in Gujarat)
- The agent must cross-reference case details (address, survey number mentions in case text) to filter relevant results

### 4.4 iGR Gujarat / GARVI (garvi.gujarat.gov.in)

**What:** Gujarat Anywhere Registration and Valuation of Immovable-property (GARVI) portal. Shows registered sale deeds, conveyance deeds, and other registered documents. Also provides jantri (ready reckoner) rates used for stamp duty calculation.

**Why critical:** GARVI shows the official registered transaction history of a property. If a property has been bought and sold 4 times in 3 years, that's a potential flipping pattern. If the registered value is significantly lower than the market value, there may be undervaluation (black money component). Jantri rates from GARVI are the basis for stamp duty calculation.

**Navigation Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GARVI NAVIGATION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  REGISTERED DOCUMENT SEARCH:                                            │
│  Step 1: Navigate to garvi.gujarat.gov.in                               │
│  Step 2: Select "Search Registered Document" / "Document Search"        │
│  Step 3: Select District (e.g., "Surat")                               │
│  Step 4: Select Sub-Registrar Office                                    │
│  Step 5: Select document type: "Sale Deed" / "Conveyance Deed"        │
│  Step 6: Enter search criteria:                                         │
│          - Property details (survey number, address)                    │
│          - OR party name (seller/buyer)                                 │
│          - OR document registration number (if known)                   │
│  Step 7: Select date range for search                                   │
│  Step 8: Solve CAPTCHA (if present)                                     │
│  Step 9: View results                                                   │
│          📸 Screenshot: Search results                                   │
│  Step 10: For each relevant result — view document details              │
│           📸 Screenshot: Document detail page                            │
│                                                                         │
│  JANTRI RATE LOOKUP:                                                     │
│  Step 1: Navigate to GARVI jantri rate section                          │
│  Step 2: Select District → Taluka → Village/Zone                       │
│  Step 3: Select property type (Residential / Commercial / Industrial)   │
│  Step 4: View applicable jantri rate                                    │
│          📸 Screenshot: Jantri rate table                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Extracted:**

| Field | Source | How Extracted |
|-------|--------|---------------|
| Document registration number | Document detail page | Direct extraction |
| Registration date | Document detail page | Date parsing |
| Document type | Document detail page | e.g., "Sale Deed", "Agreement to Sell" |
| Seller name(s) | Document detail page | Text extraction |
| Buyer name(s) | Document detail page | Text extraction |
| Property description | Document detail page | Text extraction (survey no, area, address) |
| Registered value (consideration) | Document detail page | Numeric extraction |
| Stamp duty paid | Document detail page | Numeric extraction |
| Sub-Registrar office | Document detail page | Text extraction |
| Jantri rate (₹/sqm) | Jantri rate page | Numeric extraction by zone |

**Red Flags to Detect:**

| Red Flag | Detection Method | Severity |
|----------|-----------------|----------|
| Multiple transactions in short period | 3+ registered deeds for same property within 3 years | HIGH |
| Registered value significantly below market | Registered value < 50% of expected market value (suggests undervaluation) | HIGH |
| Seller name mismatch | Seller name on GARVI doesn't match 7/12 owner or builder agreement | CRITICAL |
| Recent registered agreement to sell with different buyer | Another agreement registered for same property | CRITICAL |
| Power of Attorney transactions | Sale through PoA (common in Gujarat, sometimes misused) | MEDIUM |
| No prior registered deed for seller's ownership | Seller claims ownership but no registered deed found in their favor | HIGH |
| Stamp duty underpayment in prior transaction | Prior deed's stamp duty lower than jantri-mandated amount | MEDIUM |

### 4.5 SMC Property Tax (Surat Municipal Corporation) / Municipal Corporation Portals

**What:** Municipal corporation property tax portal. For Surat, this is the Surat Municipal Corporation (SMC) portal. Shows property ID, owner on record, property classification (residential/commercial), built-up area, tax payment history, and outstanding tax dues.

**Why critical:** Unpaid property tax becomes the buyer's liability after purchase. The owner on municipal records should match the seller. Property classification (residential vs commercial) affects tax rates and usage permissions.

**Navigation Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SMC PROPERTY TAX NAVIGATION FLOW                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: Navigate to SMC property tax portal                            │
│          (suratmunicipal.gov.in or SMC property tax subdomain)         │
│  Step 2: Select "Property Tax" or "Check Property Tax Status"          │
│  Step 3: Search by:                                                     │
│          Option A: Property ID / Ward number                            │
│          Option B: Owner name (less reliable — common names)            │
│          Option C: Zone + Ward + Survey Number                          │
│  Step 4: Solve CAPTCHA (if present)                                     │
│  Step 5: View property details                                         │
│          📸 Screenshot: Property details page                            │
│  Step 6: View tax payment history                                       │
│          📸 Screenshot: Payment history table                            │
│  Step 7: Check outstanding dues                                         │
│          📸 Screenshot: Outstanding amount (if any)                      │
│                                                                         │
│  Note: For cities other than Surat, similar flow applies for:           │
│  - AMC (Ahmedabad Municipal Corporation)                                │
│  - VMC (Vadodara Municipal Corporation)                                 │
│  - RMC (Rajkot Municipal Corporation)                                   │
│  Portal URLs and layouts differ but the data structure is similar.      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Extracted:**

| Field | Source | How Extracted |
|-------|--------|---------------|
| Property ID / Assessment number | Property detail page | Direct extraction |
| Owner name on record | Property detail page | Text extraction |
| Property address | Property detail page | Text extraction |
| Property classification | Property detail page | Residential / Commercial / Industrial |
| Built-up area (sqm) | Property detail page | Numeric extraction |
| Annual tax amount | Tax detail page | Numeric extraction |
| Last payment date | Payment history | Date parsing |
| Outstanding tax dues | Tax detail page | Numeric extraction — critical |
| Ward / Zone | Property detail page | Text extraction |
| Year-wise payment history | Payment history table | Table extraction |

**Red Flags to Detect:**

| Red Flag | Detection Method | Severity |
|----------|-----------------|----------|
| Unpaid property tax (outstanding dues) | Outstanding amount > 0 | HIGH (buyer may inherit liability) |
| Owner name mismatch | Municipal owner != seller name / 7/12 owner | HIGH |
| Property classified differently than sold | Municipal says "commercial" but sold as "residential" (or vice versa) | HIGH |
| Area mismatch | Municipal built-up area significantly different from agreement area | MEDIUM |
| Long gap in tax payments | No payments for 2+ years | MEDIUM |
| Property in dispute zone | Municipal records show dispute/hold flag | CRITICAL |

### 4.6 GSTN (services.gst.gov.in)

**What:** GST Network portal for verifying a builder/developer's GST registration. Simple GSTIN lookup that confirms the builder is a legitimate registered business.

**Why critical:** A builder selling under-construction properties must charge GST. If their GSTIN is inactive or cancelled, it indicates financial/regulatory trouble. For resale properties (individual to individual), GST is not applicable — this check is only for builder purchases.

**Navigation Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GSTN VERIFICATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: Navigate to services.gst.gov.in/services/searchtp             │
│  Step 2: Enter Builder's GSTIN (15-character alphanumeric)             │
│          (Source: builder's letterhead, agreement, or RERA page)        │
│  Step 3: Solve CAPTCHA                                                  │
│  Step 4: View GST registration details                                  │
│          📸 Screenshot: GST registration page                            │
│                                                                         │
│  This is a simple lookup — no complex navigation required.              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Extracted:**

| Field | Source | How Extracted |
|-------|--------|---------------|
| GSTIN | Search result page | Direct extraction |
| Legal name of business | Registration details | Text extraction |
| Trade name | Registration details | Text extraction |
| Registration date | Registration details | Date parsing |
| Status | Registration details | "Active" / "Inactive" / "Cancelled" / "Suspended" |
| Business type | Registration details | Proprietorship / Partnership / Pvt Ltd / LLP |
| Principal place of business | Registration details | Address extraction |
| Additional places of business | Registration details | Address extraction |
| HSN codes | Registration details | Check for construction-related codes (9954, 9972) |

**Red Flags to Detect:**

| Red Flag | Detection Method | Severity |
|----------|-----------------|----------|
| GSTIN is inactive | Status != "Active" | CRITICAL |
| GSTIN is cancelled | Status == "Cancelled" | CRITICAL |
| Business name mismatch | Legal name on GST != builder name on agreement/RERA | HIGH |
| Address mismatch | GST principal place != builder's address on agreement | MEDIUM |
| No construction HSN codes | Missing 9954/9972 HSN codes for a builder | MEDIUM |
| GST registration very recent | Registration date < 1 year for an established builder | MEDIUM |
| Different entity type than expected | e.g., Proprietorship when builder claims to be Pvt Ltd | MEDIUM |

### Cross-Portal Verification Matrix

The real power of this agent is cross-referencing data from multiple portals:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CROSS-PORTAL VERIFICATION MATRIX                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SELLER IDENTITY CHECK:                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ AnyRoR 7/12 owner    ─┐                                        │    │
│  │ RERA promoter name    ─┤─→ ALL must match (fuzzy) ─→ ✅ or 🔴   │    │
│  │ GARVI registered deed ─┤                                        │    │
│  │ SMC property owner    ─┤                                        │    │
│  │ GST legal name        ─┘                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  PROPERTY AREA CHECK:                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ AnyRoR survey area     ─┐                                       │    │
│  │ RERA carpet area        ─┤─→ Must be consistent ─→ ✅ or 🔴     │    │
│  │ Agreement carpet area   ─┤   (within 5% tolerance)              │    │
│  │ SMC built-up area       ─┘                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  LITIGATION CHECK:                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ eCourts (seller name)  ─┐                                       │    │
│  │ eCourts (builder name) ─┤─→ No active disputes ─→ ✅ or 🔴     │    │
│  │ eCourts (society name) ─┤                                       │    │
│  │ RERA complaints         ─┘                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  FINANCIAL CHECK:                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ GARVI registered value  ─┐                                      │    │
│  │ Jantri rate × area      ─┤─→ Price consistency ─→ ✅ or 🔴     │    │
│  │ Agreement price          ─┤                                      │    │
│  │ SMC property tax amount  ─┘                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Purchase Dossier System

The dossier is the agent's evidence vault — every verification finding is backed by a screenshot, every portal check is logged with a timestamp, and all documents collected are organized in a structured directory. This is what differentiates the agent from a simple advice-giving chatbot: it produces a auditable evidence trail that can be handed to a lawyer, bank, or future buyer.

### Directory Structure

```
purchase-dossier/
├── {purchase-id}/                         # e.g., "surat-athwa-flat-2026"
│   ├── metadata.json                      # Purchase metadata (property, buyer, seller, phase)
│   ├── verification-log.json              # Append-only master verification log
│   │
│   ├── due-diligence/
│   │   ├── anyror/
│   │   │   ├── 7-12-extract.png           # Screenshot of 7/12 record
│   │   │   ├── 8a-mutation-history.png    # Screenshot of mutation history
│   │   │   └── anyror-data.json           # Structured extracted data
│   │   ├── rera/
│   │   │   ├── project-details.png        # Screenshot of RERA project page
│   │   │   ├── promoter-details.png       # Screenshot of promoter details
│   │   │   ├── complaints.png             # Screenshot of complaints section
│   │   │   └── rera-data.json             # Structured extracted data
│   │   ├── ecourts/
│   │   │   ├── search-seller-full-name.png
│   │   │   ├── search-seller-short-name.png
│   │   │   ├── search-builder.png
│   │   │   ├── search-society.png
│   │   │   ├── case-detail-CS-123-2019.png  # If relevant case found
│   │   │   └── ecourts-data.json
│   │   ├── garvi/
│   │   │   ├── registered-deeds.png
│   │   │   ├── jantri-rates.png
│   │   │   └── garvi-data.json
│   │   ├── property-tax/
│   │   │   ├── tax-details.png
│   │   │   ├── payment-history.png
│   │   │   └── tax-data.json
│   │   ├── gstn/
│   │   │   ├── gst-registration.png
│   │   │   └── gstn-data.json
│   │   └── due-diligence-report.pdf        # Generated summary report
│   │
│   ├── documents/
│   │   ├── collected/                       # Documents received from builder/seller
│   │   │   ├── builder-agreement.pdf
│   │   │   ├── allotment-letter.pdf
│   │   │   ├── title-deed.pdf
│   │   │   ├── encumbrance-certificate.pdf
│   │   │   ├── occupancy-certificate.pdf
│   │   │   ├── completion-certificate.pdf
│   │   │   ├── noc-society.pdf
│   │   │   ├── noc-bank.pdf
│   │   │   └── ...
│   │   ├── analysis/
│   │   │   ├── agreement-review.json        # Clause-by-clause analysis
│   │   │   └── agreement-review-report.pdf  # Readable report
│   │   └── document-checklist.json          # What's collected vs what's needed
│   │
│   ├── financials/
│   │   ├── cost-breakdown.json              # Structured cost data
│   │   ├── cost-breakdown-report.pdf        # Readable report
│   │   ├── jantri-lookup.json               # Jantri rate data
│   │   ├── stamp-duty-calculation.json      # Detailed stamp duty computation
│   │   └── payment-tracker.json             # Payments made to builder/others
│   │
│   ├── registration/
│   │   ├── registration-guide.pdf           # Step-by-step guide
│   │   ├── registration-checklist.json      # Day-of checklist
│   │   └── registered-deed.pdf              # Final registered deed (post-registration)
│   │
│   ├── post-purchase/
│   │   ├── mutation-status.json
│   │   ├── tax-transfer-status.json
│   │   ├── utility-transfer-status.json
│   │   └── post-purchase-checklist.json
│   │
│   └── dossier-summary.pdf                  # Complete evidence-backed summary
│
└── index.json                               # Index of all purchases
```

### verification-log.json Schema

The verification log is the master audit trail — an append-only log of every verification action taken by the agent.

```json
{
  "purchase_id": "surat-athwa-flat-2026",
  "property": {
    "address": "Flat 401, Sunrise Heights, Nr Athwa Gate, Surat",
    "type": "residential_flat",
    "survey_number": "185/A",
    "builder": "Sunrise Developers Pvt Ltd",
    "seller": "Sunrise Developers Pvt Ltd",
    "rera_number": "PR/GJ/SURAT/SURAT CITY/SUDA/RAA01234/20250101"
  },
  "buyer": {
    "name": "Buyer Name",
    "contact": "9876543210"
  },
  "created_at": "2026-03-20T10:00:00+05:30",
  "current_phase": "due_diligence",
  "verification_entries": [
    {
      "id": "v_001",
      "timestamp": "2026-03-20T10:05:00+05:30",
      "portal": "anyror",
      "action": "7_12_extract_lookup",
      "input": {
        "district": "SURAT",
        "taluka": "SURAT CITY",
        "village": "ATHWA",
        "survey_number": "185/A"
      },
      "result": {
        "status": "success",
        "owner_names": ["SUNRISE DEVELOPERS PVT LTD"],
        "area_sqm": 2450,
        "land_type": "NA - Non Agricultural",
        "encumbrance": "None recorded"
      },
      "screenshots": [
        {
          "filename": "due-diligence/anyror/7-12-extract.png",
          "sha256": "a1b2c3d4e5f6...",
          "captured_at": "2026-03-20T10:05:12+05:30"
        }
      ],
      "red_flags": [],
      "agent_notes": "Owner name on 7/12 matches builder name on agreement. Land type is NA. No encumbrance."
    },
    {
      "id": "v_002",
      "timestamp": "2026-03-20T10:08:00+05:30",
      "portal": "anyror",
      "action": "8a_mutation_lookup",
      "input": {
        "district": "SURAT",
        "taluka": "SURAT CITY",
        "village": "ATHWA",
        "survey_number": "185/A"
      },
      "result": {
        "status": "success",
        "mutation_count": 3,
        "latest_mutation": {
          "date": "2022-06-15",
          "type": "sale",
          "from": "PATEL RAMESH KANTILAL",
          "to": "SUNRISE DEVELOPERS PVT LTD",
          "entry_number": "4521"
        }
      },
      "screenshots": [
        {
          "filename": "due-diligence/anyror/8a-mutation-history.png",
          "sha256": "b2c3d4e5f6a1...",
          "captured_at": "2026-03-20T10:08:25+05:30"
        }
      ],
      "red_flags": [],
      "agent_notes": "Clean mutation history. Builder acquired land from Patel Ramesh Kantilal in 2022 via registered sale deed."
    },
    {
      "id": "v_003",
      "timestamp": "2026-03-20T10:15:00+05:30",
      "portal": "ecourts",
      "action": "party_name_search",
      "input": {
        "state": "Gujarat",
        "district": "Surat",
        "party_name": "Sunrise Developers",
        "search_type": "builder_name"
      },
      "result": {
        "status": "success",
        "cases_found": 2,
        "cases": [
          {
            "case_number": "CS/456/2021",
            "case_type": "Civil Suit",
            "parties": "Patel Govindbhai vs Sunrise Developers Pvt Ltd",
            "status": "Disposed",
            "filing_date": "2021-03-15",
            "disposal_date": "2023-09-20",
            "court": "City Civil Court, Surat"
          },
          {
            "case_number": "CC/78/2024",
            "case_type": "Consumer Complaint",
            "parties": "Shah Mehul vs Sunrise Developers Pvt Ltd",
            "status": "Pending",
            "filing_date": "2024-01-10",
            "next_hearing": "2026-04-15",
            "court": "District Consumer Forum, Surat"
          }
        ]
      },
      "screenshots": [
        {
          "filename": "due-diligence/ecourts/search-builder.png",
          "sha256": "c3d4e5f6a1b2...",
          "captured_at": "2026-03-20T10:15:45+05:30"
        }
      ],
      "red_flags": [
        {
          "severity": "HIGH",
          "code": "ACTIVE_CONSUMER_COMPLAINT",
          "description": "Active consumer complaint (CC/78/2024) against builder — Shah Mehul vs Sunrise Developers. Case pending, next hearing 2026-04-15.",
          "recommendation": "Investigate the complaint details. A consumer complaint from another buyer may indicate delivery delays or quality issues."
        }
      ],
      "agent_notes": "Found 2 cases. CS/456/2021 is disposed (was a land dispute with original landowner, resolved). CC/78/2024 is a pending consumer complaint — flagged as HIGH risk."
    }
  ]
}
```

### Screenshot Management

**Naming Convention:**
```
{portal}-{action}-{timestamp}.png

Examples:
anyror-7-12-extract-20260320T100512.png
rera-project-details-20260320T101030.png
ecourts-search-builder-20260320T101545.png
```

**SHA-256 Hashing:** Every screenshot is hashed immediately after capture. The hash is stored in verification-log.json. This ensures the evidence trail is tamper-evident — if a screenshot is modified after capture, the hash won't match.

**Screenshot Optimization:**
- Captured at full resolution via Puppeteer `page.screenshot()`
- Optimized with `sharp` library to reduce file size while maintaining readability
- Average screenshot size: 200-500 KB
- Total dossier screenshot size per property: 5-15 MB

### Dossier Summary PDF Generation

The agent generates a comprehensive PDF summary using `pdf-lib`:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PROPERTY PURCHASE DOSSIER                                       │
│  ═════════════════════════                                       │
│                                                                  │
│  Property: Flat 401, Sunrise Heights, Athwa, Surat               │
│  Buyer: [Name]                                                   │
│  Date: 2026-03-20                                                │
│  Status: Due Diligence Complete                                  │
│  Risk Score: 35/100 (LOW-MEDIUM)                                 │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│  EXECUTIVE SUMMARY                                               │
│                                                                  │
│  Verified across 6 government portals. 2 items need attention:   │
│  1. Active consumer complaint against builder (HIGH)             │
│  2. Carpet area in agreement is 2% less than RERA (MEDIUM)       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│  VERIFICATION RESULTS                                            │
│                                                                  │
│  ✅ Land Records (AnyRoR) — Owner matches, NA land, no liens     │
│  ✅ RERA — Registered, valid till 2027, 0 complaints on portal   │
│  ⚠️ eCourts — 1 active consumer complaint (see details)          │
│  ✅ GARVI — 1 prior registered deed, clean history               │
│  ✅ Property Tax — Paid up to date, owner matches                │
│  ✅ GSTN — Active registration, name matches                     │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│  [Detailed findings for each portal follow...]                   │
│  [Each finding includes reference to screenshot evidence]        │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│  DISCLAIMER                                                      │
│  This verification is AI-assisted using publicly available       │
│  government records. It does not constitute legal advice.        │
│  For high-value transactions, consult a qualified property       │
│  lawyer in Gujarat.                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### S3 Storage

```
s3://property-dossiers/
├── {purchase-id}/
│   ├── screenshots/           # All portal screenshots
│   ├── documents/             # Collected property documents
│   ├── reports/               # Generated analysis reports
│   └── dossier-summary.pdf    # Final summary
```

**Lifecycle Policy:**
- Active purchases: Standard storage (immediate access)
- Completed purchases (6+ months): Infrequent Access tier
- Archived (2+ years): Glacier tier
- Retention: 10 years (property documentation retention requirement)

### Dossier Metadata Schema (PostgreSQL)

```sql
CREATE TABLE purchase_dossiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id VARCHAR(100) UNIQUE NOT NULL,
    property_address TEXT NOT NULL,
    property_type VARCHAR(50) NOT NULL,          -- residential_flat, commercial_office, plot, etc.
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    survey_number VARCHAR(50),
    rera_number VARCHAR(100),
    builder_name VARCHAR(255),
    seller_name VARCHAR(255),
    buyer_name VARCHAR(255),
    current_phase VARCHAR(30) NOT NULL DEFAULT 'due_diligence',
    risk_score INTEGER,                          -- 0-100
    risk_grade VARCHAR(10),                      -- A (Low), B (Medium), C (High), D (Critical)
    total_red_flags INTEGER DEFAULT 0,
    critical_flags INTEGER DEFAULT 0,
    high_flags INTEGER DEFAULT 0,
    medium_flags INTEGER DEFAULT 0,
    s3_dossier_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE verification_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID REFERENCES purchase_dossiers(id),
    entry_number SERIAL,
    portal VARCHAR(50) NOT NULL,                 -- anyror, rera, ecourts, garvi, smc, gstn
    action VARCHAR(100) NOT NULL,                -- e.g., "7_12_extract_lookup"
    input_params JSONB,
    result_data JSONB,
    screenshot_paths TEXT[],
    screenshot_hashes TEXT[],
    red_flags JSONB DEFAULT '[]',
    agent_notes TEXT,
    status VARCHAR(20) DEFAULT 'success',        -- success, failed, captcha_timeout, portal_down
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dossier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID REFERENCES purchase_dossiers(id),
    document_type VARCHAR(100) NOT NULL,          -- builder_agreement, title_deed, etc.
    file_name VARCHAR(255) NOT NULL,
    s3_path TEXT NOT NULL,
    file_hash VARCHAR(64),                        -- SHA-256
    file_size_bytes BIGINT,
    collected BOOLEAN DEFAULT false,
    required BOOLEAN DEFAULT true,
    analysis_status VARCHAR(20) DEFAULT 'pending', -- pending, analyzed, flagged
    analysis_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID REFERENCES purchase_dossiers(id),
    payment_type VARCHAR(100) NOT NULL,           -- booking_amount, installment_1, stamp_duty, etc.
    amount_inr DECIMAL(15,2) NOT NULL,
    payment_date DATE,
    payment_mode VARCHAR(50),                     -- bank_transfer, cheque, dd, cash
    reference_number VARCHAR(100),
    paid_to VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dossier_city ON purchase_dossiers(city);
CREATE INDEX idx_dossier_phase ON purchase_dossiers(current_phase);
CREATE INDEX idx_verification_portal ON verification_entries(portal);
CREATE INDEX idx_verification_dossier ON verification_entries(dossier_id);
CREATE INDEX idx_documents_dossier ON dossier_documents(dossier_id);
CREATE INDEX idx_payments_dossier ON payment_records(dossier_id);
```

---

## 6. Property Knowledge Base (Gujarat-Specific)

The Property Knowledge Base is the agent's domain expertise — Gujarat-specific rules, rates, documents, and red flag patterns that make it more useful than a generic chatbot.

### 6.1 Jantri (Ready Reckoner) Rates — Surat

Jantri rates are government-mandated minimum property values used for stamp duty calculation. They vary by zone, property type, and construction type.

**Note:** Jantri rates in Gujarat were last significantly revised in 2023, with increases of 100-400% in many areas. The agent must use current rates, not historical ones.

| Zone | Area | Residential Land (₹/sqm) | Residential Flat (₹/sqm) | Commercial (₹/sqm) |
|------|------|--------------------------|--------------------------|---------------------|
| Zone 1 | Athwa, Ghod Dod Road, Piplod | ₹55,000-75,000 | ₹42,000-58,000 | ₹65,000-90,000 |
| Zone 2 | Adajan, Pal, Vesu | ₹40,000-55,000 | ₹32,000-45,000 | ₹50,000-70,000 |
| Zone 3 | City Light, Parle Point | ₹45,000-60,000 | ₹35,000-48,000 | ₹55,000-75,000 |
| Zone 4 | Varachha, Katargam | ₹25,000-35,000 | ₹20,000-28,000 | ₹35,000-50,000 |
| Zone 5 | Udhna, Sachin | ₹18,000-28,000 | ₹15,000-22,000 | ₹25,000-40,000 |
| Zone 6 | Dumas, Dindoli | ₹15,000-22,000 | ₹12,000-18,000 | ₹20,000-32,000 |
| Zone 7 | Olpad, Kamrej (peri-urban) | ₹8,000-15,000 | ₹8,000-12,000 | ₹12,000-22,000 |

**Important:** These are indicative ranges. Actual jantri rates vary by specific survey number and are looked up on GARVI. The agent always fetches the actual rate from the portal rather than using these estimates.

### 6.2 Stamp Duty Rates — Gujarat

| Parameter | Rate |
|-----------|------|
| **Stamp duty on sale deed** | 4.9% of market value or agreement value (whichever is higher, but not less than jantri value) |
| **Female buyer concession** | 0% additional concession in Gujarat (unlike Maharashtra where women get 1% discount) |
| **Registration fee** | 1% of property value (capped at ₹30,000 for residential, no cap for commercial) |
| **E-stamping fee** | ₹50 per e-stamp certificate |
| **Agreement to sell** | ₹100 (fixed stamp duty in Gujarat) |
| **Power of Attorney (property)** | 2% of property value (if for sale purpose) |
| **Mortgage deed** | 0.1% of loan amount (for home loan) |
| **Lease deed (< 5 years)** | 1% of total lease value |
| **Lease deed (5-10 years)** | 2% of total lease value |
| **Lease deed (> 10 years)** | 3.5% of total lease value |

**Stamp duty calculation rule:**
```
Stamp Duty = 4.9% × max(Agreement Value, Jantri Value)

Where:
- Agreement Value = price stated in sale agreement
- Jantri Value = Jantri rate (₹/sqm) × property area (sqm)
```

If the agreement value is lower than jantri value, stamp duty is calculated on jantri value. This means the buyer always pays stamp duty on the higher amount.

### 6.3 GST Rules for Property Purchases

| Scenario | GST Rate | Notes |
|----------|---------|-------|
| **Under-construction flat (affordable)** | 1% (no ITC) | Flat value ≤ ₹45 lakh, carpet area ≤ 60 sqm (metro) or ≤ 90 sqm (non-metro) |
| **Under-construction flat (non-affordable)** | 5% (no ITC) | Flat value > ₹45 lakh or area above threshold |
| **Ready-to-move (with OC)** | 0% | No GST on completed properties with Occupancy Certificate |
| **Resale (individual to individual)** | 0% | No GST on resale of residential property |
| **Commercial property (under-construction)** | 12% (with ITC) | Full GST rate for commercial properties |
| **Plot sale** | 0% | No GST on sale of land |

**Key nuance:** "Under-construction" means the builder has not received OC (Occupancy Certificate) from the authority at the time of agreement. Even if the flat is physically ready but OC is pending, GST applies.

### 6.4 RERA Rules Specific to Gujarat

| Rule | Detail |
|------|--------|
| **Registration threshold** | All projects > 500 sqm land area or > 8 units must register |
| **Carpet area definition** | Net usable floor area excluding walls, balcony, terrace, and common areas (as per RERA Act) |
| **Advance limit** | Builder cannot collect > 10% of flat cost before signing the Agreement for Sale |
| **Structural defect warranty** | 5 years from possession date — builder must fix structural defects free of cost |
| **Penalty for late possession** | Builder must pay interest at SBI Prime Lending Rate + 2% per month to the buyer |
| **Completion date** | As registered with RERA — builder must complete by this date or apply for extension |
| **Complaint filing** | Buyer can file complaint at Gujarat RERA for any violation — ₹1,000 filing fee |
| **Builder obligations** | Must share all approvals, layout plans, and quarterly progress updates on RERA portal |
| **Carpet area lock** | Builder cannot sell more carpet area than registered with RERA for each unit |

### 6.5 Common Document Types and What to Look For

| Document | What It Is | What to Verify | Where to Get |
|----------|-----------|----------------|--------------|
| **7/12 Extract (Satbara Utara)** | Land ownership record showing current owner, survey number, area, land type | Owner matches seller, land is NA (non-agricultural), no encumbrance, area matches | AnyRoR portal |
| **8A Extract (Khatavahi)** | Mutation history — chain of ownership transfers | Clean chain of title, no gaps, latest mutation is in seller's name | AnyRoR portal |
| **Encumbrance Certificate (EC)** | Certificate showing all registered transactions on the property for a given period | No mortgages, no pending liens, no active encumbrances other than known home loan | Sub-Registrar office |
| **Title Deed / Sale Deed** | The registered document that transferred ownership to the current seller | Properly registered, stamp duty paid, parties match, property description matches survey records | Seller provides / GARVI |
| **Builder Agreement / Agreement for Sale** | Contract between buyer and builder specifying terms of purchase | See Section 10 for clause-by-clause review | Builder provides |
| **Allotment Letter** | Initial letter from builder confirming flat allotment and price | Unit number, floor, carpet area, price, payment schedule — must match agreement | Builder provides |
| **Occupancy Certificate (OC)** | Permission from local authority to occupy the building | Must be obtained BEFORE possession, issued by competent authority, covers the specific tower/block | Builder provides / SMC |
| **Completion Certificate (CC)** | Certificate that building construction is complete as per approved plans | Confirms building is constructed per sanctioned plan | Builder provides / SUDA |
| **NOC from Society** | No Objection Certificate from housing society for resale | Required for resale of existing flats — society has no objection to transfer | Society office |
| **NOC from Bank** | If property has existing mortgage, bank's no objection to sale | Required when seller has ongoing home loan — bank must release lien | Seller's bank |
| **NA Order (Non-Agricultural)** | Government order converting agricultural land to non-agricultural use | Must verify the land was officially converted before construction began | Revenue Department / AnyRoR |
| **Approved Building Plan** | Sanctioned plan from SUDA / SMC showing approved floor count, FSI, setbacks | Number of floors, FSI utilization, common area calculation must match what builder is constructing | SUDA / SMC |
| **Commencement Certificate** | Permission to begin construction | Confirms builder had legal permission to start construction | Builder provides / SUDA |
| **Property Tax Receipt** | Latest property tax payment receipt | Tax is paid up to date, no outstanding dues | Municipal corporation |
| **Electricity Meter Transfer** | Last electricity bill / meter details for utility transfer | Needed for post-purchase utility connection transfer | Seller provides / DGVCL |

### 6.6 Red Flag Pattern Library

The agent maintains a library of 30+ red flag patterns, each with severity, detection method, and recommended action:

| # | Red Flag Pattern | Severity | Detection Source | Recommended Action |
|---|-----------------|----------|------------------|--------------------|
| 1 | Seller name on agreement doesn't match 7/12 owner | CRITICAL | AnyRoR vs Agreement | Do NOT proceed. Clarify title chain. |
| 2 | Property is agricultural land being sold as residential | CRITICAL | AnyRoR land type | Verify NA conversion order exists |
| 3 | RERA registration expired | CRITICAL | Gujarat RERA portal | Builder is violating RERA. Do not pay any amount. |
| 4 | Active litigation on property | CRITICAL | eCourts search | Consult property lawyer before proceeding |
| 5 | Government / Sarkar land noted on 7/12 | CRITICAL | AnyRoR owner field | Cannot be sold. Walk away. |
| 6 | Multiple owners on 7/12 but only one signing | CRITICAL | AnyRoR vs Agreement | All co-owners must sign or give PoA |
| 7 | Injunction / stay order on property | CRITICAL | eCourts case details | Property is under court restriction. Do NOT buy. |
| 8 | Carpet area mismatch (RERA vs agreement) | HIGH | RERA vs Agreement | Demand correction to match RERA registered area |
| 9 | Unpaid property tax (outstanding dues) | HIGH | SMC portal | Ensure seller clears all dues before registration |
| 10 | No Occupancy Certificate but builder giving possession | HIGH | Document checklist | Illegal to give possession without OC under RERA |
| 11 | Builder's GSTIN is inactive/cancelled | HIGH | GSTN portal | Financial trouble indicator — investigate further |
| 12 | Multiple consumer complaints against builder | HIGH | eCourts + RERA | Pattern of buyer grievances — proceed with extreme caution |
| 13 | Agreement price significantly below jantri value | HIGH | GARVI jantri vs Agreement | Likely undervaluation — stamp duty shortfall risk |
| 14 | Pending mutation on 7/12 | HIGH | AnyRoR 8A | Title transfer not yet officially recorded |
| 15 | Power of Attorney based sale | HIGH | GARVI deed search | PoA sales have higher fraud risk — verify PoA validity |
| 16 | Encumbrance / bank lien on property | HIGH | AnyRoR + EC | Existing loan must be cleared before sale |
| 17 | Multiple transactions in < 3 years | HIGH | GARVI deed search | Potential property flipping — inflated pricing |
| 18 | Builder GST name mismatch with agreement | HIGH | GSTN vs Agreement | Could be a different entity or shell company |
| 19 | Completion date on RERA already passed | MEDIUM | Gujarat RERA | Builder is delayed — check for extension approval |
| 20 | No quarterly updates on RERA for 6+ months | MEDIUM | Gujarat RERA | Builder not complying with RERA reporting |
| 21 | Very old latest mutation (10+ years) | MEDIUM | AnyRoR 8A | May indicate stagnant ownership — verify chain |
| 22 | Disposed litigation in last 2 years | MEDIUM | eCourts | Check disposal order — ensure it's a clean resolution |
| 23 | Super built-up area > 1.5× carpet area | MEDIUM | Agreement vs RERA | Unusually high loading factor — verify common area calculation |
| 24 | Payment schedule not linked to construction milestone | MEDIUM | Agreement analysis | Risky — builder gets money before building |
| 25 | Force majeure clause is very broad | MEDIUM | Agreement analysis | Builder can delay indefinitely citing force majeure |
| 26 | Possession delay penalty below SBI PLR + 2% | MEDIUM | Agreement vs RERA | Violates Gujarat RERA minimum penalty rate |
| 27 | No structural defect warranty clause | MEDIUM | Agreement analysis | Missing mandatory 5-year warranty under RERA |
| 28 | Municipal property classified differently | MEDIUM | SMC vs Agreement | Tax implications and usage restrictions may differ |
| 29 | Area mismatch between municipal records and agreement | MEDIUM | SMC vs Agreement | Could indicate unauthorized construction |
| 30 | Cheque bounce cases against builder | MEDIUM | eCourts NI Act cases | Financial stress indicator |
| 31 | Agreement price exactly equals jantri value | LOW | GARVI jantri vs Agreement | Common in Gujarat — not necessarily wrong, but noteworthy |
| 32 | Builder is proprietorship (not Pvt Ltd) | LOW | GSTN business type | Less corporate protection for buyer — note for awareness |
| 33 | Project nearing RERA expiry (< 6 months left) | LOW | Gujarat RERA | Builder may need extension — track this |

### 6.7 Post-Purchase Checklist for Gujarat

| # | Task | Where | When | Documents Needed |
|---|------|-------|------|------------------|
| 1 | Collect registered sale deed | Sub-Registrar office | Within 1-2 weeks of registration | Registration receipt, ID |
| 2 | Property mutation (8A update) | Mamlatdar / Talati office | Within 3 months of registration | Registered deed, 7/12, application form |
| 3 | Update property tax records | Municipal corporation (SMC for Surat) | Within 1 month | Registered deed, old tax receipt, ID |
| 4 | Society / Association registration | Housing society office | At possession | Registered deed, allotment letter, builder NOC |
| 5 | Electricity connection transfer | DGVCL (Dakshin Gujarat Vij Company) | At possession | Registered deed, old meter details, ID, society NOC |
| 6 | Water connection transfer | Municipal corporation | At possession | Registered deed, society NOC, application form |
| 7 | Gas connection transfer | Gas company (Adani Gas for Surat) | At possession | Registered deed, ID, society NOC |
| 8 | Home loan EMI start verification | Bank | After disbursement | Loan account details, amortization schedule |
| 9 | Home insurance | Insurance company | Within 1 month of possession | Registered deed, property valuation, loan details |
| 10 | Update address on Aadhaar, PAN | UIDAI, Income Tax | Within 3 months | New address proof (electricity bill / society letter) |
| 11 | Property in income tax declaration | ITR filing | Next tax filing season | Registered deed, loan certificate (Section 24/80C) |
| 12 | Keep originals in safe deposit | Bank locker | Immediately | Original registered deed, original agreement, all NOCs |

---

## 7. MCP Server Specifications

### 7.1 browser-mcp — Government Portal Automation

This MCP server wraps Puppeteer/Playwright to provide high-level tools for each government portal. Each tool handles navigation, CAPTCHA coordination, data extraction, and screenshot capture.

#### Tool: `navigate_anyror`

```typescript
// Input Schema
{
  name: "navigate_anyror",
  description: "Navigate AnyRoR Gujarat portal to fetch 7/12 extract and 8A mutation history for a given survey number",
  input: {
    district: string,           // e.g., "SURAT"
    taluka: string,             // e.g., "SURAT CITY"
    village: string,            // e.g., "ATHWA"
    survey_number: string,      // e.g., "185/A"
    record_type: "7_12" | "8a" | "both",  // default: "both"
    captcha_mode: "human" | "auto",       // default: "human"
  },
  output: {
    status: "success" | "failed" | "captcha_timeout" | "portal_down" | "not_found",
    data_7_12: {
      owner_names: string[],
      survey_number: string,
      block_number: string,
      total_area_sqm: number,
      land_type: string,
      khatavahi_number: string,
      tenancy_notes: string | null,
      encumbrance_notes: string | null,
      raw_text: string,         // Full text extraction for Claude to re-analyze if needed
    } | null,
    data_8a: {
      mutation_entries: Array<{
        date: string,
        type: string,
        from_name: string,
        to_name: string,
        entry_number: string,
      }>,
      total_mutations: number,
      latest_mutation_date: string,
      raw_text: string,
    } | null,
    screenshots: Array<{
      type: string,
      path: string,
      sha256: string,
      captured_at: string,
    }>,
    errors: string[],
  }
}
```

#### Tool: `search_rera`

```typescript
// Input Schema
{
  name: "search_rera",
  description: "Search Gujarat RERA portal for project registration details, builder information, and complaints",
  input: {
    search_type: "project_name" | "rera_number",
    search_value: string,       // project name or RERA number
    district: string,           // e.g., "Surat"
  },
  output: {
    status: "success" | "failed" | "not_found" | "portal_down",
    project: {
      rera_number: string,
      project_name: string,
      registration_date: string,
      expiry_date: string,
      project_status: string,
      promoter_name: string,
      promoter_address: string,
      total_units: number,
      carpet_area_sqm: number,
      towers: number,
      proposed_completion_date: string,
      sanctioned_fsi: number,
      latest_quarterly_update: string,
    } | null,
    complaints: {
      total_count: number,
      complaints: Array<{
        complaint_number: string,
        complainant: string,
        date: string,
        subject: string,
        status: string,
      }>,
    },
    screenshots: Array<{
      type: string,
      path: string,
      sha256: string,
      captured_at: string,
    }>,
    errors: string[],
  }
}
```

#### Tool: `search_ecourts`

```typescript
// Input Schema
{
  name: "search_ecourts",
  description: "Search eCourts portal for cases involving specified party names in Gujarat courts",
  input: {
    party_name: string,         // Name to search for
    name_variations: string[],  // Alternative spellings/formats to try
    state: "Gujarat",
    district: string,           // e.g., "Surat"
    search_scope: "district_court" | "high_court" | "consumer_forum" | "all",
    captcha_mode: "human" | "auto",
  },
  output: {
    status: "success" | "failed" | "captcha_timeout" | "portal_down",
    searches_completed: number,
    total_cases_found: number,
    cases: Array<{
      case_number: string,
      case_type: string,
      court: string,
      parties_petitioner: string,
      parties_respondent: string,
      filing_date: string,
      status: "Pending" | "Disposed",
      disposal_date: string | null,
      next_hearing_date: string | null,
      case_subject: string | null,
      relevance_score: number,   // 0-1, how likely this is property-related
    }>,
    screenshots: Array<{
      type: string,
      path: string,
      sha256: string,
      captured_at: string,
    }>,
    errors: string[],
  }
}
```

#### Tool: `lookup_garvi`

```typescript
// Input Schema
{
  name: "lookup_garvi",
  description: "Search GARVI Gujarat portal for registered documents and jantri rates",
  input: {
    search_type: "registered_document" | "jantri_rate",
    // For registered_document:
    district: string,
    sub_registrar: string,
    document_type: "sale_deed" | "conveyance_deed" | "agreement_to_sell" | "all",
    party_name: string | null,
    survey_number: string | null,
    date_from: string | null,    // YYYY-MM-DD
    date_to: string | null,
    // For jantri_rate:
    zone: string | null,
    property_type: "residential" | "commercial" | "industrial" | null,
  },
  output: {
    status: "success" | "failed" | "not_found" | "portal_down",
    // For registered_document:
    documents: Array<{
      registration_number: string,
      registration_date: string,
      document_type: string,
      seller_names: string[],
      buyer_names: string[],
      property_description: string,
      registered_value_inr: number,
      stamp_duty_paid_inr: number,
      sub_registrar: string,
    }> | null,
    // For jantri_rate:
    jantri_data: {
      zone: string,
      residential_land_per_sqm: number,
      residential_flat_per_sqm: number,
      commercial_per_sqm: number,
      effective_date: string,
    } | null,
    screenshots: Array<{
      type: string,
      path: string,
      sha256: string,
      captured_at: string,
    }>,
    errors: string[],
  }
}
```

#### Tool: `check_property_tax`

```typescript
// Input Schema
{
  name: "check_property_tax",
  description: "Check property tax status on Surat Municipal Corporation or other Gujarat municipal portals",
  input: {
    city: "surat" | "ahmedabad" | "vadodara" | "rajkot",
    search_type: "property_id" | "owner_name" | "zone_ward_survey",
    property_id: string | null,
    owner_name: string | null,
    zone: string | null,
    ward: string | null,
    survey_number: string | null,
  },
  output: {
    status: "success" | "failed" | "not_found" | "portal_down",
    property: {
      property_id: string,
      owner_name: string,
      address: string,
      classification: string,     // Residential / Commercial / Industrial
      built_up_area_sqm: number,
      annual_tax_inr: number,
      outstanding_dues_inr: number,
      last_payment_date: string,
      payment_history: Array<{
        year: string,
        amount_inr: number,
        payment_date: string,
        status: "paid" | "unpaid" | "partial",
      }>,
    } | null,
    screenshots: Array<{
      type: string,
      path: string,
      sha256: string,
      captured_at: string,
    }>,
    errors: string[],
  }
}
```

#### Tool: `verify_gstin`

```typescript
// Input Schema
{
  name: "verify_gstin",
  description: "Verify a builder's GSTIN on the GSTN services portal",
  input: {
    gstin: string,               // 15-character GSTIN
    captcha_mode: "human" | "auto",
  },
  output: {
    status: "success" | "failed" | "invalid_gstin" | "portal_down",
    registration: {
      gstin: string,
      legal_name: string,
      trade_name: string,
      registration_date: string,
      status: "Active" | "Inactive" | "Cancelled" | "Suspended",
      business_type: string,
      principal_place: string,
      additional_places: string[],
      hsn_codes: string[],
      last_return_filed: string | null,
    } | null,
    screenshots: Array<{
      type: string,
      path: string,
      sha256: string,
      captured_at: string,
    }>,
    errors: string[],
  }
}
```

### 7.2 property-kb-mcp — Gujarat Property Knowledge Base

This MCP server provides tools for looking up Gujarat-specific property rules, rates, and patterns.

#### Tool: `get_jantri_rate`

```typescript
{
  name: "get_jantri_rate",
  description: "Look up jantri (ready reckoner) rate for a specific location in Gujarat",
  input: {
    district: string,
    taluka: string,
    village_or_zone: string,
    survey_number: string | null,
    property_type: "residential_land" | "residential_flat" | "commercial" | "industrial",
  },
  output: {
    rate_per_sqm_inr: number,
    effective_date: string,
    zone_name: string,
    source: "garvi_portal" | "kb_cached",
    last_updated: string,
  }
}
```

#### Tool: `calculate_stamp_duty`

```typescript
{
  name: "calculate_stamp_duty",
  description: "Calculate stamp duty, registration fee, and related charges for a Gujarat property transaction",
  input: {
    agreement_value_inr: number,
    jantri_value_inr: number,
    property_type: "residential" | "commercial" | "industrial" | "plot",
    transaction_type: "sale_deed" | "agreement_to_sell" | "lease" | "gift_deed" | "mortgage",
    buyer_gender: "male" | "female" | "joint",
    is_first_property: boolean,
    lease_period_years: number | null,   // For lease transactions
  },
  output: {
    base_value_for_duty: number,         // max(agreement, jantri)
    stamp_duty_rate_percent: number,
    stamp_duty_amount_inr: number,
    registration_fee_inr: number,
    e_stamping_fee_inr: number,
    total_government_charges_inr: number,
    calculation_notes: string[],         // Explain how each amount was derived
  }
}
```

#### Tool: `get_registration_fee`

```typescript
{
  name: "get_registration_fee",
  description: "Get registration fee for a property transaction in Gujarat",
  input: {
    property_value_inr: number,
    property_type: "residential" | "commercial",
    transaction_type: "sale_deed" | "lease" | "gift_deed",
  },
  output: {
    registration_fee_inr: number,
    cap_applied: boolean,
    cap_amount_inr: number | null,
    notes: string,
  }
}
```

#### Tool: `get_required_documents`

```typescript
{
  name: "get_required_documents",
  description: "Get the list of required documents for a specific type of property purchase in Gujarat",
  input: {
    property_type: "residential_flat_new" | "residential_flat_resale" | "commercial_office_new" |
                   "commercial_office_resale" | "residential_plot" | "commercial_plot",
    has_home_loan: boolean,
    purchase_phase: "due_diligence" | "agreement" | "registration" | "post_purchase",
  },
  output: {
    documents: Array<{
      name: string,
      description: string,
      required: boolean,
      source: string,              // Where to get it
      verification_portal: string | null,  // Which portal to verify against
      common_issues: string[],
    }>,
    total_required: number,
    total_optional: number,
  }
}
```

#### Tool: `check_red_flags`

```typescript
{
  name: "check_red_flags",
  description: "Run red flag pattern matching against collected verification data for a property",
  input: {
    verification_data: {
      anyror_data: object | null,
      rera_data: object | null,
      ecourts_data: object | null,
      garvi_data: object | null,
      tax_data: object | null,
      gstn_data: object | null,
      agreement_data: object | null,
    },
  },
  output: {
    risk_score: number,            // 0-100
    risk_grade: "A" | "B" | "C" | "D",  // A=Low, B=Medium, C=High, D=Critical
    red_flags: Array<{
      id: number,
      pattern: string,
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      description: string,
      evidence: string,
      recommended_action: string,
    }>,
    cross_reference_issues: Array<{
      field: string,
      sources: string[],
      values: string[],
      mismatch_type: string,
    }>,
    summary: string,
  }
}
```

### 7.3 document-mcp — Document Parsing & Analysis

#### Tool: `parse_property_document`

```typescript
{
  name: "parse_property_document",
  description: "Parse a property document (PDF/image) and extract structured data",
  input: {
    file_path: string,
    document_type: "7_12_extract" | "8a_extract" | "encumbrance_certificate" | "title_deed" |
                   "sale_deed" | "builder_agreement" | "allotment_letter" | "oc" | "cc" |
                   "noc" | "approved_plan" | "property_tax_receipt" | "other",
    language: "english" | "gujarati" | "hindi" | "mixed",
  },
  output: {
    status: "success" | "failed" | "partial",
    document_type_detected: string,
    language_detected: string,
    text_content: string,
    structured_data: object,      // Varies by document type
    confidence_score: number,     // 0-1, how confident the parser is
    ocr_used: boolean,
    warnings: string[],
  }
}
```

#### Tool: `extract_deed_details`

```typescript
{
  name: "extract_deed_details",
  description: "Extract key details from a sale deed or title deed document",
  input: {
    file_path: string,
    language: "english" | "gujarati" | "hindi" | "mixed",
  },
  output: {
    deed_type: string,
    registration_number: string | null,
    registration_date: string | null,
    seller_names: string[],
    buyer_names: string[],
    property_description: string,
    survey_number: string | null,
    area_sqm: number | null,
    consideration_amount_inr: number | null,
    stamp_duty_paid_inr: number | null,
    sub_registrar: string | null,
    witnesses: string[],
    special_conditions: string[],
    confidence_score: number,
  }
}
```

#### Tool: `analyze_agreement`

```typescript
{
  name: "analyze_agreement",
  description: "Perform clause-by-clause analysis of a builder agreement for buyer-unfavorable terms",
  input: {
    file_path: string,
    agreement_type: "builder_buyer" | "resale" | "plot_sale" | "lease",
    property_value_inr: number,
    rera_carpet_area_sqm: number | null,   // For cross-reference
  },
  output: {
    total_clauses_analyzed: number,
    flagged_clauses: Array<{
      clause_number: string,
      clause_title: string,
      clause_text: string,
      flag_type: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO",
      issue: string,
      plain_language_explanation: string,   // For non-expert buyer
      rera_compliance: boolean | null,      // Does it comply with Gujarat RERA?
      suggested_counter: string | null,     // What the buyer should negotiate
      industry_standard: string | null,     // What is typical in the market
    }>,
    missing_clauses: Array<{
      clause_name: string,
      why_needed: string,
      rera_required: boolean,
    }>,
    carpet_area_analysis: {
      agreement_carpet_sqm: number | null,
      rera_carpet_sqm: number | null,
      super_buildup_sqm: number | null,
      loading_factor_percent: number | null,
      mismatch: boolean,
    } | null,
    payment_schedule_analysis: {
      total_installments: number,
      linked_to_construction: boolean,
      front_loaded: boolean,      // More than 50% before 50% construction
      notes: string[],
    } | null,
    overall_assessment: string,   // Plain language summary for buyer
  }
}
```

### 7.4 tracker-mcp — Purchase Tracking & Dossier Management

#### Tool: `create_purchase`

```typescript
{
  name: "create_purchase",
  description: "Create a new property purchase tracking record and initialize dossier",
  input: {
    property_address: string,
    property_type: "residential_flat" | "commercial_office" | "residential_plot" |
                   "commercial_plot" | "row_house" | "bungalow",
    city: string,
    district: string,
    survey_number: string | null,
    rera_number: string | null,
    builder_name: string | null,
    seller_name: string,
    buyer_name: string,
    expected_price_inr: number,
  },
  output: {
    purchase_id: string,
    dossier_path: string,
    s3_path: string,
    initial_phase: "due_diligence",
    created_at: string,
  }
}
```

#### Tool: `update_phase`

```typescript
{
  name: "update_phase",
  description: "Advance the purchase to the next lifecycle phase (requires human checkpoint confirmation)",
  input: {
    purchase_id: string,
    new_phase: "document_review" | "financial_analysis" | "registration" | "post_purchase" | "complete",
    checkpoint_confirmed: boolean,    // Must be true — agent cannot auto-advance
    checkpoint_notes: string,         // What the buyer acknowledged
  },
  output: {
    status: "success" | "failed",
    previous_phase: string,
    current_phase: string,
    updated_at: string,
    next_actions: string[],
  }
}
```

#### Tool: `log_verification`

```typescript
{
  name: "log_verification",
  description: "Log a verification action to the purchase dossier's verification log",
  input: {
    purchase_id: string,
    portal: "anyror" | "rera" | "ecourts" | "garvi" | "smc" | "gstn" | "manual",
    action: string,
    input_params: object,
    result_data: object,
    screenshots: Array<{
      filename: string,
      sha256: string,
    }>,
    red_flags: Array<{
      severity: string,
      code: string,
      description: string,
      recommendation: string,
    }>,
    agent_notes: string,
  },
  output: {
    entry_id: string,
    entry_number: number,
    logged_at: string,
    total_entries: number,
    total_red_flags: number,
  }
}
```

#### Tool: `add_payment`

```typescript
{
  name: "add_payment",
  description: "Record a payment made by the buyer as part of the property purchase",
  input: {
    purchase_id: string,
    payment_type: "booking_amount" | "installment" | "stamp_duty" | "registration_fee" |
                  "gst" | "maintenance_deposit" | "parking" | "legal_fees" | "brokerage" |
                  "club_house" | "other",
    amount_inr: number,
    payment_date: string,
    payment_mode: "bank_transfer" | "cheque" | "demand_draft" | "cash" | "online",
    reference_number: string | null,
    paid_to: string,
    notes: string | null,
  },
  output: {
    payment_id: string,
    total_paid_inr: number,
    payments_count: number,
    logged_at: string,
  }
}
```

#### Tool: `get_checklist`

```typescript
{
  name: "get_checklist",
  description: "Get the current status of the purchase checklist for a specific phase",
  input: {
    purchase_id: string,
    phase: "due_diligence" | "document_review" | "financial_analysis" |
           "registration" | "post_purchase" | "all",
  },
  output: {
    phase: string,
    items: Array<{
      id: string,
      description: string,
      status: "pending" | "in_progress" | "completed" | "blocked" | "not_applicable",
      completed_at: string | null,
      notes: string | null,
      evidence_path: string | null,
    }>,
    total_items: number,
    completed_items: number,
    completion_percent: number,
  }
}
```

#### Tool: `generate_dossier_summary`

```typescript
{
  name: "generate_dossier_summary",
  description: "Generate a comprehensive PDF summary of the purchase dossier",
  input: {
    purchase_id: string,
    include_screenshots: boolean,    // Embed screenshot thumbnails in PDF
    include_cost_breakdown: boolean,
    include_agreement_review: boolean,
    include_checklist: boolean,
  },
  output: {
    pdf_path: string,
    s3_url: string,
    page_count: number,
    generated_at: string,
    sections_included: string[],
  }
}
```

---

## 8. Orchestrator — Main Agent

### System Prompt

```typescript
const SYSTEM_PROMPT = `You are a Real Estate Transaction Agent — an AI assistant that helps
individual property buyers in Gujarat, India navigate the property purchase process with
confidence. You verify everything using government portal data and present findings in plain
language.

## Your Role
You are a property purchase companion, not a lawyer and not a real estate advisor. You:
- VERIFY claims using government sources (AnyRoR, Gujarat RERA, eCourts, GARVI, SMC, GSTN)
- EXPLAIN findings in simple language that a first-time buyer can understand
- FLAG risks with evidence and severity ratings
- TRACK the purchase through every phase with a dossier of proof
- GUIDE the buyer through registration and post-purchase formalities

## What You NEVER Do
- NEVER recommend "buy" or "don't buy" — present evidence, let the buyer decide
- NEVER make payments or financial transactions
- NEVER sign or execute documents
- NEVER submit forms on government portals on behalf of the buyer
- NEVER skip verification steps even if the buyer asks you to
- NEVER contact the builder, seller, or any third party
- NEVER share buyer's personal or financial information
- NEVER provide legal advice — frame everything as "verification findings"
- NEVER dismiss a red flag without buyer acknowledgment

## Communication Style
- Use simple, clear language — avoid legal jargon unless explaining a specific term
- When you use a technical term, explain it immediately: "Encumbrance (this means a claim
  or lien on the property, like a bank mortgage)"
- Show your work — always reference which portal the data came from
- Be honest about limitations — "I could not access eCourts due to portal downtime"
- Present risk findings factually: "The RERA registration expired 3 months ago" not
  "This is a terrible builder"
- Use INR (₹) for all amounts. Use Indian number formatting (₹50,00,000 not ₹5,000,000)

## Gujarat-Specific Context
- Property transactions follow Gujarat state rules for stamp duty, registration, and RERA
- Jantri rates (ready reckoner) are the government minimum values for stamp duty calculation
- Gujarat RERA is governed by gujrera.gujarat.gov.in
- Land records are on AnyRoR (anyror.gujarat.gov.in)
- Surat Municipal Corporation handles property tax for Surat
- DGVCL handles electricity, Adani Gas handles piped gas in Surat

## Verification Evidence
Every finding must be backed by a screenshot from the government portal. When presenting
findings, always mention: "Verified on [portal name] on [date] — screenshot saved to dossier."

## Phase Management
The purchase goes through 5 phases, each ending with a human checkpoint:
1. Due Diligence → You run all portal checks, present findings, buyer confirms to proceed
2. Document Review → You review agreement and documents, buyer confirms to proceed
3. Financial Analysis → You calculate total cost, buyer confirms to proceed
4. Registration → You guide through registration steps, buyer confirms completion
5. Post-Purchase → You track mutation, tax transfer, utility setup, buyer confirms done

Never auto-advance to the next phase. Always wait for buyer confirmation.

## Disclaimer
Include at the end of every major report:
"This verification is AI-assisted using publicly available government records. It does not
constitute legal advice or a legal opinion. For high-value transactions, property disputes,
or title issues, consult a qualified property lawyer in Gujarat."`;
```

### Phase Management Logic

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

interface PurchaseState {
  purchaseId: string;
  currentPhase: Phase;
  phaseHistory: PhaseTransition[];
  riskScore: number | null;
  redFlags: RedFlag[];
  checkpointsPassed: string[];
}

type Phase =
  | "due_diligence"
  | "document_review"
  | "financial_analysis"
  | "registration"
  | "post_purchase"
  | "complete";

interface PhaseTransition {
  from: Phase;
  to: Phase;
  timestamp: string;
  buyerConfirmation: string;
}

const PHASE_ORDER: Phase[] = [
  "due_diligence",
  "document_review",
  "financial_analysis",
  "registration",
  "post_purchase",
  "complete",
];

const PHASE_TOOLS: Record<Phase, string[]> = {
  due_diligence: [
    "navigate_anyror",
    "search_rera",
    "search_ecourts",
    "lookup_garvi",
    "check_property_tax",
    "verify_gstin",
    "check_red_flags",
    "log_verification",
  ],
  document_review: [
    "parse_property_document",
    "extract_deed_details",
    "analyze_agreement",
    "get_required_documents",
    "log_verification",
  ],
  financial_analysis: [
    "get_jantri_rate",
    "calculate_stamp_duty",
    "get_registration_fee",
    "add_payment",
  ],
  registration: [
    "get_required_documents",
    "get_checklist",
    "add_payment",
  ],
  post_purchase: [
    "get_checklist",
    "generate_dossier_summary",
  ],
  complete: [
    "generate_dossier_summary",
  ],
};

function getNextPhase(current: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

function canAdvancePhase(state: PurchaseState): {
  allowed: boolean;
  reason: string;
} {
  // Check if there are unacknowledged critical red flags
  const unacknowledgedCritical = state.redFlags.filter(
    (f) => f.severity === "CRITICAL" && !f.buyerAcknowledged
  );
  if (unacknowledgedCritical.length > 0) {
    return {
      allowed: false,
      reason: `Cannot proceed — ${unacknowledgedCritical.length} critical red flag(s) require your acknowledgment before moving forward.`,
    };
  }
  return { allowed: true, reason: "Checkpoint ready for buyer confirmation." };
}
```

### Human Checkpoint Enforcement

```typescript
async function handlePhaseCheckpoint(
  state: PurchaseState,
  buyerMessage: string
): Promise<{ proceed: boolean; response: string }> {
  const nextPhase = getNextPhase(state.currentPhase);
  if (!nextPhase) {
    return {
      proceed: false,
      response: "Purchase process is already complete.",
    };
  }

  const advanceCheck = canAdvancePhase(state);
  if (!advanceCheck.allowed) {
    return {
      proceed: false,
      response: advanceCheck.reason,
    };
  }

  // Buyer must explicitly confirm — look for affirmative signals
  const confirmationPatterns = [
    /proceed/i,
    /go ahead/i,
    /continue/i,
    /confirmed?/i,
    /yes/i,
    /move forward/i,
    /next phase/i,
    /aage badho/i,        // Hindi: move ahead
    /chalao/i,            // Gujarati: proceed
  ];

  const isConfirmed = confirmationPatterns.some((p) => p.test(buyerMessage));

  if (!isConfirmed) {
    return {
      proceed: false,
      response: `I've completed ${formatPhaseName(state.currentPhase)}. ` +
        `Please review the findings above and say "proceed" when you're ready ` +
        `to move to ${formatPhaseName(nextPhase)}. ` +
        `Take your time — there's no rush on a decision this important.`,
    };
  }

  return {
    proceed: true,
    response: `Moving to ${formatPhaseName(nextPhase)}.`,
  };
}
```

### Model Selection Strategy

```typescript
const MODEL_SELECTION: Record<string, string> = {
  // Opus — complex reasoning tasks
  agreement_review: "claude-opus-4-6",           // Clause-by-clause agreement analysis
  cross_reference: "claude-opus-4-6",            // Cross-portal data reconciliation
  risk_assessment: "claude-opus-4-6",            // Overall risk scoring and reasoning
  due_diligence_synthesis: "claude-opus-4-6",    // Synthesizing findings across all portals

  // Sonnet — analysis and report generation
  portal_data_analysis: "claude-sonnet-4-6",     // Analyzing extracted portal data
  report_generation: "claude-sonnet-4-6",        // Generating due diligence reports
  document_parsing: "claude-sonnet-4-6",         // Understanding parsed document content
  cost_calculation: "claude-sonnet-4-6",         // Total cost breakdown computation
  red_flag_detection: "claude-sonnet-4-6",       // Pattern matching against red flag library

  // Haiku — simple lookups and status updates
  jantri_lookup: "claude-haiku-4-5",             // Jantri rate retrieval
  checklist_update: "claude-haiku-4-5",          // Updating checklist items
  payment_logging: "claude-haiku-4-5",           // Recording payments
  phase_status: "claude-haiku-4-5",              // Checking current phase status
  document_classification: "claude-haiku-4-5",   // Classifying uploaded documents
};
```

### Orchestrator Entry Point

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// --- Define tools using the tool() function with Zod schemas ---

const navigateAnyror = tool(
  "navigate_anyror",
  "Navigate AnyRoR Gujarat portal to fetch 7/12 extract and 8A mutation history for a given survey number",
  {
    district: z.string(),
    taluka: z.string(),
    village: z.string(),
    survey_number: z.string(),
    record_type: z.enum(["7_12", "8a", "both"]).default("both"),
    captcha_mode: z.enum(["human", "auto"]).default("human"),
  },
  async (params) => {
    const result = await executePortalNavigation("anyror", params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const searchRera = tool(
  "search_rera",
  "Search Gujarat RERA portal for project registration details, builder information, and complaints",
  {
    search_type: z.enum(["project_name", "rera_number"]),
    search_value: z.string(),
    district: z.string(),
  },
  async (params) => {
    const result = await executePortalNavigation("rera", params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const searchEcourts = tool(
  "search_ecourts",
  "Search eCourts portal for cases involving specified party names in Gujarat courts",
  {
    party_name: z.string(),
    name_variations: z.array(z.string()),
    state: z.literal("Gujarat"),
    district: z.string(),
    search_scope: z.enum(["district_court", "high_court", "consumer_forum", "all"]),
    captcha_mode: z.enum(["human", "auto"]).default("human"),
  },
  async (params) => {
    const result = await executePortalNavigation("ecourts", params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const lookupGarvi = tool(
  "lookup_garvi",
  "Search GARVI Gujarat portal for registered documents and jantri rates",
  {
    search_type: z.enum(["registered_document", "jantri_rate"]),
    district: z.string(),
    sub_registrar: z.string().optional(),
    document_type: z.enum(["sale_deed", "conveyance_deed", "agreement_to_sell", "all"]).optional(),
    party_name: z.string().optional(),
    survey_number: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    zone: z.string().optional(),
    property_type: z.enum(["residential", "commercial", "industrial"]).optional(),
  },
  async (params) => {
    const result = await executePortalNavigation("garvi", params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const checkPropertyTax = tool(
  "check_property_tax",
  "Check property tax status on Gujarat municipal portals",
  {
    city: z.enum(["surat", "ahmedabad", "vadodara", "rajkot"]),
    search_type: z.enum(["property_id", "owner_name", "zone_ward_survey"]),
    property_id: z.string().optional(),
    owner_name: z.string().optional(),
    zone: z.string().optional(),
    ward: z.string().optional(),
    survey_number: z.string().optional(),
  },
  async (params) => {
    const result = await executePortalNavigation("property_tax", params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const verifyGstin = tool(
  "verify_gstin",
  "Verify a builder's GSTIN on the GSTN services portal",
  {
    gstin: z.string(),
    captcha_mode: z.enum(["human", "auto"]).default("human"),
  },
  async (params) => {
    const result = await executePortalNavigation("gstn", params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const checkRedFlags = tool(
  "check_red_flags",
  "Run red flag pattern matching against collected verification data for a property",
  {
    verification_data: z.object({
      anyror_data: z.any().optional(),
      rera_data: z.any().optional(),
      ecourts_data: z.any().optional(),
      garvi_data: z.any().optional(),
      tax_data: z.any().optional(),
      gstn_data: z.any().optional(),
      agreement_data: z.any().optional(),
    }),
  },
  async (params) => {
    const result = await runRedFlagCheck(params.verification_data);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const getJantriRate = tool(
  "get_jantri_rate",
  "Look up jantri (ready reckoner) rate for a specific location in Gujarat",
  {
    district: z.string(),
    taluka: z.string(),
    village_or_zone: z.string(),
    survey_number: z.string().optional(),
    property_type: z.enum(["residential_land", "residential_flat", "commercial", "industrial"]),
  },
  async (params) => {
    const result = await lookupJantriRate(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const calculateStampDuty = tool(
  "calculate_stamp_duty",
  "Calculate stamp duty, registration fee, and related charges for a Gujarat property transaction",
  {
    agreement_value_inr: z.number(),
    jantri_value_inr: z.number(),
    property_type: z.enum(["residential", "commercial", "industrial", "plot"]),
    transaction_type: z.enum(["sale_deed", "agreement_to_sell", "lease", "gift_deed", "mortgage"]),
    buyer_gender: z.enum(["male", "female", "joint"]),
    is_first_property: z.boolean(),
    lease_period_years: z.number().optional(),
  },
  async (params) => {
    const result = await computeStampDuty(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const parsePropertyDocument = tool(
  "parse_property_document",
  "Parse a property document (PDF/image) and extract structured data",
  {
    file_path: z.string(),
    document_type: z.enum([
      "7_12_extract", "8a_extract", "encumbrance_certificate", "title_deed",
      "sale_deed", "builder_agreement", "allotment_letter", "oc", "cc",
      "noc", "approved_plan", "property_tax_receipt", "other",
    ]),
    language: z.enum(["english", "gujarati", "hindi", "mixed"]),
  },
  async (params) => {
    const result = await parseDocument(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const analyzeAgreement = tool(
  "analyze_agreement",
  "Perform clause-by-clause analysis of a builder agreement for buyer-unfavorable terms",
  {
    file_path: z.string(),
    agreement_type: z.enum(["builder_buyer", "resale", "plot_sale", "lease"]),
    property_value_inr: z.number(),
    rera_carpet_area_sqm: z.number().optional(),
  },
  async (params) => {
    const result = await runAgreementAnalysis(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const createPurchase = tool(
  "create_purchase",
  "Create a new property purchase tracking record and initialize dossier",
  {
    property_address: z.string(),
    property_type: z.enum([
      "residential_flat", "commercial_office", "residential_plot",
      "commercial_plot", "row_house", "bungalow",
    ]),
    city: z.string(),
    district: z.string(),
    survey_number: z.string().optional(),
    rera_number: z.string().optional(),
    builder_name: z.string().optional(),
    seller_name: z.string(),
    buyer_name: z.string(),
    expected_price_inr: z.number(),
  },
  async (params) => {
    const result = await initializePurchase(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const logVerification = tool(
  "log_verification",
  "Log a verification action to the purchase dossier's verification log",
  {
    purchase_id: z.string(),
    portal: z.enum(["anyror", "rera", "ecourts", "garvi", "smc", "gstn", "manual"]),
    action: z.string(),
    input_params: z.any(),
    result_data: z.any(),
    screenshots: z.array(z.object({ filename: z.string(), sha256: z.string() })),
    red_flags: z.array(z.object({
      severity: z.string(),
      code: z.string(),
      description: z.string(),
      recommendation: z.string(),
    })),
    agent_notes: z.string(),
  },
  async (params) => {
    const result = await writeVerificationLog(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const generateDossierSummary = tool(
  "generate_dossier_summary",
  "Generate a comprehensive PDF summary of the purchase dossier",
  {
    purchase_id: z.string(),
    include_screenshots: z.boolean(),
    include_cost_breakdown: z.boolean(),
    include_agreement_review: z.boolean(),
    include_checklist: z.boolean(),
  },
  async (params) => {
    const result = await buildDossierPdf(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

// --- Create MCP servers from tool groups ---

const browserMcpServer = createSdkMcpServer({
  name: "browser-mcp",
  tools: [navigateAnyror, searchRera, searchEcourts, lookupGarvi, checkPropertyTax, verifyGstin],
});

const propertyKbMcpServer = createSdkMcpServer({
  name: "property-kb-mcp",
  tools: [getJantriRate, calculateStampDuty, checkRedFlags],
});

const documentMcpServer = createSdkMcpServer({
  name: "document-mcp",
  tools: [parsePropertyDocument, analyzeAgreement],
});

const trackerMcpServer = createSdkMcpServer({
  name: "tracker-mcp",
  tools: [createPurchase, logVerification, generateDossierSummary],
});

// --- Orchestrator using query() async generator ---

async function runPurchaseAgent(purchaseId: string) {
  const state = await loadPurchaseState(purchaseId);

  for await (const message of query({
    prompt: buildPhaseContext(state),
    options: {
      model: getModelForTask("orchestration"),
      systemPrompt: SYSTEM_PROMPT,
      maxTurns: 50,
      mcpServers: {
        "browser-mcp": browserMcpServer,
        "property-kb-mcp": propertyKbMcpServer,
        "document-mcp": documentMcpServer,
        "tracker-mcp": trackerMcpServer,
      },
      agents: {
        "due-diligence": {
          description: "Automates browser navigation across Gujarat government portals (AnyRoR, RERA, eCourts, GARVI, SMC, GSTN). Captures screenshots, extracts data, cross-references findings, and produces a risk-scored due diligence report.",
          prompt: `You are the Due Diligence sub-agent. Run all portal checks for the given property, capture screenshot evidence at every step, cross-reference seller/builder names across portals, and produce a structured due diligence report with risk score.`,
          tools: [
            "navigate_anyror", "search_rera", "search_ecourts",
            "lookup_garvi", "check_property_tax", "verify_gstin",
            "check_red_flags", "log_verification",
          ],
        },
        "document-analyzer": {
          description: "Reviews builder agreements, sale deeds, allotment letters and flags buyer-unfavorable clauses. Compares against Gujarat RERA rules and explains findings in plain language.",
          prompt: `You are the Document Analyzer sub-agent. Review property documents clause-by-clause, flag unfavorable terms, check RERA compliance, compare carpet area figures, and explain findings in simple language for first-time buyers.`,
          tools: [
            "parse_property_document", "analyze_agreement",
            "get_required_documents", "log_verification",
          ],
        },
        "cost-intelligence": {
          description: "Calculates total cost of property ownership including stamp duty, registration, GST, deposits, and all hidden charges using jantri rates.",
          prompt: `You are the Cost Intelligence sub-agent. Look up jantri rates, compute stamp duty and registration fees, add all deposits and charges, and produce a comprehensive cost breakdown showing the ACTUAL total outflow.`,
          tools: [
            "get_jantri_rate", "calculate_stamp_duty",
            "get_registration_fee", "add_payment",
          ],
        },
        "registration-guide": {
          description: "Provides step-by-step guidance for property registration at the Gujarat Sub-Registrar's office, including e-stamping, document preparation, and post-registration steps.",
          prompt: `You are the Registration Guide sub-agent. Provide step-by-step registration guidance tailored to the specific property type and Sub-Registrar jurisdiction, covering e-stamping, biometric verification, and document requirements.`,
          tools: [
            "get_required_documents", "get_checklist", "add_payment",
          ],
        },
        "purchase-tracker": {
          description: "Maintains the master purchase dossier with all screenshots, verification results, documents, payments, and checklist status. Generates dossier PDF on demand.",
          prompt: `You are the Purchase Tracker sub-agent. Maintain the purchase dossier, track phase transitions, log verification evidence, manage payment records, and generate comprehensive dossier summary PDFs.`,
          tools: [
            "get_checklist", "generate_dossier_summary",
          ],
        },
      },
    },
  })) {
    if ("result" in message) {
      console.log(message.result);

      // Check if this is a phase checkpoint — pause for buyer input
      if (isPhaseCheckpointMessage(message.result)) {
        break; // Pause the agent loop for buyer confirmation
      }
    }
  }
}
```

---

## 9. Example Analysis — Due Diligence Report

This is a realistic example of what the agent produces after running due diligence on a residential flat in Surat. The property is a 2BHK flat in Athwa, Surat — the buyer has shortlisted this property and wants to verify before proceeding.

### Scenario

- **Property:** Flat 401, Sunrise Heights, Nr Athwa Gate, Athwa, Surat
- **Builder:** Sunrise Developers Pvt Ltd
- **RERA Number:** PR/GJ/SURAT/SURAT CITY/SUDA/RAA01234/20250101
- **Listed Price:** ₹52,00,000
- **Carpet Area (as told by builder):** 95 sqm (1,023 sqft)
- **Type:** Under-construction (expected completion: Dec 2026)

### Due Diligence Report

```
═══════════════════════════════════════════════════════════════════════════
                    PROPERTY DUE DILIGENCE REPORT
═══════════════════════════════════════════════════════════════════════════

Property:    Flat 401, Sunrise Heights, Nr Athwa Gate, Athwa, Surat
Builder:     Sunrise Developers Pvt Ltd
RERA #:      PR/GJ/SURAT/SURAT CITY/SUDA/RAA01234/20250101
Listed Price: ₹52,00,000
Report Date: 2026-03-20
Portals Checked: 6 | Verifications Run: 11 | Screenshots: 14

───────────────────────────────────────────────────────────────────────────
RISK SCORE: 42/100  (GRADE B — MEDIUM RISK)
───────────────────────────────────────────────────────────────────────────

Summary: 0 Critical | 2 High | 2 Medium | 0 Low

Two items need your attention before proceeding:
1. [HIGH] Active consumer complaint against builder by another buyer
2. [HIGH] Carpet area mismatch — builder tells you 95 sqm but RERA
   registration shows 91 sqm
3. [MEDIUM] Builder's RERA completion date is Dec 2026 — only 9 months away,
   and construction appears to be at 65% per latest quarterly update
4. [MEDIUM] One disposed civil suit found — land dispute between original
   landowner and builder, resolved in builder's favor in 2023

───────────────────────────────────────────────────────────────────────────
1. LAND RECORDS (AnyRoR)                                              ✅
───────────────────────────────────────────────────────────────────────────

Verified on anyror.gujarat.gov.in on 2026-03-20 — screenshot saved.

7/12 Extract:
  Owner:          SUNRISE DEVELOPERS PVT LTD
  Survey No:      185/A, Athwa, Surat City
  Area:           2,450 sqm
  Land Type:      NA — Non Agricultural
  Encumbrance:    None recorded
  Tenancy:        None

  ✅ Owner on 7/12 matches the builder name on the agreement.
  ✅ Land is classified as Non-Agricultural — no NA conversion issue.
  ✅ No encumbrance or lien recorded.

8A Mutation History:
  Total mutations: 3
  Chain of title:
    1. [1998] Agricultural land — Patel family (inherited)
    2. [2015] Sold to Shah Realty Trust
    3. [2022] Sold to Sunrise Developers Pvt Ltd

  ✅ Clean chain of title. Each transfer appears properly recorded.
  ✅ Latest mutation (2022) is in the builder's name.

───────────────────────────────────────────────────────────────────────────
2. RERA VERIFICATION (Gujarat RERA)                                   ⚠️
───────────────────────────────────────────────────────────────────────────

Verified on gujrera.gujarat.gov.in on 2026-03-20 — screenshot saved.

Project Details:
  RERA #:              PR/GJ/SURAT/SURAT CITY/SUDA/RAA01234/20250101
  Project Status:      REGISTERED (Active)
  Registration Date:   2025-01-01
  Expiry Date:         2027-12-31
  Promoter:            Sunrise Developers Pvt Ltd
  Total Units:         48
  Towers:              1 (G+14)
  RERA Carpet Area:    91 sqm (for 2BHK type)    ← NOTE THIS
  Proposed Completion: 2026-12-31
  Complaints Filed:    1

  ✅ RERA registration is active and valid until Dec 2027.
  ✅ Builder name matches across portals.

  ⚠️ [HIGH] CARPET AREA MISMATCH:
     Builder told you: 95 sqm (1,023 sqft)
     RERA registered:  91 sqm (980 sqft)
     Difference:       4 sqm (43 sqft) = 4.2% less than what you were told

     What this means: The builder is advertising a carpet area that is 4 sqm
     MORE than what they registered with RERA. Under RERA, the builder CANNOT
     sell you more carpet area than what is registered. Either:
     (a) The builder is including balcony/utility in "carpet area" (misleading)
     (b) The RERA registration needs to be updated
     (c) The actual flat is smaller than what you're being told

     Recommended: Ask the builder to show you the RERA-registered carpet area
     and clarify the 4 sqm difference. Check the agreement — it MUST state
     91 sqm as carpet area per RERA rules.

  ⚠️ [MEDIUM] COMPLETION TIMELINE:
     Proposed completion: Dec 2026 (9 months from now)
     Latest quarterly update (Jan 2026): "65% construction complete"

     35% construction in 9 months is aggressive but not impossible for a
     single tower project. Monitor quarterly updates.

  ℹ️ 1 complaint filed:
     CC/78/2024 — Shah Mehul vs Sunrise Developers (see eCourts section)

───────────────────────────────────────────────────────────────────────────
3. COURT CASES (eCourts)                                              ⚠️
───────────────────────────────────────────────────────────────────────────

Searched ecourts.gov.in on 2026-03-20 — 8 searches run — screenshots saved.

Searches performed:
  1. "Sunrise Developers Pvt Ltd" — 2 cases found
  2. "Sunrise Developers" — 2 cases found (same as above)
  3. Seller individual name (N/A — builder is seller)
  4. "Sunrise Heights" (project name) — 0 cases found
  5. "Sunrise Heights Flat Owners" (society) — 0 cases found

  High Court of Gujarat:
  6. "Sunrise Developers" — 0 cases found

  Consumer Forum:
  7. "Sunrise Developers" — 1 case found (same CC/78/2024)

Cases Found:

  CASE 1: CS/456/2021 — DISPOSED
  Court:      City Civil Court, Surat
  Parties:    Patel Govindbhai vs Sunrise Developers Pvt Ltd
  Filed:      2021-03-15
  Disposed:   2023-09-20
  Type:       Civil Suit (property/land dispute)

  ⚠️ [MEDIUM] This was a land dispute between the original landowner (Patel
  family member) and the builder. The case was disposed in September 2023,
  approximately 1 year before RERA registration. This appears to be a dispute
  that was resolved before the project was formally registered.

  Recommended: This is likely the property dispute you heard about. It's
  disposed (resolved), but you should ask the builder for the disposal order
  to confirm the resolution was in their favor and there are no appeal
  possibilities remaining.

  CASE 2: CC/78/2024 — PENDING ⚠️
  Court:      District Consumer Forum, Surat
  Parties:    Shah Mehul vs Sunrise Developers Pvt Ltd
  Filed:      2024-01-10
  Status:     PENDING
  Next Hearing: 2026-04-15
  Type:       Consumer Complaint

  ⚠️ [HIGH] Active consumer complaint filed by another buyer (Shah Mehul)
  against the same builder. Consumer complaints are typically about:
  - Delay in possession
  - Quality issues
  - Refund disputes
  - Misrepresentation

  I cannot access the full complaint text from eCourts, but the fact that
  another buyer has filed a formal complaint is a signal worth investigating.

  Recommended:
  - Ask the builder about this case directly
  - Try to find out what the complaint is about (the RERA portal sometimes
    shows complaint details)
  - Consider reaching out to other flat owners in the project

───────────────────────────────────────────────────────────────────────────
4. REGISTERED DEEDS (GARVI)                                           ✅
───────────────────────────────────────────────────────────────────────────

Verified on garvi.gujarat.gov.in on 2026-03-20 — screenshot saved.

Registered Documents Found: 1

  Document: Sale Deed
  Registration #: SRT-2022-XXXXXX
  Date: 2022-06-15
  Seller: Patel Ramesh Kantilal, Patel Govindbhai Kantilal
  Buyer: Sunrise Developers Pvt Ltd
  Property: Survey No. 185/A, Athwa, Surat
  Registered Value: ₹3,50,00,000
  Stamp Duty Paid: ₹17,15,000

  ✅ Registered deed confirms builder's purchase of the land in 2022.
  ✅ Seller names on deed (Patel family) match the mutation history on AnyRoR.
  ✅ No other registered deeds found for this survey number after 2022 — no
     duplicate sale concerns.

Jantri Rate for Athwa Zone:
  Residential flat: ₹48,000/sqm
  (This will be used for stamp duty calculation in Phase 3)

───────────────────────────────────────────────────────────────────────────
5. PROPERTY TAX (Surat Municipal Corporation)                         ✅
───────────────────────────────────────────────────────────────────────────

Verified on SMC portal on 2026-03-20 — screenshot saved.

  Property ID:     SMC-ATH-XXXXX
  Owner on Record: Sunrise Developers Pvt Ltd
  Classification:  Residential
  Outstanding Dues: ₹0 (fully paid up to 2025-26)
  Last Payment:    2025-10-15

  ✅ Owner matches builder name.
  ✅ No outstanding tax dues.
  ✅ Property classified as Residential — matches what builder is selling.

───────────────────────────────────────────────────────────────────────────
6. BUILDER GST VERIFICATION (GSTN)                                    ✅
───────────────────────────────────────────────────────────────────────────

Verified on services.gst.gov.in on 2026-03-20 — screenshot saved.

  GSTIN:           24AADCS1234A1Z5
  Legal Name:      SUNRISE DEVELOPERS PRIVATE LIMITED
  Trade Name:      SUNRISE DEVELOPERS
  Status:          ACTIVE
  Registration:    2018-07-01
  Business Type:   Private Limited Company
  HSN Codes:       9954 (Construction services)
  Principal Place: Athwa, Surat, Gujarat

  ✅ GST registration is active.
  ✅ Name matches agreement and RERA.
  ✅ Construction HSN code (9954) is registered — appropriate for a builder.
  ✅ Business has been registered since 2018 — not a fly-by-night operation.

───────────────────────────────────────────────────────────────────────────
CROSS-REFERENCE CHECK
───────────────────────────────────────────────────────────────────────────

  Seller Identity:
  AnyRoR 7/12:  SUNRISE DEVELOPERS PVT LTD          ✅ Match
  RERA:         Sunrise Developers Pvt Ltd            ✅ Match
  GARVI:        Sunrise Developers Pvt Ltd            ✅ Match
  SMC:          Sunrise Developers Pvt Ltd            ✅ Match
  GSTN:         SUNRISE DEVELOPERS PRIVATE LIMITED    ✅ Match

  Property Area:
  AnyRoR (land): 2,450 sqm (total project land)      ✅ Consistent
  RERA (carpet):  91 sqm per 2BHK unit               ⚠️ Mismatch with builder claim
  Agreement:      Not yet reviewed (Phase 2)

───────────────────────────────────────────────────────────────────────────
RECOMMENDATION
───────────────────────────────────────────────────────────────────────────

This property has a MEDIUM risk profile. The fundamental title is clean —
the builder legitimately owns the land, RERA registration is active, and
there are no critical ownership disputes. However, two items need your
attention:

1. CARPET AREA: Clarify the 4 sqm difference between what the builder told
   you (95 sqm) and what RERA shows (91 sqm). This affects your price
   calculation — at ₹52L for 91 sqm, you're paying ₹57,143/sqft, not
   ₹50,831/sqft.

2. CONSUMER COMPLAINT: Understand why another buyer filed a complaint
   against this builder. It may be routine (delayed EMI collection) or
   serious (construction quality, delayed possession).

Would you like to proceed to Phase 2 (Document Review & Agreement Analysis)?
Say "proceed" when ready.

───────────────────────────────────────────────────────────────────────────
DISCLAIMER: This verification is AI-assisted using publicly available
government records. It does not constitute legal advice or a legal opinion.
For high-value transactions, property disputes, or title issues, consult a
qualified property lawyer in Gujarat.
───────────────────────────────────────────────────────────────────────────
```

---

## 10. Example — Builder Agreement Review

This section shows what the Document Analyzer Agent produces when reviewing a typical Gujarat builder-buyer agreement for the same property.

### Key Clauses Flagged

```
═══════════════════════════════════════════════════════════════════════════
                    BUILDER AGREEMENT REVIEW
═══════════════════════════════════════════════════════════════════════════

Agreement: Agreement for Sale — Flat 401, Sunrise Heights
Parties:   Sunrise Developers Pvt Ltd (Promoter) & [Buyer] (Allottee)
Pages:     47 pages
Clauses Analyzed: 38
Flagged: 2 Critical | 3 High | 3 Medium | 2 Info

───────────────────────────────────────────────────────────────────────────
CRITICAL FLAGS
───────────────────────────────────────────────────────────────────────────

🔴 FLAG 1: Possession Delay Penalty (Clause 14.3)
   Severity: CRITICAL

   What the agreement says:
   "In the event of delay in handing over possession beyond the Commitment
   Date, the Promoter shall pay to the Allottee a sum calculated at the
   rate of ₹5 per sq.ft. per month of the Carpet Area as compensation."

   What this means in plain language:
   If the builder is late giving you your flat, they'll pay you ₹5/sqft
   per month. For your 91 sqm (980 sqft) flat, that's only ₹4,900/month
   as penalty. Meanwhile, YOU are paying EMI of ~₹38,000/month on your
   home loan PLUS rent wherever you're living. The penalty doesn't even
   cover 15% of your actual monthly cost.

   What Gujarat RERA says:
   Under Gujarat RERA, the MINIMUM penalty for delayed possession is
   SBI Prime Lending Rate + 2% per annum on the amount paid by the buyer.
   At current rates, SBI PLR is ~8.5%, so the minimum is 10.5% per annum.
   On ₹52,00,000 that's ₹45,500/month — almost 10x what this agreement
   offers.

   ⚠️ This clause VIOLATES Gujarat RERA minimum penalty requirements.

   Suggested counter:
   "The Promoter shall compensate the Allottee at the rate prescribed
   under Section 18 of the RERA Act, 2016 — being the State Bank of
   India's Prime Lending Rate plus two percent per annum, calculated on
   the total amount paid by the Allottee."

───────────────────────────────────────────────────────────────────────────

🔴 FLAG 2: Carpet Area Definition (Clause 3.2)
   Severity: CRITICAL

   What the agreement says:
   "The Carpet Area of the said Flat shall be approximately 95 sq.m.
   (1,023 sq.ft.) including the area of the balcony and enclosed
   utility area."

   What this means in plain language:
   The agreement says 95 sqm — but it includes balcony and utility area
   in the "carpet area." Under RERA, carpet area EXCLUDES balcony and
   utility spaces. The actual RERA-registered carpet area is 91 sqm.
   This is the 4 sqm discrepancy we found during due diligence.

   By including balcony in carpet area, the builder is:
   (a) Making the flat sound bigger than it is
   (b) Charging carpet-area prices for balcony space (which is open)
   (c) Violating RERA's carpet area definition

   What Gujarat RERA says:
   "Carpet area" means the net usable floor area of an apartment,
   excluding the area covered by the external walls, areas under
   services shafts, exclusive balcony or verandah area and exclusive
   open terrace area (RERA Act Section 2(k)).

   Suggested counter:
   "The Carpet Area of the said Flat shall be 91 sq.m. (980 sq.ft.) as
   registered with Gujarat RERA under registration number [RERA #]. The
   balcony area of approximately 4 sq.m. shall be stated separately and
   not included in carpet area."

───────────────────────────────────────────────────────────────────────────
HIGH FLAGS
───────────────────────────────────────────────────────────────────────────

🟡 FLAG 3: Force Majeure Clause (Clause 17)
   Severity: HIGH

   What the agreement says:
   "The Promoter shall not be liable for delay caused by force majeure
   including but not limited to: act of God, fire, flood, earthquake,
   epidemic, pandemic, war, strikes, government action, changes in law,
   non-availability of building materials, shortage of labor, delay in
   obtaining government approvals, or any other circumstances beyond the
   reasonable control of the Promoter."

   What this means in plain language:
   This is an extremely broad force majeure clause. Notice: "delay in
   obtaining government approvals" and "non-availability of building
   materials" are included. These are routine business risks for a
   builder, NOT genuine force majeure events. If the builder is slow in
   getting approvals (which happens often), they can cite force majeure
   and avoid paying you any penalty.

   Industry standard:
   Force majeure should be limited to genuinely unforeseeable events
   (natural disasters, war, pandemic). Routine issues like labor shortage
   or material availability are the builder's business risk to manage.

   Suggested counter:
   Request removal of "non-availability of building materials", "shortage
   of labor", and "delay in obtaining government approvals" from the force
   majeure list. These are foreseeable business risks, not force majeure.

───────────────────────────────────────────────────────────────────────────

🟡 FLAG 4: Specification Changes (Clause 9.4)
   Severity: HIGH

   What the agreement says:
   "The Promoter reserves the right to make minor alterations,
   modifications, or changes in the specifications, layout, and design
   of the Flat and the Project as the Promoter may deem fit and proper,
   without the prior consent of the Allottee, provided such changes do
   not materially alter the Carpet Area by more than 3%."

   What this means in plain language:
   The builder can change the specifications of YOUR flat — tile brand,
   paint quality, fitting brands, kitchen layout, bathroom size — without
   asking you. "Minor" is not defined. A 3% carpet area change means they
   could reduce your flat by ~2.7 sqm (29 sqft) and call it "minor."

   Suggested counter:
   "Any changes in specifications shall require prior written consent of
   the Allottee. Carpet area shall not be reduced below the RERA-registered
   area under any circumstances. If specifications are changed to a lower
   grade, the Allottee shall be compensated proportionally."

───────────────────────────────────────────────────────────────────────────

🟡 FLAG 5: Payment Schedule (Clause 6, Schedule II)
   Severity: HIGH

   Payment schedule from the agreement:

   | Milestone | % of Total Price | Amount (₹) |
   |-----------|-----------------|------------|
   | Booking | 10% | ₹5,20,000 |
   | Agreement signing | 15% | ₹7,80,000 |
   | Plinth completion | 15% | ₹7,80,000 |
   | 5th floor slab | 20% | ₹10,40,000 |
   | 10th floor slab | 15% | ₹7,80,000 |
   | Brickwork completion | 10% | ₹5,20,000 |
   | Plaster/finishing | 10% | ₹5,20,000 |
   | Possession | 5% | ₹2,60,000 |

   Analysis:
   By the time the 5th floor slab is complete (your flat is on 4th floor),
   you would have paid: 10% + 15% + 15% + 20% = 60% of the total price
   (₹31,20,000). But the building is roughly 35% complete at that point.

   This payment schedule is front-loaded — you pay 60% of the money when
   only 35% of the work is done. The builder gets most of your money early,
   reducing their incentive to complete on time.

   Suggested counter:
   Request a more linear payment schedule where payments are proportional to
   construction progress. Ideally: 50% of total price at 50% construction
   completion, with the remaining 50% spread across the second half.

───────────────────────────────────────────────────────────────────────────
MEDIUM FLAGS
───────────────────────────────────────────────────────────────────────────

🟠 FLAG 6: Maintenance Charges (Clause 20)
   The builder will charge maintenance at ₹4/sqft/month for 2 years after
   possession ("interim maintenance period"). After that, the society takes
   over. ₹4/sqft for 91 sqm (980 sqft) = ₹3,920/month. This is on the
   higher side for Surat but not unreasonable. However, there's no cap on
   increases during the interim period.

🟠 FLAG 7: Parking (Clause 22)
   One covered parking is included at ₹3,00,000 (charged separately, not
   in the flat price). Parking is described as "not a guaranteed specific
   slot" — the builder reserves the right to allocate any available slot.
   This means you're paying ₹3L for parking but may get a slot far from
   the elevator.

🟠 FLAG 8: Structural Defect Clause (Clause 15)
   Structural defect warranty is stated as 3 years. Under Gujarat RERA,
   the minimum is 5 years. This clause is non-compliant with RERA.

───────────────────────────────────────────────────────────────────────────
MISSING CLAUSES
───────────────────────────────────────────────────────────────────────────

The following clauses are expected in a Gujarat builder-buyer agreement
but are NOT present:

1. Interest on delayed payments by buyer — RERA requires this to be the
   same rate as the builder's delay penalty (SBI PLR + 2%). Agreement
   specifies 18% p.a. for buyer delays but ₹5/sqft for builder delays —
   this asymmetry is not RERA-compliant.

2. Defect rectification timeline — agreement says builder will fix defects
   "in reasonable time" but doesn't specify a number of days. RERA expects
   30 days for defect rectification.

3. Quality specification schedule — no detailed schedule of fittings,
   brands, and materials. Only vague references to "standard quality."

───────────────────────────────────────────────────────────────────────────
DISCLAIMER: This analysis is AI-assisted and does not constitute legal
advice. For contract negotiations, consult a property lawyer.
───────────────────────────────────────────────────────────────────────────
```

---

## 11. Example — Total Cost Breakdown

This section shows a realistic total cost breakdown for the same property — a ₹52,00,000 residential flat in Athwa, Surat.

```
═══════════════════════════════════════════════════════════════════════════
                    TOTAL COST OF OWNERSHIP
                    Flat 401, Sunrise Heights, Athwa, Surat
═══════════════════════════════════════════════════════════════════════════

Listed Price: ₹52,00,000
RERA Carpet Area: 91 sqm (980 sqft)
Effective Rate: ₹57,143/sqm (₹5,306/sqft) on RERA carpet area

───────────────────────────────────────────────────────────────────────────
JANTRI vs MARKET RATE COMPARISON
───────────────────────────────────────────────────────────────────────────

Jantri rate (Athwa zone):    ₹48,000/sqm
Your agreement rate:         ₹57,143/sqm
Difference:                  ₹9,143/sqm (19% above jantri)

Jantri value of property:    91 sqm × ₹48,000 = ₹43,68,000
Agreement value:             ₹52,00,000
Stamp duty calculated on:    ₹52,00,000 (higher of the two)

Note: A 19% premium over jantri is normal for Athwa area in Surat.
Jantri rates were revised in 2023 and are closer to market rates now,
but a 15-25% gap is typical for premium locations.

───────────────────────────────────────────────────────────────────────────
COST BREAKDOWN
───────────────────────────────────────────────────────────────────────────

A. PROPERTY COST
   ┌──────────────────────────────────────────────────┬──────────────┐
   │ Item                                              │ Amount (₹)   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ Base price (flat)                                 │  52,00,000   │
   │ Covered parking (1 unit)                          │   3,00,000   │
   │ Club house / amenity charges                      │   1,50,000   │
   │ Maintenance deposit (24 months advance)           │     94,080   │
   │   (₹4/sqft × 980 sqft × 24 months)              │              │
   │ Legal charges (builder's lawyer)                  │     25,000   │
   │ Infrastructure development charges                │   1,00,000   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ SUB-TOTAL: BUILDER CHARGES                        │  58,69,080   │
   └──────────────────────────────────────────────────┴──────────────┘

B. GOVERNMENT CHARGES
   ┌──────────────────────────────────────────────────┬──────────────┐
   │ Item                                              │ Amount (₹)   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ Stamp duty (4.9% of ₹52,00,000)                  │   2,54,800   │
   │ Registration fee (1% of ₹52,00,000, cap ₹30,000) │     30,000   │
   │ E-stamping fee                                    │         50   │
   │ GST (5% of ₹52,00,000 — under construction)      │   2,60,000   │
   │   Note: GST is on agreement value minus land      │              │
   │   value. Effective GST = 5% on ~2/3 of price.    │              │
   │   Actual: 5% × ₹34,67,000 = ₹1,73,350           │   1,73,350   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ SUB-TOTAL: GOVERNMENT CHARGES                     │   4,58,200   │
   └──────────────────────────────────────────────────┴──────────────┘

   GST Note: For under-construction properties, GST is calculated as:
   GST = 5% × (Agreement Value - Value of Land)
   Land value is typically 1/3 of the total for residential flats.
   So: 5% × (₹52,00,000 - ₹17,33,000) = 5% × ₹34,67,000 = ₹1,73,350

   Builder may charge you ₹2,60,000 (5% on full amount) — push back
   and ask for the correct calculation with land abatement.

C. OTHER CHARGES
   ┌──────────────────────────────────────────────────┬──────────────┐
   │ Item                                              │ Amount (₹)   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ Brokerage (if applicable, 1% of flat price)       │     52,000   │
   │ Your lawyer's fee (agreement review + registration)│    15,000   │
   │ Property insurance (first year)                   │      5,000   │
   │ Society formation / registration charges          │     10,000   │
   │ Electricity meter deposit (DGVCL)                 │      5,000   │
   │ Water connection deposit (SMC)                    │      2,000   │
   │ Gas connection (Adani Gas)                        │      6,000   │
   │ Address change / documentation                    │      1,000   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ SUB-TOTAL: OTHER CHARGES                          │     96,000   │
   └──────────────────────────────────────────────────┴──────────────┘

───────────────────────────────────────────────────────────────────────────
TOTAL
───────────────────────────────────────────────────────────────────────────

   ┌──────────────────────────────────────────────────┬──────────────┐
   │ Builder charges                                   │  58,69,080   │
   │ Government charges                                │   4,58,200   │
   │ Other charges                                     │     96,000   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ TOTAL COST OF OWNERSHIP                           │  64,23,280   │
   ├──────────────────────────────────────────────────┼──────────────┤
   │ "Listed price" you were told                      │  52,00,000   │
   │ ACTUAL total outflow                              │  64,23,280   │
   │ DIFFERENCE                                        │  12,23,280   │
   │ Percentage over listed price                      │     23.5%    │
   └──────────────────────────────────────────────────┴──────────────┘

   The actual cost is ₹12,23,280 MORE than the "price" you were quoted.
   That's 23.5% over the listed price. This is typical in India — the
   "price" never includes everything.

───────────────────────────────────────────────────────────────────────────
HOME LOAN IMPACT (if applicable)
───────────────────────────────────────────────────────────────────────────

   Assuming 80% loan on flat price:
   Loan amount:          ₹41,60,000
   Interest rate:        ~8.75% p.a. (current market rate)
   Tenure:               20 years
   EMI:                  ~₹37,500/month

   Total interest paid:  ~₹48,40,000 over 20 years
   Total amount repaid:  ~₹90,00,000

   You need to arrange from your own funds:
   Down payment (20%):   ₹10,40,000
   Stamp duty + reg:     ₹4,58,200
   Other charges:        ₹9,65,080 (builder extras + misc)
   Total own funds:      ~₹24,63,280

───────────────────────────────────────────────────────────────────────────
DISCLAIMER: Costs are estimated based on current rates and may vary.
GST calculation depends on builder's methodology. Verify exact amounts
with the builder and your CA before making payments.
───────────────────────────────────────────────────────────────────────────
```

---

## 12. Cost Estimates (INR)

### Claude API Usage Per Property Analysis

| Operation | Model | Tokens (est.) | Cost (est.) |
|-----------|-------|---------------|-------------|
| Portal navigation decisions (6 portals × ~5 pages each) | Haiku | ~15,000 input + 5,000 output | ~₹3 |
| Data extraction from portal HTML (6 portals) | Sonnet | ~30,000 input + 8,000 output | ~₹30 |
| eCourts multi-search (8-10 searches) | Sonnet | ~20,000 input + 5,000 output | ~₹20 |
| Cross-reference analysis across portals | Opus | ~25,000 input + 5,000 output | ~₹40 |
| Due diligence report generation | Sonnet | ~15,000 input + 8,000 output | ~₹20 |
| Agreement review (40-60 pages) | Opus | ~80,000 input + 15,000 output | ~₹150 |
| Cost breakdown calculation | Sonnet | ~5,000 input + 3,000 output | ~₹6 |
| Red flag pattern matching | Sonnet | ~10,000 input + 3,000 output | ~₹10 |
| Dossier summary PDF generation | Haiku | ~8,000 input + 3,000 output | ~₹2 |

### Per-Property Analysis Cost

| Scope | Claude API | CAPTCHA (2Captcha) | Total |
|-------|-----------|-------------------|-------|
| **Phase 1 only** (Due Diligence) | ~₹125 | ~₹15 (30 CAPTCHAs) | **~₹140** |
| **Phase 1 + 2** (+ Agreement Review) | ~₹275 | ~₹15 | **~₹290** |
| **Phase 1 + 2 + 3** (+ Financial Analysis) | ~₹295 | ~₹15 | **~₹310** |
| **Full lifecycle** (all 5 phases) | ~₹320 | ~₹15 | **~₹335** |

### Comparison with Traditional Alternatives

| Approach | Cost | Time | What You Get |
|----------|------|------|-------------|
| **This agent (full lifecycle)** | ₹300-400 | 30-45 minutes | 6-portal verification, agreement review, cost breakdown, evidence dossier |
| **Property lawyer (basic)** | ₹10,000-25,000 | 7-15 days | Title search, basic document review — often no portal-level verification |
| **Property lawyer (thorough)** | ₹25,000-50,000 | 15-30 days | Full title search, agreement review, registration support |
| **CA for stamp duty** | ₹2,000-5,000 | 2-3 days | Stamp duty calculation and advice |
| **Online "property verification" services** | ₹3,000-10,000 | 3-7 days | Basic RERA check, title report (often templated, not portal-verified) |
| **DIY (buyer does everything)** | ₹0 (your time) | 20-40 hours | Incomplete, error-prone, no evidence trail |

### ROI Justification

The cost of missing a problem is orders of magnitude higher than the verification cost:

| Missed Issue | Typical Cost to Buyer |
|--------------|-----------------------|
| Purchased property with disputed title | ₹5,00,000 - ₹50,00,000+ (litigation) |
| Carpet area 5% less than claimed | ₹2,50,000 - ₹5,00,000 (overpaid) |
| Stamp duty shortfall discovered later | ₹50,000 - ₹2,00,000 (penalty + difference) |
| Unpaid property tax inherited | ₹25,000 - ₹2,00,000 (with interest) |
| Builder goes bankrupt mid-construction | Full investment (₹20,00,000 - ₹1,00,00,000) |
| Delayed possession with weak penalty clause | ₹2,00,000 - ₹10,00,000 (lost rent + EMI burden) |
| RERA non-compliant agreement clauses | Enforcement difficulty — reduced legal protection |

**At ₹300-400 per property verification, the agent costs less than a single dinner out — for the most important financial decision of most people's lives.**

---

## 13. Deployment & Rollout

### Phased Rollout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PHASES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: DUE DILIGENCE MVP (Week 1-8)                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Browser automation for 3 core portals:                         │   │
│  │   - AnyRoR (land records)                                        │   │
│  │   - Gujarat RERA (project verification)                          │   │
│  │   - GSTN (builder GST check)                                     │   │
│  │ • CAPTCHA handling (human-in-the-loop)                            │   │
│  │ • Screenshot capture and verification log                         │   │
│  │ • Cross-reference check (name matching across portals)            │   │
│  │ • Red flag detection (top 15 patterns)                            │   │
│  │ • Basic due diligence report generation                           │   │
│  │ • Property Knowledge Base v1 (Surat jantri rates, stamp duty)    │   │
│  │ • Test with 5 real properties in Surat:                           │   │
│  │   - 2 residential flats (different builders)                      │   │
│  │   - 1 commercial office                                           │   │
│  │   - 1 resale flat                                                 │   │
│  │   - 1 residential plot                                            │   │
│  │ • Target: <15 min per due diligence check                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 2: FULL DUE DILIGENCE + DOCUMENT REVIEW (Week 9-14)             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Add remaining portals:                                          │   │
│  │   - eCourts (dispute search with multi-strategy)                  │   │
│  │   - GARVI (registered deeds + jantri lookup)                      │   │
│  │   - SMC property tax (Surat-specific)                             │   │
│  │ • Agreement review engine (clause-by-clause analysis)             │   │
│  │ • Document parsing (DocProof + Sarvam AI for Gujarati)            │   │
│  │ • Cost calculation (stamp duty, GST, total cost breakdown)        │   │
│  │ • Purchase dossier system (full directory, verification log)      │   │
│  │ • Red flag library expanded to 30+ patterns                       │   │
│  │ • Test with 10 more real properties                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 3: FULL PURCHASE COMPANION (Week 15-20)                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Registration guide (step-by-step for Gujarat Sub-Registrar)     │   │
│  │ • Post-purchase checklist and tracking                            │   │
│  │ • Payment tracker (all payment streams)                           │   │
│  │ • Home loan document checklist (bank-specific)                    │   │
│  │ • Dossier summary PDF generation                                  │   │
│  │ • S3 storage with lifecycle policies                              │   │
│  │ • Full 5-phase lifecycle with human checkpoints                   │   │
│  │ • Portal resilience (handle layout changes, downtime)             │   │
│  │ • Web UI for dossier viewing (basic React app)                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 4: SCALE & EXPAND (Week 21+)                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Expand to other Gujarat cities:                                 │   │
│  │   - Ahmedabad (AMC property tax portal)                           │   │
│  │   - Vadodara (VMC portal)                                         │   │
│  │   - Rajkot (RMC portal)                                           │   │
│  │ • State expansion architecture:                                   │   │
│  │   - Maharashtra (IGR Maharashtra, MahaRERA, MahaRera complaint)   │   │
│  │   - Karnataka (Kaveri, Karnataka RERA, BBMP tax)                  │   │
│  │   - Multi-state property KB with state-specific modules           │   │
│  │ • API for third-party integration (real estate platforms, banks)  │   │
│  │ • Multi-tenant for property advisory firms                        │   │
│  │ • Automated portal monitoring (track RERA status changes)         │   │
│  │ • Historical property analytics (price trends by area)            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Validation Plan — Real Properties in Surat

The agent will be tested against real properties identified by the user:

| Test Property | Type | Key Verification Points |
|--------------|------|------------------------|
| Commercial office in Surat (user's actual purchase) | Commercial office | RERA verification, stamp duty (commercial rates), GST at 12%, builder verification |
| Residential flat in Surat (user's actual purchase) | Residential flat | RERA carpet area cross-check, eCourts dispute history (known historical dispute), stamp duty calculation, agreement review |
| Known clean property | Residential flat | Baseline — expect green flags across all portals |
| Known problematic property (if identifiable) | Any | Validate red flag detection against known issues |
| Resale property | Residential flat | Different workflow — no RERA, no builder GST, focus on title chain |

### Portal Resilience Strategy

Government portals are notoriously unreliable. The agent must handle:

| Issue | Strategy |
|-------|---------|
| **Portal down** | Retry 3 times with exponential backoff. If still down, log as "portal_unavailable" and continue with other portals. Alert buyer. |
| **Layout change** | Use semantic selectors (text content, ARIA labels) rather than CSS class names. Maintain a selector map that can be updated without code changes. |
| **CAPTCHA change** | If CAPTCHA type changes from image to reCAPTCHA or hCAPTCHA, fall back to human-in-the-loop for all CAPTCHAs. |
| **Session timeout** | Detect timeout (redirect to login page) and re-authenticate. For AnyRoR, this means re-navigating from district selection. |
| **Rate limiting** | Add 3-5 second delays between portal requests. If rate limited, wait 60 seconds and retry. |
| **Partial data** | If a portal returns partial data (e.g., 7/12 without mutation history), log what was extracted and flag what's missing. |
| **New portal version** | When a portal redesign is detected (major HTML structure change), pause automation and alert for selector map update. |

---

## 14. Security & Privacy

Property transactions involve some of the most sensitive personal and financial data a person has. The agent must handle this with extreme care.

| Concern | Mitigation |
|---------|-----------|
| **Personal data exposure** | Buyer's name, address, PAN, Aadhaar (for registration), financial details — all stored encrypted at rest (AES-256-GCM). Never sent to third-party APIs without explicit consent. |
| **Government portal credentials** | The agent NEVER stores or requests government portal login credentials. Portals used (AnyRoR, RERA, eCourts, GARVI, GSTN) are public-access — no login required. SMC property tax may require property ID but not personal credentials. |
| **Dossier confidentiality** | Each buyer's dossier is isolated. No cross-buyer data access. S3 buckets use per-buyer encryption keys. API access requires authentication. |
| **Screenshot evidence integrity** | All screenshots are SHA-256 hashed immediately after capture. Hashes stored in the append-only verification log. Tampering is detectable. |
| **No data sharing** | Property verification data is never shared between buyers, even for the same property. Each buyer gets an independent verification. |
| **Browser automation audit trail** | Every portal navigation action is logged with timestamp, URL, and screenshot. Full audit trail for every interaction. |
| **Payment data** | Payment records (amounts, dates, references) stored in PostgreSQL with field-level encryption. Agent never processes actual payments — only records them. |
| **Third-party API data** | DocProof and Sarvam AI receive document data for parsing. Contracts should specify: no data retention by third party, encrypted transit, processing-only access. |
| **Data retention** | Active dossiers: hot storage. Completed purchases: moved to cold storage after 6 months. All data deleted after 10 years unless buyer requests extension. Buyer can request deletion at any time. |
| **Access control** | Role-based: Buyer (full access to own dossier), Property Advisor (read access to assigned dossiers), Admin (system management, no dossier content access). |
| **CAPTCHA interaction** | When CAPTCHA screenshots are shown to the user, they are displayed transiently and not stored beyond the verification session. |
| **Portal scraping legality** | All portals accessed are public-access government portals providing public information. Data extracted is publicly available records. Browser automation mimics normal user access patterns with rate limiting. |

---

## 15. Example Conversations

### Starting a New Property Verification

```
User: I'm looking at a 2BHK flat in Sunrise Heights, Athwa, Surat. The
      builder is Sunrise Developers and the RERA number is PR/GJ/SURAT/
      SURAT CITY/SUDA/RAA01234/20250101. Price is 52 lakhs. Can you
      check this property?

Agent: I'll set up a verification dossier for this property and begin
       due diligence across Gujarat government portals.

       Property: 2BHK flat, Sunrise Heights, Athwa, Surat
       Builder: Sunrise Developers Pvt Ltd
       RERA #: PR/GJ/SURAT/SURAT CITY/SUDA/RAA01234/20250101
       Price: ₹52,00,000

       To get started, I need a few details:
       1. What is the survey number? (Should be on the brochure or
          allotment letter)
       2. Do you have the builder's GSTIN? (Usually on their letterhead)
       3. Is this under-construction or ready-to-move?
       4. Is the seller the builder directly, or is this a resale from
          another individual?

       I'll check 6 portals: AnyRoR (land records), Gujarat RERA
       (project verification), eCourts (dispute history), GARVI
       (registered deeds), SMC (property tax), and GSTN (builder GST).

       This will take about 15-20 minutes. I'll need your help with
       CAPTCHAs — I'll show them to you as they come up.

User: Survey number is 185/A. GSTIN is 24AADCS1234A1Z5. It's under
      construction, buying directly from the builder.

Agent: Starting due diligence. First portal: AnyRoR for land records.

       [Navigating to anyror.gujarat.gov.in...]
       [Selected District: SURAT, Taluka: SURAT CITY, Village: ATHWA]
       [Entered Survey No: 185/A]

       I need you to solve a CAPTCHA: [shows CAPTCHA image]
       Please type the characters you see.

User: X7K2M

Agent: [Submitting CAPTCHA...]
       [Extracting 7/12 data...]
       [Screenshot captured and saved to dossier]

       7/12 result: Land is owned by Sunrise Developers Pvt Ltd.
       Non-agricultural land, 2,450 sqm. No encumbrance recorded.

       Moving to 8A mutation history...
       [Extracting mutation data...]
       [Screenshot captured]

       Mutation history shows clean chain: Patel family → Shah Realty
       Trust → Sunrise Developers (2022).

       Now checking Gujarat RERA portal...
       [Navigating to gujrera.gujarat.gov.in...]
```

### Asking About a Specific Finding

```
User: You mentioned a consumer complaint against the builder. Can you
      tell me more about what it might be about?

Agent: The case I found is CC/78/2024 — Shah Mehul vs Sunrise Developers
       Pvt Ltd, pending at the District Consumer Forum in Surat. The
       next hearing is on 2026-04-15.

       Unfortunately, eCourts doesn't show the full complaint text for
       consumer cases. However, based on the case type and pattern,
       consumer complaints against builders are typically about:

       1. Delayed possession (most common — builder missed commitment date)
       2. Quality/specification issues (builder used inferior materials)
       3. Refund dispute (buyer wants to exit, builder won't refund)
       4. Misrepresentation (carpet area, amenities, or other promises)
       5. Hidden charges (demands for money not in the original agreement)

       What I can tell you:
       - This is a single complaint, not multiple — that's less concerning
         than 5+ complaints which would indicate a systemic problem
       - The case was filed in January 2024, so it's been pending for over
         2 years — consumer forum cases in Surat typically take 1-3 years
       - The RERA portal shows 0 complaints filed through RERA itself —
         this buyer chose the consumer forum route instead

       What you can do:
       - Ask the builder directly: "I see a consumer case CC/78/2024.
         Can you explain what it's about?"
       - Check if you know anyone else who's bought in Sunrise Heights
         and ask about their experience
       - The next hearing is April 15 — the case details may be
         available from a lawyer if you want to investigate further

       This alone is not a reason to walk away, but combined with the
       carpet area mismatch, it's worth getting clear answers from the
       builder before signing anything.

       Verified on ecourts.gov.in on 2026-03-20 — screenshot saved to
       dossier.
```

### Checking Post-Purchase Status

```
User: We've done registration. What's next?

Agent: Congratulations on completing registration! Moving to Phase 5:
       Post-Purchase formalities.

       Here's your post-purchase checklist for Gujarat:

       ☐ Property mutation (8A update)
         Where: Mamlatdar / Talati office, Athwa Taluka
         When: Within 3 months of registration
         Documents: Registered deed (original + copy), 7/12 extract,
         application form, ID proof
         Status: PENDING

       ☐ Property tax transfer (SMC)
         Where: Surat Municipal Corporation, Zone office
         When: Within 1 month
         Documents: Registered deed, old tax receipt from builder,
         ID proof, application form
         Status: PENDING

       ☐ Society registration
         Where: Sunrise Heights Society office (once formed)
         When: At possession
         Documents: Registered deed, allotment letter, builder NOC,
         share certificate application
         Status: WAITING (society not yet formed for under-construction)

       ☐ Electricity connection (DGVCL)
       ☐ Water connection (SMC)
       ☐ Gas connection (Adani Gas)
       ☐ Home loan EMI verification
       ☐ Home insurance
       ☐ Address update (Aadhaar, PAN)
       ☐ Income tax filing update

       Priority: Start with mutation (8A update) — this is the most
       important post-purchase step. Without mutation, the government
       records won't show you as the new owner.

       Would you like me to prepare the mutation application checklist
       with all required documents?
```

---

## 16. State Expansion Architecture

While v1 is Gujarat-only, the architecture is designed for multi-state expansion:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATE EXPANSION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SHARED LAYER (state-agnostic)                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Orchestrator / phase management / human checkpoints            │   │
│  │ • Agreement review engine (RERA Act is central, not state-level) │   │
│  │ • eCourts search (national portal — same across states)          │   │
│  │ • GSTN verification (national portal)                            │   │
│  │ • Dossier system (universal structure)                           │   │
│  │ • Red flag patterns (70% are universal across India)             │   │
│  │ • Cost calculation engine (framework, not rates)                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  STATE-SPECIFIC MODULES                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │   Gujarat     │ │ Maharashtra  │ │  Karnataka   │ │  Tamil Nadu  │  │
│  │              │ │              │ │              │ │              │  │
│  │ • AnyRoR     │ │ • Mahabhulekh│ │ • Bhoomi     │ │ • Patta      │  │
│  │ • GujRERA    │ │ • MahaRERA   │ │ • K-RERA     │ │ • TN-RERA    │  │
│  │ • GARVI      │ │ • IGR-MH     │ │ • Kaveri     │ │ • TN Reg     │  │
│  │ • SMC/AMC    │ │ • BMC/PMC    │ │ • BBMP/BDA   │ │ • Chennai    │  │
│  │ • GJ stamp   │ │ • MH stamp   │ │ • KA stamp   │ │ • TN stamp   │  │
│  │   duty rates │ │   duty rates │ │   duty rates │ │   duty rates │  │
│  │ • GJ jantri  │ │ • MH ASR     │ │ • KA guidanc │ │ • TN guideln │  │
│  │ • Gujarati   │ │ • Marathi    │ │ • Kannada    │ │ • Tamil      │  │
│  │   OCR        │ │   OCR        │ │   OCR        │ │   OCR        │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                         │
│  Each state module implements a standard interface:                      │
│  • get_land_records(survey_number) → LandRecordData                     │
│  • search_rera_project(project_id) → RERAData                           │
│  • get_registered_deeds(property) → DeedData[]                          │
│  • check_property_tax(property_id) → TaxData                            │
│  • get_stamp_duty_rate(type, value) → StampDutyData                     │
│  • get_ready_reckoner_rate(location) → ReadyReckonerData                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### State Expansion Priority

| Priority | State | Why | Key Portals |
|----------|-------|-----|-------------|
| P0 (v1) | Gujarat | User's home state, validated on real properties | AnyRoR, GujRERA, GARVI, SMC |
| P1 | Maharashtra | Highest volume real estate market in India (Mumbai, Pune) | Mahabhulekh, MahaRERA, IGR-MH, BMC |
| P2 | Karnataka | Bangalore's tech-driven buyer base, high property values | Bhoomi, K-RERA, Kaveri, BBMP |
| P3 | Tamil Nadu | Chennai real estate market, unique registration system | Patta/Chitta, TN-RERA, TN Registration |
| P4 | Delhi NCR | National capital region — Haryana/UP/Delhi portals needed | DLR, H-RERA, UP-RERA |

---

## 17. Integration with Other Agents

### Legal/Contract Intelligence Agent

The agreement review component of this agent overlaps with the Legal/Contract Intelligence Agent. For deeper agreement analysis (comparing against Indian Contract Act provisions, generating redlined versions, negotiation playbooks), the Real Estate Agent can delegate to the Legal/Contract Agent via MCP tool calls.

Integration points:
- Builder agreement review → Legal agent for clause-by-clause analysis with RERA overlay
- Sale deed verification → Legal agent for title chain validation
- Stamp duty compliance → Legal agent's stamp duty matrix (expanded to all states)

### Statutory Compliance Calendar Agent

For property advisory firms using this agent for multiple clients:
- Track RERA expiry dates across all active purchases
- Track property tax payment deadlines
- Track mutation application follow-up dates
- Track home loan documentation submission deadlines

### Cloud Cost Optimization Agent (ScaleCapacity)

If deployed at scale for a property-tech platform:
- Portal automation infrastructure costs (Puppeteer/Playwright compute)
- S3 dossier storage optimization
- Database scaling for property KB

---

## 18. Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **Government portals change without notice** | Browser automation selectors break | Semantic selectors, regular testing against live portals, fallback to human-guided navigation |
| **CAPTCHA overhead** | Each portal visit may require 1-3 CAPTCHAs, adding 30-60 seconds each | Human-in-the-loop for reliability, 2Captcha as opt-in fallback |
| **eCourts data lag** | Court records may lag by weeks to months | Disclose to buyer: "eCourts data may not reflect cases filed in the last 30-60 days" |
| **Gujarati text parsing** | Old title deeds in Gujarati handwriting are difficult to OCR | Sarvam AI for printed Gujarati, manual review flag for handwritten documents |
| **No definitive legal opinion** | Agent verifies facts but cannot give legal advice | Clear disclaimer on every output, recommend lawyer for critical issues |
| **Portal downtime** | Government portals have unpredictable downtime | Retry logic, partial results with "portal unavailable" flags, continue with available portals |
| **Rate accuracy** | Jantri rates and stamp duty may change without notice | KB refresh mechanism, always verify against portal during active analysis |
| **Single state (v1)** | Only Gujarat in initial release | Architecture designed for state expansion from day 1 |
| **No direct API access** | All government portals require browser automation (no APIs) | Puppeteer/Playwright with resilient selectors, screenshot-based fallback extraction |
| **No historical data** | Agent cannot access records older than what portals show | Flag when record history is incomplete, recommend manual verification at Sub-Registrar for older records |

---

## 19. References

- [AnyRoR Gujarat](https://anyror.gujarat.gov.in) — Gujarat land record portal (7/12, 8A extracts)
- [Gujarat RERA](https://gujrera.gujarat.gov.in) — Gujarat Real Estate Regulatory Authority
- [eCourts India](https://ecourts.gov.in) — National court case search portal
- [GARVI Gujarat](https://garvi.gujarat.gov.in) — Gujarat registered document and jantri rate portal
- [Surat Municipal Corporation](https://www.suratmunicipal.gov.in) — Surat property tax portal
- [GSTN Services](https://services.gst.gov.in) — GST registration verification
- [RERA Act 2016](https://legislative.gov.in/sites/default/files/A2016-16_1.pdf) — Real Estate (Regulation and Development) Act
- [Gujarat Stamp Act](https://registration.gujarat.gov.in) — Gujarat stamp duty rates and rules
- [Claude Agent SDK Documentation](https://docs.anthropic.com/en/docs/agents) — Agent SDK reference
- [Deep Agent Infrastructure Playbook](deep-agent-infrastructure-playbook.md) — Shared infrastructure patterns for all agents in this repository
