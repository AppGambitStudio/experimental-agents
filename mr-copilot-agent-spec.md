# Deep Agent for MR Copilot — AI Assistant for Medical Representatives

## Overview

This document outlines how to build an **MR Copilot Agent** using the **Claude Agent SDK**. The agent transforms how Medical Representatives (MRs) in the pharmaceutical industry prepare for, execute, and report on doctor visits. It ingests data from CRM systems (Veeva, IQVIA OCE, or custom pharma CRM), RCPA (Retail Chemist Prescription Audit) feeds, product knowledge bases, and clinical literature — then provides pre-call intelligence (doctor profiling, prescription trends, visit history, competitor analysis), real-time in-call assistance (talking points, objection handling, clinical evidence retrieval), automated post-call reporting (DCR generation, CRM updates, follow-up scheduling), territory optimization (route planning, coverage analysis, frequency compliance), and manager coaching signals. What currently requires an MR to spend 2-3 hours daily on admin work — manually filling DCRs, looking up product info, planning tomorrow's route — becomes an intelligent copilot that handles the busywork so MRs can focus on what they're hired for: building relationships with doctors.

**Target users:** Medical Representatives (MRs), Area Business Managers (ABMs), Regional Business Managers (RBMs), Product Managers, Training & Development teams.

**Target customers:** Indian pharmaceutical companies (Sun Pharma, Cipla, Dr. Reddy's, Lupin, Zydus, Alkem, Torrent, Mankind, Intas, Glenmark), contract sales organizations (CSOs), emerging biotech/specialty pharma companies building field forces.

---

## 1. Why This Agent Is Needed

### The Problem

Medical Representatives are the backbone of pharmaceutical sales in India (~5.5 lakh MRs), yet they operate with tools and workflows designed for the pre-smartphone era:

| Pain Point | Detail |
|------------|--------|
| **DCR drudgery** | MRs spend 45-90 minutes daily filling Daily Call Reports — entering doctor names, products discussed, samples given, next visit date. It's the #1 most hated activity. Most fill it at night from memory, leading to inaccurate data. |
| **No pre-call intelligence** | MRs visit a doctor and rely on memory: "What did I discuss last time? What is he prescribing? What objections did he raise?" CRM data exists but MRs don't open it before each call. |
| **Product knowledge overload** | A typical MR promotes 8-15 brands across multiple therapeutic areas. Keeping track of indications, dosages, drug interactions, clinical studies, and competitor comparisons for each is overwhelming. New launches make it worse. |
| **RCPA data is gold, unused** | Companies spend crores on RCPA data (which doctors prescribe which brands at which chemists). But MRs get raw Excel dumps they never analyze. The insight-to-action gap is massive. |
| **Territory planning is gut-feel** | Which doctors to visit today? In what order? How often? MRs plan routes based on habit, not data. High-potential doctors get under-visited, low-value ones get over-visited. |
| **Objection handling is inconsistent** | Doctor says "your brand is expensive" or "I had a patient with side effects." Experienced MRs handle it well, new MRs freeze. No real-time support for evidence-based responses. |
| **Manager visibility is delayed** | ABMs learn about field activity days later through DCR reports. No real-time pulse on what MRs are doing, which doctors they're missing, which products they're not promoting. |
| **Compliance blind spots** | UCPMP (Uniform Code of Pharmaceutical Marketing Practices) restricts gifting, hospitality, and inducements. MRs may unknowingly cross lines. No proactive compliance guardrails. |
| **Sample & input tracking is manual** | Samples distributed, visual aids used, inputs (gifts/literature) given — tracked in disconnected spreadsheets or not tracked at all. Reconciliation at month-end is chaos. |
| **Training reinforcement is zero** | MRs attend product training once, then forget 70% within a week. No mechanism to reinforce key messages, clinical data, or competitive positioning during actual field work. |

### What Existing Tools Do vs. What This Agent Does

| Capability | Existing Tools (Veeva, IQVIA OCE, custom CRM) | MR Copilot Agent |
|-----------|-----------------------------------------------|------------------|
| Doctor visit logging | ✅ Manual entry form — 5 min per call | ✅ Auto-generated from voice notes + location: "Visited Dr. Patel at 10:15am, discussed Cardivas 6.25, he asked about the SENIOR trial" |
| Product information | ✅ Static PDF visual aids | ✅ Conversational: "What's the dosage adjustment for Cardivas in renal impairment?" → instant, contextualized answer |
| RCPA analysis | ❌ Raw Excel export, MR interprets | ✅ "Dr. Mehta shifted 30% of atorvastatin Rxs from Atorva to Lipicure last month. His Cardivas Rx is stable at 12/week." |
| Pre-call briefing | ❌ MR opens CRM, scrolls through history | ✅ Auto-generated 30-second brief: visit history, Rx trends, open commitments, suggested talking points |
| Objection handling | ❌ Training manual (never opened in field) | ✅ Real-time: doctor says "too expensive" → agent surfaces cost-per-day comparison, generic equivalence data, patient assistance programs |
| Route optimization | ❌ MR plans by gut feel | ✅ "Optimal route for 8 calls today: Dr. Shah (9:30), Dr. Desai (10:15)... saves 47 min vs your usual route" |
| Compliance monitoring | ❌ Post-facto audits | ✅ Proactive: "You've given ₹1,800 in inputs to Dr. Kumar this quarter. UCPMP limit is ₹1,000. Hold off on the next gift." |
| Manager coaching | ❌ Monthly review of aggregated DCR | ✅ Real-time signals: "Ravi hasn't visited any cardiologists this week despite 4 in his patch. Cardivas calls are 40% below target." |
| Training reinforcement | ❌ One-time classroom training | ✅ Micro-learning nudges before relevant calls: "Reminder: the COPERNICUS trial showed 35% reduction in mortality in severe HF. Key for Dr. Shah who asked about outcomes data last time." |

### Why Claude Agent SDK

The Agent SDK is ideal because MR Copilot requires:
- **Multi-model orchestration** — Opus for complex RCPA trend analysis and competitive strategy, Sonnet for pre-call briefs and objection responses, Haiku for quick product lookups and DCR auto-fill
- **MCP tool architecture** — modular tools for CRM integration, RCPA analysis, product knowledge, route optimization, and compliance checking that compose into workflows
- **Conversational intelligence** — MRs interact via WhatsApp-style voice/text, not forms. The agent must understand natural language field reports
- **Context accumulation** — the agent builds a living profile of each doctor over time: preferences, objections raised, prescription patterns, best times to visit
- **Human-in-the-loop** — manager approval for high-value activities (sponsorships, speaker programs), compliance escalations
- **Offline-first with sync** — MRs work in areas with poor connectivity. The agent must work offline and sync when connected

---

## 2. Architecture

### High-Level Design

```
                    ┌───────────────────────────────────────┐
                    │       MR Copilot Agent                 │
                    │      (Field Orchestrator)               │
                    │                                        │
                    │   Claude Agent SDK + 6 MCP Servers     │
                    └──────────────┬────────────────────────┘
                                   │
         ┌───────────┬─────────────┼─────────────┬────────────┐
         │           │             │             │            │
   ┌─────▼─────┐ ┌──▼──────┐ ┌───▼────┐ ┌──────▼─────┐ ┌───▼────────┐
   │ Pre-Call  │ │ In-Call  │ │ Post-  │ │ Territory  │ │ Manager    │
   │ Intelli-  │ │ Assist   │ │ Call   │ │ & Route    │ │ Intelligence│
   │ gence     │ │ Engine   │ │ Engine │ │ Optimizer  │ │ Engine     │
   └─────┬─────┘ └──┬──────┘ └───┬────┘ └──────┬─────┘ └───┬────────┘
         │           │            │             │            │
   ┌─────▼───────────▼────────────▼─────────────▼────────────▼──┐
   │                    4 MCP Servers                            │
   │                                                             │
   │  crm-mcp            pharma-intel-mcp    field-ops-mcp      │
   │  (Veeva/IQVIA/      (Product KB,        (Route planning,   │
   │   custom CRM,       RCPA analysis,      geolocation,       │
   │   doctor master,    clinical evidence,   compliance,        │
   │   visit history,    competitor intel)    sample tracking)   │
   │   DCR submission)                                           │
   │                     analytics-mcp                           │
   │                     (Manager dashboards, coaching signals,  │
   │                      KPI tracking, team performance)        │
   └──────────────────────────┬─────────────────────────────────┘
                              │
   ┌──────────────────────────▼─────────────────────────────────┐
   │              Specialized Model Layer (MCP-wrapped)          │
   │                                                             │
   │  medgemma-mcp              medasr-mcp                       │
   │  (MedGemma 1.5 4B —       (MedASR — medical speech-to-     │
   │   medical image interp,    text, pharma terminology,        │
   │   lab report extraction,   Hinglish medical dictation,      │
   │   clinical document        82% fewer errors vs Whisper)     │
   │   understanding)                                            │
   │                                                             │
   │  Fine-tuned via Unsloth Studio on company-specific data:    │
   │  • Product formulary & clinical positioning                 │
   │  • Regional prescribing patterns from RCPA                  │
   │  • Company-specific brand names & molecule mappings          │
   │  • Historical doctor interaction transcripts                │
   │                                                             │
   │  Deployment: Private infra (on-prem GPU) or hosted cloud    │
   │  (Vertex AI / custom endpoint)                              │
   └────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Purpose | MCP Server |
|-----------|---------|------------|
| **Pre-Call Intelligence** | Generates doctor briefing before each visit — visit history, Rx trends from RCPA, open commitments, suggested talking points, optimal products to promote, micro-learning nudge relevant to this doctor | `crm-mcp` + `pharma-intel-mcp` |
| **In-Call Assist Engine** | Real-time support during doctor interaction — product Q&A, objection handling with clinical evidence, dosage lookups, drug interaction checks, competitor comparison, clinical study summaries | `pharma-intel-mcp` |
| **Post-Call Engine** | Automated DCR generation from voice/text notes + geolocation, CRM update, follow-up scheduling, sample/input logging, commitment tracking | `crm-mcp` + `field-ops-mcp` |
| **Territory & Route Optimizer** | Daily route planning based on call targets, doctor availability, geography, visit frequency compliance, high-priority flags | `field-ops-mcp` |
| **Manager Intelligence Engine** | Team performance dashboards, coaching signals (under-visited doctors, product coverage gaps, compliance risks), territory analysis | `analytics-mcp` |
| **Medical AI Layer** | Specialized models for medical document understanding (lab reports, prescriptions), medical speech-to-text with pharma vocabulary, and clinical image interpretation — fine-tuned on company data via Unsloth Studio | `medgemma-mcp` + `medasr-mcp` |

### End-to-End Daily Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MR COPILOT — DAILY WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MORNING (7:00-8:30 AM)                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. DAILY PLANNER                                                 │   │
│  │    • Generate optimized route for today's calls                  │   │
│  │    • Factor in: call targets, geography, doctor OPD times,       │   │
│  │      frequency compliance, pending commitments                   │   │
│  │    • Output: "8 calls planned. Route saves 52 min vs linear.     │   │
│  │      Start with Dr. Shah (Cardiology, OPD 9-12, pending Rx       │   │
│  │      feedback from last visit)"                                  │   │
│  │                                                                  │   │
│  │ 2. MORNING BRIEF                                                 │   │
│  │    • RCPA alerts: "Dr. Desai's Atorva Rx dropped 40% this week"  │   │
│  │    • Product updates: "New study published for Telmivas — 24%    │   │
│  │      better BP reduction vs competitor in Indian population"     │   │
│  │    • Compliance reminder: sample stock status, input budget       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PER CALL (×8-12 times/day)                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 3. PRE-CALL BRIEF (30 seconds before entering clinic)            │   │
│  │    • Doctor profile: specialty, patient volume, Rx habits         │   │
│  │    • Last 3 visits: what discussed, samples given, commitments   │   │
│  │    • RCPA snapshot: current brand Rx, trends, competitor share   │   │
│  │    • Suggested pitch: "Focus on Cardivas 6.25 — he's using       │   │
│  │      competitor Metolar XR for mild HF. Lead with COMET data"   │   │
│  │    • Micro-learning: key clinical point relevant to this call    │   │
│  │                                                                  │   │
│  │ 4. IN-CALL ASSIST (on-demand via voice/text)                     │   │
│  │    • "What's the Cardivas dose in renal impairment?" → instant   │   │
│  │    • "Doctor says Metolar has better compliance" → evidence-      │   │
│  │      based rebuttal with study reference                         │   │
│  │    • "Drug interaction with amiodarone?" → real-time lookup      │   │
│  │    • "Show cost comparison" → Cardivas vs Metolar per-day cost   │   │
│  │                                                                  │   │
│  │ 5. POST-CALL LOG (voice note as MR walks to car)                 │   │
│  │    • MR says: "Met Dr. Shah, discussed Cardivas for his mild HF  │   │
│  │      patients. He'll try 5 patients this week. Gave 2 sample     │   │
│  │      strips. He wants the COPERNICUS study reprint next visit."      │   │
│  │    • Agent auto-generates DCR entry:                              │   │
│  │      - Doctor: Dr. Rajesh Shah, Cardiologist, Medipoint Hospital │   │
│  │      - Products: Cardivas 6.25mg (Primary), Telmivas 40mg (Sec.) │   │
│  │      - Outcome: Will trial 5 patients, requested COPERNICUS reprint  │   │
│  │      - Samples: Cardivas 6.25mg × 2 strips                      │   │
│  │      - Next visit: scheduled in 7 days (follow up on trial)      │   │
│  │      - Commitment: bring COPERNICUS study reprint                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  EVENING (6:00-7:00 PM)                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 6. DAY SUMMARY & DCR SUBMISSION                                  │   │
│  │    • "You completed 8/8 calls today. 6 productive, 2 not met."   │   │
│  │    • Auto-compiled DCR ready for review and submit                │   │
│  │    • Discrepancy check: "You logged Dr. Mehta at 11am but GPS    │   │
│  │      shows you were at Medipoint until 11:30. Correct?"          │   │
│  │                                                                  │   │
│  │ 7. TOMORROW PREP                                                  │   │
│  │    • Pre-generated route for tomorrow                             │   │
│  │    • Open commitments due: "Bring COPERNICUS reprint for Dr. Shah,   │   │
│  │      confirm speaker slot for Dr. Desai, follow up on Dr. Kumar's│   │
│  │      patient feedback"                                           │   │
│  │    • Stock check: "You have 4 Cardivas sample strips left.       │   │
│  │      Request restock from stockist before Thursday."              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  MANAGER VIEW (continuous)                                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 8. TEAM INTELLIGENCE                                              │   │
│  │    • Real-time field pulse: which MRs are in field, call count   │   │
│  │    • Coverage gaps: "Ravi hasn't visited Dr. Patel (A-category,  │   │
│  │      200+ Rxs/month) in 3 weeks"                                 │   │
│  │    • Product alerts: "Cardivas detailing is 35% below target     │   │
│  │      across West zone. Top barrier: doctors citing cost."         │   │
│  │    • Coaching signals: "Neha's conversion rate on cardiologists  │   │
│  │      jumped 40% after she started leading with MERIT-HF data.    │   │
│  │      Replicate across team?"                                     │   │
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
│ LEVEL 1  │  Agent: Inform & Suggest                              │
│ (Trust   │  ──────────────────────────────────────────          │
│  building│  Agent generates pre-call briefs, suggests talking    │
│  phase)  │  points, and drafts DCR entries — but MR reviews     │
│          │  and confirms everything before CRM submission.       │
│          │  No auto-submission. No auto-scheduling.              │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 2  │  Agent: Auto-Log, Suggest Actions                     │
│ (Proven  │  ──────────────────────────────────────────          │
│  trust)  │  Auto-submits DCR entries from voice notes (MR gets  │
│          │  notification to review). Auto-schedules follow-ups.  │
│          │  Auto-sends sample reconciliation. MR approval for:   │
│          │  new doctor additions, commitment changes, escalations │
│          │  to manager.                                          │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 3  │  Agent: Full Copilot                                   │
│ (Full    │  ──────────────────────────────────────────          │
│  trust)  │  Auto-submits DCR, auto-manages follow-ups and       │
│          │  commitments, proactively reschedules missed calls,   │
│          │  auto-generates weekly reports for manager, triggers  │
│          │  restock requests. MR approval only for: compliance-  │
│          │  sensitive actions, high-value doctor engagement       │
│          │  proposals (speaker programs, sponsorships).           │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ ALL      │  ⛔ NEVER AUTO-EXECUTED (regardless of level)          │
│ LEVELS   │  - Compliance-regulated activities (gifts > threshold)│
│          │  - Speaker program nominations or sponsorships        │
│          │  - Doctor categorization changes (A→B or B→A)         │
│          │  - Sending communications to doctors directly         │
│          │  - Expense claims or reimbursement submissions        │
│          │  - Sharing doctor PII outside the CRM system          │
│          │  - Any action that could violate UCPMP guidelines     │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Models:
  Orchestration: claude-opus-4-6 (RCPA trend analysis, competitive strategy, coaching signals)
                 claude-sonnet-4-6 (pre-call briefs, objection handling, DCR generation)
                 claude-haiku-4-5 (product lookups, dosage queries, quick calculations)
  Specialized:   MedGemma 1.5 4B (medical document understanding, lab report extraction,
                   clinical image interpretation — fine-tuned via Unsloth Studio)
                 MedASR (medical speech-to-text, pharma vocabulary, 5.2% WER vs
                   Whisper's 12.5% on medical dictation)
Fine-tuning:     Unsloth Studio (LoRA + RL fine-tuning on company-specific pharma data)
MCP Servers:     6 custom — crm-mcp, pharma-intel-mcp, field-ops-mcp, analytics-mcp,
                            medgemma-mcp, medasr-mcp
Mobile App:      React Native (iOS + Android) — voice-first UX
Voice:           MedASR (primary, medical-optimized) → Whisper API (fallback)
Geolocation:     Google Maps Platform (route optimization, geocoding, distance matrix)
Storage:         SQLite (local on device) + PostgreSQL (cloud sync)
Offline:         Service worker + local SQLite — full offline capability with sync queue
                 MedGemma 4B runs on-device for offline medical lookups
Messaging:       WhatsApp Business API (optional channel for MR interaction)
Notifications:   Firebase Cloud Messaging (push notifications)
Config:          JSON files (product KB, RCPA rules, compliance thresholds, territory config)
Model Hosting:   Private GPU infra (on-prem) or Vertex AI (cloud) for specialized models
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install zod                          # Schema validation
npm install better-sqlite3               # Local SQLite for offline
npm install pg                           # PostgreSQL for cloud sync
npm install dayjs                        # Date handling
npm install winston                      # Structured logging
npm install axios                        # HTTP client for CRM APIs
npm install @googlemaps/google-maps-services-js  # Route optimization
npm install node-cron                    # Scheduled tasks (morning brief, evening summary)
npm install geolib                       # Distance calculations
npm install fuse.js                      # Fuzzy search for doctor/product names
```

---

## 4. Domain Knowledge Base

### 4.1 Doctor Master Schema

```typescript
interface DoctorProfile {
  doctor_id: string;                     // Unique ID from CRM
  name: string;                          // Full name with title (Dr. Rajesh Shah)
  specialty: DoctorSpecialty;
  sub_specialty?: string;                // e.g., "Interventional Cardiology"
  qualification: string;                 // MBBS, MD, DM, etc.
  hospital_name: string;
  hospital_type: "Government" | "Private" | "Trust" | "Clinic";
  clinic_address: string;
  clinic_lat: number;
  clinic_lng: number;
  opd_timings: OPDTiming[];             // When the doctor sees patients
  patient_volume: "High" | "Medium" | "Low";  // Estimated daily patient count
  category: "A+" | "A" | "B" | "C";    // Based on Rx potential + current Rx

  // Prescription behavior
  rx_potential: number;                  // Estimated total Rxs per month in our therapy area
  our_brand_rx: number;                  // Current monthly Rx for our brands
  competitor_brands: CompetitorRx[];     // What competitor brands they prescribe
  rx_trend: "Growing" | "Stable" | "Declining";

  // Relationship
  years_known: number;
  relationship_strength: 1 | 2 | 3 | 4 | 5;  // MR's self-assessment
  key_interests: string[];               // Clinical interests, hobbies
  preferred_communication: "In-person" | "WhatsApp" | "Email" | "Phone";
  best_visit_time: string;              // "Tuesday/Thursday 10-11am"
  gatekeeper_notes?: string;            // "Receptionist Meera — very strict, call ahead"

  // Visit history
  total_visits_ytd: number;
  last_visit_date: string;
  visit_frequency_target: number;        // Visits per month based on category
  visit_frequency_actual: number;        // Actual visits in last 30 days

  // Compliance
  total_inputs_value_ytd: number;        // ₹ value of gifts/inputs given YTD
  ucpmp_limit_remaining: number;         // ₹ remaining before UCPMP threshold
}

type DoctorSpecialty =
  | "General Physician" | "Internal Medicine" | "Cardiology"
  | "Endocrinology" | "Neurology" | "Orthopedics" | "Pulmonology"
  | "Gastroenterology" | "Nephrology" | "Dermatology" | "Psychiatry"
  | "Obstetrics & Gynecology" | "Pediatrics" | "Ophthalmology"
  | "ENT" | "Urology" | "Oncology" | "Rheumatology" | "Diabetology";

interface OPDTiming {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  start_time: string;                    // "09:00"
  end_time: string;                      // "13:00"
  location: string;                      // Hospital/clinic name
  best_visit_window: string;             // "10:00-10:30" (before OPD rush)
}

interface CompetitorRx {
  brand_name: string;                    // e.g., "Metolar XR"
  company: string;                       // e.g., "Cipla"
  molecule: string;                      // e.g., "Metoprolol Succinate"
  estimated_monthly_rx: number;
  trend: "Growing" | "Stable" | "Declining";
}
```

### 4.2 Product Knowledge Base Schema

```typescript
interface ProductKB {
  brand_name: string;                    // e.g., "Cardivas"
  molecule: string;                      // e.g., "Carvedilol"
  therapeutic_area: string;              // e.g., "Cardiovascular"
  strengths: string[];                   // ["3.125mg", "6.25mg", "12.5mg", "25mg"]
  formulation: string;                   // "Tablet", "Capsule", "Injection", etc.
  mrp: { [strength: string]: number };   // MRP per strength
  ptr: { [strength: string]: number };   // Price to Retailer
  pts: { [strength: string]: number };   // Price to Stockist
  cost_per_day: { [strength: string]: number };  // For cost-effectiveness arguments

  // Clinical information
  indications: Indication[];
  dosage: DosageInfo[];
  contraindications: string[];
  drug_interactions: DrugInteraction[];
  side_effects: SideEffect[];
  special_populations: SpecialPopulation[];

  // Competitive positioning
  usp: string[];                         // Unique selling points
  clinical_studies: ClinicalStudy[];
  competitor_comparison: CompetitorComparison[];

  // Objection handling
  common_objections: ObjectionResponse[];

  // Sales materials
  visual_aids: VisualAid[];
  patient_education: PatientResource[];
  sample_available: boolean;
  sample_pack_size: string;
}

interface Indication {
  condition: string;                     // "Heart Failure with reduced EF"
  approved: boolean;                     // CDSCO approved indication
  evidence_level: "A" | "B" | "C";     // Guideline recommendation level
  guideline_reference: string;           // "ESC 2021 HF Guidelines"
  key_message: string;                   // One-line pitch for this indication
}

interface ClinicalStudy {
  study_name: string;                    // "COPERNICUS"
  publication: string;                   // "NEJM 2001"
  patients: number;                      // 2289
  design: string;                        // "Randomized, double-blind, placebo-controlled"
  primary_endpoint: string;
  key_result: string;                    // "35% reduction in all-cause mortality"
  indian_data: boolean;                  // Was there an Indian sub-population?
  one_liner: string;                     // "COPERNICUS: carvedilol reduces severe HF mortality by 35%"
  detail_summary: string;               // 2-3 sentence summary for deeper discussion
  competitor_rebuttal?: string;          // How this study positions us vs competitor
}

interface ObjectionResponse {
  objection: string;                     // "Your brand is expensive"
  category: "Price" | "Efficacy" | "Safety" | "Availability" | "Habit" | "Competitor";
  response_short: string;               // Quick 1-sentence response
  response_detailed: string;            // Detailed response with evidence
  supporting_data?: string;             // Study reference or data point
  cost_comparison?: CostComparison;     // If price objection, include comparison
}

interface CostComparison {
  our_brand: { name: string; strength: string; cost_per_day: number };
  competitor: { name: string; strength: string; cost_per_day: number };
  savings_per_month: number;
  narrative: string;                     // "At ₹X/day, Cardivas costs just ₹Y more than generic but offers..."
}
```

### 4.3 RCPA Data Schema

```typescript
interface RCPAData {
  chemist_id: string;
  chemist_name: string;
  chemist_address: string;
  month: string;                         // "2026-03"
  doctor_id: string;
  doctor_name: string;

  prescriptions: RCPAPrescription[];
}

interface RCPAPrescription {
  molecule: string;                      // "Carvedilol"
  brand_name: string;                    // "Cardivas" or "Carca" (competitor)
  company: string;                       // "Sun Pharma" or "Cipla"
  strength: string;                      // "6.25mg"
  quantity: number;                      // Number of Rxs/units captured
  is_our_brand: boolean;
}

// Derived analytics
interface DoctorRCPAAnalysis {
  doctor_id: string;
  doctor_name: string;
  therapy_area: string;
  period: string;                        // "2026-Q1"

  total_rx_volume: number;               // Total Rxs across all brands in therapy area
  our_brand_share: number;               // % share of our brands
  our_brand_rx_count: number;            // Absolute Rx count for our brands
  top_competitor: {
    brand: string;
    company: string;
    share: number;
    rx_count: number;
  };

  trend_3m: {
    our_share_change: number;            // +5% or -3%
    competitor_share_change: number;
    insight: string;                     // "Gaining share from Cipla's Carca"
  };

  opportunity_score: number;             // 0-100, combines Rx potential + current gap
  recommended_action: string;            // "High potential — increase visit frequency"
}
```

### 4.4 Visit & DCR Schema

```typescript
interface DCREntry {
  dcr_id: string;
  mr_id: string;
  visit_date: string;                    // ISO 8601

  // Doctor details
  doctor_id: string;
  doctor_name: string;
  doctor_specialty: string;
  hospital_name: string;

  // Visit details
  visit_type: "Regular" | "Planned" | "Unplanned" | "Missed" | "Doctor Not Available";
  check_in_time: string;                 // From geolocation
  check_out_time: string;
  check_in_lat: number;
  check_in_lng: number;
  geo_verified: boolean;                 // Was MR actually at the clinic?

  // Products discussed
  products_detailed: ProductDetail[];

  // Samples & inputs
  samples_given: SampleEntry[];
  inputs_given: InputEntry[];

  // Outcome
  discussion_summary: string;            // AI-generated from voice note
  doctor_feedback: string;               // Key feedback captured
  commitments_made: Commitment[];        // What MR promised to do
  doctor_commitments: Commitment[];      // What doctor agreed to do
  next_visit_date?: string;

  // Metadata
  source: "Voice" | "Text" | "Manual";  // How was this DCR created?
  voice_note_url?: string;              // Original voice recording
  ai_confidence: number;                 // 0-1, how confident is AI in the parsing?
  mr_reviewed: boolean;                  // Did MR review the auto-generated entry?
  submitted_at?: string;
}

interface ProductDetail {
  brand_name: string;
  strength?: string;
  detail_type: "Primary" | "Secondary" | "Reminder";
  key_message_delivered: string;         // What was the pitch
  doctor_response: "Positive" | "Neutral" | "Negative" | "Will Try" | "Already Using";
  objections_raised?: string[];
}

interface Commitment {
  commitment_id: string;
  doctor_id: string;                     // Doctor this commitment is for
  description: string;                   // "Bring COPERNICUS study reprint"
  due_date: string;
  status: "Open" | "Completed" | "Overdue";
  priority: "High" | "Medium" | "Low";
}

interface SampleEntry {
  brand_name: string;
  strength: string;
  quantity: number;                      // Number of strips/units
  lot_number?: string;
  expiry_date?: string;
}

interface InputEntry {
  type: "Literature" | "Gift" | "Patient Aid" | "Reminder Card" | "Other";
  description: string;
  value_inr: number;                     // ₹ value for UCPMP tracking
}
```

### 4.5 Compliance Rules (UCPMP)

The Uniform Code of Pharmaceutical Marketing Practices (UCPMP) governs pharmaceutical marketing in India:

| Rule | Threshold | Agent Action |
|------|-----------|--------------|
| **Gifts to doctors** | Max ₹1,000 per doctor per year (industry standard) | Track cumulative value, warn at 80%, block at 100% |
| **No cash or monetary grants** | ₹0 | Hard block — never allow recording of cash gifts |
| **Samples** | Reasonable quantity, properly documented | Track quantity per doctor, flag if > 2× industry average |
| **Travel & hospitality for CMEs** | Economy class, 3-star hotel, INR limits per UCPMP | Flag if arrangement exceeds limits |
| **Speaker honorarium** | Must be for legitimate scientific service | Requires ABM + compliance approval before commitment |
| **Food/beverage** | Modest, incidental to scientific discussion | Track per doctor, flag patterns |
| **Literature/reprints** | Must be scientific, not branded promotional | No restriction, but must be logged |
| **No entertainment** | Zero tolerance for entertainment, sports, leisure | Hard block — flag if MR attempts to log |
| **Patient assistance programs** | Must be transparent, no kickback element | Log and audit trail |

```typescript
interface ComplianceCheck {
  doctor_id: string;
  mr_id: string;
  action_type: "Gift" | "Sample" | "Hospitality" | "Sponsorship" | "Honorarium" | "Food";
  proposed_value_inr: number;

  // Agent evaluates
  ytd_spend_on_doctor: number;
  ucpmp_limit: number;
  remaining_budget: number;

  result: "Allowed" | "Warning" | "Blocked" | "Requires_Approval";
  reason: string;
  approval_required_from?: "ABM" | "RBM" | "Compliance";
}
```

---

## 5. MCP Server Specifications

### 5.1 MCP Server: `crm-mcp` (CRM Integration & Visit Management)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `get_doctor_profile` | Fetch full doctor profile with Rx data | `{ doctor_id: string }` | `DoctorProfile` |
| `search_doctors` | Search doctors by name, specialty, area | `{ query: string, specialty?: string, category?: string, area?: string }` | `{ doctors: DoctorProfile[], count }` |
| `get_visit_history` | Fetch past visit entries for a doctor | `{ doctor_id: string, mr_id: string, limit?: number }` | `{ visits: DCREntry[], total }` |
| `submit_dcr_entry` | Submit a DCR entry to CRM | `{ entry: DCREntry }` | `{ dcr_id, submitted: boolean, validation_errors? }` |
| `update_dcr_entry` | Update an existing DCR entry | `{ dcr_id: string, updates: Partial<DCREntry> }` | `{ updated: boolean }` |
| `get_daily_dcr` | Get all DCR entries for a date | `{ mr_id: string, date: string }` | `{ entries: DCREntry[], total_calls, productive_calls }` |
| `get_open_commitments` | Fetch open commitments for MR | `{ mr_id: string, doctor_id?: string, status?: string }` | `{ commitments: Commitment[] }` |
| `update_commitment` | Mark commitment as completed/overdue | `{ commitment_id: string, status: string, notes?: string }` | `{ updated: boolean }` |
| `get_call_targets` | Fetch monthly call targets | `{ mr_id: string, month: string }` | `{ targets: CallTarget[], achievement }` |
| `get_doctor_master_list` | Full territory doctor list | `{ mr_id: string, filters?: DoctorFilter }` | `{ doctors: DoctorProfile[], count }` |

**Implementation — Pre-Call Brief Generation:**

```typescript
import { z } from "zod";

const PreCallBriefSchema = z.object({
  doctor_id: z.string().describe("Doctor ID to generate brief for"),
  mr_id: z.string().describe("MR ID for personalized context"),
  products_to_promote: z.array(z.string()).optional()
    .describe("Override: specific products to focus on"),
});

async function generatePreCallBrief(input: z.infer<typeof PreCallBriefSchema>) {
  // 1. Fetch doctor profile
  const doctor = await tools.get_doctor_profile({ doctor_id: input.doctor_id });

  // 2. Fetch last 5 visits
  const history = await tools.get_visit_history({
    doctor_id: input.doctor_id,
    mr_id: input.mr_id,
    limit: 5
  });

  // 3. Fetch RCPA trends
  const rcpa = await tools.get_rcpa_analysis({
    doctor_id: input.doctor_id,
    period: "last_3_months"
  });

  // 4. Fetch open commitments
  const commitments = await tools.get_open_commitments({
    mr_id: input.mr_id,
    doctor_id: input.doctor_id
  });

  // 5. Claude generates the brief
  const brief = await claude.sonnet.generate({
    system: `You are an MR Copilot generating a pre-call brief. Be concise — the MR reads this
    in 30 seconds while walking to the clinic. Lead with actionable insights.`,
    prompt: `Generate a pre-call brief for this doctor visit:

    DOCTOR: ${JSON.stringify(doctor)}
    LAST 5 VISITS: ${JSON.stringify(history.visits)}
    RCPA TRENDS: ${JSON.stringify(rcpa)}
    OPEN COMMITMENTS: ${JSON.stringify(commitments)}
    PRODUCTS TO PROMOTE: ${input.products_to_promote || "auto-select based on opportunity"}

    Format:
    🎯 TOP PRIORITY: [One-line focus for this call]
    📊 RX SNAPSHOT: [Current Rx status, trends]
    📝 LAST VISIT: [Key points from last interaction]
    ⚡ OPEN ITEMS: [Pending commitments]
    💡 SUGGESTED PITCH: [2-3 sentences on what to lead with and why]
    🧠 MICRO-LEARNING: [One clinical fact relevant to this call]`
  });

  return brief;
}
```

### 5.2 MCP Server: `pharma-intel-mcp` (Product Knowledge & Clinical Evidence)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `lookup_product` | Get full product information | `{ brand_name: string, field?: string[] }` | `ProductKB` |
| `search_products` | Search across product portfolio | `{ query: string, therapeutic_area?: string, molecule?: string }` | `{ products: ProductKB[], count }` |
| `get_dosage` | Get dosage for specific condition/population | `{ brand_name: string, indication?: string, special_population?: string }` | `{ dosage: DosageInfo[], warnings: string[] }` |
| `check_drug_interaction` | Check for drug interactions | `{ drug_1: string, drug_2: string }` | `{ interaction_level: string, details: string, recommendation: string }` |
| `get_clinical_study` | Fetch clinical study details | `{ study_name: string }` | `ClinicalStudy` |
| `compare_with_competitor` | Generate head-to-head comparison | `{ our_brand: string, competitor_brand: string, aspects?: string[] }` | `{ comparison: CompetitorComparison, cost_analysis: CostComparison }` |
| `handle_objection` | Get evidence-based objection response | `{ objection_text: string, brand_name: string, doctor_specialty?: string }` | `{ response: ObjectionResponse, supporting_studies: ClinicalStudy[] }` |
| `get_rcpa_analysis` | Get RCPA analysis for a doctor | `{ doctor_id: string, period: string, therapy_area?: string }` | `DoctorRCPAAnalysis` |
| `get_rcpa_trends` | Trend analysis across territory | `{ mr_id: string, brand_name?: string, period: string }` | `{ trends: TerritoryRCPATrend[], alerts: RCPAAlert[] }` |
| `get_micro_learning` | Get learning nugget for context | `{ doctor_specialty: string, products: string[], topics?: string[] }` | `{ nugget: MicroLearning }` |

**Implementation — Objection Handling:**

```typescript
const HandleObjectionSchema = z.object({
  objection_text: z.string().describe("What the doctor said"),
  brand_name: z.string().describe("Brand being discussed"),
  doctor_specialty: z.string().optional().describe("Doctor's specialty for tailored response"),
  doctor_id: z.string().optional().describe("Doctor ID for personalized context"),
});

async function handleObjection(input: z.infer<typeof HandleObjectionSchema>) {
  // 1. Load product knowledge
  const product = await tools.lookup_product({ brand_name: input.brand_name });

  // 2. Match objection pattern
  const matchedObjections = product.common_objections.filter(obj =>
    fuzzyMatch(obj.objection, input.objection_text) > 0.6
  );

  // 3. If known objection, use pre-built response; otherwise, generate with Claude
  if (matchedObjections.length > 0) {
    const best = matchedObjections[0];
    // Enrich with doctor context if available
    if (input.doctor_id) {
      const rcpa = await tools.get_rcpa_analysis({
        doctor_id: input.doctor_id,
        period: "last_3_months"
      });
      // Personalize response based on doctor's current prescribing
    }
    return {
      response: best,
      supporting_studies: await Promise.all(
        (best.supporting_data ? [best.supporting_data] : []).map(
          study => tools.get_clinical_study({ study_name: study })
        )
      )
    };
  }

  // 4. Novel objection — use Claude Sonnet to generate response
  const response = await claude.sonnet.generate({
    system: `You are a pharmaceutical medical advisor helping an MR respond to a doctor's objection.
    Rules:
    - Response must be evidence-based — cite clinical studies
    - Be respectful of the doctor's expertise
    - Never make unsubstantiated claims
    - If the objection is valid, acknowledge it honestly and pivot to strengths
    - Keep the response conversational, not lecture-like`,
    prompt: `Doctor (${input.doctor_specialty || "GP"}) objection: "${input.objection_text}"
    Brand: ${input.brand_name} (${product.molecule})
    Available studies: ${JSON.stringify(product.clinical_studies.map(s => s.one_liner))}
    USPs: ${product.usp.join(", ")}

    Generate a natural, conversational response the MR can use.`
  });

  return { response, supporting_studies: [] };
}
```

### 5.3 MCP Server: `field-ops-mcp` (Route Planning, Compliance, Samples)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `plan_daily_route` | Generate optimized route for the day | `{ mr_id: string, date: string, constraints?: RouteConstraints }` | `{ route: PlannedRoute, estimated_time: number, calls_planned: number }` |
| `check_geo_compliance` | Verify if MR is at claimed location | `{ lat: number, lng: number, doctor_id: string }` | `{ verified: boolean, distance_meters: number, clinic_address: string }` |
| `get_sample_inventory` | Check MR's current sample stock | `{ mr_id: string }` | `{ inventory: SampleStock[], low_stock_alerts: string[] }` |
| `log_sample_distribution` | Record sample given to doctor | `{ mr_id: string, doctor_id: string, sample: SampleEntry }` | `{ logged: boolean, remaining_stock: number }` |
| `check_compliance` | Run UCPMP compliance check | `{ doctor_id: string, mr_id: string, action: ComplianceAction }` | `ComplianceCheck` |
| `get_frequency_compliance` | Check visit frequency vs target | `{ mr_id: string, period: string }` | `{ doctors: FrequencyStatus[], on_target: number, below_target: number, above_target: number }` |
| `get_territory_coverage` | Territory coverage analysis | `{ mr_id: string, period: string }` | `{ total_doctors: number, visited: number, not_visited: number, coverage_pct: number, gaps: DoctorProfile[] }` |
| `transcribe_voice_note` | Convert voice recording to text | `{ audio_url: string }` | `{ text: string, confidence: number, duration_seconds: number }` |
| `parse_voice_to_dcr` | Extract structured DCR from voice text | `{ transcription: string, mr_id: string, date: string }` | `{ dcr_entries: DCREntry[], confidence: number, ambiguities: string[] }` |

**Implementation — Route Optimization:**

```typescript
const PlanDailyRouteSchema = z.object({
  mr_id: z.string(),
  date: z.string().describe("Date to plan for (ISO 8601)"),
  constraints: z.object({
    max_calls: z.number().default(12),
    start_location: z.object({ lat: z.number(), lng: z.number() }).optional(),
    end_location: z.object({ lat: z.number(), lng: z.number() }).optional(),
    preferred_start_time: z.string().default("09:00"),
    must_visit: z.array(z.string()).default([]),   // Doctor IDs that must be visited today
    exclude: z.array(z.string()).default([]),       // Doctor IDs to skip
  }).optional(),
});

async function planDailyRoute(input: z.infer<typeof PlanDailyRouteSchema>) {
  const dayOfWeek = dayjs(input.date).format("ddd");

  // 1. Get all doctors in territory with their priority scores
  const territory = await tools.get_doctor_master_list({ mr_id: input.mr_id });

  // 2. Get frequency compliance to find under-visited doctors
  const frequency = await tools.get_frequency_compliance({
    mr_id: input.mr_id,
    period: "current_month"
  });

  // 3. Get open commitments (due today or overdue)
  const commitments = await tools.get_open_commitments({
    mr_id: input.mr_id,
    status: "Open"
  });
  const doctorsWithCommitments = commitments.commitments
    .filter(c => dayjs(c.due_date).isSameOrBefore(input.date))
    .map(c => c.doctor_id);

  // 4. Score and rank doctors for today
  const candidates = territory.doctors
    .filter(d => {
      // Available on this day of week
      return d.opd_timings.some(t => t.day === dayOfWeek);
    })
    .map(d => ({
      ...d,
      priority_score: calculatePriorityScore(d, frequency, doctorsWithCommitments, input.constraints?.must_visit || []),
    }))
    .sort((a, b) => b.priority_score - a.priority_score);

  // 5. Select top N doctors respecting constraints
  const selectedDoctors = selectDoctorsForRoute(
    candidates,
    input.constraints?.max_calls || 12,
    input.constraints?.must_visit || []
  );

  // 6. Optimize route order using Google Maps Distance Matrix
  const optimizedOrder = await optimizeRouteOrder(
    selectedDoctors,
    input.constraints?.start_location,
    input.constraints?.end_location
  );

  // 7. Assign estimated times based on OPD windows
  const scheduledRoute = assignVisitTimes(optimizedOrder, input.constraints?.preferred_start_time || "09:00");

  return {
    route: scheduledRoute,
    estimated_time: calculateTotalTravelTime(scheduledRoute),
    calls_planned: scheduledRoute.length,
    savings_vs_linear: calculateTimeSavings(selectedDoctors, scheduledRoute),
  };
}

function calculatePriorityScore(
  doctor: DoctorProfile,
  frequency: FrequencyStatus[],
  commitmentDoctors: string[],
  mustVisit: string[]
): number {
  let score = 0;

  // Must-visit doctors get max priority
  if (mustVisit.includes(doctor.doctor_id)) return 1000;

  // Doctors with pending commitments
  if (commitmentDoctors.includes(doctor.doctor_id)) score += 200;

  // Category weight: A+ = 100, A = 80, B = 50, C = 20
  const categoryWeights = { "A+": 100, "A": 80, "B": 50, "C": 20 };
  score += categoryWeights[doctor.category] || 20;

  // Under-visited doctors get boost
  const freq = frequency.find(f => f.doctor_id === doctor.doctor_id);
  if (freq && freq.actual < freq.target) {
    const gap = (freq.target - freq.actual) / freq.target;
    score += gap * 150;  // Bigger gap = higher priority
  }

  // RCPA trend: declining = urgent
  if (doctor.rx_trend === "Declining") score += 100;
  if (doctor.rx_trend === "Growing") score += 30;

  // Recency: not visited recently = higher priority
  const daysSinceVisit = dayjs().diff(dayjs(doctor.last_visit_date), "day");
  if (daysSinceVisit > 14) score += 50;
  if (daysSinceVisit > 30) score += 100;

  return score;
}
```

### 5.4 MCP Server: `analytics-mcp` (Manager Intelligence & KPIs)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `get_team_dashboard` | Manager's team performance view | `{ manager_id: string, period: string }` | `TeamDashboard` |
| `get_mr_performance` | Individual MR performance card | `{ mr_id: string, period: string }` | `MRPerformanceCard` |
| `get_coverage_gaps` | Identify under-visited high-value doctors | `{ manager_id: string, category?: string }` | `{ gaps: CoverageGap[], total_lost_opportunity: number }` |
| `get_product_performance` | Product-level performance across team | `{ manager_id: string, brand_name: string, period: string }` | `ProductPerformance` |
| `get_coaching_signals` | AI-generated coaching recommendations | `{ manager_id: string }` | `{ signals: CoachingSignal[] }` |
| `get_competitor_intel` | Territory-wide competitor movement | `{ manager_id: string, period: string }` | `CompetitorIntelReport` |
| `generate_weekly_report` | Auto-generate weekly team report | `{ manager_id: string, week: string }` | `WeeklyReport` |
| `get_rcpa_alerts` | Significant RCPA changes across territory | `{ manager_id: string, threshold_pct?: number }` | `{ alerts: RCPAAlert[] }` |

**Implementation — Coaching Signals:**

```typescript
async function getCoachingSignals(input: { manager_id: string }) {
  // 1. Get team roster
  const team = await tools.get_team_dashboard({
    manager_id: input.manager_id,
    period: "current_month"
  });

  // 2. For each MR, analyze patterns
  const mrAnalyses = await Promise.all(
    team.mrs.map(async (mr) => {
      const [performance, coverage, rcpa] = await Promise.all([
        tools.get_mr_performance({ mr_id: mr.mr_id, period: "last_30_days" }),
        tools.get_territory_coverage({ mr_id: mr.mr_id, period: "current_month" }),
        tools.get_rcpa_trends({ mr_id: mr.mr_id, period: "last_3_months" }),
      ]);
      return { mr, performance, coverage, rcpa };
    })
  );

  // 3. Use Claude Opus to identify coaching opportunities
  const signals = await claude.opus.generate({
    system: `You are a pharmaceutical sales analytics engine generating coaching signals for
    an Area Business Manager. Focus on:
    1. Pattern recognition across MRs — who is doing something right that others can learn from?
    2. Coverage gaps — which high-value doctors are being neglected?
    3. Product focus issues — which products are under-detailed?
    4. Competitive threats — where is the team losing ground?
    5. Positive reinforcement — what's working well?

    Be specific with names, numbers, and actionable recommendations.
    Prioritize signals by business impact.`,
    prompt: `Team data: ${JSON.stringify(mrAnalyses)}

    Generate coaching signals sorted by priority. For each signal:
    - Category (Coverage, Product Focus, Competitive, Skill Gap, Recognition)
    - MR(s) involved
    - Specific observation with data
    - Recommended action for manager`
  });

  return signals;
}
```

---

## 6. Specialized Medical Models (MCP-Wrapped)

### Why Specialized Models

Claude handles orchestration, reasoning, and natural language interaction. But pharma field operations have domain-specific tasks where purpose-built medical models dramatically outperform general-purpose LLMs:

| Task | General LLM Performance | Specialized Model Performance | Why It Matters |
|------|------------------------|------------------------------|----------------|
| **Medical speech-to-text** | Whisper: 12.5% WER on medical dictation | MedASR: 5.2% WER (82% fewer errors) | MRs dictate voice notes with drug names, dosages, medical terms. "Carvedilol 6.25mg BID" misheard as "cardiovascular 6.25 bid" breaks the entire DCR pipeline. |
| **Lab report extraction** | Generic OCR + LLM: ~70% field accuracy | MedGemma 1.5: 90% EHR QA accuracy | When doctors show MRs patient reports to discuss product efficacy, the agent needs to understand lab values, reference ranges, and clinical context. |
| **Medical document understanding** | Good but not domain-optimized | MedGemma 1.5: trained on CT, MRI, CXR, histopathology, lab reports | Understanding prescription pads, hospital formulary documents, clinical trial reprints shared during doctor interactions. |
| **Hinglish medical dictation** | Poor — general ASR models struggle with code-mixed medical terminology | Fine-tuned MedASR: domain-adapted for Indian pharma field vocabulary | "Dr. Sharma ko Cardivas ke baare mein bataya, unka HbA1c 7.2 tha" — needs both Hinglish understanding AND medical entity recognition. |

### 6.1 MedGemma 1.5 Integration

[MedGemma 1.5](https://research.google/blog/next-generation-medical-image-interpretation-with-medgemma-15-and-medical-speech-to-text-with-medasr/) is Google's open medical AI model (4B parameters, free for research and commercial use).

**Capabilities used in MR Copilot:**

| Capability | MR Copilot Use Case | How It's Used |
|------------|-------------------|---------------|
| **Medical document understanding** | Prescription/lab report reading | Doctor shows a patient's lab report during call → MR photographs it → MedGemma extracts structured data (HbA1c, lipid profile, eGFR) → Agent uses extracted values to suggest relevant products and clinical positioning |
| **Lab report extraction** | Competitive intelligence from prescriptions | MR photographs competitor prescriptions at chemist (with consent) → MedGemma extracts brand names, dosages, quantities → feeds into RCPA-like competitive analysis |
| **Clinical document parsing** | Study reprint understanding | When an MR needs to quickly understand a clinical study PDF or a hospital formulary document → MedGemma extracts key findings, endpoints, results |
| **Longitudinal data review** | Patient outcome tracking | When doctors share serial reports to discuss treatment outcomes → MedGemma compares values across timepoints → Agent generates trend narrative |

**MedGemma MCP Server (`medgemma-mcp`):**

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `extract_lab_report` | Extract structured data from lab report image | `{ image_path: string, report_type?: string }` | `{ parameters: LabParameter[], patient_info: PatientInfo, abnormal_flags: string[] }` |
| `extract_prescription` | Extract prescription details from image | `{ image_path: string }` | `{ drugs: PrescriptionDrug[], doctor_name?: string, diagnosis?: string }` |
| `parse_clinical_document` | Extract key information from clinical documents | `{ document_path: string, document_type: "study" \| "formulary" \| "guideline" }` | `{ summary: string, key_findings: string[], structured_data: any }` |
| `compare_serial_reports` | Compare lab values across multiple reports | `{ reports: string[], parameter_focus?: string[] }` | `{ trends: ParameterTrend[], clinical_narrative: string }` |

**Implementation:**

```typescript
import { z } from "zod";

const ExtractLabReportSchema = z.object({
  image_path: z.string().describe("Path to lab report image (photo taken by MR)"),
  report_type: z.enum(["blood_panel", "lipid_profile", "thyroid", "liver", "kidney", "diabetes", "auto"])
    .default("auto").describe("Type of lab report for optimized extraction"),
});

async function extractLabReport(input: z.infer<typeof ExtractLabReportSchema>) {
  // MedGemma 1.5 4B — fine-tuned on Indian lab report formats
  // (Metropolis, SRL, Dr. Lal PathLab, Thyrocare report layouts)
  const result = await medgemmaClient.generate({
    model: "medgemma-1.5-4b-finetuned",  // Company-specific fine-tune
    image: await loadImage(input.image_path),
    prompt: `Extract all lab parameters from this report. For each parameter, provide:
    - Parameter name and code
    - Value with unit
    - Reference range
    - Flag: normal, high, low, critical

    Also extract: patient name, age, sex, sample date, lab name.
    Return as structured JSON.`,
  });

  // Post-process: map to standard schema, validate ranges
  const structured = parseLabReportResponse(result);

  // Feed to Claude for clinical interpretation if abnormals found
  if (structured.abnormal_flags.length > 0) {
    const interpretation = await claude.sonnet.generate({
      prompt: `Given these lab results: ${JSON.stringify(structured.parameters)}
      Patient: ${structured.patient_info.age}y ${structured.patient_info.sex}

      1. What clinical patterns do you see?
      2. Which of our products are relevant to these findings?
      3. What talking points can the MR use with the prescribing doctor?`
    });
    structured.clinical_context = interpretation;
  }

  return structured;
}
```

### 6.2 MedASR Integration

MedASR is Google's medical speech-to-text model, purpose-built for healthcare vocabulary — achieving 5.2% word error rate vs Whisper's 12.5% on medical dictation (82% fewer errors).

**Why MedASR over Whisper for MR Copilot:**

| Scenario | Whisper | MedASR | Impact |
|----------|---------|--------|--------|
| Drug name: "Carvedilol 6.25mg" | "cardiovascular 6.25 mg" ❌ | "Carvedilol 6.25 mg" ✅ | Correct product identified in DCR |
| Dosage: "BID with food" | "bit with food" ❌ | "BID with food" ✅ | Correct dosing instruction captured |
| Study: "COPERNICUS trial" | "Copernicus trial" ⚠️ | "COPERNICUS trial" ✅ | Exact study name for evidence lookup |
| Hinglish: "HbA1c 7.2 tha" | "hb a1 c 7.2 tha" ❌ | "HbA1c 7.2 tha" ✅ | Lab value correctly parsed |
| Doctor name: "Dr. Subramaniam" | "Dr. Subramanyam" ⚠️ | "Dr. Subramaniam" ✅ | Correct doctor matched from master list |
| Medical term: "dyslipidemia" | "dislipidemia" ❌ | "dyslipidemia" ✅ | Correct clinical term for search/matching |

**MedASR MCP Server (`medasr-mcp`):**

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `transcribe_medical_audio` | Transcribe voice note with medical vocabulary | `{ audio_url: string, language_hint?: LanguageCode, context?: string }` | `{ text: string, confidence: number, medical_entities: MedicalEntity[], language_detected: string }` |
| `transcribe_with_diarization` | Transcribe multi-speaker conversation (MR + doctor) | `{ audio_url: string, speakers?: number }` | `{ segments: SpeakerSegment[], medical_entities: MedicalEntity[] }` |
| `extract_medical_entities` | Extract medical entities from transcribed text | `{ text: string }` | `{ drugs: string[], conditions: string[], lab_values: LabValue[], dosages: Dosage[] }` |

**Implementation:**

```typescript
const TranscribeMedicalAudioSchema = z.object({
  audio_url: z.string().describe("URL or path to audio file"),
  language_hint: z.string().optional().describe("Expected language (hi, ta, mr, etc.)"),
  context: z.string().optional().describe("Context hint: 'cardiology_call', 'diabetes_discussion'"),
});

async function transcribeMedicalAudio(input: z.infer<typeof TranscribeMedicalAudioSchema>) {
  // Primary: MedASR (medical-optimized, 82% fewer errors on medical terms)
  try {
    const result = await medasrClient.transcribe({
      audio: input.audio_url,
      language: input.language_hint || "auto",
      domain: "pharmaceutical_field",  // Custom domain hint
      vocabulary_boost: await getCompanyVocabulary(),  // Company brand names, molecule names
    });

    // Post-process: extract medical entities for downstream DCR generation
    const entities = extractMedicalEntities(result.text);

    return {
      text: result.text,
      confidence: result.confidence,
      medical_entities: entities,
      language_detected: result.language,
      model: "medasr",
    };
  } catch (error) {
    // Fallback: Whisper API if MedASR unavailable (offline, API down)
    console.warn("MedASR unavailable, falling back to Whisper:", error.message);
    const whisperResult = await whisperClient.transcribe({
      audio: input.audio_url,
      language: input.language_hint,
    });
    return {
      text: whisperResult.text,
      confidence: whisperResult.confidence * 0.85,  // Discount confidence for non-medical model
      medical_entities: [],  // Whisper doesn't extract entities
      language_detected: whisperResult.language,
      model: "whisper-fallback",
    };
  }
}

// Company-specific vocabulary boosting
async function getCompanyVocabulary(): Promise<string[]> {
  // Loaded from config — all brand names, molecule names, study names
  // that MedASR should recognize with high confidence
  return [
    // Brand names
    "Cardivas", "Telmivas", "Atorvas", "Gluconorm", "Pantocid",
    // Molecule names
    "Carvedilol", "Telmisartan", "Atorvastatin", "Metformin", "Pantoprazole",
    // Competitor brands
    "Metolar", "Concor", "Nebicard", "Lipicure", "Atorva",
    // Study names
    "COPERNICUS", "COMET", "CAPRICORN", "GEMINI",
    // Medical terms frequently used in field
    "HbA1c", "eGFR", "dyslipidemia", "HFrEF", "NYHA",
    // Common Hinglish medical phrases
    "BP check", "sugar level", "cholesterol report",
  ];
}
```

### 6.3 Fine-Tuning with Unsloth Studio

General-purpose MedGemma and MedASR are strong baselines. But fine-tuning on **company-specific private data** is what transforms them from good to indispensable. We use [Unsloth Studio](https://unsloth.ai/) for efficient LoRA and reinforcement learning fine-tuning.

**What Gets Fine-Tuned:**

| Model | Fine-Tuning Data Source | What It Learns | Business Impact |
|-------|------------------------|----------------|-----------------|
| **MedGemma 1.5 4B** | Company's product formulary, visual aids, clinical data sheets | Recognizes company-specific brand names, formulations, pack sizes in prescription/report images | 40-60% improvement in brand name extraction from prescription photos |
| **MedGemma 1.5 4B** | Historical RCPA data (prescription patterns by region) | Regional prescribing pattern recognition — knows that "Atorva 10mg" in Mumbai means the Zydus brand, not the molecule | Accurate competitive intelligence from chemist prescription data |
| **MedGemma 1.5 4B** | Indian lab report formats (Metropolis, SRL, Dr. Lal, Thyrocare templates) | Correctly parses Indian lab report layouts — header positions, parameter naming conventions, reference range formats | >95% extraction accuracy on top 10 Indian lab chains' report formats |
| **MedASR** | 10,000+ hours of MR voice notes (anonymized, with consent) | Company-specific brand pronunciations, regional accent patterns, Hinglish medical code-mixing, doctor name phonetics | 60-70% reduction in drug name transcription errors vs base MedASR |
| **MedASR** | Regional language medical dictation corpus | Tamil, Marathi, Bengali, Gujarati medical terminology mixed with English pharma terms | Regional language support with medical vocabulary accuracy |

**Fine-Tuning Pipeline:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FINE-TUNING PIPELINE (Unsloth Studio)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DATA COLLECTION            2. PREPARATION              3. TRAIN    │
│  ┌──────────────────┐         ┌──────────────────┐       ┌──────────┐ │
│  │ Sources:          │         │ Unsloth Studio:  │       │ Method:  │ │
│  │ • Product data    │         │                  │       │          │ │
│  │ • RCPA feeds      │────────>│ • Data cleaning  │──────>│ LoRA     │ │
│  │ • Voice note      │         │ • Format to      │       │ fine-    │ │
│  │   transcripts     │         │   instruction    │       │ tuning   │ │
│  │ • Lab report      │         │   pairs          │       │ (4-bit   │ │
│  │   scans           │         │ • Train/val      │       │ quant,   │ │
│  │ • Prescription    │         │   split          │       │ 2× speed │ │
│  │   photos          │         │ • Quality        │       │ via      │ │
│  │                   │         │   filtering      │       │ Unsloth) │ │
│  └──────────────────┘         └──────────────────┘       └────┬─────┘ │
│                                                                │       │
│  4. EVALUATE                   5. DEPLOY                       │       │
│  ┌──────────────────┐         ┌──────────────────┐            │       │
│  │ Test against:     │         │ Options:         │            │       │
│  │                   │<────────│                  │<───────────┘       │
│  │ • Held-out voice  │         │ A. On-prem GPU   │                    │
│  │   notes           │         │    (L4/A10/A100) │                    │
│  │ • Known lab       │         │    → Lowest      │                    │
│  │   reports         │         │    latency,      │                    │
│  │ • Prescription    │         │    data stays    │                    │
│  │   photos          │         │    private       │                    │
│  │                   │         │                  │                    │
│  │ Metrics:          │         │ B. Vertex AI     │                    │
│  │ • Drug name WER   │         │    Model Garden  │                    │
│  │ • Entity F1       │         │    → Managed,    │                    │
│  │ • Extraction acc. │         │    scalable,     │                    │
│  │                   │         │    DICOM support │                    │
│  └──────────────────┘         │                  │                    │
│                                │ C. Custom API    │                    │
│                                │    endpoint      │                    │
│                                │    (vLLM/TGI)    │                    │
│                                └──────────────────┘                    │
│                                                                         │
│  RE-TRAINING CADENCE                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Monthly: New RCPA data, new voice notes from field             │   │
│  │ • Quarterly: New product launches, formulary changes             │   │
│  │ • Ad-hoc: New regional language support, new lab report formats  │   │
│  │ • Automated: Unsloth Studio pipeline triggered by data threshold │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Unsloth Studio Configuration:**

```python
# Fine-tuning MedGemma 1.5 4B for Indian pharma lab report extraction
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="google/medgemma-4b-it",
    max_seq_length=4096,
    load_in_4bit=True,        # 4-bit quantization — fits on single L4 GPU
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                      # LoRA rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",  # 2× speed, 60% less memory
)

# Training data: Indian lab report images + structured extraction pairs
# Format: image → JSON with parameters, values, units, flags
from datasets import load_dataset
dataset = load_dataset("company-internal/indian-lab-reports-annotated")

from trl import SFTTrainer
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset["train"],
    dataset_text_field="text",
    max_seq_length=4096,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=1,
        output_dir="outputs/medgemma-indian-pharma",
    ),
)

trainer.train()

# Export for deployment
model.save_pretrained_merged("medgemma-indian-pharma-merged", tokenizer)
# → Deploy to Vertex AI or on-prem vLLM endpoint
```

### 6.4 Model Orchestration — Who Does What

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MODEL ORCHESTRATION                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INPUT                  SPECIALIZED MODEL              CLAUDE            │
│  ─────                  ─────────────────              ──────            │
│                                                                         │
│  Voice note ──────────> MedASR ──────────────────────> Claude Sonnet    │
│  (MR dictation)         • Transcribes with             • Extracts DCR   │
│                           medical vocabulary             structure       │
│                         • Identifies drug names,        • Generates      │
│                           dosages, lab values             summary        │
│                         • Handles Hinglish              • Matches        │
│                                                           doctor/product │
│                                                                         │
│  Lab report photo ────> MedGemma 1.5 ────────────────> Claude Sonnet    │
│  (doctor shows MR)      • Extracts structured           • Interprets    │
│                           lab values                      clinically     │
│                         • Identifies abnormals           • Suggests      │
│                         • Recognizes Indian lab            product pitch │
│                           report formats                                 │
│                                                                         │
│  Prescription photo ──> MedGemma 1.5 ────────────────> Claude Haiku     │
│  (RCPA at chemist)      • Extracts brand names,         • Maps to       │
│                           dosages, quantities              competitor DB │
│                         • Recognizes doctor               • Updates RCPA │
│                           handwriting                       analytics    │
│                                                                         │
│  Complex analysis ────> (no specialized model) ────────> Claude Opus    │
│  (RCPA trends,          Claude handles directly:          • Deep         │
│   coaching signals,     • Multi-step reasoning             reasoning    │
│   competitive           • Strategy generation             • Pattern     │
│   strategy)             • Natural language                  recognition  │
│                                                                         │
│  RULE: Specialized models handle PERCEPTION (vision, speech).           │
│        Claude handles REASONING (analysis, strategy, generation).       │
│        MCP servers provide the clean interface between them.            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Deployment Options for Specialized Models

| Option | Best For | Cost (per MR/month) | Latency | Data Privacy |
|--------|----------|-------------------|---------|-------------|
| **On-prem GPU (L4/A10)** | Large pharma (500+ MRs), strict data compliance | ₹200-400 (amortized GPU cost shared across MRs) | <500ms (local network) | Maximum — data never leaves company infra |
| **Vertex AI Model Garden** | Mid-size pharma, cloud-first teams | ₹300-500 (pay-per-inference) | 500-1000ms (API call) | Google Cloud — data processing agreement required |
| **Custom vLLM/TGI endpoint** | Flexible deployment, multi-cloud | ₹250-450 (depends on cloud provider) | 500-800ms | Depends on hosting provider |
| **On-device (MedGemma 4B)** | Offline-first regions (Northeast, rural), zero-latency lookups | ₹0 (runs on MR's device) | <200ms (local) | Maximum — runs entirely on device |

**Hybrid strategy (recommended):**
- MedASR: Cloud API (needs internet anyway for sync) with Whisper offline fallback
- MedGemma 4B: On-device for lab report reading (works offline), cloud for heavy document processing
- Fine-tuned models: On-prem GPU for pharma companies with compliance requirements, Vertex AI for cloud-native companies

---

## 7. Voice-to-DCR Pipeline

The most transformative feature — turning a 30-second voice note into a structured CRM entry:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOICE → DCR PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CAPTURE               2. TRANSCRIBE            3. EXTRACT           │
│  ┌──────────────┐        ┌──────────────────┐     ┌──────────────────┐ │
│  │ MR records   │        │ MedASR (primary) │     │ Claude Sonnet    │ │
│  │ voice note   │        │ medical speech-  │     │ extracts:        │ │
│  │ after call   │───────>│ to-text, 82%     │────>│                  │ │
│  │              │        │ fewer errors on   │     │ • Doctor name    │ │
│  │ "Met Dr.     │        │ drug names vs     │     │ • Products       │ │
│  │  Shah today, │        │ Whisper. Handles  │     │ • Samples given  │ │
│  │  discussed   │        │ Hinglish medical  │     │ • Outcome        │ │
│  │  Cardivas..."│        │ Confidence: 0.97  │     │ • Commitments    │ │
│  └──────────────┘        └──────────────────┘     │ • Next steps     │ │
│                                                    └────────┬─────────┘ │
│                                                             │           │
│  4. ENRICH                5. VALIDATE             6. SUBMIT             │
│  ┌──────────────┐        ┌──────────────────┐    ┌──────────────────┐  │
│  │ Match doctor │        │ Cross-check:     │    │ Based on tier:   │  │
│  │ from master  │        │                  │    │                  │  │
│  │ list (fuzzy  │───────>│ • Doctor exists? │───>│ L1: Draft for    │  │
│  │ match)       │        │ • Time plausible?│    │   MR review      │  │
│  │              │        │ • Location match?│    │                  │  │
│  │ Add:         │        │ • Products in    │    │ L2: Auto-submit, │  │
│  │ • doctor_id  │        │   MR's bag?      │    │   notify MR      │  │
│  │ • geo coords │        │ • Sample stock   │    │                  │  │
│  │ • OPD timing │        │   available?     │    │ L3: Auto-submit  │  │
│  │   validation │        │                  │    │   + schedule      │  │
│  └──────────────┘        │ Flag ambiguities │    │   follow-up      │  │
│                          └──────────────────┘    └──────────────────┘  │
│                                                                         │
│  HINGLISH HANDLING                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Indian MRs naturally code-mix Hindi and English:                │   │
│  │ "Dr. Sharma se mila, Cardivas discuss kiya, woh bol rahe the   │   │
│  │  ki thoda expensive hai but efficacy ke baare mein positive     │   │
│  │  the. 2 sample strips diye, next week phir milenge."            │   │
│  │                                                                  │   │
│  │ → Doctor: Dr. Sharma                                             │   │
│  │ → Product: Cardivas (Primary)                                    │   │
│  │ → Objection: Price concern ("expensive")                         │   │
│  │ → Response: Positive on efficacy                                 │   │
│  │ → Samples: 2 strips of Cardivas                                  │   │
│  │ → Next visit: ~7 days                                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation — Voice Note Processing:**

```typescript
async function processVoiceNote(input: {
  audio_url: string;
  mr_id: string;
  date: string;
  lat?: number;
  lng?: number;
}) {
  // 1. Transcribe using MedASR (82% fewer errors on medical terms vs Whisper)
  const transcription = await tools.transcribe_medical_audio({
    audio_url: input.audio_url,
    context: "pharmaceutical_field_call",
  });

  // 2. Get MR's territory context for entity resolution
  const [doctorList, sampleInventory, recentVisits] = await Promise.all([
    tools.get_doctor_master_list({ mr_id: input.mr_id }),
    tools.get_sample_inventory({ mr_id: input.mr_id }),
    tools.get_daily_dcr({ mr_id: input.mr_id, date: input.date }),
  ]);

  // 3. Claude extracts structured data from transcription
  const extracted = await claude.sonnet.generate({
    system: `You are an expert at extracting structured pharmaceutical field visit data from
    Indian MR voice notes. You understand Hinglish (Hindi-English code-mixing) perfectly.

    RULES:
    - Match doctor names to the provided master list (fuzzy match — "Dr. Shah" could be "Dr. Rajesh Shah")
    - Match product names to known brands (fuzzy — "Cardivas" from "cardivas" or "kaaardivas")
    - Extract ALL products discussed, even secondary mentions
    - Capture doctor sentiment: positive, negative, neutral, will-try
    - Identify commitments made by MR or doctor
    - Extract sample quantities if mentioned
    - Flag any ambiguities you cannot resolve confidently

    Doctor master list: ${doctorList.doctors.map(d => `${d.doctor_id}: ${d.name} (${d.specialty})`).join("\n")}
    Known products: ${getProductList().join(", ")}`,

    prompt: `Transcription: "${transcription.text}"
    MR location: ${input.lat}, ${input.lng}
    Time: ${dayjs().format("HH:mm")}

    Extract and return as JSON matching the DCREntry schema.`
  });

  // 4. Validate and enrich
  const dcr = await validateAndEnrich(extracted, input);

  return dcr;
}
```

---

## 8. Orchestrator — Main Agent Loop

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// System prompt for the MR Copilot orchestrator
const SYSTEM_PROMPT = `You are MR Copilot, an AI assistant for Medical Representatives in the
Indian pharmaceutical industry. You help MRs be more effective in the field.

YOUR CAPABILITIES:
1. Pre-Call Intelligence — Doctor briefs with Rx data, visit history, and tailored talking points
2. In-Call Support — Product info, objection handling, clinical evidence, drug interactions
3. Post-Call Automation — Voice-to-DCR, CRM updates, follow-up scheduling
4. Territory Planning — Route optimization, coverage analysis, frequency compliance
5. Compliance — UCPMP tracking, input/sample management

YOUR PERSONALITY:
- You're a smart, experienced field colleague — not a robot
- You speak the MR's language: "detailing", "DCR", "RCPA", "stockist", "POB", "primary/secondary"
- You're concise in the field (MR is between calls) but detailed when asked
- You celebrate wins: "Nice! Dr. Shah agreeing to trial 5 patients is huge for Cardivas."
- You're proactive: if you notice something the MR should know, say it

CONSTRAINTS:
- Never fabricate clinical data or study results
- Never suggest off-label use of products
- Always cite the source when quoting clinical evidence
- Respect UCPMP compliance boundaries
- Never share one doctor's prescribing data with another doctor
- Flag compliance risks proactively

LANGUAGE:
- Communicate in English by default
- Understand Hinglish (Hindi-English mix) in voice notes
- If the MR writes in Hindi, respond in Hindi
- Use pharma field jargon naturally

ANTI-HALLUCINATION RULES:
- Never cite a clinical study name, result, or statistic from general knowledge. Only reference studies listed in the Product Knowledge Base. If a doctor asks about a study not in your KB, say "I don't have data on that study — let me check with the medical team." Never fabricate study results, patient numbers, or efficacy percentages.
- When quoting clinical data (e.g., "COPERNICUS showed 35% mortality reduction"), verify this comes from the product KB tool. If the tool has no match, retract the claim.
- For RCPA data, only cite numbers returned by the get_rcpa_analysis tool. Never estimate or extrapolate prescription numbers.`;

// --- CRM tools ---
const getDoctorProfile = tool("get_doctor_profile", "Fetch doctor profile from CRM", getDoctorProfileSchema, getDoctorProfileHandler);
const searchDoctors = tool("search_doctors", "Search doctors in territory", searchDoctorsSchema, searchDoctorsHandler);
const getVisitHistory = tool("get_visit_history", "Get visit history for a doctor", getVisitHistorySchema, getVisitHistoryHandler);
const submitDcrEntry = tool("submit_dcr_entry", "Submit a DCR entry to CRM", submitDCRSchema, submitDCRHandler);
const getOpenCommitments = tool("get_open_commitments", "Get open commitments for MR", getOpenCommitmentsSchema, getOpenCommitmentsHandler);
const getCallTargets = tool("get_call_targets", "Get call targets for MR", getCallTargetsSchema, getCallTargetsHandler);

// --- Pharma intelligence tools ---
const lookupProduct = tool("lookup_product", "Look up product information", lookupProductSchema, lookupProductHandler);
const getDosage = tool("get_dosage", "Get dosage information for a product", getDosageSchema, getDosageHandler);
const checkDrugInteraction = tool("check_drug_interaction", "Check drug-drug interactions", checkDrugInteractionSchema, checkDrugInteractionHandler);
const getClinicalStudy = tool("get_clinical_study", "Retrieve clinical study details", getClinicalStudySchema, getClinicalStudyHandler);
const compareWithCompetitor = tool("compare_with_competitor", "Compare product with competitor", compareCompetitorSchema, compareCompetitorHandler);
const handleObjection = tool("handle_objection", "Get evidence-based objection response", handleObjectionSchema, handleObjectionHandler);
const getRcpaAnalysis = tool("get_rcpa_analysis", "Analyze RCPA data for a doctor", getRCPAAnalysisSchema, getRCPAAnalysisHandler);
const getMicroLearning = tool("get_micro_learning", "Get micro-learning nudge for a call", getMicroLearningSchema, getMicroLearningHandler);

// --- Field ops tools ---
const planDailyRoute = tool("plan_daily_route", "Plan optimized daily route", planDailyRouteSchema, planDailyRouteHandler);
const checkGeoCompliance = tool("check_geo_compliance", "Verify geo-location compliance", checkGeoComplianceSchema, checkGeoComplianceHandler);
const getSampleInventory = tool("get_sample_inventory", "Get current sample inventory", getSampleInventorySchema, getSampleInventoryHandler);
const logSampleDistribution = tool("log_sample_distribution", "Log sample distribution to doctor", logSampleDistributionSchema, logSampleDistributionHandler);
const checkCompliance = tool("check_compliance", "Check UCPMP compliance status", checkComplianceSchema, checkComplianceHandler);
const transcribeVoiceNote = tool("transcribe_voice_note", "Transcribe MR voice note", transcribeVoiceNoteSchema, transcribeVoiceNoteHandler);
const parseVoiceToDcr = tool("parse_voice_to_dcr", "Parse voice transcription into DCR entry", parseVoiceToDCRSchema, parseVoiceToDCRHandler);

// --- Analytics tools ---
const getTeamDashboard = tool("get_team_dashboard", "Get team performance dashboard", getTeamDashboardSchema, getTeamDashboardHandler);
const getCoachingSignals = tool("get_coaching_signals", "Get coaching signals for team", getCoachingSignalsSchema, getCoachingSignalsHandler);

// Create MCP servers grouping tools by domain
const crmMcpServer = createSdkMcpServer({
  name: "crm-mcp",
  tools: [getDoctorProfile, searchDoctors, getVisitHistory, submitDcrEntry, getOpenCommitments, getCallTargets],
});

const pharmaIntelMcpServer = createSdkMcpServer({
  name: "pharma-intel-mcp",
  tools: [lookupProduct, getDosage, checkDrugInteraction, getClinicalStudy, compareWithCompetitor, handleObjection, getRcpaAnalysis, getMicroLearning],
});

const fieldOpsMcpServer = createSdkMcpServer({
  name: "field-ops-mcp",
  tools: [planDailyRoute, checkGeoCompliance, getSampleInventory, logSampleDistribution, checkCompliance, transcribeVoiceNote, parseVoiceToDcr],
});

const analyticsMcpServer = createSdkMcpServer({
  name: "analytics-mcp",
  tools: [getTeamDashboard, getCoachingSignals],
});

// Pre-tool-use hook: enforce compliance checks before CRM writes
const complianceHook: HookCallback = async ({ toolName, toolInput, context }) => {
  if (toolName === "submit_dcr_entry" && context.autonomy_level < 2) {
    return {
      decision: "block",
      message: "DCR auto-submit requires Level 2 autonomy. Saving as draft for MR review.",
    };
  }
  return { decision: "allow" };
};

async function runMRCopilot(userMessage: string, context: MRContext) {
  let finalResult = "";

  // query() handles the full agentic loop — no manual while loop needed
  for await (const message of query({
    prompt: userMessage,
    options: {
      model: "claude-sonnet-4-6-20250514",  // Sonnet for most field interactions
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: {
        "crm-mcp": crmMcpServer,
        "pharma-intel-mcp": pharmaIntelMcpServer,
        "field-ops-mcp": fieldOpsMcpServer,
        "analytics-mcp": analyticsMcpServer,
      },
      permissionMode: "bypassPermissions",
      maxTurns: 50,
      hooks: {
        PreToolUse: [{ matcher: "submit_dcr_entry", hooks: [complianceHook] }],
      },
      agents: {
        "rcpa-analyst": {
          description: "Specialized sub-agent for complex RCPA trend analysis and coaching signals — uses Opus for deeper reasoning",
          prompt: "You are an RCPA analysis specialist. Perform deep prescription trend analysis, competitor intelligence, and generate coaching signals for managers.",
          model: "claude-opus-4-6-20250514",
          tools: ["get_coaching_signals", "get_rcpa_analysis", "compare_with_competitor", "get_team_dashboard"],
        },
      },
    },
  })) {
    if ("result" in message) {
      finalResult = message.result;
    }
  }

  return finalResult;
}
```

---

## 9. Scheduled Tasks

```typescript
import cron from "node-cron";

// Morning brief — 7:00 AM daily
cron.schedule("0 7 * * *", async () => {
  const activeMRs = await getActiveMRs();
  for (const mr of activeMRs) {
    const brief = await generateMorningBrief(mr.mr_id);
    await sendPushNotification(mr.device_token, {
      title: "🌅 Good morning! Your day is planned",
      body: `${brief.calls_planned} calls today. Start with ${brief.first_call.doctor_name}`,
      data: { type: "morning_brief", brief },
    });
  }
});

// Evening reminder — 6:30 PM daily (if DCR not submitted)
cron.schedule("30 18 * * *", async () => {
  const activeMRs = await getActiveMRs();
  for (const mr of activeMRs) {
    const dcr = await tools.get_daily_dcr({ mr_id: mr.mr_id, date: today() });
    if (!dcr.submitted) {
      const pending = dcr.entries.filter(e => !e.mr_reviewed);
      await sendPushNotification(mr.device_token, {
        title: "📝 DCR ready for review",
        body: `${dcr.entries.length} calls auto-logged. ${pending.length} need your review before submit.`,
        data: { type: "dcr_reminder", date: today() },
      });
    }
  }
});

// Weekly RCPA analysis — Monday 8:00 AM
cron.schedule("0 8 * * 1", async () => {
  const managers = await getActiveManagers();
  for (const mgr of managers) {
    const report = await tools.generate_weekly_report({
      manager_id: mgr.manager_id,
      week: lastWeek()
    });
    await sendPushNotification(mgr.device_token, {
      title: "📊 Weekly team report ready",
      body: `Team avg: ${report.avg_calls}/day. ${report.highlights[0]}`,
      data: { type: "weekly_report", report },
    });
  }
});

// Monthly compliance audit — 1st of every month
cron.schedule("0 9 1 * *", async () => {
  const allMRs = await getActiveMRs();
  for (const mr of allMRs) {
    const compliance = await runMonthlyComplianceAudit(mr.mr_id);
    if (compliance.violations.length > 0) {
      await escalateToManager(mr.manager_id, {
        type: "compliance_alert",
        mr_name: mr.name,
        violations: compliance.violations,
      });
    }
  }
});
```

---

## 10. Configuration

### Territory Configuration

```json
{
  "territory": {
    "territory_id": "MUM-WEST-001",
    "territory_name": "Mumbai West",
    "mr_id": "MR-5001",
    "mr_name": "Ravi Sharma",
    "manager_id": "ABM-201",
    "manager_name": "Priya Nair",
    "region": "West",
    "zone": "Mumbai",

    "call_targets": {
      "daily_calls": 8,
      "monthly_calls": 176,
      "category_wise": {
        "A+": { "frequency_per_month": 8, "min_time_per_call_min": 10 },
        "A":  { "frequency_per_month": 6, "min_time_per_call_min": 8 },
        "B":  { "frequency_per_month": 4, "min_time_per_call_min": 5 },
        "C":  { "frequency_per_month": 2, "min_time_per_call_min": 3 }
      }
    },

    "products_in_bag": [
      { "brand": "Cardivas", "priority": 1, "therapeutic_area": "Cardiovascular" },
      { "brand": "Telmivas", "priority": 2, "therapeutic_area": "Cardiovascular" },
      { "brand": "Atorvas", "priority": 3, "therapeutic_area": "Cardiovascular" },
      { "brand": "Gluconorm", "priority": 4, "therapeutic_area": "Diabetes" },
      { "brand": "Pantocid", "priority": 5, "therapeutic_area": "Gastro" }
    ],

    "compliance": {
      "ucpmp_gift_limit_per_doctor_inr": 1000,
      "ucpmp_warning_threshold_pct": 80,
      "sample_tracking_enabled": true,
      "geo_verification_enabled": true,
      "geo_tolerance_meters": 500
    },

    "autonomy_level": 2,

    "notifications": {
      "morning_brief": true,
      "evening_dcr_reminder": true,
      "rcpa_alerts": true,
      "compliance_warnings": true,
      "commitment_reminders": true
    }
  }
}
```

### Product Knowledge Configuration

```json
{
  "products": {
    "Cardivas": {
      "molecule": "Carvedilol",
      "therapeutic_area": "Cardiovascular",
      "strengths": ["3.125mg", "6.25mg", "12.5mg", "25mg"],
      "mrp": {
        "3.125mg": 58.50,
        "6.25mg": 89.00,
        "12.5mg": 142.00,
        "25mg": 198.00
      },
      "cost_per_day": {
        "6.25mg_bid": 5.93,
        "12.5mg_bid": 9.47,
        "25mg_bid": 13.20
      },
      "indications": [
        {
          "condition": "Heart Failure (HFrEF)",
          "evidence_level": "A",
          "guideline": "ESC 2021, AHA/ACC 2022",
          "key_message": "Only beta-blocker with proven mortality benefit in HF across all severity levels"
        },
        {
          "condition": "Hypertension",
          "evidence_level": "A",
          "guideline": "ESC/ESH 2023",
          "key_message": "Dual alpha + beta blockade — superior BP reduction in metabolic syndrome patients"
        },
        {
          "condition": "Post-MI with LV dysfunction",
          "evidence_level": "A",
          "guideline": "ESC 2023 ACS Guidelines",
          "key_message": "CAPRICORN trial: 23% reduction in all-cause mortality post-MI"
        }
      ],
      "key_studies": [
        {
          "name": "COPERNICUS",
          "one_liner": "Carvedilol reduced mortality by 35% in severe heart failure",
          "detail": "2,289 patients with NYHA IV HF, EF <25%. 35% mortality reduction (p=0.00013). NNT=15 over 10 months."
        },
        {
          "name": "US Carvedilol HF Study",
          "one_liner": "Carvedilol reduced mortality by 65% in mild-moderate heart failure",
          "detail": "1,094 patients with NYHA II-III HF. 65% mortality reduction (p<0.001). First trial to establish carvedilol's HF mortality benefit, led to FDA approval."
        },
        {
          "name": "CAPRICORN",
          "one_liner": "Post-MI: carvedilol reduces mortality by 23% in LV dysfunction",
          "detail": "1,959 post-MI patients with EF ≤40%. 23% all-cause mortality reduction. Benefit beyond reperfusion."
        },
        {
          "name": "GEMINI",
          "one_liner": "Carvedilol improves insulin sensitivity vs metoprolol in diabetic hypertensives",
          "detail": "1,235 diabetic patients. Carvedilol improved HbA1c vs metoprolol worsening it. Better metabolic profile."
        },
        {
          "name": "COMET",
          "one_liner": "Carvedilol superior to metoprolol tartrate: 17% better survival in HF",
          "detail": "3,029 HF patients. Carvedilol vs metoprolol tartrate. 17% mortality reduction favoring carvedilol (p=0.0017)."
        }
      ],
      "common_objections": [
        {
          "objection": "It's more expensive than metoprolol",
          "category": "Price",
          "response_short": "At ₹6/day, Cardivas costs just ₹2 more than generic metoprolol but offers dual alpha+beta blockade and proven metabolic benefits.",
          "response_detailed": "The GEMINI trial showed carvedilol improves insulin sensitivity while metoprolol worsens it. For your diabetic hypertensive patients, the ₹60/month difference prevents metabolic deterioration. The COMET trial showed 17% better survival vs metoprolol in HF. Cost per life-year saved is among the most favorable in cardiology."
        },
        {
          "objection": "Metoprolol succinate is the standard for heart failure",
          "category": "Competitor",
          "response_short": "The COMET trial directly compared carvedilol vs metoprolol and showed 17% survival advantage for carvedilol.",
          "response_detailed": "While metoprolol succinate (Toprol-XL/Metolar XR) is indeed guideline-recommended, the head-to-head COMET trial (n=3,029) showed carvedilol provided 17% better survival (p=0.0017). The additional alpha-1 blockade provides peripheral vasodilation, reduces afterload, and offers metabolic benefits that pure beta-1 selective agents don't."
        },
        {
          "objection": "Patients complain of dizziness",
          "category": "Safety",
          "response_short": "Start low (3.125mg BID), uptitrate every 2 weeks. First-dose hypotension is manageable with proper titration.",
          "response_detailed": "Dizziness is mostly a first-dose phenomenon due to alpha blockade. The key is starting at 3.125mg BID and doubling every 2 weeks to target dose. In COPERNICUS, only 1.5% discontinued due to hypotension with proper titration. Taking with food reduces absorption rate and minimizes dizziness. The long-term benefits (35% mortality reduction) far outweigh transient initial dizziness."
        }
      ],
      "competitor_comparison": {
        "vs_metoprolol_succinate": {
          "brand": "Metolar XR (Cipla)",
          "advantage": "Dual alpha+beta blockade, metabolic benefits (GEMINI), 17% mortality advantage (COMET)",
          "disadvantage": "Needs BID dosing vs OD for Metolar XR, more first-dose hypotension",
          "cost_comparison": { "cardivas_6_25_bid": 5.93, "metolar_xr_50_od": 4.10 }
        },
        "vs_bisoprolol": {
          "brand": "Concor (Merck)",
          "advantage": "Alpha blockade for metabolic benefit, better in diabetics, vasodilation",
          "disadvantage": "BID dosing, more side effects initially",
          "cost_comparison": { "cardivas_6_25_bid": 5.93, "concor_5_od": 7.80 }
        },
        "vs_nebivolol": {
          "brand": "Nebicard (Torrent)",
          "advantage": "Broader evidence base (COPERNICUS, CAPRICORN, COMET), dual mechanism",
          "disadvantage": "Nebivolol also vasodilates (via NO pathway), BID dosing for carvedilol, more initial side effects",
          "cost_comparison": { "cardivas_6_25_bid": 5.93, "nebicard_5_od": 6.20 }
        }
      }
    }
  }
}
```

---

## 11. KPIs & Monitoring

### MR-Level KPIs

| KPI | Target | Measurement | Agent Action if Below Target |
|-----|--------|-------------|------------------------------|
| **Daily call average** | 8 calls/day | DCR entries per working day | Morning brief prioritizes calls, evening reminder nudges |
| **Coverage %** | >90% of territory doctors visited/month | Unique doctors visited / total assigned | Route optimizer prioritizes unvisited doctors |
| **Frequency compliance** | >80% of A+/A doctors at target frequency | Actual visits / target visits per doctor category | Pre-call brief flags under-visited doctors |
| **Productive call %** | >75% calls rated "productive" | Calls with positive outcome / total calls | Coaching signal to manager |
| **Product detailing mix** | Aligned with company priority | % of calls where priority products discussed | Suggested pitch emphasizes priority products |
| **RCPA share growth** | +2% share per quarter | Our brand Rx / total therapy area Rx | Alert if declining, suggest competitive strategies |
| **DCR submission timeliness** | Same-day by 8 PM | % DCRs submitted on visit date | Evening push notification |
| **Sample reconciliation** | 100% accounted | Distributed + in-stock = received from company | Monthly audit, flag discrepancies |
| **Compliance score** | 100% (zero violations) | UCPMP adherence | Proactive warning before threshold breach |

### Manager-Level KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Team call average** | 8.0 across team | Average daily calls per MR |
| **Territory coverage** | >85% team-wide | % of territory doctors receiving target frequency |
| **RCPA growth** | +2% quarterly share | Territory-level brand share trend |
| **DCR accuracy** | >95% geo-verified | % of DCR entries with valid geo-tag |
| **Compliance adherence** | Zero UCPMP violations | Monthly compliance audit pass rate |
| **New doctor additions** | ≥5/month/MR | New doctors added and visited |
| **Conversion rate** | >20% trial commitments per month | Doctors agreeing to trial / total unique calls |

---

## 12. Cost Estimates (INR)

### Per-MR Monthly Cost

| Component | Cost (₹) | Notes |
|-----------|----------|-------|
| Claude API — Sonnet (pre-call briefs, DCR generation, objection handling) | ₹800-1,200 | ~30-40 calls/day × 22 days, ~2-3 API calls per call |
| Claude API — Haiku (product lookups, quick queries) | ₹150-250 | High-volume, low-cost queries |
| Claude API — Opus (weekly RCPA analysis, coaching signals) | ₹200-400 | 4-5 deep analyses per month |
| MedASR (medical speech-to-text) | ₹200-350 | Replaces Whisper for medical dictation, 82% fewer errors on drug names |
| MedGemma 1.5 inference (lab reports, prescriptions) | ₹150-300 | ~2-5 image analyses/day (lab reports, prescription photos at chemist) |
| Google Maps Platform (routing, geocoding) | ₹200-350 | Daily route optimization + geo-verification |
| Cloud infrastructure (per-MR share) | ₹100-200 | PostgreSQL, Firebase, hosting |
| **Total per MR per month** | **₹1,800-3,050** | |

### Company-Level Cost for 100 MRs

| Component | Monthly (₹) | Annual (₹) |
|-----------|-------------|------------|
| MR copilot (100 MRs) | ₹1.8L-3.05L | ₹21.6L-36.6L |
| Manager dashboards (10 ABMs) | ₹15K-25K | ₹1.8L-3L |
| RCPA data processing | ₹10K-20K | ₹1.2L-2.4L |
| Specialized model hosting (MedGemma + MedASR) | ₹40K-80K | ₹4.8L-9.6L (shared GPU infra or Vertex AI) |
| Fine-tuning (Unsloth Studio, quarterly) | ₹15K-30K | ₹1.8L-3.6L (GPU compute for retraining) |
| Infrastructure | ₹30K-50K | ₹3.6L-6L |
| **Total** | **₹2.9L-4.85L** | **₹34.8L-58.2L** |

### ROI Justification

| Benefit | Conservative Estimate | Calculation |
|---------|----------------------|-------------|
| MR time saved on DCR | 1 hour/day × 100 MRs = 2,200 hrs/month | At ₹500/hr MR cost = ₹11L/month saved |
| Extra productive call per day | 1 call × 22 days × 100 MRs × ₹200 avg Rx value | ₹4.4L/month in incremental Rx |
| Reduced MR attrition (better tools) | 5% lower attrition × ₹3L replacement cost | ₹15L/year saved |
| Improved coverage → Rx growth | 2% share gain on ₹50Cr territory | ₹1Cr/year incremental revenue |
| Improved accuracy from specialized models | Better drug name recognition → fewer DCR errors, better RCPA from prescription photos | Saves ₹2-3L/year in data correction + MR rework |
| **Total annual benefit** | **₹1.5-2Cr** | **vs cost of ₹35-58L = 2.5-4× ROI** |

---

## 13. Deployment & Rollout

### Phased Rollout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PHASES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: PILOT (Week 1-4)                                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • 5-10 MRs in one territory (ideally tech-savvy, high performers)│   │
│  │ • Level 1 autonomy only (suggest, don't auto-execute)            │   │
│  │ • Focus: Pre-call briefs + Voice-to-DCR + Product Q&A            │   │
│  │ • Measure: MR satisfaction, DCR quality, time saved               │   │
│  │ • Iterate: Fix entity resolution errors, improve voice parsing    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 2: TERRITORY (Week 5-8)                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Full territory (30-50 MRs) under one ABM                       │   │
│  │ • Level 2 autonomy for proven MRs (auto-DCR with notification)   │   │
│  │ • Add: Route optimization, RCPA analysis, compliance tracking     │   │
│  │ • Launch: Manager dashboard for ABM                               │   │
│  │ • Measure: Coverage improvement, RCPA trend, DCR timeliness       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 3: REGION (Week 9-16)                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • Full region (100-200 MRs, 5-10 ABMs, 1-2 RBMs)                │   │
│  │ • Level 2-3 autonomy based on MR performance                     │   │
│  │ • Full feature set including coaching signals                     │   │
│  │ • CRM integration (Veeva/IQVIA API sync)                         │   │
│  │ • Measure: ROI metrics, Rx growth vs control territories          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  PHASE 4: NATIONAL (Month 5+)                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ • All-India rollout                                               │   │
│  │ • Multi-language support (Hindi, Tamil, Telugu, Bengali, Marathi) │   │
│  │ • Integration with stockist/distribution systems                  │   │
│  │ • Advanced analytics: territory re-alignment recommendations      │   │
│  │ • ML models for Rx prediction and doctor segmentation             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### CRM Integration Patterns

```
┌────────────────────────────────────────────────────────────────────┐
│                  CRM INTEGRATION OPTIONS                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  OPTION A: Veeva CRM (Enterprise pharma)                           │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ • Veeva Vault API for document management                 │     │
│  │ • Veeva CRM API for doctor master, call reporting        │     │
│  │ • Veeva Engage for remote detailing data                  │     │
│  │ • Bidirectional sync: DCR → Veeva, Doctor data → Agent   │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  OPTION B: Custom CRM (most Indian pharma)                         │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ • REST API adapter for company's existing CRM             │     │
│  │ • CSV import for doctor master and RCPA data              │     │
│  │ • Webhook push for real-time DCR submission               │     │
│  │ • Most flexible — adapts to any backend                   │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  OPTION C: Standalone (startup pharma / no CRM)                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ • MR Copilot IS the CRM — local SQLite + cloud sync      │     │
│  │ • Doctor master built from scratch via MR input           │     │
│  │ • RCPA data imported via CSV                              │     │
│  │ • Export to Excel for existing reporting workflows        │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 14. Security & Privacy

| Concern | Mitigation |
|---------|-----------|
| **Doctor PII** | All doctor data encrypted at rest (AES-256) and in transit (TLS 1.3). Doctor PII never sent in Claude API prompts — only anonymized IDs with separate lookup. |
| **RCPA data sensitivity** | RCPA data is commercially sensitive. Per-MR access only to their territory. Aggregated views for managers. No cross-company data leakage. |
| **Voice recordings** | Processed in real-time, transcription stored, audio deleted after 30 days. Consent obtained from MR at onboarding. |
| **Geolocation tracking** | Used only for DCR verification during working hours. No off-hours tracking. MR can see their own location data. |
| **Offline data** | Local SQLite encrypted with device-level encryption. Remote wipe capability if device lost/stolen. |
| **API key management** | All CRM and third-party API keys stored in environment variables, never in code or config files. Rotated quarterly. |
| **Audit trail** | Every agent action (DCR submit, compliance check, route plan) logged with timestamp, MR ID, input, output. Retained for 2 years. |
| **Multi-tenancy** | Pharma company data completely isolated. One deployment per customer. No shared infrastructure between competing pharma companies. |

---

## 15. Example Conversations

### Pre-Call Brief Request

```
MR: "Brief me on Dr. Patel"

Agent: 🎯 TOP PRIORITY: Follow up on Cardivas trial — he agreed to try 5 patients last visit (Mar 18)

📊 RX SNAPSHOT:
• Total cardio Rxs: ~45/week
• Cardivas: 8/week (18%) — stable
• Metolar XR: 15/week (33%) — was 12 three months ago ⚠️
• Concor: 10/week (22%)

📝 LAST VISIT (Mar 18):
• Discussed Cardivas for mild HF patients
• Agreed to trial 5 patients on Cardivas 6.25mg BID
• Asked for COPERNICUS study reprint (you committed to bring it)
• He mentioned a patient who felt dizzy on 12.5mg — you suggested slower titration

⚡ OPEN ITEMS:
• Bring COPERNICUS study reprint (OVERDUE - was due Mar 22)
• Follow up on 5-patient trial outcome

💡 SUGGESTED PITCH:
Lead with "How did those 5 Cardivas patients do?" — this is your hook. If positive, push for broader
adoption in his mild HF cohort. If dizziness came up again, reinforce the 3.125→6.25 titration protocol
from COPERNICUS. The fact that Metolar XR is growing is a competitive threat — address with COMET data
(17% survival advantage).

🧠 MICRO-LEARNING: In COPERNICUS, the starting dose was 3.125mg BID with uptitration every 2 weeks.
Only 1.5% discontinued due to hypotension. Slow titration is key.
```

### Objection Handling

```
MR: "Doctor is saying Cardivas causes too much dizziness compared to Metolar"

Agent: Good objection — here's how to respond:

QUICK RESPONSE:
"Doctor, the dizziness is typically a first-dose phenomenon. In COPERNICUS, with proper titration
starting at 3.125mg BID, only 1.5% discontinued due to hypotension."

IF HE PUSHES BACK:
"The key is starting low and going slow — 3.125mg BID for 2 weeks, then 6.25mg BID. Taking with food
also helps. And the long-term benefit is significant: the COMET trial showed carvedilol provides 17%
better survival than metoprolol in heart failure. That's the trade-off — a few days of manageable
dizziness for 17% better long-term outcomes."

PIVOT TO ADVANTAGE:
"In fact, the alpha-blocking property that causes initial dizziness is the SAME property that gives
Cardivas its metabolic advantage. The GEMINI trial showed carvedilol improves insulin sensitivity while
metoprolol worsens it. For your diabetic patients, this is a meaningful difference."

📄 STUDY REFERENCE: COMET trial, Lancet 2003, n=3,029
```

### Voice-to-DCR

```
MR (voice note): "Abhi Dr. Mehta se mil ke aa raha hoon. Unhe Cardivas ke baare mein bataya,
6.25 wala. Bohot positive the, bole 10 patients pe try karenge next week. 3 sample strips diye
6.25 ke. Unhe wo COMET study ka printout bhi chahiye next time. Ek patient ka bhi mention kiya
jisko cough aa raha tha ACE inhibitor se, toh maine bola Cardivas is a good alternative since
it's a beta-blocker with vasodilation, no cough issue."

Agent: ✅ DCR auto-generated:

📋 CALL ENTRY:
• Doctor: Dr. Amit Mehta (ID: DOC-2847, Cardiologist, City Heart Clinic)
• Time: 2:15 PM | Location verified ✓ (within 120m of clinic)
• Products: Cardivas 6.25mg (Primary)
• Detail: Discussed Cardivas 6.25mg as beta-blocker with vasodilation. Doctor very positive.
• Outcome: Will trial on 10 patients next week
• Doctor's interest: Patient had ACE inhibitor cough — Cardivas positioned as alternative
  (beta-blocker + vasodilation, no cough)
• Samples: Cardivas 6.25mg × 3 strips (stock remaining: 12 strips)
• Commitment: Bring COMET study printout next visit
• Next visit: Scheduled in 7 days (follow up on 10-patient trial)

⚠️ One thing to note: Dr. Mehta's ACE inhibitor cough case is a great story. Consider sharing this
use case positioning with your ABM — could be a team-wide messaging opportunity.

[Submit DCR] [Edit before submit] [Add notes]
```

---

## 16. Regional & Language Intelligence

Indian pharma is fundamentally regional. An MR in Chennai operates in an entirely different linguistic, cultural, and medical ecosystem than one in Lucknow. This isn't a "nice to have" localization layer — it's a core differentiator that determines adoption.

### 15.1 Language Support Matrix

| Region | Primary Language | Code-Mix Pattern | Voice Note Example | Agent Must Handle |
|--------|-----------------|-----------------|-------------------|-------------------|
| **North India** (UP, Delhi, Rajasthan, MP, Haryana, Punjab) | Hindi | Hindi-English (Hinglish) | "Dr. Sharma se mila, Cardivas discuss kiya, positive the" | Hindi-English entity extraction, Devanagari brand name recognition |
| **Maharashtra** | Marathi | Marathi-Hindi-English | "Dr. Patil bhettlo, tyaanna Cardivas sangitla, 6.25 wala. Changla response hota" | Marathi medical terminology, tri-lingual code-mixing |
| **Gujarat** | Gujarati | Gujarati-Hindi-English | "Dr. Patel ne malyo, Cardivas batavyu, positive chhe, 5 patients try karshe" | Gujarati verb forms with English medical terms |
| **West Bengal** | Bengali | Bengali-English (Benglish) | "Dr. Banerjee r sathe dekha korlam, Cardivas niye kotha bollam, onar response bhalo chhilo" | Bengali script names, unique honorifics (babu/da) |
| **Tamil Nadu** | Tamil | Tamil-English (Tanglish) | "Dr. Ramasamy kitta pesinen, Cardivas pathi sollinen, nalla response kuduthaar" | Tamil medical terminology, formal/informal register |
| **Karnataka** | Kannada | Kannada-English | "Dr. Gowda avara jote maatadide, Cardivas bagge helide, olleya response kodtare" | Kannada verb conjugations with English nouns |
| **Andhra/Telangana** | Telugu | Telugu-English (Tenglish) | "Dr. Reddy gaarini kalisa, Cardivas gurinchi cheppanu, positive response icharu" | Telugu honorifics (gaaru), code-mixing patterns |
| **Kerala** | Malayalam | Malayalam-English | "Dr. Nair ne kandhu, Cardivas ne patti parayunnu, nalla response aanu" | Malayalam medical jargon, unique script |
| **Odisha** | Odia | Odia-Hindi-English | "Dr. Mohanty nka sathe bhetila, Cardivas discuss kalaa, positive response milila" | Odia honorifics, regional medical terms |
| **Northeast** | Assamese/English | English-dominant with Assamese | "Met Dr. Bora, discussed Cardivas, he was positive, will try on 5 patients" | English-primary with regional name recognition |

### 15.2 Language Processing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTILINGUAL PROCESSING PIPELINE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. LANGUAGE DETECTION              2. TRANSCRIPTION                     │
│  ┌──────────────────────────┐      ┌──────────────────────────┐        │
│  │ Detect primary language   │      │ Language-specific ASR:    │        │
│  │ from MR profile + audio   │      │                          │        │
│  │ signal                    │─────>│ • Whisper (multilingual)  │        │
│  │                           │      │ • Bhashini ASR (govt,     │        │
│  │ MR profile.region →       │      │   free, 12 Indian langs)  │        │
│  │ expected language(s)      │      │ • Google Cloud Speech     │        │
│  │                           │      │   (hi-IN, ta-IN, te-IN,   │        │
│  │ Handle: one voice note    │      │   bn-IN, mr-IN, gu-IN,   │        │
│  │ may have 3 languages      │      │   kn-IN, ml-IN, or-IN)   │        │
│  └──────────────────────────┘      └──────────┬───────────────┘        │
│                                                │                        │
│  3. NORMALIZATION                  4. ENTITY EXTRACTION                  │
│  ┌──────────────────────────┐     ┌──────────────────────────────┐     │
│  │ Normalize to canonical    │     │ Language-aware NER:          │     │
│  │ form for processing:      │     │                              │     │
│  │                           │     │ • Doctor names in regional   │     │
│  │ • Regional brand name     │────>│   scripts (डॉ. शर्मा =      │     │
│  │   variants → standard     │     │   Dr. Sharma)                │     │
│  │ • Regional medical terms  │     │ • Product names with accent  │     │
│  │   → English equivalents   │     │   variations (Kaaardivas =   │     │
│  │ • Honorifics normalized   │     │   Cardivas)                  │     │
│  │   (Sir/Saab/Gaaru/Avare)  │     │ • Quantity in regional       │     │
│  │                           │     │   numerals (५ = 5)           │     │
│  └──────────────────────────┘     └──────────────────────────────┘     │
│                                                                         │
│  5. RESPONSE GENERATION                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Agent responds in the MR's preferred language:                   │   │
│  │                                                                  │   │
│  │ • Pre-call briefs: MR's language preference (configurable)       │   │
│  │ • Product info: Always English (medical accuracy > localization)  │   │
│  │ • Clinical data: English (study names, dosages — never translate)│   │
│  │ • Casual conversation: Match MR's language                       │   │
│  │ • Manager reports: English (cross-region standardization)        │   │
│  │                                                                  │   │
│  │ RULE: Never translate brand names, molecule names, study names,  │   │
│  │ or dosage instructions. Medical accuracy is non-negotiable.       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 15.3 Regional Configuration

```typescript
interface RegionalConfig {
  region_id: string;                     // "south-tn" | "west-mh" | "north-up" etc.
  region_name: string;                   // "Tamil Nadu" | "Maharashtra" etc.
  state: string;

  // Language settings
  languages: {
    primary: LanguageCode;               // "ta" | "mr" | "hi" | "bn" etc.
    secondary: LanguageCode[];           // ["en", "hi"] — fallback languages
    voice_model: "whisper" | "bhashini" | "google_cloud";
    voice_locale: string;                // "ta-IN" | "mr-IN" | "hi-IN"
    response_language: LanguageCode;     // What language the agent replies in
    code_mix_expected: boolean;          // true for most Indian regions
  };

  // Regional pharma landscape
  pharma_landscape: {
    dominant_local_companies: string[];  // ["Sanofi", "Abbott India"] — regional market leaders
    local_chemist_chains: string[];      // Region-specific pharmacy chains for RCPA
    prescription_pattern: "Brand-heavy" | "Generic-heavy" | "Mixed";
    digital_rx_adoption: "High" | "Medium" | "Low";
    government_scheme_influence: "High" | "Medium" | "Low";  // Jan Aushadhi, PMBJP impact
  };

  // Regional doctor behavior
  doctor_behavior: {
    avg_opd_hours: string;               // "9am-1pm, 5pm-8pm" (varies by region)
    preferred_visit_timing: string;      // "Before OPD" | "During OPD gap" | "After OPD"
    receptivity_to_data: "High" | "Medium" | "Low";  // South India generally more evidence-driven
    key_relationship_factors: string[];  // ["Personal rapport" for North, "Clinical evidence" for South]
    honorific_pattern: string;           // "Sir/Madam" | "Doctor saab" | "Gaaru" | "Avare"
    festival_sensitivity: string[];      // Regional festivals where visits should be adjusted
  };

  // Regional compliance specifics
  compliance: {
    state_pharma_council: string;        // State Pharmacy Council name
    state_specific_regulations: string[];
    local_medical_association: string;   // IMA state branch
    gift_culture_sensitivity: "High" | "Low";  // Some regions more strict on gifting
  };

  // Calendar & timing
  calendar: {
    working_days: string[];              // Most are Mon-Sat, some regions differ
    regional_holidays: Holiday[];        // Pongal, Onam, Durga Puja, Ganesh Chaturthi etc.
    peak_disease_seasons: DiseaseSeason[];  // Dengue season, monsoon infections, winter cardiac events
    conference_calendar: Conference[];   // Regional medical conferences (API, RSSDI, CSI chapters)
  };
}

type LanguageCode = "hi" | "en" | "mr" | "gu" | "bn" | "ta" | "te" | "kn" | "ml" | "or" | "pa" | "as";

interface DiseaseSeason {
  season: string;                        // "Monsoon" | "Winter" | "Summer"
  months: string[];                      // ["Jul", "Aug", "Sep"]
  conditions: string[];                  // ["Dengue", "Malaria", "Viral fever"]
  impact_on_rx: string;                  // "Increased antibiotic Rx, reduced elective procedures"
  relevant_products: string[];           // Products to push during this season
  suggested_messaging: string;           // "Lead with monsoon infection management, position our antibiotic range"
}

interface Holiday {
  name: string;                          // "Pongal" | "Onam" | "Durga Puja"
  date_range: string;                    // "Jan 14-17" | "Aug-Sep (varies)"
  region_impact: "Full closure" | "Partial" | "Hospital-only";
  mr_action: string;                     // "Festival greetings, avoid visits" | "Hospital calls only"
}

interface Conference {
  name: string;                          // "TNSCON 2026" | "API Maharashtra Chapter"
  specialty: string;                     // "Cardiology" | "Diabetes" | "General Medicine"
  month: string;
  city: string;
  relevance: string;                     // "Key doctors attend — plan pre/post conference engagement"
}
```

### 15.4 Regional Pharma Market Characteristics

| Region | Market Character | Prescription Pattern | MR Strategy Implication |
|--------|-----------------|---------------------|------------------------|
| **North India (UP, Delhi, Rajasthan)** | Brand-driven, relationship-heavy. Doctors prescribe based on MR rapport as much as clinical data. High competition with 15-20 MRs/doctor. | Brand-loyal, high influence of MR frequency. Generic substitution low. | Visit frequency is king. Build personal rapport. Festival gifts matter (within UCPMP). Small talk before pitch. |
| **Maharashtra (Mumbai, Pune)** | Balanced — evidence matters but so does brand. Mumbai doctors are time-starved (2 min/MR). Pune more accessible. | Mix of branded generics and brands. Cost-consciousness growing. | Mumbai: crisp, data-led 2-minute pitch. Pune: longer discussions possible. Use cost-per-day arguments. |
| **Gujarat** | Trade-focused market. Stockist/chemist relationships very important. Doctors influenced by what's available at local chemist. | Brand loyalty moderate. Availability at chemist drives Rx. | Ensure stockist coverage before pushing Rx. Lead with availability + trade schemes. |
| **South India (TN, KA, KL, AP/TS)** | Evidence-driven. Doctors want clinical data, study references. Less relationship-dependent, more meritocratic. | Evidence-based prescribing. Higher generic adoption in TN/KL due to govt schemes. | Lead with clinical evidence. Know your studies cold. Print materials with study data work better than gifts. |
| **West Bengal** | Academic-oriented. Teaching hospital KOLs drive prescribing patterns across the state. | KOL-influenced. Whatever SSKM/Medical College professors prescribe cascades. | Focus on KOL engagement. Speaker programs at teaching hospitals have outsized ROI. |
| **East/Northeast** | Underpenetrated. Fewer MR visits, doctors more receptive. Access challenges (geography, connectivity). | Limited brand exposure. Doctors open to trying new brands. | Massive opportunity for first-mover. Solve logistics (sample delivery, follow-ups). Offline-first critical. |

### 15.5 Disease Seasonality & Regional Messaging Calendar

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SEASONAL MESSAGING CALENDAR                           │
├────────┬────────────────────────────────────────────────────────────────┤
│ Month  │ Regional Focus                                                 │
├────────┼────────────────────────────────────────────────────────────────┤
│ Jan    │ Post-winter cardiac events (North). Pongal season (TN) —      │
│        │ hospital visits only. Push cardiac + diabetes products.         │
├────────┼────────────────────────────────────────────────────────────────┤
│ Feb-Mar│ Financial year-end push. CME season (conferences peak).        │
│        │ Holi (North) — reduced visits. Target achievement focus.       │
├────────┼────────────────────────────────────────────────────────────────┤
│ Apr    │ New financial year. Summer begins — heat-related illness       │
│        │ in North/West. Electrolyte + GI products opportunity.          │
├────────┼────────────────────────────────────────────────────────────────┤
│ May-Jun│ Peak summer. Reduced OPD in some regions. Focus on hospital   │
│        │ doctors (air-conditioned, accessible). Dehydration messaging.  │
├────────┼────────────────────────────────────────────────────────────────┤
│ Jul-Sep│ MONSOON — peak opportunity. Dengue, malaria, viral fever,     │
│        │ waterborne diseases spike. Anti-infectives + antipyretics.     │
│        │ Regional: Onam (KL), Ganesh Chaturthi (MH), Durga Puja (WB). │
│        │ Plan visits around festivals — doctors may have reduced hours. │
├────────┼────────────────────────────────────────────────────────────────┤
│ Oct-Nov│ Post-monsoon. Diwali (all-India) — gifting season (UCPMP!).   │
│        │ Respiratory issues increase. Air pollution spikes (North).     │
│        │ Push respiratory + cardiac products in Delhi/NCR.              │
├────────┼────────────────────────────────────────────────────────────────┤
│ Dec    │ Winter cardiac events begin. Conference season (RSSDI, API).  │
│        │ Year-end Rx review with doctors. Christmas (South/NE/Goa).    │
│        │ Strategic planning for next year's targets.                    │
└────────┴────────────────────────────────────────────────────────────────┘
```

### 15.6 Bhashini Integration (Government India AI Language Platform)

For cost-effective multilingual support, integrate with [Bhashini](https://bhashini.gov.in/) — India's national language translation platform:

```typescript
interface BhashiniConfig {
  // Bhashini provides free ASR, NMT, and TTS for 22 scheduled languages
  api_endpoint: "https://meity-auth.ulcacontrib.org";
  services: {
    asr: {                               // Automatic Speech Recognition
      supported_languages: LanguageCode[];
      model_preference: "ai4bharat" | "google" | "microsoft";
      use_for: "voice_note_transcription";
    };
    nmt: {                               // Neural Machine Translation
      supported_pairs: string[];         // "hi→en", "ta→en", "mr→en"
      use_for: "translating_regional_text_to_english_for_processing";
    };
    tts: {                               // Text to Speech
      supported_languages: LanguageCode[];
      use_for: "reading_pre_call_brief_aloud_while_MR_drives";
    };
  };
  fallback: "whisper";                   // If Bhashini API is slow/unavailable
}

// Pipeline: Voice Note → Bhashini ASR → Regional Text → Bhashini NMT → English Text → Claude → DCR
// Cost: Bhashini is FREE (government platform), so multilingual support adds zero API cost
```

### 15.7 Regional Voice Note Examples with Entity Extraction

**Tamil (Chennai MR):**
```
Voice: "Dr. Ramasamy kitta indha week Cardivas 6.25 pathi pesinen. Avarukku oru patient ku
cough problem irukku ACE inhibitor la. Cardivas suggest panninen — beta-blocker with
vasodilation, cough problem irukkaadhu nu sollinen. Rendu sample strips kuduthein.
Next week follow up panna sollirukkaar."

Extracted DCR:
• Doctor: Dr. Ramasamy (matched from territory master)
• Product: Cardivas 6.25mg (Primary)
• Discussion: ACE inhibitor cough → positioned Cardivas as alternative
• Samples: 2 strips of Cardivas 6.25mg
• Next visit: Next week (follow-up)
• Language detected: Tamil-English (Tanglish)
```

**Marathi (Pune MR):**
```
Voice: "Dr. Kulkarni bhetlo. Tyanna Telmivas 40mg baaddal sangitla. Tyanche
response changla hota — 10 patients var try karnar mhale. Metolar XR vaprtat
currently, pan Telmivas chya fixed-dose combination madhe interest dakhavla.
Pudchya veli clinical data aanaycha aahe."

Extracted DCR:
• Doctor: Dr. Kulkarni (matched from territory master)
• Product: Telmivas 40mg (Primary)
• Discussion: Interested in fixed-dose combination, currently using Metolar XR (competitor)
• Outcome: Will try on 10 patients
• Commitment: Bring clinical data on FDC next visit
• Language detected: Marathi-English
```

**Bengali (Kolkata MR):**
```
Voice: "Aaj Dr. Chatterjee r sathe dekha korlam SSKM te. Cardivas niye detailed
discussion holo — COPERNICUS trial er data dekhalam. Uni impressed hoechhen,
specifically severe heart failure te 35% mortality reduction dekhey. 3 ta sample
strip diyechi. Uni bolchhen department e discuss korben."

Extracted DCR:
• Doctor: Dr. Chatterjee (matched, SSKM Hospital)
• Product: Cardivas (Primary)
• Discussion: COPERNICUS trial — 35% mortality reduction in severe HF
• Outcome: Impressed, will discuss in department (KOL cascade potential)
• Samples: 3 strips
• Language detected: Bengali-English (Benglish)
• Flag: KOL at teaching hospital — ABM should be notified of positive reception
```
