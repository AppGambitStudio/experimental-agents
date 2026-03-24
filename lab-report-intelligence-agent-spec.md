# Deep Agent for Lab Report Intelligence — Research Document

## Overview

This document outlines how to build a **Lab Report Intelligence Agent** using the **Claude Agent SDK**. The agent automates the most time-consuming part of a diagnostics laboratory's workflow — post-analyzer result validation and intelligent report generation. It ingests raw results from lab analyzers via file exchange (CSV/HL7/ASTM), validates them against age/sex-adjusted reference ranges, runs delta checks against patient history, detects clinical patterns across multiple parameters, generates AI-powered interpretive comments, produces formatted reports, and routes them through a configurable tiered autonomy model (pathologist reviews everything → auto-validates normals → auto-generates reports). What currently requires a pathologist to manually review every single result — including thousands of perfectly normal ones — becomes an intelligent triage system that surfaces only what truly needs human expertise.

**Target users:** Lab operations teams — pathologists, lab technicians, quality managers.

**Target customers:** Diagnostic lab chains (Metropolis, SRL, Dr. Lal PathLab, Thyrocare), standalone pathology labs, hospital laboratory departments.

---

## 1. Why This Agent Is Needed

### The Problem

Diagnostic laboratories face a validation bottleneck:

| Pain Point | Detail |
|------------|--------|
| **Pathologist bottleneck** | A single pathologist manually reviews 300-500+ reports/day. 70% are normal — pure rubber-stamping that wastes clinical expertise. |
| **Turnaround time pressure** | Patients and doctors expect same-day reports. Manual validation creates a queue that grows through the day. |
| **No clinical correlation** | Pathologists review individual parameters in isolation. Multi-parameter patterns (iron deficiency, metabolic syndrome, DIC) are often missed or require extra cognitive effort. |
| **Delta check blindness** | Without automated comparison to prior results, sudden changes (hemoglobin drop, creatinine spike) go unnoticed until a doctor catches it clinically. |
| **Critical value delays** | Panic values (potassium > 6.5, glucose < 40) buried in a batch of normal results may not get flagged for immediate notification. |
| **Inconsistent interpretive comments** | Different pathologists write different comments for the same result pattern. No standardization across shifts, branches, or pathologists. |
| **No reflex test suggestions** | Elevated TSH without Free T3/T4 ordered? Abnormal liver function without hepatitis markers? The opportunity to suggest additional tests is missed at report time. |
| **NABL compliance overhead** | Quality indicators (TAT, critical value notification time, error rates) tracked manually or not at all. |
| **Scaling constraints** | Adding more volume means hiring more pathologists — the only way to scale is to reduce what pathologists need to review. |

### Why Claude Agent SDK

The Agent SDK is ideal because this agent requires:
- **MCP tool architecture** — modular tools for file parsing, validation, clinical intelligence, and report generation that can be composed into workflows
- **Multi-model orchestration** — Opus for complex clinical pattern analysis, Sonnet for routine validation and comment generation, Haiku for file parsing and simple lookups
- **Agentic workflow** — the agent makes decisions (classify, route, auto-validate) based on a chain of tool results, not a single prompt
- **Knowledge base integration** — reference ranges, clinical rules, and patterns stored as structured data that the agent reasons over
- **Human-in-the-loop** — tiered autonomy with pathologist gates at configurable levels
- **Audit logging** — every validation decision must be traceable for NABL and regulatory compliance

---

## 2. Architecture

### High-Level Design

```
                    ┌──────────────────────────────────┐
                    │   Lab Report Intelligence Agent   │
                    │       (Batch Orchestrator)        │
                    │                                   │
                    │   Claude Agent SDK + 3 MCP Servers│
                    └───────────────┬──────────────────┘
                                    │
           ┌────────────┬───────────┼───────────┬────────────┐
           │            │           │           │            │
     ┌─────▼─────┐ ┌───▼─────┐ ┌──▼──────┐ ┌──▼────────┐ ┌▼───────────┐
     │ File      │ │ Result  │ │ Clinical│ │ Report    │ │ Alert &    │
     │ Ingestion │ │ Validat.│ │ Comment │ │ Generator │ │ Escalation │
     │ Engine    │ │ Engine  │ │ Engine  │ │           │ │ Engine     │
     └─────┬─────┘ └───┬─────┘ └──┬──────┘ └──┬────────┘ └┬───────────┘
           │            │          │           │           │
     ┌─────▼─────┐ ┌───▼──────────▼───┐  ┌───▼───────────▼───┐
     │ Input     │ │ Reference        │  │ Output            │
     │ Folder    │ │ Knowledge Base   │  │ Folder            │
     │ (CSV/HL7/ │ │ (ranges, rules,  │  │ (validated PDFs,  │
     │  ASTM)    │ │  clinical guides)│  │  alerts, logs)    │
     └───────────┘ └──────────────────┘  └───────────────────┘
```

### Component Responsibilities

| Component | Purpose | MCP Server |
|-----------|---------|------------|
| **File Ingestion Engine** | Watches input folder, auto-detects file format, parses CSV/HL7/ASTM/Excel into standard internal format, handles multiple analyzer output formats | `lab-data-mcp` |
| **Result Validation Engine** | Core intelligence — reference range checks (age/sex-adjusted), delta checks against patient history, internal consistency checks, calculated value derivation, critical value detection, clinical pattern recognition | `clinical-intelligence-mcp` |
| **Clinical Comment Engine** | Generates AI-powered interpretive comments using Claude — parameter-level annotations, report-level narrative, reflex test suggestions, medication interaction flags | `clinical-intelligence-mcp` |
| **Report Generator** | Produces formatted PDF reports with patient demographics, results table (with reference ranges and abnormal flags), interpretive comments, pathologist sign-off status | `lab-data-mcp` |
| **Alert & Escalation Engine** | Routes reports based on tiered autonomy, dispatches critical value alerts, manages pathologist review queue | `lab-workflow-mcp` |

### End-to-End Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAB REPORT PROCESSING LIFECYCLE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. INGEST              2. VALIDATE              3. ANALYZE             │
│  ┌──────────────┐      ┌──────────────────┐     ┌──────────────────┐   │
│  │ Watch input  │      │ For each result: │     │ Detect clinical  │   │
│  │ folder for   │      │                  │     │ patterns across  │   │
│  │ new files    │      │ • Reference range│     │ parameters:      │   │
│  │              │─────>│   check (age/sex)│────>│                  │   │
│  │ Auto-detect  │      │ • Delta check vs │     │ • Iron deficiency│   │
│  │ format       │      │   patient history│     │ • Liver damage   │   │
│  │              │      │ • Internal       │     │ • Renal failure  │   │
│  │ Parse to     │      │   consistency    │     │ • DIC            │   │
│  │ standard     │      │ • Computed values│     │ • Metabolic syn. │   │
│  │ format       │      │   (eGFR, LDL)   │     │ • Thyroid dysfn. │   │
│  └──────────────┘      │ • Critical value │     │                  │   │
│                        │   detection      │     │ Suggest reflex   │   │
│                        └──────────────────┘     │ tests            │   │
│                                                  └────────┬─────────┘   │
│                                                           │             │
│  4. COMMENT             5. GENERATE             6. ROUTE               │
│  ┌──────────────┐      ┌──────────────────┐    ┌──────────────────┐    │
│  │ Claude AI    │      │ Produce:         │    │ Based on tier:   │    │
│  │ generates:   │      │                  │    │                  │    │
│  │              │─────>│ • PDF report     │───>│ Level 1: All to  │    │
│  │ • Parameter  │      │ • JSON data      │    │   pathologist    │    │
│  │   comments   │      │ • Patient history│    │                  │    │
│  │ • Report     │      │   update         │    │ Level 2: Normals │    │
│  │   narrative  │      │                  │    │   auto-validated │    │
│  │ • Reflex     │      │                  │    │                  │    │
│  │   suggestions│      │                  │    │ Level 3: Normals │    │
│  └──────────────┘      └──────────────────┘    │   auto-generated │    │
│                                                 │                  │    │
│                                                 │ Criticals ALWAYS │    │
│                                                 │ alert immediately│    │
│                                                 └──────────────────┘    │
│                                                                         │
│  7. MONITOR (Ongoing)                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Track: TAT, auto-validation rate, override rate, false positive │   │
│  │ rate, critical value notification time — NABL quality metrics    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tiered Autonomy Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMY LEVELS                               │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 1  │  Agent: Suggest    Pathologist: Reviews ALL          │
│ (Trust   │  ──────────────────────────────────────────          │
│  building│  Agent validates, comments, flags — but every        │
│  phase)  │  report goes to pathologist queue with pre-          │
│          │  populated analysis. Pathologist clicks approve.     │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 2  │  Agent: Auto-validate normals                        │
│ (Proven  │  ──────────────────────────────────────────          │
│  trust)  │  Normal results (all params in range, no delta       │
│          │  flags, high confidence) → auto-validated.           │
│          │  Abnormal/suspect/critical → pathologist queue.      │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 3  │  Agent: Auto-validate + auto-generate normals        │
│ (Full    │  ──────────────────────────────────────────          │
│  trust)  │  Normal results → auto-validated + report auto-      │
│          │  dispatched to patient/doctor. Pathologist only       │
│          │  sees flagged cases. Critical values ALWAYS alert.   │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ ALL      │  ⚠️ CRITICAL VALUES ALWAYS ESCALATE                   │
│ LEVELS   │  No autonomy level bypasses panic value alerting.    │
│          │  Pathologist + ordering doctor notified immediately.  │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (complex clinical pattern analysis, multi-parameter reasoning)
                 claude-sonnet-4-6 (routine validation, comment generation, report narrative)
                 claude-haiku-4-5 (file parsing, format detection, simple lookups, stats)
MCP Servers:     3 custom — lab-data-mcp, clinical-intelligence-mcp, lab-workflow-mcp
File Parsing:    csv-parse, hl7-standard (HL7 v2.x), custom ASTM parser, xlsx
PDF Generation:  Puppeteer (HTML template → PDF) or pdf-lib
Storage:         Local filesystem (file-based, zero database dependency)
Alerting:        Nodemailer (email), Twilio (SMS), webhook (for LIS/dashboard integration)
Config:          JSON files (reference ranges, rules, autonomy settings)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install csv-parse                    # CSV parsing
npm install hl7-standard                 # HL7 v2.x message parsing
npm install xlsx                         # Excel file parsing
npm install pdf-lib                      # PDF report generation
npm install puppeteer                    # HTML template → PDF (alternative)
npm install zod                          # Schema validation
npm install dayjs                        # Date handling
npm install chokidar                     # File system watcher
npm install nodemailer                   # Email alerts
npm install winston                      # Structured logging
```

---

## 4. Input File Format Support

### Supported Formats

| Format | Source | Detection Method | Parsing Strategy |
|--------|--------|-----------------|-----------------|
| **CSV** | Most Indian LIS exports (LabMate, CompuLab, etc.) | `.csv` extension + delimiter detection | Header row mapping, configurable column positions |
| **HL7 v2.x** | Analyzer middleware, LIS HL7 interfaces | `MSH\|` header segment | Parse MSH, PID, OBR, OBX segments |
| **ASTM** | Direct analyzer output (Beckman, Roche, Siemens, Sysmex, Mindray) | ASTM frame structure (STX/ETX) | Parse H, P, O, R records |
| **Excel (.xlsx)** | Manual entry from smaller labs | `.xlsx` extension | Sheet parsing with header detection |
| **JSON** | Modern LIS APIs, custom integrations | `.json` extension + schema detection | Direct schema mapping |

### Standard Internal Format

All input formats are normalized to this structure before processing:

```typescript
interface LabResultBatch {
  file_id: string;                     // Unique ID for this input file
  file_path: string;                   // Original file path
  format: "csv" | "hl7" | "astm" | "xlsx" | "json";
  parsed_at: string;                   // ISO 8601
  source_analyzer?: string;            // Analyzer name if detected
  results: PatientResult[];
  parse_errors: ParseError[];          // Rows/segments that failed to parse
}

interface PatientResult {
  sample_id: string;                   // Lab sample/accession number
  patient_id: string;                  // Patient ID (MRN, UHID, etc.)
  patient_name: string;
  patient_age: number;                 // In years
  patient_sex: "M" | "F" | "O";       // Male, Female, Other
  patient_dob?: string;               // If available (more precise than age)
  ordering_doctor?: string;
  ordering_facility?: string;
  sample_collected_at?: string;        // Timestamp
  sample_received_at?: string;         // Timestamp
  test_panels: TestPanel[];
}

interface TestPanel {
  test_code: string;                   // e.g., "CBC", "LFT", "LIPID"
  test_name: string;                   // e.g., "Complete Blood Count"
  parameters: TestParameter[];
}

interface TestParameter {
  param_code: string;                  // e.g., "HGB", "WBC", "CHOL"
  param_name: string;                  // e.g., "Hemoglobin", "White Blood Cells"
  value: number | string;              // Numeric or qualitative
  unit: string;                        // e.g., "g/dL", "10^3/µL"
  is_numeric: boolean;
  instrument_flag?: string;            // Analyzer flag if any (H, L, *)
}
```

### CSV Column Mapping Configuration

Labs export CSVs in different column layouts. The agent supports configurable column mapping:

```json
{
  "csv_profiles": {
    "metropolis_default": {
      "delimiter": ",",
      "has_header": true,
      "column_map": {
        "sample_id": 0,
        "patient_id": 1,
        "patient_name": 2,
        "age": 3,
        "sex": 4,
        "test_code": 5,
        "test_name": 6,
        "param_code": 7,
        "param_name": 8,
        "value": 9,
        "unit": 10,
        "instrument_flag": 11
      }
    },
    "labmate_export": {
      "delimiter": "|",
      "has_header": true,
      "column_map": {
        "sample_id": "Accession No",
        "patient_name": "Patient Name",
        "age": "Age",
        "sex": "Gender",
        "test_name": "Test",
        "param_name": "Parameter",
        "value": "Result",
        "unit": "Unit"
      }
    }
  }
}
```

### HL7 v2.x Parsing

```
MSH|^~\&|ANALYZER|LAB|LIS|HOSPITAL|202603241030||ORU^R01|MSG001|P|2.5
PID|1||PAT10001||Sharma^Rajesh||19800215|M
OBR|1|SAM001234||CBC^Complete Blood Count
OBX|1|NM|HGB^Hemoglobin||14.2|g/dL|13.0-17.0|N|||F
OBX|2|NM|WBC^White Blood Cells||7.5|10^3/µL|4.0-11.0|N|||F
OBX|3|NM|PLT^Platelet Count||245|10^3/µL|150-400|N|||F
OBX|4|NM|RBC^Red Blood Cells||4.8|10^6/µL|4.5-5.5|N|||F
OBX|5|NM|HCT^Hematocrit||42.1|%|38.0-50.0|N|||F
OBX|6|NM|MCV^Mean Corpuscular Volume||87.7|fL|80-100|N|||F
OBX|7|NM|MCH^Mean Corpuscular Hemoglobin||29.6|pg|27-33|N|||F
OBX|8|NM|MCHC^Mean Corpuscular Hb Conc||33.7|g/dL|32-36|N|||F
```

---

## 5. Reference Knowledge Base

### 5.1 Reference Ranges (Age/Sex-Adjusted)

The knowledge base ships with standard ranges and is fully customizable per lab.

**Hematology — Complete Blood Count:**

| Parameter | Unit | Male (18-60) | Female (18-60) | Female (Pregnant) | Child (1-12) | Newborn |
|-----------|------|-------------|----------------|-------------------|-------------|---------|
| Hemoglobin | g/dL | 13.0 – 17.0 | 12.0 – 15.5 | 11.0 – 14.0 | 11.5 – 14.5 | 14.0 – 24.0 |
| WBC | 10³/µL | 4.0 – 11.0 | 4.0 – 11.0 | 6.0 – 16.0 | 5.0 – 13.0 | 9.0 – 30.0 |
| Platelet Count | 10³/µL | 150 – 400 | 150 – 400 | 150 – 400 | 150 – 450 | 150 – 450 |
| RBC | 10⁶/µL | 4.5 – 5.5 | 4.0 – 5.0 | 3.5 – 5.0 | 4.0 – 5.2 | 4.0 – 6.6 |
| Hematocrit | % | 38.0 – 50.0 | 36.0 – 44.0 | 33.0 – 44.0 | 35.0 – 45.0 | 44.0 – 64.0 |
| MCV | fL | 80 – 100 | 80 – 100 | 80 – 100 | 75 – 95 | 95 – 125 |
| MCH | pg | 27 – 33 | 27 – 33 | 27 – 33 | 24 – 30 | 30 – 42 |
| MCHC | g/dL | 32 – 36 | 32 – 36 | 32 – 36 | 31 – 37 | 30 – 36 |
| ESR | mm/hr | 0 – 15 | 0 – 20 | 0 – 70 | 0 – 10 | 0 – 2 |
| Reticulocyte Count | % | 0.5 – 2.5 | 0.5 – 2.5 | 0.5 – 2.5 | 0.5 – 2.5 | 2.0 – 6.0 |

**Clinical Biochemistry — Liver Function:**

| Parameter | Unit | Adult | Child (1-12) | Newborn |
|-----------|------|-------|-------------|---------|
| Total Bilirubin | mg/dL | 0.1 – 1.2 | 0.1 – 1.0 | 1.0 – 12.0 |
| Direct Bilirubin | mg/dL | 0.0 – 0.3 | 0.0 – 0.3 | 0.0 – 0.5 |
| AST (SGOT) | U/L | 10 – 40 | 15 – 55 | 25 – 75 |
| ALT (SGPT) | U/L | 7 – 56 | 10 – 40 | 10 – 40 |
| ALP | U/L | 44 – 147 | 100 – 400 | 150 – 600 |
| GGT | U/L | 9 – 48 (M) / 9 – 32 (F) | 5 – 32 | 10 – 270 |
| Total Protein | g/dL | 6.0 – 8.3 | 6.0 – 8.0 | 4.6 – 7.0 |
| Albumin | g/dL | 3.5 – 5.0 | 3.5 – 5.0 | 2.5 – 5.0 |
| Globulin | g/dL | 2.0 – 3.5 | 2.0 – 3.5 | 1.5 – 3.0 |
| A/G Ratio | — | 1.0 – 2.5 | 1.0 – 2.5 | 1.0 – 2.5 |

**Clinical Biochemistry — Kidney Function:**

| Parameter | Unit | Male | Female | Child |
|-----------|------|------|--------|-------|
| Creatinine | mg/dL | 0.7 – 1.3 | 0.6 – 1.1 | 0.3 – 0.7 |
| Blood Urea | mg/dL | 15 – 40 | 15 – 40 | 10 – 36 |
| BUN | mg/dL | 7 – 20 | 7 – 20 | 5 – 18 |
| Uric Acid | mg/dL | 3.5 – 7.2 | 2.6 – 6.0 | 2.0 – 5.5 |
| Sodium | mEq/L | 136 – 145 | 136 – 145 | 136 – 145 |
| Potassium | mEq/L | 3.5 – 5.0 | 3.5 – 5.0 | 3.5 – 5.5 |
| Chloride | mEq/L | 98 – 106 | 98 – 106 | 98 – 106 |
| Calcium | mg/dL | 8.5 – 10.5 | 8.5 – 10.5 | 8.5 – 11.0 |
| Phosphate | mg/dL | 2.5 – 4.5 | 2.5 – 4.5 | 4.0 – 7.0 |

**Clinical Biochemistry — Lipid Profile:**

| Parameter | Unit | Desirable | Borderline | High Risk |
|-----------|------|-----------|-----------|-----------|
| Total Cholesterol | mg/dL | < 200 | 200 – 239 | ≥ 240 |
| LDL Cholesterol | mg/dL | < 100 | 100 – 159 | ≥ 160 |
| HDL Cholesterol | mg/dL | > 60 (protective) | 40 – 60 | < 40 (risk) |
| Triglycerides | mg/dL | < 150 | 150 – 199 | ≥ 200 |
| VLDL | mg/dL | < 30 | 30 – 40 | > 40 |
| Total/HDL Ratio | — | < 4.5 | 4.5 – 5.5 | > 5.5 |

**Clinical Biochemistry — Thyroid, Diabetes, Cardiac:**

| Parameter | Unit | Normal Range | Notes |
|-----------|------|-------------|-------|
| TSH | µIU/mL | 0.4 – 4.0 | Pregnancy: trimester-specific ranges |
| Free T4 | ng/dL | 0.8 – 1.8 | |
| Free T3 | pg/mL | 2.3 – 4.2 | |
| Fasting Glucose | mg/dL | 70 – 100 | Pre-diabetes: 100-125, Diabetes: ≥ 126 |
| Post-prandial Glucose | mg/dL | < 140 | Pre-diabetes: 140-199, Diabetes: ≥ 200 |
| HbA1c | % | < 5.7 | Pre-diabetes: 5.7-6.4, Diabetes: ≥ 6.5 |
| Troponin I | ng/mL | < 0.04 | > 0.4 = critical |
| CK-MB | U/L | 0 – 25 | |
| BNP | pg/mL | < 100 | Heart failure: > 400 |
| CRP | mg/L | < 5.0 | |
| hs-CRP | mg/L | < 1.0 (low risk) | 1-3: moderate, > 3: high cardiovascular risk |

### 5.2 Critical / Panic Value Thresholds

These trigger *immediate* alerts regardless of autonomy level:

| Parameter | Low Critical | High Critical | Action Required |
|-----------|-------------|---------------|-----------------|
| Hemoglobin | < 5.0 g/dL | > 20.0 g/dL | Immediate alert to pathologist + ordering doctor |
| WBC | < 2,000 /µL | > 30,000 /µL | Immediate alert |
| Platelet Count | < 20,000 /µL | > 1,000,000 /µL | Immediate alert |
| Glucose | < 40 mg/dL | > 500 mg/dL | Immediate alert — life-threatening |
| Potassium | < 2.5 mEq/L | > 6.5 mEq/L | Immediate alert — cardiac risk |
| Sodium | < 120 mEq/L | > 160 mEq/L | Immediate alert |
| Calcium | < 6.0 mg/dL | > 13.0 mg/dL | Immediate alert |
| Creatinine | — | > 10.0 mg/dL | Immediate alert |
| INR | — | > 5.0 | Immediate alert — bleeding risk |
| Troponin I | — | > 0.4 ng/mL | Immediate alert — possible MI |
| Total Bilirubin (newborn) | — | > 15.0 mg/dL | Immediate alert — kernicterus risk |
| TSH | < 0.1 µIU/mL | > 20.0 µIU/mL | Urgent alert |

### 5.3 Delta Check Rules

| Parameter | % Change Threshold | Time Window | Likely Cause | Action |
|-----------|-------------------|-------------|-------------|--------|
| Hemoglobin | > 20% (≥ 3 g/dL) | 48 hours | Pre-analytical error or acute hemorrhage | Flag suspect, suggest re-collection |
| Potassium | > 30% (≥ 1.5 mEq/L) | 24 hours | Hemolysis or acute event | Flag suspect, check for hemolysis |
| Creatinine | > 50% increase | 7 days | Acute kidney injury | Escalate to pathologist |
| Platelet Count | > 50% change | 72 hours | Clumping, EDTA effect, or real change | Flag, suggest peripheral smear |
| WBC | > 100% increase | 48 hours | Infection, leukemia, or sample issue | Flag for pathologist review |
| TSH | > 100% change | 30 days | Medication change or lab error | Flag, verify with clinical correlation |
| ALT/AST | > 200% increase | 7 days | Acute liver injury | Escalate, suggest hepatitis panel |
| HbA1c | > 2% absolute change | 90 days | Unlikely — verify sample identity | Flag suspect, possible wrong patient |
| Calcium | > 15% change | 7 days | Likely error or acute event | Flag for immediate review |

### 5.4 Clinical Pattern Rules

| Pattern ID | Pattern Name | Triggering Parameters | Clinical Significance | Reflex Test Suggestions |
|------------|-------------|----------------------|----------------------|------------------------|
| PAT-001 | Iron Deficiency Anemia | MCV↓ + MCH↓ + Hb↓ ± Ferritin↓ ± TIBC↑ | Microcytic hypochromic anemia — iron deficiency likely | Serum Iron, Ferritin, TIBC if not ordered |
| PAT-002 | Megaloblastic Anemia | MCV↑ + MCH↑ + Hb↓ | Macrocytic anemia — B12/folate deficiency likely | Vitamin B12, Folate if not ordered |
| PAT-003 | Hemolytic Pattern | Hb↓ + Reticulocyte↑ + Indirect Bilirubin↑ + LDH↑ + Haptoglobin↓ | Suggest hemolysis — intravascular vs extravascular | Direct Coombs, Peripheral smear, Haptoglobin |
| PAT-004 | Hepatocellular Injury | ALT↑↑ + AST↑ + ALP normal/mild↑ + Bilirubin↑ | Hepatocellular damage pattern | Viral hepatitis markers (HBsAg, Anti-HCV), PT/INR |
| PAT-005 | Cholestatic Pattern | ALP↑↑ + GGT↑↑ + Bilirubin↑ + ALT mild↑ | Cholestasis — intra or extra-hepatic | USG Abdomen, AMA (if PBC suspected) |
| PAT-006 | Metabolic Syndrome | Glucose↑ + TG↑ + HDL↓ ± Uric Acid↑ | Metabolic syndrome features | HbA1c, Fasting Insulin, Urine Microalbumin |
| PAT-007 | DIC (Disseminated Intravascular Coagulation) | Platelets↓ + PT↑ + aPTT↑ + Fibrinogen↓ + D-dimer↑ | Possible DIC — CRITICAL, immediate review | Fibrinogen, D-dimer, FDP, Peripheral smear |
| PAT-008 | Primary Hypothyroidism | TSH↑ + FT4↓ | Primary hypothyroidism | Anti-TPO, FT3 if not ordered |
| PAT-009 | Subclinical Hypothyroidism | TSH↑ + FT4 normal | Subclinical hypothyroidism — monitor or treat based on level | Anti-TPO antibodies, FT3 |
| PAT-010 | Hyperthyroidism | TSH↓ + FT4↑ ± FT3↑ | Thyrotoxicosis | TSH Receptor Antibodies, Thyroid scan |
| PAT-011 | Renal Failure | Creatinine↑ + Urea↑ + eGFR↓ ± K+↑ ± Phosphate↑ | Renal impairment — CKD staging by eGFR | Urine Routine, Urine Protein/Creatinine Ratio, USG KUB |
| PAT-012 | Diabetic Nephropathy | HbA1c↑ + Creatinine↑ + eGFR↓ + Urine Albumin↑ | Diabetic kidney disease | Urine ACR, Lipid Profile, Fundoscopy referral |
| PAT-013 | Atherogenic Dyslipidemia | LDL↑ + HDL↓ + TG↑ + Non-HDL↑ | High cardiovascular risk profile | hs-CRP, Lp(a), ApoB if available |
| PAT-014 | Pancytopenia | Hb↓ + WBC↓ + Platelets↓ | Bone marrow failure, infiltration, or aplasia — urgent | Peripheral smear, Reticulocyte count, B12/Folate, Bone marrow referral |
| PAT-015 | Tumor Lysis Syndrome | Uric Acid↑↑ + K+↑ + Phosphate↑ + Calcium↓ + LDH↑ + Creatinine↑ | Possible tumor lysis — oncologic emergency | Immediate pathologist alert, clinical correlation |

### 5.5 Calculated / Derived Values

| Derived Parameter | Formula | When to Calculate |
|------------------|---------|-------------------|
| **eGFR (CKD-EPI)** | CKD-EPI 2021 equation using creatinine, age, sex | Whenever creatinine is reported |
| **LDL (Friedewald)** | TC – HDL – (TG/5) | When TG < 400 and lipid panel complete |
| **Non-HDL Cholesterol** | TC – HDL | When lipid panel available |
| **A/G Ratio** | Albumin / Globulin | When both available |
| **Globulin** | Total Protein – Albumin | When both available |
| **Corrected Calcium** | Calcium + 0.8 × (4.0 – Albumin) | When both calcium and albumin available |
| **MELD Score** | 3.78 × ln(Bilirubin) + 11.2 × ln(INR) + 9.57 × ln(Creatinine) + 6.43 | When all 3 available in liver panel |
| **BUN/Creatinine Ratio** | BUN / Creatinine | When both available. >20 suggests pre-renal azotemia |
| **Anion Gap** | Na – (Cl + HCO3) | When electrolytes available. >12 = raised |

---

## 6. MCP Server Specifications

### 6.1 MCP Server: `lab-data-mcp` (File I/O & Reports)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `ingest_result_file` | Parse input file into standard format | `{ file_path: string, format_hint?: "csv"\|"hl7"\|"astm"\|"xlsx"\|"json", csv_profile?: string }` | `{ file_id, records: PatientResult[], parse_errors[], format_detected }` |
| `detect_file_format` | Auto-detect input file format | `{ file_path: string }` | `{ format, confidence, csv_profile_match?, column_mapping? }` |
| `list_pending_files` | List unprocessed files in input folder | `{ folder?: string }` | `{ files: FileInfo[], count }` |
| `archive_processed_file` | Move processed file to archive | `{ file_id: string }` | `{ archived_path }` |
| `lookup_patient_history` | Fetch patient's prior results | `{ patient_id: string, test_codes?: string[], date_from?: string, date_to?: string }` | `{ prior_results: PatientResult[], visit_count, date_range }` |
| `store_patient_result` | Save validated result to patient history | `{ patient_id: string, result: PatientResult }` | `{ stored: true, total_records }` |
| `export_report_pdf` | Generate formatted PDF report | `{ result_data: ValidatedResult, template?: string, comments: ClinicalComments }` | `{ pdf_path, file_size_bytes }` |
| `export_report_json` | Export structured JSON of validated result | `{ result_data: ValidatedResult }` | `{ json_path }` |
| `list_report_templates` | List available PDF templates | `{}` | `{ templates: TemplateInfo[] }` |

**Implementation — File Ingestion:**

```typescript
import { z } from "zod";
import { parse as csvParse } from "csv-parse/sync";

const IngestResultFileSchema = z.object({
  file_path: z.string().describe("Path to the input file"),
  format_hint: z.enum(["csv", "hl7", "astm", "xlsx", "json"]).optional()
    .describe("Override auto-detection with explicit format"),
  csv_profile: z.string().optional()
    .describe("Named CSV column mapping profile to use"),
});

async function ingestResultFile(input: z.infer<typeof IngestResultFileSchema>) {
  const format = input.format_hint || await detectFormat(input.file_path);

  let rawRecords: RawRecord[];
  let parseErrors: ParseError[] = [];

  switch (format) {
    case "csv":
      const profile = input.csv_profile || await matchCsvProfile(input.file_path);
      ({ records: rawRecords, errors: parseErrors } = parseCsv(input.file_path, profile));
      break;
    case "hl7":
      ({ records: rawRecords, errors: parseErrors } = parseHl7(input.file_path));
      break;
    case "astm":
      ({ records: rawRecords, errors: parseErrors } = parseAstm(input.file_path));
      break;
    case "xlsx":
      ({ records: rawRecords, errors: parseErrors } = parseExcel(input.file_path));
      break;
    case "json":
      ({ records: rawRecords, errors: parseErrors } = parseJson(input.file_path));
      break;
  }

  // Normalize to standard internal format
  const normalizedResults = rawRecords.map(normalizeToPatientResult);

  // Move file to processing/
  const fileId = generateFileId();
  await moveFile(input.file_path, `input/processing/${fileId}_${basename(input.file_path)}`);

  return {
    file_id: fileId,
    records: normalizedResults,
    parse_errors: parseErrors,
    format_detected: format,
    total_records: normalizedResults.length,
    total_parameters: normalizedResults.reduce((sum, r) =>
      sum + r.test_panels.reduce((s, t) => s + t.parameters.length, 0), 0
    ),
  };
}
```

### 6.2 MCP Server: `clinical-intelligence-mcp` (Validation & Analysis)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `validate_against_ranges` | Check params against age/sex-adjusted ranges | `{ results: TestParameter[], patient_age, patient_sex }` | `{ validations: ParamValidation[], normal_count, abnormal_count, critical_count }` |
| `run_delta_check` | Compare against patient's prior results | `{ current: TestParameter[], prior: TestParameter[], time_window_hours }` | `{ delta_flags: DeltaFlag[], alerts: DeltaAlert[] }` |
| `check_internal_consistency` | Verify parameters are consistent with each other | `{ results: TestParameter[] }` | `{ inconsistencies: Inconsistency[], suspect_params: string[] }` |
| `compute_derived_values` | Calculate eGFR, LDL, A/G ratio, etc. | `{ results: TestParameter[], patient_age, patient_sex }` | `{ computed: DerivedValue[] }` |
| `detect_critical_values` | Check against panic value thresholds | `{ results: TestParameter[] }` | `{ critical_values: CriticalValue[], has_critical: boolean }` |
| `detect_clinical_patterns` | Multi-parameter pattern matching | `{ results: TestParameter[], abnormal_flags: string[] }` | `{ patterns: DetectedPattern[], suggested_tests: Reflex[] }` |
| `classify_result` | Final classification of the result set | `{ validations, delta_flags, patterns, criticals, confidence_threshold }` | `{ classification: "normal"\|"abnormal"\|"critical"\|"suspect", confidence: number, reasoning: string }` |
| `generate_interpretive_comment` | Claude-powered clinical narrative | `{ results: TestParameter[], validations, patterns, patient_history?, patient_demographics }` | `{ param_comments: ParamComment[], report_comment: string, reflex_suggestions: Reflex[] }` |
| `lookup_reference_range` | Get range for specific test/param | `{ param_code, age, sex }` | `{ low, high, unit, critical_low?, critical_high? }` |
| `update_reference_range` | Lab customizes a reference range | `{ param_code, demographic_key, low, high }` | `{ updated: true, previous: Range, current: Range }` |
| `add_clinical_pattern` | Add custom pattern rule | `{ pattern_id, name, triggers: ParamCondition[], significance, reflex_suggestions }` | `{ added: true }` |

**Implementation — Validation Chain:**

```typescript
const ValidateAgainstRangesSchema = z.object({
  results: z.array(TestParameterSchema),
  patient_age: z.number().describe("Patient age in years"),
  patient_sex: z.enum(["M", "F", "O"]).describe("Patient sex"),
});

async function validateAgainstRanges(input: z.infer<typeof ValidateAgainstRangesSchema>) {
  const validations: ParamValidation[] = [];
  let normalCount = 0, abnormalCount = 0, criticalCount = 0;

  for (const param of input.results) {
    if (!param.is_numeric) {
      validations.push({ param_code: param.param_code, status: "qualitative", skip_reason: "non-numeric" });
      continue;
    }

    const range = await getReferenceRange(param.param_code, input.patient_age, input.patient_sex);
    if (!range) {
      validations.push({ param_code: param.param_code, status: "no_range", skip_reason: "reference range not configured" });
      continue;
    }

    const numValue = Number(param.value);
    const criticalRange = await getCriticalRange(param.param_code);

    let status: "normal" | "low" | "high" | "critical_low" | "critical_high";

    if (criticalRange?.low && numValue < criticalRange.low) {
      status = "critical_low"; criticalCount++;
    } else if (criticalRange?.high && numValue > criticalRange.high) {
      status = "critical_high"; criticalCount++;
    } else if (numValue < range.low) {
      status = "low"; abnormalCount++;
    } else if (numValue > range.high) {
      status = "high"; abnormalCount++;
    } else {
      status = "normal"; normalCount++;
    }

    validations.push({
      param_code: param.param_code,
      param_name: param.param_name,
      value: numValue,
      unit: param.unit,
      reference_range: { low: range.low, high: range.high },
      status,
      deviation: status === "normal" ? 0 :
        status.includes("low") ? ((range.low - numValue) / range.low * 100) :
        ((numValue - range.high) / range.high * 100),
    });
  }

  return { validations, normal_count: normalCount, abnormal_count: abnormalCount, critical_count: criticalCount };
}
```

**Implementation — Clinical Comment Generation:**

```typescript
const GenerateInterpretiveCommentSchema = z.object({
  results: z.array(TestParameterSchema),
  validations: z.array(ParamValidationSchema),
  patterns: z.array(DetectedPatternSchema).optional(),
  patient_history: z.any().optional(),
  patient_demographics: z.object({
    age: z.number(),
    sex: z.enum(["M", "F", "O"]),
  }),
});

async function generateInterpretiveComment(input: z.infer<typeof GenerateInterpretiveCommentSchema>) {
  // Build context for Claude — NEVER send patient name or ID
  const anonymizedContext = {
    demographics: `${input.patient_demographics.age}y ${input.patient_demographics.sex}`,
    results: input.validations.map(v => ({
      param: v.param_name,
      value: `${v.value} ${v.unit}`,
      range: `${v.reference_range.low}-${v.reference_range.high}`,
      status: v.status,
    })),
    patterns: input.patterns?.map(p => p.pattern_name) || [],
    prior_trend: input.patient_history ? summarizeTrend(input.patient_history) : null,
  };

  // Use Claude Sonnet for routine, Opus for complex patterns
  const model = (input.patterns?.length > 0 || input.validations.filter(v => v.status !== "normal").length > 3)
    ? "claude-opus-4-6"
    : "claude-sonnet-4-6";

  const response = await claude.generate({
    model,
    system: `You are a clinical pathologist generating interpretive comments for laboratory reports.
Rules:
- Be concise and clinically precise
- Use standard medical terminology
- Flag clinically significant findings first
- Suggest reflex tests when appropriate
- Note trends if prior results are available
- Never diagnose — use phrases like "suggests", "consistent with", "consider"
- Output structured JSON`,
    prompt: `Generate interpretive comments for this lab report:
Patient: ${anonymizedContext.demographics}
Results: ${JSON.stringify(anonymizedContext.results)}
Patterns detected: ${JSON.stringify(anonymizedContext.patterns)}
Prior trends: ${JSON.stringify(anonymizedContext.prior_trend)}

Return JSON: { param_comments: [{param, comment}], report_comment: string, reflex_suggestions: [{test, reason}] }`,
  });

  return JSON.parse(response.content);
}
```

### 6.3 MCP Server: `lab-workflow-mcp` (Routing & Alerting)

| Tool | Description | Input Schema | Output |
|------|-------------|-------------|--------|
| `route_for_review` | Place report in pathologist queue | `{ result_id, classification, priority, reasoning }` | `{ queue: "critical"\|"abnormal"\|"suspect", position }` |
| `auto_validate_result` | Auto-approve if autonomy level permits | `{ result_id, classification, confidence, autonomy_level }` | `{ validated: boolean, reason }` |
| `send_critical_alert` | Dispatch immediate alert for panic values | `{ result_id, patient_id, sample_id, critical_params[], pathologist_email?, doctor_phone? }` | `{ alert_id, channels: string[] }` |
| `get_pathologist_queue` | List reports awaiting review | `{ priority?: "critical"\|"abnormal"\|"suspect", date?: string }` | `{ items: QueueItem[], counts: { critical, abnormal, suspect } }` |
| `pathologist_approve` | Record pathologist sign-off | `{ result_id, pathologist_id, override_comments? }` | `{ approved: true, timestamp }` |
| `pathologist_reject` | Reject result with reason | `{ result_id, pathologist_id, reason: "rerun"\|"recollect"\|"wrong_patient"\|"other", notes? }` | `{ rejected: true, action }` |
| `get_daily_stats` | Processing volumes and performance | `{ date: string }` | `{ total_processed, auto_validated, escalated_abnormal, escalated_critical, escalated_suspect, avg_tat_minutes }` |
| `get_quality_metrics` | Quality indicators over a period | `{ date_from, date_to }` | `{ auto_validation_rate, override_rate, false_positive_rate, critical_alert_response_time_avg, tat_distribution }` |
| `update_autonomy_level` | Change the lab's autonomy tier | `{ level: 1\|2\|3, admin_id: string }` | `{ updated: true, previous_level, new_level, timestamp }` |
| `log_pathologist_override` | Record when pathologist disagrees with agent | `{ result_id, pathologist_id, agent_classification, pathologist_classification, reason }` | `{ logged: true, total_overrides_this_month }` |

**Implementation — Auto-Validation Decision:**

```typescript
const AutoValidateResultSchema = z.object({
  result_id: z.string(),
  classification: z.enum(["normal", "abnormal", "critical", "suspect"]),
  confidence: z.number().min(0).max(100),
  autonomy_level: z.enum(["1", "2", "3"]),
});

async function autoValidateResult(input: z.infer<typeof AutoValidateResultSchema>) {
  // CRITICAL VALUES NEVER AUTO-VALIDATE — regardless of level
  if (input.classification === "critical") {
    return {
      validated: false,
      reason: "Critical values always require pathologist review",
    };
  }

  // SUSPECT VALUES NEVER AUTO-VALIDATE
  if (input.classification === "suspect") {
    return {
      validated: false,
      reason: "Suspect results (possible errors) require pathologist review",
    };
  }

  // Level 1: Nothing auto-validates
  if (input.autonomy_level === "1") {
    return {
      validated: false,
      reason: "Autonomy Level 1: all results require pathologist review",
    };
  }

  // Level 2 & 3: Auto-validate normals above confidence threshold
  if (input.classification === "normal" && input.confidence >= 95) {
    return {
      validated: true,
      reason: `Auto-validated: classification=normal, confidence=${input.confidence}%, autonomy_level=${input.autonomy_level}`,
    };
  }

  // Level 2 & 3: Abnormals always go to pathologist
  if (input.classification === "abnormal") {
    return {
      validated: false,
      reason: "Abnormal results require pathologist review",
    };
  }

  // Below confidence threshold
  return {
    validated: false,
    reason: `Confidence ${input.confidence}% below threshold (95%). Routing to pathologist.`,
  };
}
```

---

## 7. File I/O Structure

### Directory Layout

```
lab-agent/
├── input/
│   ├── pending/                     # Drop new files here
│   │   ├── batch_20260324_0900.csv
│   │   └── analyzer_sysmex_run42.hl7
│   ├── processing/                  # Currently being processed
│   └── archived/                    # Processed files (date-organized)
│       └── 2026-03-24/
│           ├── FILE001_batch_20260324_0900.csv
│           └── FILE002_analyzer_sysmex_run42.hl7
├── output/
│   ├── reports/                     # Final validated reports
│   │   └── 2026-03-24/
│   │       ├── SAM001234_cbc_report.pdf
│   │       ├── SAM001234_cbc_report.json
│   │       ├── SAM001235_lipid-profile_report.pdf
│   │       └── SAM001235_lipid-profile_report.json
│   ├── pathologist-queue/           # Reports needing human review
│   │   ├── critical/               # 🔴 Panic values — ASAP
│   │   ├── abnormal/               # 🟡 Abnormal results
│   │   └── suspect/                # 🟠 Possible errors / re-run needed
│   ├── auto-validated/              # Level 2/3: auto-approved normals
│   │   └── 2026-03-24/
│   │       ├── SAM001236_kft_report.pdf
│   │       └── ...
│   └── alerts/                      # Critical value alert records
│       └── 2026-03-24_SAM001240_critical-potassium.json
├── patient-history/                 # Historical results per patient
│   ├── PAT_10001.json
│   ├── PAT_10002.json
│   └── ...
├── knowledge-base/
│   ├── reference-ranges/
│   │   ├── hematology.json
│   │   ├── biochemistry-liver.json
│   │   ├── biochemistry-kidney.json
│   │   ├── biochemistry-lipid.json
│   │   ├── biochemistry-thyroid.json
│   │   ├── biochemistry-diabetes.json
│   │   ├── biochemistry-cardiac.json
│   │   └── custom-overrides.json    # Lab-specific range overrides
│   ├── critical-values.json
│   ├── delta-check-rules.json
│   ├── clinical-patterns.json
│   ├── calculated-params.json
│   ├── reflex-test-rules.json
│   └── report-templates/
│       ├── cbc-template.html
│       ├── lipid-template.html
│       ├── lft-template.html
│       ├── kft-template.html
│       ├── thyroid-template.html
│       └── generic-template.html
├── config/
│   ├── agent-config.json            # Lab identity, preferences
│   ├── autonomy-level.json          # Current tier (1/2/3)
│   ├── csv-profiles.json            # CSV column mapping profiles
│   ├── alert-recipients.json        # Who gets critical alerts
│   └── analyzer-config.json         # Analyzer-specific settings
├── logs/
│   ├── processing-log.jsonl         # Every file processed (append-only)
│   ├── validation-log.jsonl         # Every validation decision + reasoning
│   ├── alert-log.jsonl              # Every alert dispatched
│   ├── override-log.jsonl           # Pathologist disagreements with agent
│   └── error-log.jsonl              # Parsing errors, system errors
└── dashboard-data/
    ├── daily-stats/
    │   └── 2026-03-24.json
    └── quality-metrics/
        └── 2026-03-monthly.json
```

---

## 8. Error Handling & Recovery

### Processing Errors

| Scenario | Detection | Strategy |
|----------|-----------|----------|
| **Malformed input file** | Parse errors > 20% of rows | Reject entire file, log errors, move to `input/errors/`, notify operator |
| **Partially malformed file** | Parse errors < 20% of rows | Process valid rows, skip bad rows, include error summary in processing log |
| **Unknown test code** | Test code not in knowledge base | Skip validation for that test, mark as "unrecognized", pass through for manual review |
| **Missing patient demographics** | Age or sex fields empty/invalid | Use generic adult ranges, flag report: "⚠️ Reference ranges not age/sex-adjusted — demographics missing" |
| **Missing patient ID** | patient_id field empty | Reject record — cannot do delta checks or store history without patient ID |
| **Duplicate sample ID** | Same sample_id already processed today | Flag as possible duplicate, present both to pathologist for reconciliation |
| **Impossible values** | Value physically impossible (e.g., Hb = 450 g/dL) | Classify as "suspect — instrument error", hold report, suggest re-run |
| **Patient history mismatch** | Delta check finds extreme change that's not clinically plausible | NEVER auto-validate. Escalate with full historical comparison. Suggest verifying patient identity. |
| **Claude API failure** | Timeout/error during comment generation | Generate report WITHOUT interpretive comments, flag: "⚠️ Interpretive comments unavailable — manual review required" |
| **Disk full / write failure** | OS-level I/O error | Halt processing immediately, alert operator, resume from checkpoint after resolution |
| **Concurrent file access** | Multiple files being processed simultaneously | File-level locking via `.lock` files, sequential processing per batch |

### Checkpoint & Resume

For large batch files (500+ results), the agent maintains processing checkpoints:

```json
{
  "file_id": "FILE001",
  "file_path": "input/processing/FILE001_batch_20260324.csv",
  "started_at": "2026-03-24T09:00:00+05:30",
  "status": "in_progress",
  "total_records": 534,
  "processed": 312,
  "last_processed_sample": "SAM001546",
  "auto_validated": 245,
  "escalated": 62,
  "critical_alerts": 5,
  "errors": 0
}
```

If interrupted, the agent resumes from `last_processed_sample` on restart.

---

## 9. Security Considerations

### Data Privacy

| Principle | Implementation |
|-----------|---------------|
| **Patient data isolation** | All processing local. Patient records never leave the lab's infrastructure. |
| **Anonymized AI calls** | Only anonymized parameter values (age, sex, lab values) sent to Claude API for comment generation. NEVER patient name, ID, or any identifying information. |
| **No cloud storage** | Zero dependency on external cloud services for data storage. All files local. |
| **Access control** | Pathologist approval requires pathologist ID. Autonomy level changes require admin credential. |
| **Encryption at rest** | Optional AES-256 encryption for patient history files. |
| **Audit immutability** | All log files are append-only (`.jsonl` format). Agent has no tool to delete or modify past log entries. |

### Compliance

| Standard | How the Agent Supports It |
|----------|--------------------------|
| **NABL (ISO 15189)** | Auto-tracks quality indicators: TAT, critical value notification time, error rates, amendment rates |
| **HIPAA / DISHA** | Patient data never transmitted externally. Anonymized-only API calls. Full audit trail. |
| **Indian Clinical Establishment Act** | Report format includes mandatory fields: lab registration, pathologist name/registration, NABL certificate number |
| **CLIA equivalent** | Supports proficiency testing tracking, quality control logging |

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Wrong patient results** | Delta check catches extreme history mismatches. Agent flags for patient identity verification. |
| **Report tampering** | Immutable processing log records every validation. PDF reports include hash for integrity verification. |
| **Unauthorized auto-validation** | Autonomy level change requires admin credential. Every auto-validation logged with full reasoning. |
| **Claude API compromise** | No PHI sent to API — only anonymized lab values. Even if intercepted, data is not identifiable. |
| **Knowledge base tampering** | Custom range overrides logged with who changed what and when. Critical value thresholds require admin access. |

---

## 10. Example User Interactions

### Example 1: Routine Batch Processing

```
Operator: "Process today's morning batch."

Agent: Scanning input/pending/ for new files...

       Found: batch_20260324_morning.csv (534 records)
       Format: CSV (auto-detected, profile: metropolis_default)

       Processing...
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%

       📊 Batch Summary:
       ┌─────────────────────────────────────────────┐
       │ Total records:          534                  │
       │ ✅ Normal (auto-validated): 389 (72.8%)       │
       │ 🟡 Abnormal (pathologist):  127 (23.8%)       │
       │ 🟠 Suspect (re-check):       13 (2.4%)        │
       │ 🔴 Critical (ALERT SENT):      5 (0.9%)       │
       │ Avg processing time:     1.2 sec/report      │
       │ Total batch time:        10.7 minutes        │
       └─────────────────────────────────────────────┘

       🔴 5 Critical Alerts dispatched:
       1. SAM001240 — Potassium 7.2 mEq/L (critical high)
          → Dr. Mehta notified via SMS
       2. SAM001298 — Glucose 28 mg/dL (critical low)
          → Dr. Singh notified via SMS
       3. SAM001315 — Hemoglobin 4.2 g/dL (critical low)
          → Dr. Patel notified via SMS
       4. SAM001402 — Platelet Count 12,000 /µL (critical low)
          → Dr. Kumar notified via SMS
       5. SAM001489 — Troponin I 2.8 ng/mL (critical high)
          → Dr. Reddy notified via SMS

       ✅ 389 normal reports → output/auto-validated/2026-03-24/
       🟡 127 abnormal reports → output/pathologist-queue/abnormal/
       🟠 13 suspect reports → output/pathologist-queue/suspect/

       Pathologist queue ready for review.
```

### Example 2: Clinical Pattern Detection

```
Agent (processing SAM001567):

  Patient: 45y Female
  Test: Complete Blood Count + Iron Studies

  Results:
  ┌────────────────────┬────────┬─────────┬──────────┬────────┐
  │ Parameter          │ Value  │ Unit    │ Range    │ Status │
  ├────────────────────┼────────┼─────────┼──────────┼────────┤
  │ Hemoglobin         │ 8.2    │ g/dL    │ 12.0-15.5│ 🔴 Low  │
  │ RBC                │ 3.4    │ 10⁶/µL  │ 4.0-5.0  │ 🔴 Low  │
  │ MCV                │ 68     │ fL      │ 80-100   │ 🔴 Low  │
  │ MCH                │ 24.1   │ pg      │ 27-33    │ 🔴 Low  │
  │ MCHC               │ 30.2   │ g/dL    │ 32-36    │ 🔴 Low  │
  │ RDW                │ 18.5   │ %       │ 11.5-14.5│ 🔴 High │
  │ WBC                │ 6.8    │ 10³/µL  │ 4.0-11.0 │ ✅      │
  │ Platelet Count     │ 310    │ 10³/µL  │ 150-400  │ ✅      │
  │ Serum Iron         │ 22     │ µg/dL   │ 60-170   │ 🔴 Low  │
  │ Ferritin           │ 8      │ ng/mL   │ 12-150   │ 🔴 Low  │
  │ TIBC               │ 450    │ µg/dL   │ 250-370  │ 🔴 High │
  │ Transferrin Sat.   │ 4.9    │ %       │ 20-50    │ 🔴 Low  │
  └────────────────────┴────────┴─────────┴──────────┴────────┘

  🔍 Pattern Detected: PAT-001 (Iron Deficiency Anemia)
     MCV↓ + MCH↓ + MCHC↓ + Ferritin↓ + TIBC↑ + Hb↓

  📝 Interpretive Comment (AI-generated):
  "Microcytic hypochromic anemia with significantly depleted iron stores.
   Hemoglobin 8.2 g/dL represents moderate anemia. Iron studies confirm
   iron deficiency — serum ferritin 8 ng/mL (severely depleted), elevated
   TIBC 450 µg/dL, and transferrin saturation 4.9% (markedly reduced).
   Elevated RDW (18.5%) indicates anisocytosis consistent with iron
   deficiency. Clinical correlation recommended — evaluate for chronic
   blood loss (menstrual, gastrointestinal). Peripheral blood smear may
   show target cells, pencil cells, and hypochromic microcytes."

  💡 Reflex Suggestion:
     - Peripheral Blood Smear (confirm morphology)
     - Stool Occult Blood (evaluate GI blood loss)
     - Reticulocyte Count (assess marrow response)

  📋 Delta Check: Prior Hb was 9.8 g/dL (3 months ago) → dropped 1.6 g/dL.
     Progressive decline suggests ongoing iron loss.

  → Classification: ABNORMAL (confidence: 99%)
  → Routed to: pathologist-queue/abnormal/ with pre-populated analysis
```

### Example 3: Suspect Result Detection

```
Agent (processing SAM001589):

  Patient: 32y Male
  Test: Renal Function Test

  Results:
  ┌────────────────────┬────────┬─────────┬──────────┬────────┐
  │ Parameter          │ Value  │ Unit    │ Range    │ Status │
  ├────────────────────┼────────┼─────────┼──────────┼────────┤
  │ Creatinine         │ 4.8    │ mg/dL   │ 0.7-1.3  │ 🔴 High │
  │ Blood Urea         │ 22     │ mg/dL   │ 15-40    │ ✅      │
  │ BUN                │ 10.3   │ mg/dL   │ 7-20     │ ✅      │
  │ Uric Acid          │ 5.1    │ mg/dL   │ 3.5-7.2  │ ✅      │
  │ Sodium             │ 140    │ mEq/L   │ 136-145  │ ✅      │
  │ Potassium          │ 4.2    │ mEq/L   │ 3.5-5.0  │ ✅      │
  └────────────────────┴────────┴─────────┴──────────┴────────┘

  ⚠️ SUSPECT RESULT DETECTED:

  🔍 Internal Consistency Check: FAILED
     Creatinine 4.8 mg/dL would correspond to eGFR ~13 mL/min (Stage 5 CKD)
     BUT urea, BUN, potassium, and uric acid are ALL normal.
     In true renal failure at this creatinine level, urea would typically
     be >80 mg/dL and potassium likely elevated.

  📋 Delta Check: Prior creatinine was 0.9 mg/dL (2 months ago).
     A 433% increase in 60 days with no other renal markers affected is
     highly suspicious for pre-analytical or analytical error.

  📝 Agent Comment:
  "Isolated creatinine elevation (4.8 mg/dL) with normal urea, BUN,
   electrolytes, and uric acid is internally inconsistent and likely
   represents a pre-analytical or analytical error. Prior creatinine was
   0.9 mg/dL. Recommend: (1) check for sample hemolysis or lipemia,
   (2) re-run creatinine on the same sample, (3) if confirmed, request
   fresh sample collection."

  → Classification: SUSPECT (confidence: 97%)
  → Routed to: pathologist-queue/suspect/
  → Suggested action: RE-RUN before reporting
```

### Example 4: Pathologist Queue Review

```
Pathologist: "Show me the critical queue."

Agent: 🔴 Critical Queue — 5 reports pending:

  ┌────┬────────────┬──────────┬──────────────────────────────┬─────────┐
  │ #  │ Sample     │ Patient  │ Critical Finding             │ Alert   │
  ├────┼────────────┼──────────┼──────────────────────────────┼─────────┤
  │ 1  │ SAM001240  │ 67y M    │ K+ 7.2 mEq/L                │ ✅ Sent  │
  │ 2  │ SAM001298  │ 45y F    │ Glucose 28 mg/dL             │ ✅ Sent  │
  │ 3  │ SAM001315  │ 28y F    │ Hb 4.2 g/dL                 │ ✅ Sent  │
  │ 4  │ SAM001402  │ 55y M    │ Platelets 12,000 /µL         │ ✅ Sent  │
  │ 5  │ SAM001489  │ 72y M    │ Troponin I 2.8 ng/mL         │ ✅ Sent  │
  └────┴────────────┴──────────┴──────────────────────────────┴─────────┘

  All ordering doctors have been alerted via SMS. Select a report to review.

Pathologist: "Open SAM001489."

Agent: SAM001489 — 72y Male — Cardiac Markers

  ┌────────────────────┬────────┬─────────┬──────────┬────────┐
  │ Parameter          │ Value  │ Unit    │ Range    │ Status │
  ├────────────────────┼────────┼─────────┼──────────┼────────┤
  │ Troponin I         │ 2.8    │ ng/mL   │ <0.04    │ 🔴 CRIT│
  │ CK-MB              │ 68     │ U/L     │ 0-25     │ 🔴 High │
  │ CK Total           │ 420    │ U/L     │ 39-308   │ 🔴 High │
  │ LDH                │ 380    │ U/L     │ 140-280  │ 🔴 High │
  │ BNP                │ 850    │ pg/mL   │ <100     │ 🔴 High │
  └────────────────────┴────────┴─────────┴──────────┴────────┘

  📝 AI Comment:
  "Markedly elevated Troponin I (2.8 ng/mL, >70x ULN) with concurrent
   CK-MB elevation (68 U/L) strongly suggests acute myocardial injury.
   Elevated BNP (850 pg/mL) indicates cardiac failure component.
   Clinical correlation for acute coronary syndrome is essential.
   Serial troponin measurements recommended at 3-6 hour intervals."

  📋 No prior cardiac markers on file for this patient.

  → Approve report? [approve / reject / add comment]

Pathologist: "Approve."

Agent: ✅ Report approved by Dr. Pathologist_ID.
       PDF generated → output/reports/2026-03-24/SAM001489_cardiac_report.pdf
       Patient history updated.
```

### Example 5: Quality Metrics Review

```
Lab Manager: "Show me this month's quality metrics."

Agent: 📊 Quality Metrics — March 2026 (1st - 24th)

  ┌─────────────────────────────────────────────────┐
  │ VOLUME                                          │
  │ Total reports processed:        12,847           │
  │ Daily average:                    535            │
  │ Peak day:                         687 (Mar 15)   │
  ├─────────────────────────────────────────────────┤
  │ AUTONOMY PERFORMANCE (Level 2)                   │
  │ Auto-validated (normal):     9,234 (71.9%)       │
  │ Escalated to pathologist:    3,388 (26.4%)       │
  │ Suspect (re-run/re-collect):   148 (1.2%)        │
  │ Critical alerts sent:           77 (0.6%)        │
  ├─────────────────────────────────────────────────┤
  │ QUALITY INDICATORS                               │
  │ Pathologist override rate:      2.1%             │
  │   (pathologist disagreed with agent's flagging)  │
  │ False positive rate:            1.8%             │
  │   (agent flagged normal results as abnormal)     │
  │ Missed abnormals:              0.0%              │
  │   (normals that pathologist reclassified)        │
  │ Critical value alert time:     avg 45 seconds    │
  │   (detection → SMS sent to doctor)               │
  ├─────────────────────────────────────────────────┤
  │ TURNAROUND TIME                                  │
  │ Average (all reports):        12 minutes         │
  │ Auto-validated normals:        2 minutes         │
  │ Pathologist-reviewed:         45 minutes         │
  │ Critical value reports:        8 minutes         │
  ├─────────────────────────────────────────────────┤
  │ PATTERNS DETECTED                                │
  │ Iron deficiency anemia:          34              │
  │ Thyroid dysfunction:             28              │
  │ Metabolic syndrome features:     22              │
  │ Liver injury patterns:           15              │
  │ Renal impairment:               12              │
  │ Suspect results caught:         148              │
  └─────────────────────────────────────────────────┘

  📈 Trend: Auto-validation rate improved from 68% (week 1) to 74%
  (week 4) as the knowledge base was tuned. Override rate decreased
  from 3.2% to 1.4%.

  Recommendation: Lab is performing well at Level 2. Consider graduating
  to Level 3 for CBC and lipid panels, which have 0.3% override rate
  (well below the 2% threshold).
```

---

## 11. Data Model

### Core Types

```typescript
// Validated result — after full processing pipeline
interface ValidatedResult {
  result_id: string;                   // Unique processing ID
  file_id: string;                     // Source file reference
  sample_id: string;
  patient: PatientInfo;
  test_panels: ValidatedPanel[];
  classification: "normal" | "abnormal" | "critical" | "suspect";
  confidence: number;                  // 0-100
  reasoning: string;                   // Why this classification
  computed_values: DerivedValue[];
  clinical_patterns: DetectedPattern[];
  delta_flags: DeltaFlag[];
  interpretive_comments: ClinicalComments;
  reflex_suggestions: ReflexSuggestion[];
  routing: RoutingDecision;
  processed_at: string;               // ISO 8601
  processing_time_ms: number;
}

interface PatientInfo {
  patient_id: string;
  name: string;
  age: number;
  sex: "M" | "F" | "O";
  dob?: string;
  has_prior_history: boolean;
  prior_visit_count: number;
}

interface ValidatedPanel {
  test_code: string;
  test_name: string;
  parameters: ValidatedParameter[];
}

interface ValidatedParameter {
  param_code: string;
  param_name: string;
  value: number | string;
  unit: string;
  reference_range: { low: number; high: number } | null;
  status: "normal" | "low" | "high" | "critical_low" | "critical_high" | "qualitative" | "no_range";
  deviation_percent: number;           // How far from range boundary
  instrument_flag?: string;
  comment?: string;                    // Parameter-level interpretive comment
}

interface DerivedValue {
  param_code: string;                  // e.g., "EGFR", "LDL_CALC"
  param_name: string;
  value: number;
  unit: string;
  formula_used: string;
  reference_range?: { low: number; high: number };
  status?: "normal" | "low" | "high";
}

interface DetectedPattern {
  pattern_id: string;                  // e.g., "PAT-001"
  pattern_name: string;
  triggering_params: string[];         // Which params triggered this
  clinical_significance: string;
  severity: "informational" | "moderate" | "urgent" | "critical";
}

interface DeltaFlag {
  param_code: string;
  current_value: number;
  prior_value: number;
  prior_date: string;
  change_percent: number;
  threshold_percent: number;
  likely_cause: string;
  action_suggested: "verify" | "recollect" | "investigate" | "alert";
}

interface ClinicalComments {
  parameter_comments: { param_code: string; comment: string }[];
  report_comment: string;              // Overall interpretive narrative
  methodology_notes?: string;
}

interface ReflexSuggestion {
  test_code: string;
  test_name: string;
  reason: string;                      // Why this reflex test is suggested
  priority: "recommended" | "consider" | "if_clinically_indicated";
}

interface RoutingDecision {
  destination: "auto_validated" | "pathologist_critical" | "pathologist_abnormal" | "pathologist_suspect";
  autonomy_level: 1 | 2 | 3;
  auto_validated: boolean;
  pathologist_id?: string;
  approved_at?: string;
  override?: {
    agent_classification: string;
    pathologist_classification: string;
    reason: string;
  };
}

// Processing log entry (append-only)
interface ProcessingLogEntry {
  timestamp: string;
  file_id: string;
  result_id: string;
  sample_id: string;
  patient_id: string;
  classification: string;
  confidence: number;
  auto_validated: boolean;
  critical_alert_sent: boolean;
  patterns_detected: string[];
  processing_time_ms: number;
}

// Quality metrics
interface DailyStats {
  date: string;
  total_processed: number;
  auto_validated: number;
  escalated_abnormal: number;
  escalated_critical: number;
  escalated_suspect: number;
  parse_errors: number;
  avg_tat_minutes: number;
  critical_alert_avg_seconds: number;
  patterns_detected: Record<string, number>;
}

interface QualityMetrics {
  period: { from: string; to: string };
  auto_validation_rate: number;        // % of total
  override_rate: number;               // % pathologist disagreed
  false_positive_rate: number;         // % agent flagged but was normal
  missed_abnormal_rate: number;        // % agent passed but was abnormal
  critical_alert_response_time: number; // Avg seconds
  tat_distribution: {
    p50: number; p90: number; p99: number;
  };
}
```

---

## 12. Development Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Description | Priority |
|------|-------------|----------|
| Project scaffolding | TypeScript project, Agent SDK setup, 3 MCP server skeletons | P0 |
| CSV parser | Parse CSV with configurable column mapping profiles | P0 |
| Reference range engine | Age/sex-adjusted range lookups for biochemistry + hematology | P0 |
| Basic validation | Range check, classify normal/abnormal/critical | P0 |
| File watcher | Chokidar-based input folder monitoring | P0 |
| Processing log | Append-only JSONL logging for every action | P0 |

### Phase 2: Clinical Intelligence (Week 3-4)

| Task | Description | Priority |
|------|-------------|----------|
| Critical value detection | Panic thresholds + immediate alerting (email/SMS) | P0 |
| Delta check engine | Compare against patient history, flag significant changes | P0 |
| Internal consistency checks | Cross-parameter validation (e.g., CBC indices consistency) | P0 |
| Calculated values | eGFR, LDL, A/G ratio, anion gap, etc. | P1 |
| Clinical pattern detection | Multi-parameter pattern matching (15 patterns) | P1 |
| Patient history store | File-based per-patient history accumulation | P0 |

### Phase 3: AI-Powered Comments & Reports (Week 5-6)

| Task | Description | Priority |
|------|-------------|----------|
| Interpretive comment generation | Claude-powered parameter + report level comments | P0 |
| Reflex test suggestions | Suggest additional tests based on patterns | P1 |
| PDF report generation | HTML template → PDF with results, flags, comments | P0 |
| Report templates | CBC, lipid, LFT, KFT, thyroid, generic templates | P0 |
| Pathologist queue management | Route reports, track approvals/rejections | P0 |

### Phase 4: Tiered Autonomy & Quality (Week 7-8)

| Task | Description | Priority |
|------|-------------|----------|
| Autonomy level engine | Level 1/2/3 routing logic, configurable per lab | P0 |
| Auto-validation with confidence scoring | Only auto-validate above threshold | P0 |
| Override tracking | Log pathologist disagreements, compute override rate | P1 |
| Quality metrics dashboard | Daily stats, monthly quality metrics, NABL indicators | P1 |
| Suspect result detection | Combine delta checks + consistency checks for error catching | P1 |

### Phase 5: Format Support & Hardening (Week 9-10)

| Task | Description | Priority |
|------|-------------|----------|
| HL7 v2.x parser | Parse OBX segments from HL7 messages | P1 |
| ASTM parser | Parse ASTM protocol frames from analyzers | P2 |
| Excel parser | Handle .xlsx exports from smaller labs | P2 |
| Batch checkpoint & resume | Handle large file processing with restart capability | P1 |
| Custom knowledge base editor | Tools for labs to adjust ranges, add patterns, configure rules | P1 |
| Deployment documentation | Setup guide, CSV profile configuration, alerting setup | P1 |

### Phase 6: Extensibility (Week 11-12)

| Task | Description | Priority |
|------|-------------|----------|
| Microbiology module | Culture sensitivity parsing and comment generation | P2 |
| Serology module | Qualitative result interpretation (reactive/non-reactive) | P2 |
| Multi-branch support | Process results from multiple lab branches, unified patient history | P2 |
| API integration layer | REST API for LIS integration (supplement file exchange) | P2 |
| GIF recording | Record processing demos for training and QA | P2 |

---

## 13. Cost Estimates

### Claude API Usage Per Batch

| Operation | Model | Tokens (est.) | Cost (est.) |
|-----------|-------|---------------|-------------|
| File format detection | Haiku | ~500 input + 200 output | ~₹0.10 |
| Per result: range validation + classification | Haiku | ~1,000 input + 500 output | ~₹0.15 |
| Per result: interpretive comment (normal) | Sonnet | ~2,000 input + 500 output | ~₹0.85 |
| Per result: interpretive comment (abnormal/pattern) | Opus | ~5,000 input + 1,500 output | ~₹8.50 |
| Per result: clinical pattern analysis | Sonnet | ~3,000 input + 1,000 output | ~₹1.25 |
| Daily stats generation | Haiku | ~2,000 input + 500 output | ~₹0.25 |

**Typical morning batch (500 results):**
- File parsing & format detection: ~₹0.50
- Range validation (500 results × Haiku): ~₹75
- Comments for normals (350 results × Sonnet): ~₹300
- Comments for abnormals (130 results × Opus): ~₹1,100
- Pattern analysis (130 results × Sonnet): ~₹165
- Critical alerts + routing: ~₹5
- **Total: ~₹1,650 per batch (~₹3.30 per report)**

**Monthly cost (15,000 reports, Level 2):**
- Auto-validated normals (10,500 × Sonnet): ~₹8,925
- Pathologist-reviewed (4,500 × Opus): ~₹38,250
- Pattern analysis + routing: ~₹6,000
- Quality metrics: ~₹500
- **Total: ~₹53,675/month (~₹3.58 per report)**

### Cost Optimization Strategies

| Strategy | Savings |
|----------|---------|
| Use Haiku for all normal-range validations (no comment needed at Level 3) | 40% on normals |
| Cache clinical patterns — don't re-analyze identical parameter combinations | 15-20% |
| Batch interpretive comments — send 10 similar results in one prompt | 25-30% |
| Skip comments entirely for auto-validated normals at Level 3 | 50% on normals |

### Local Resource Usage

| Resource | Requirement |
|----------|------------|
| **Disk space** | ~100MB per 10,000 reports (PDFs + history + logs) |
| **Memory** | ~500MB for agent + file watching + PDF generation |
| **CPU** | Minimal — I/O bound, not compute bound |
| **Network** | Claude API calls only — no other external services |

---

## 14. Getting Started — Quick Setup

### Prerequisites

```bash
# 1. Claude Code CLI installed and authenticated
claude --version

# 2. Node.js 18+
node --version

# 3. Create lab-agent directory
mkdir lab-agent && cd lab-agent
```

### First Run

```bash
# Start Claude Code
claude

> "Set up the Lab Report Intelligence Agent. My lab name is City Diagnostics."
```

The agent will:
1. Create the full directory structure (`input/`, `output/`, `knowledge-base/`, etc.)
2. Initialize reference ranges for biochemistry + hematology
3. Set default critical values and delta check rules
4. Create `agent-config.json` with lab identity
5. Set autonomy to Level 1 (safest starting point)
6. Start watching `input/pending/` for files

### Processing Your First Batch

```bash
# Export results from your LIS as CSV and drop in the input folder
cp /path/to/your/lis-export.csv lab-agent/input/pending/

# Tell the agent to process
> "Process new files in the input folder."

# Or configure auto-processing
> "Auto-process any new files that appear in the input folder."
```

### Configuring for Your Lab

```bash
# Adjust reference ranges
> "Update the hemoglobin reference range for adult males to 13.5-17.5 g/dL."

# Add a CSV profile for your LIS
> "My LIS exports CSV with columns: AccNo, PatientName, Age, Gender, TestName, Param, Result, Units. Create a profile."

# Set up critical value alerts
> "Send critical value alerts to dr.pathologist@lab.com and SMS to +91-9876543210."

# Graduate autonomy level
> "We've been running for 2 weeks with <2% override rate. Move to Level 2."
```

---

## 15. Integration with Other Agents

### ABHA Health Record Agent

When a patient's ABHA-linked records include lab reports from other facilities:
- The ABHA agent downloads records → Lab Report Intelligence Agent can parse and add to patient history
- Enables delta checks across labs, not just within the same lab
- Unified medication/condition context improves clinical comment quality

### Vendor Onboarding Agent

For labs onboarding new reagent/equipment vendors:
- Vendor validation feeds into analyzer configuration
- New analyzer → new ASTM/HL7 format → agent auto-detects and maps

### Statutory Compliance Calendar Agent

Lab regulatory compliance integration:
- NABL audit preparation — agent provides quality metrics on demand
- Clinical Establishment Act compliance — report format verification
- Biomedical waste tracking (Phase 2 — sample volumes)

---

## 16. References

- [NABL (National Accreditation Board for Testing and Calibration Laboratories)](https://nabl-india.org/) — Indian lab accreditation body
- [ISO 15189:2022](https://www.iso.org/standard/76677.html) — Medical laboratory quality and competence requirements
- [CLSI (Clinical and Laboratory Standards Institute)](https://clsi.org/) — Laboratory standards and guidelines
- [HL7 International](https://www.hl7.org/) — Health Level Seven messaging standards
- [ASTM E1394](https://www.astm.org/) — Standard for transferring data between clinical instruments and computer systems
- [CKD-EPI Creatinine Equation (2021)](https://www.kidney.org/professionals/kdoqi/gfr_calculator) — eGFR calculation
- [Friedewald Formula](https://en.wikipedia.org/wiki/Friedewald_equation) — LDL cholesterol estimation
- [WHO Hemoglobin Thresholds](https://www.who.int/publications/i/item/9789240000124) — Anemia classification by age/sex
- [Claude Agent SDK Documentation](https://docs.anthropic.com/en/docs/agents) — Agent SDK reference
- [Deep Agent Infrastructure Playbook](deep-agent-infrastructure-playbook.md) — Shared infrastructure patterns for all agents in this repository
