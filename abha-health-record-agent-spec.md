# Deep Agent for ABHA Health Records — Research Document

## Overview

This document outlines how to build an **ABHA Health Record Agent** using the **Claude Agent SDK**. The agent is a personal, locally-running assistant that autonomously manages an individual's Ayushman Bharat Health Account (ABHA) — navigating the ABHA portal via browser automation, downloading health records, organizing them into a structured local vault, generating health summaries, and maintaining a complete audit trail with screenshots. Unlike server-side agents, this one runs entirely on the user's machine, sees what they see, and pauses for human confirmation at every authentication and consent step. What typically requires a person to manually navigate government portals, download scattered PDFs, and mentally track their health history becomes a single-command operation with organized records, medication timelines, and exportable health reports.

---

## 1. Why This Agent Is Needed

### The Problem

Managing personal health records in India is broken:

| Pain Point | Detail |
|------------|--------|
| **Scattered records** | Health records spread across 5-10+ hospitals, labs, and clinics — each with their own portal or no digital system at all |
| **ABHA portal friction** | The ABDM/ABHA portal requires manual navigation, OTP authentication, and individual record downloads — tedious for regular use |
| **No organization** | Downloaded PDFs pile up in ~/Downloads with cryptic filenames like `report_1234.pdf` — impossible to find when needed |
| **No health timeline** | No unified view of medications, lab trends, or visit history across providers |
| **Consent complexity** | ABHA's consent-based architecture requires understanding and approving data-sharing requests — easy to miss or misunderstand |
| **Offline inaccessibility** | Health records locked behind portal login — no offline access during emergencies when you need them most |
| **Doctor visit prep** | Patients scramble to gather records before doctor visits instead of having a ready health summary |
| **Insurance claims** | Gathering discharge summaries, bills, and prescriptions for insurance claims is a multi-hour manual process |

### Why a Local Agent

This agent is fundamentally different from the server-side agents in this repository:

| Aspect | Server-Side Agents (Vendor, SOC2, etc.) | ABHA Local Agent |
|--------|----------------------------------------|------------------|
| **Runs where** | Cloud/server infrastructure | User's personal machine |
| **Data storage** | PostgreSQL, S3, cloud services | Local filesystem only |
| **Authentication** | API keys, service accounts | Human enters OTP each session |
| **Interaction model** | API-driven, webhook-triggered | Conversational + browser automation |
| **Privacy model** | Data passes through server | Zero data leaves the machine |
| **Primary interface** | MCP tools + APIs | Chrome browser automation + file system |
| **User trust model** | Organizational access control | Individual — sees everything, approves everything |

### Why Claude Agent SDK

The Agent SDK is ideal because this agent requires:
- **Browser automation via MCP** — drive Chrome to navigate ABHA portal, fill forms, click buttons, read page content
- **Screenshot capture** — visual proof of every consent and authentication action
- **File system access** — create folders, save PDFs, maintain manifest, generate reports
- **Multi-modal understanding** — parse downloaded health records (PDFs, images) to extract structured data
- **Conversational interface** — natural language interaction ("download my latest lab reports", "show me my medication history")
- **Human-in-the-loop** — pause execution at authentication and consent gates
- **Long-running sessions** — a full sync may take 10-15 minutes of portal navigation

---

## 2. Architecture

### High-Level Design

```
                    ┌──────────────────────────────────┐
                    │     ABHA Health Record Agent      │
                    │       (Single Orchestrator)       │
                    │                                   │
                    │   Claude Agent SDK + MCP Chrome   │
                    └───────────────┬──────────────────┘
                                    │
           ┌────────────┬───────────┼───────────┬────────────┐
           │            │           │           │            │
     ┌─────▼─────┐ ┌───▼─────┐ ┌──▼──────┐ ┌──▼────────┐ ┌▼───────────┐
     │ Browser   │ │ File    │ │ Record  │ │ Health    │ │ Screenshot │
     │ Automation│ │ System  │ │ Parser  │ │ Summary   │ │ & Audit    │
     │ Layer     │ │ Manager │ │ Engine  │ │ Engine    │ │ Logger     │
     └─────┬─────┘ └───┬─────┘ └──┬──────┘ └──┬────────┘ └┬───────────┘
           │            │          │           │           │
     ┌─────▼─────┐ ┌───▼──────────▼───┐  ┌───▼───────────▼───┐
     │ ABHA      │ │ Local Health     │  │ Audit Trail &     │
     │ Portal    │ │ Record Vault     │  │ Consent Log       │
     │ (Chrome)  │ │ (~/health-       │  │ (Screenshots +    │
     │           │ │  records/)       │  │  JSON action log) │
     └───────────┘ └──────────────────┘  └───────────────────┘
```

### Component Responsibilities

| Component | Purpose | Tools Used |
|-----------|---------|------------|
| **Browser Automation Layer** | Drives Chrome to navigate ABHA portal — login, browse records, manage consents, download files | MCP Chrome: `navigate`, `form_input`, `find`, `get_page_text`, `computer` |
| **File System Manager** | Creates folder structure, saves downloads, maintains manifest, enforces naming conventions | Agent SDK: `Read`, `Write`, `Edit`, `Glob`, `Bash` |
| **Record Parser Engine** | Extracts structured data from downloaded PDFs — dates, doctor names, medications, lab values | `pdf-parse`, Claude multi-modal (for scanned docs) |
| **Health Summary Engine** | Analyzes parsed records to generate medication timelines, lab trends, visit history, health reports | Claude analysis + `pdf-lib` for PDF generation |
| **Screenshot & Audit Logger** | Captures screenshots at auth/consent steps, maintains append-only JSON action log | MCP Chrome: `computer` (screenshot), Agent SDK: `Write` |

### End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ABHA HEALTH RECORD LIFECYCLE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. AUTHENTICATE       2. DISCOVER             3. DOWNLOAD              │
│  ┌──────────────┐     ┌──────────────────┐    ┌──────────────────┐     │
│  │ Navigate to  │     │ Browse "My       │    │ Download records │     │
│  │ ABHA portal  │     │ Records" section │    │ (user-selected   │     │
│  │              │────>│                  │───>│  or all new)     │     │
│  │ ⏸️ User enters│     │ List facilities  │    │                  │     │
│  │ OTP manually │     │ & available      │    │ Verify file      │     │
│  │              │     │ records          │    │ integrity        │     │
│  │ 📸 Screenshot│     │                  │    │ 📸 Screenshot     │     │
│  └──────────────┘     └──────────────────┘    └────────┬─────────┘     │
│                                                        │               │
│  4. ORGANIZE           5. ANALYZE             6. EXPORT                │
│  ┌──────────────┐     ┌──────────────────┐    ┌──────────────────┐     │
│  │ Categorize   │     │ Parse records    │    │ Generate:        │     │
│  │ into folders │<────│ Extract:         │───>│ - Health timeline│     │
│  │              │     │ - Dates          │    │ - Medication list│     │
│  │ Rename with  │     │ - Doctors        │    │ - Lab trends     │     │
│  │ convention   │     │ - Medications    │    │ - Consolidated   │     │
│  │              │     │ - Lab values     │    │   PDF report     │     │
│  │ Update       │     │ - Diagnoses      │    │                  │     │
│  │ manifest.json│     │                  │    │ Store in         │     │
│  └──────────────┘     └──────────────────┘    │ _summaries/      │     │
│                                                └──────────────────┘     │
│  7. CONSENT MANAGEMENT (Ongoing)                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Monitor consent requests → Present to user → ⏸️ User decides     │   │
│  │ → Execute decision → 📸 Screenshot → Log to audit trail          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Human-in-the-Loop Gates

The agent MUST pause and wait for explicit user confirmation at these points:

| Gate | Trigger | What User Sees |
|------|---------|----------------|
| **OTP Entry** | ABHA login screen loaded | "I've navigated to the ABHA login page and entered your ABHA number. Please enter the OTP sent to your mobile." |
| **Consent Approval** | ABHA consent request displayed | Screenshot of consent screen + "Facility X is requesting access to your records from Y date range. Approve or deny?" |
| **Profile Modification** | Any ABHA profile edit | "I'm about to update [field] from [old] to [new]. Confirm?" |
| **Bulk Download** | Large number of records found | "Found 47 new records across 5 facilities. Download all, or let me show you the list to pick?" |
| **CAPTCHA** | CAPTCHA detected on portal | Screenshot of CAPTCHA + "Please solve this CAPTCHA for me." |
| **File Deletion** | User requests record cleanup | "This will permanently delete [N] local files. Confirm?" |

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (orchestrator, health analysis, complex record parsing)
                 claude-sonnet-4-6 (record categorization, summary generation)
                 claude-haiku-4-5 (manifest updates, simple navigation decisions)
Browser:         MCP Chrome tools (navigate, click, form_input, screenshots, get_page_text)
PDF Parsing:     pdf-parse / pdfjs-dist (extract text from downloaded health records)
PDF Generation:  pdf-lib (consolidated health reports)
OCR:             Tesseract.js (fallback for scanned/image-based records)
Storage:         Local filesystem (~/health-records/)
Config:          JSON file (~/.health-records/agent-config.json)
Encryption:      Node.js crypto (AES-256-GCM, optional, user-provided passphrase)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install pdf-parse                    # PDF text extraction
npm install pdf-lib                      # PDF generation for reports
npm install tesseract.js                 # OCR for scanned documents
npm install zod                          # Schema validation
npm install dayjs                        # Date handling
npm install crypto-js                    # Optional vault encryption
```

### MCP Chrome Tools (Pre-installed)

The agent relies on the Claude-in-Chrome MCP extension for browser automation:

| MCP Tool | Usage in This Agent |
|----------|-------------------|
| `mcp__claude-in-chrome__navigate` | Open ABHA portal URLs |
| `mcp__claude-in-chrome__form_input` | Enter ABHA number, search queries |
| `mcp__claude-in-chrome__find` | Locate elements on the ABHA portal |
| `mcp__claude-in-chrome__computer` | Click buttons, scroll, interact with portal UI |
| `mcp__claude-in-chrome__get_page_text` | Extract text content from portal pages |
| `mcp__claude-in-chrome__read_page` | Read structured page content |
| `mcp__claude-in-chrome__javascript_tool` | Execute JS for dynamic content extraction |
| `mcp__claude-in-chrome__tabs_create_mcp` | Open new tabs for multi-page workflows |
| `mcp__claude-in-chrome__tabs_context_mcp` | Track active tab context |
| `mcp__claude-in-chrome__gif_creator` | Record multi-step interactions for user review |
| `mcp__claude-in-chrome__read_console_messages` | Debug portal interaction issues |

---

## 4. ABHA/ABDM Background

### What is ABHA?

**Ayushman Bharat Health Account (ABHA)** is India's national digital health ID system under the **Ayushman Bharat Digital Mission (ABDM)**. Key concepts:

| Concept | Description |
|---------|-------------|
| **ABHA Number** | 14-digit unique health ID (e.g., 91-1234-5678-9012) created via Aadhaar or driving license |
| **ABHA Address** | User-friendly address (e.g., `username@abdm`) for sharing records |
| **Health Information Provider (HIP)** | Hospitals/labs/clinics that create and share health records |
| **Health Information User (HIU)** | Entities that request access to health records (with consent) |
| **Health Locker** | Personal health record storage linked to ABHA |
| **Consent Manager** | ABDM's consent framework — every data access requires explicit patient consent |
| **FHIR** | HL7 FHIR R4 standard used for health record interchange |

### ABHA Portal URLs

| Portal | URL | Purpose |
|--------|-----|---------|
| **ABHA Portal** | `https://abha.abdm.gov.in` | Main patient portal — login, view records, manage consents |
| **Health Locker** | `https://phr.abdm.gov.in` | Personal Health Records app (web version) |
| **ABHA Creation** | `https://abha.abdm.gov.in/abha/v3/register` | Create new ABHA number |
| **Facility Registry** | `https://facility.abdm.gov.in` | Find linked health facilities |

### Record Types in ABDM

| Record Type | FHIR Resource | Typical Source | Example |
|-------------|---------------|----------------|---------|
| **Prescription** | MedicationRequest | Hospital OPD, Clinic | Dr. visit medication list |
| **Diagnostic Report** | DiagnosticReport | Pathology lab | Blood test, urine test |
| **Discharge Summary** | Composition | Hospital IPD | Post-surgery discharge notes |
| **OP Consultation** | Encounter + Composition | Hospital OPD | Doctor consultation notes |
| **Immunization** | Immunization | PHC, vaccination center | COVID vaccine, flu shot |
| **Health Document** | DocumentReference | Any HIP | Generic health document |
| **Wellness Record** | Observation | Wellness app, fitness device | Vitals, BMI, activity data |

---

## 5. Local File Structure

### Directory Layout

```
~/health-records/
├── prescriptions/
│   ├── 2026-01-15_apollo-hospital-chennai_dr-sharma_antibiotics.pdf
│   ├── 2026-03-01_max-healthcare-delhi_dr-patel_bp-medication.pdf
│   └── ...
├── lab-reports/
│   ├── 2026-02-10_thyrocare_complete-blood-count.pdf
│   ├── 2026-03-20_dr-lal-pathlab_lipid-profile.pdf
│   └── ...
├── discharge-summaries/
│   └── 2025-12-05_fortis-gurugram_knee-surgery.pdf
├── op-consultations/
│   └── 2026-03-10_aiims-delhi_cardiology-followup.pdf
├── imaging/
│   ├── 2026-01-20_medanta_chest-xray.pdf
│   └── 2026-02-15_narayana-health_mri-knee.pdf
├── immunizations/
│   ├── 2025-08-15_govt-phc_covid-booster.pdf
│   └── 2026-01-10_apollo-clinic_flu-vaccine.pdf
├── wellness/
│   └── 2026-03-01_healthify_annual-health-checkup.pdf
├── insurance/
│   ├── policy-documents/
│   └── claim-records/
├── _summaries/
│   ├── health-timeline.md
│   ├── medication-list.md
│   ├── lab-trends.md
│   ├── allergy-and-conditions.md
│   ├── doctor-directory.md
│   └── consolidated-health-report.pdf
├── _audit/
│   ├── screenshots/
│   │   ├── 2026-03-24T10-30-00_login_otp-screen.png
│   │   ├── 2026-03-24T10-31-00_consent_apollo-request.png
│   │   └── ...
│   └── action-log.json
├── _config/
│   └── agent-config.json
└── manifest.json
```

### File Naming Convention

```
YYYY-MM-DD_facility-name_description.pdf
```

Rules:
- Date from the record itself (visit date), not download date
- Facility name normalized to lowercase-hyphenated
- Description is a brief, human-readable summary
- All names ASCII-safe (transliterated from regional languages if needed)
- Duplicates get a `-2`, `-3` suffix

### manifest.json Schema

```json
{
  "version": "1.0",
  "abha_number": "91-XXXX-XXXX-XXXX",
  "abha_address": "username@abdm",
  "vault_path": "~/health-records",
  "last_sync": "2026-03-24T10:30:00+05:30",
  "sync_history": [
    {
      "timestamp": "2026-03-24T10:30:00+05:30",
      "records_found": 12,
      "records_downloaded": 5,
      "records_skipped_duplicate": 7
    }
  ],
  "total_records": 23,
  "records": [
    {
      "id": "rec_001",
      "file_path": "prescriptions/2026-01-15_apollo-hospital-chennai_dr-sharma_antibiotics.pdf",
      "category": "prescription",
      "record_date": "2026-01-15",
      "download_date": "2026-03-24T10:25:00+05:30",
      "facility": {
        "name": "Apollo Hospital",
        "city": "Chennai",
        "hip_id": "IN3210000001"
      },
      "doctor": "Dr. Sharma",
      "tags": ["antibiotics", "throat-infection", "amoxicillin"],
      "abha_record_id": "abdm-record-uuid-here",
      "content_hash": "sha256:abc123...",
      "file_size_bytes": 245760,
      "parsed": true,
      "parsed_data": {
        "medications": ["Amoxicillin 500mg", "Paracetamol 650mg"],
        "diagnosis": "Acute pharyngitis",
        "follow_up": "2026-01-22"
      }
    }
  ],
  "facilities": [
    {
      "hip_id": "IN3210000001",
      "name": "Apollo Hospital",
      "city": "Chennai",
      "record_count": 5,
      "last_record_date": "2026-03-01"
    }
  ]
}
```

### agent-config.json Schema

```json
{
  "abha_number": "91-XXXX-XXXX-XXXX",
  "abha_address": "username@abdm",
  "vault_path": "~/health-records",
  "preferences": {
    "auto_categorize": true,
    "generate_summaries_after_sync": true,
    "screenshot_all_actions": true,
    "screenshot_auth_only": false,
    "encryption_enabled": false
  },
  "categories": [
    "prescriptions",
    "lab-reports",
    "discharge-summaries",
    "op-consultations",
    "imaging",
    "immunizations",
    "wellness",
    "insurance"
  ],
  "summary_types": [
    "health-timeline",
    "medication-list",
    "lab-trends",
    "allergy-and-conditions",
    "doctor-directory"
  ]
}
```

---

## 6. Core Workflows — Detailed Implementation

### 6.1 Workflow: ABHA Login & Session Management

```
┌─────────────────────────────────────────────────────────┐
│                    LOGIN FLOW                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Agent                          ABHA Portal             │
│  ──────                         ───────────             │
│  1. Open Chrome tab        ──>  Portal loads            │
│  2. Navigate to login      ──>  Login page              │
│  3. Enter ABHA number      ──>  OTP triggered           │
│  4. 📸 Screenshot                                        │
│  5. ⏸️ "Please enter OTP"                                │
│     ... user enters OTP ...                             │
│  6. Detect OTP entry       ──>  Dashboard loads         │
│  7. 📸 Screenshot dashboard                              │
│  8. Extract session info                                │
│  9. Log: "Authenticated at HH:MM"                       │
│                                                         │
│  SESSION KEEP-ALIVE:                                    │
│  - Monitor for session expiry redirects                 │
│  - If expired mid-operation: re-trigger login flow      │
│  - Resume from last checkpoint after re-auth            │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Tool: abha_login
const AbhaLoginSchema = z.object({
  abha_id: z.string().describe("ABHA number (14-digit) or ABHA address"),
});

async function abhaLogin(input: { abha_id: string }, context: AgentContext) {
  // Step 1: Open ABHA portal
  await context.useTool("mcp__claude-in-chrome__tabs_create_mcp", {
    url: "https://abha.abdm.gov.in"
  });

  // Step 2: Navigate to login
  await context.useTool("mcp__claude-in-chrome__navigate", {
    url: "https://abha.abdm.gov.in/abha/v3/login"
  });

  // Step 3: Enter ABHA number
  await context.useTool("mcp__claude-in-chrome__form_input", {
    selector: "input[placeholder*='ABHA']",
    value: input.abha_id
  });

  // Step 4: Click submit to trigger OTP
  await context.useTool("mcp__claude-in-chrome__computer", {
    action: "click",
    selector: "button[type='submit']"
  });

  // Step 5: Screenshot the OTP screen
  await captureAuditScreenshot(context, "login_otp-screen");

  // Step 6: PAUSE — return control to user for OTP entry
  return {
    status: "awaiting_otp",
    message: "I've navigated to the ABHA login page and entered your ABHA number. An OTP has been sent to your registered mobile. Please enter it in the browser, then tell me once you're logged in.",
    screenshot: "See browser window"
  };
}
```

### 6.2 Workflow: Health Record Discovery

```typescript
// Tool: abha_list_records
const AbhaListRecordsSchema = z.object({
  facility_filter: z.string().optional().describe("Filter by facility name"),
  date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
});

async function abhaListRecords(input: any, context: AgentContext) {
  // Navigate to records section
  await context.useTool("mcp__claude-in-chrome__navigate", {
    url: "https://abha.abdm.gov.in/abha/v3/health-records"
  });

  // Wait for records to load and extract page content
  const pageText = await context.useTool("mcp__claude-in-chrome__get_page_text", {});

  // Use Claude to parse the unstructured page text into structured records
  const records = await context.analyzeContent(pageText, {
    task: "Extract all health records listed on this page. For each record, identify: facility name, record type, date, doctor name if available.",
    output_format: "json"
  });

  // Load existing manifest to identify new vs existing records
  const manifest = await context.useTool("Read", {
    file_path: "~/health-records/manifest.json"
  });

  const existingHashes = manifest.records.map(r => r.abha_record_id);
  const newRecords = records.filter(r => !existingHashes.includes(r.id));

  return {
    total_found: records.length,
    new_records: newRecords.length,
    already_downloaded: records.length - newRecords.length,
    records: records,
    summary: `Found ${records.length} records across ${new Set(records.map(r => r.facility)).size} facilities. ${newRecords.length} are new since last sync.`
  };
}
```

### 6.3 Workflow: Record Download & Organization

```typescript
// Tool: abha_download_record
const AbhaDownloadRecordSchema = z.object({
  record_id: z.string().describe("ABHA record identifier"),
  record_type: z.string().describe("Type: prescription, lab-report, discharge-summary, etc."),
  facility_name: z.string().describe("Name of the health facility"),
  record_date: z.string().describe("Date of the record (YYYY-MM-DD)"),
});

async function abhaDownloadRecord(input: any, context: AgentContext) {
  // Click the download button for this specific record on the portal
  await context.useTool("mcp__claude-in-chrome__find", {
    text: input.record_id
  });

  await context.useTool("mcp__claude-in-chrome__computer", {
    action: "click",
    description: "Click download button for this record"
  });

  // Screenshot the download
  await captureAuditScreenshot(context, `download_${input.record_type}`);

  // Wait for download and locate the file
  const downloadedFile = await waitForDownload(context, {
    timeout_ms: 15000,
    expected_extension: ".pdf"
  });

  // Verify file integrity
  const fileStats = await context.useTool("Bash", {
    command: `wc -c "${downloadedFile}" && file "${downloadedFile}"`
  });

  if (fileStats.size === 0) {
    return { status: "error", message: "Downloaded file is empty. Retrying..." };
  }

  // Generate structured filename
  const facilitySlug = slugify(input.facility_name);
  const description = await generateDescription(context, downloadedFile);
  const newFilename = `${input.record_date}_${facilitySlug}_${description}.pdf`;

  // Categorize and move to appropriate folder
  const category = mapRecordTypeToCategory(input.record_type);
  const targetPath = `~/health-records/${category}/${newFilename}`;

  await context.useTool("Bash", {
    command: `mv "${downloadedFile}" "${targetPath}"`
  });

  // Compute content hash for deduplication
  const contentHash = await context.useTool("Bash", {
    command: `shasum -a 256 "${targetPath}" | cut -d' ' -f1`
  });

  // Update manifest
  await updateManifest(context, {
    id: generateRecordId(),
    file_path: `${category}/${newFilename}`,
    category: category,
    record_date: input.record_date,
    download_date: new Date().toISOString(),
    facility: { name: input.facility_name },
    abha_record_id: input.record_id,
    content_hash: `sha256:${contentHash}`,
    parsed: false
  });

  return {
    status: "downloaded",
    file: targetPath,
    category: category,
    content_hash: contentHash
  };
}
```

### 6.4 Workflow: Record Parsing & Data Extraction

```typescript
// Tool: parse_health_record
const ParseHealthRecordSchema = z.object({
  file_path: z.string().describe("Path to the health record PDF"),
  category: z.string().describe("Record category for context-aware parsing"),
});

async function parseHealthRecord(input: any, context: AgentContext) {
  // Extract text from PDF
  const pdfText = await extractPdfText(input.file_path);

  // If text extraction yields little content, fall back to OCR
  if (pdfText.length < 50) {
    const ocrText = await runOcr(input.file_path);
    pdfText = ocrText;
  }

  // Category-specific parsing prompts
  const parsingPrompts = {
    "prescriptions": `Extract from this prescription:
      - Doctor name and specialization
      - Medications (name, dosage, frequency, duration)
      - Diagnosis/condition
      - Follow-up date if mentioned
      - Any warnings or special instructions`,

    "lab-reports": `Extract from this lab report:
      - Test name and type
      - All parameters with values, units, and reference ranges
      - Flag any values outside normal range
      - Lab name and collection date
      - Ordering doctor if mentioned`,

    "discharge-summaries": `Extract from this discharge summary:
      - Admission and discharge dates
      - Primary diagnosis and procedures performed
      - Medications at discharge
      - Follow-up instructions
      - Treating doctor and department`,

    "imaging": `Extract from this imaging report:
      - Study type (X-ray, MRI, CT, USG, etc.)
      - Body part examined
      - Key findings
      - Impression/conclusion
      - Radiologist name`,

    "immunizations": `Extract from this immunization record:
      - Vaccine name and type
      - Dose number (1st, 2nd, booster)
      - Date administered
      - Batch/lot number if available
      - Next dose due date if applicable`,
  };

  const prompt = parsingPrompts[input.category] || "Extract all structured data from this health record.";

  // Use Claude to parse the record
  const parsedData = await context.analyzeContent(pdfText, {
    task: prompt,
    output_format: "json"
  });

  // Update manifest with parsed data
  await updateManifestRecord(context, input.file_path, {
    parsed: true,
    parsed_data: parsedData,
    language: detectLanguage(pdfText),
    tags: generateTags(parsedData)
  });

  return {
    status: "parsed",
    file: input.file_path,
    data: parsedData,
    tags: generateTags(parsedData)
  };
}
```

### 6.5 Workflow: Health Summary Generation

```typescript
// Tool: generate_health_summary
const GenerateHealthSummarySchema = z.object({
  summary_type: z.enum([
    "health-timeline",
    "medication-list",
    "lab-trends",
    "allergy-and-conditions",
    "doctor-directory",
    "consolidated-report"
  ]).describe("Type of summary to generate"),
});

async function generateHealthSummary(input: any, context: AgentContext) {
  // Load all parsed records from manifest
  const manifest = await loadManifest(context);
  const parsedRecords = manifest.records.filter(r => r.parsed);

  switch (input.summary_type) {
    case "health-timeline":
      return generateTimeline(context, parsedRecords);
    case "medication-list":
      return generateMedicationList(context, parsedRecords);
    case "lab-trends":
      return generateLabTrends(context, parsedRecords);
    case "allergy-and-conditions":
      return generateAllergyList(context, parsedRecords);
    case "doctor-directory":
      return generateDoctorDirectory(context, parsedRecords);
    case "consolidated-report":
      return generateConsolidatedPdf(context, parsedRecords);
  }
}
```

**Health Timeline Output Example (`_summaries/health-timeline.md`):**

```markdown
# Health Timeline

*Generated: 2026-03-24 | Records analyzed: 23*

## 2026

### March 2026
- **Mar 20** — Lab Report @ Dr. Lal PathLab
  Lipid Profile: Total Cholesterol 210 mg/dL (⚠️ borderline high), LDL 140 mg/dL (⚠️ high)
- **Mar 10** — OP Consultation @ AIIMS Delhi
  Cardiology follow-up with Dr. Reddy. BP: 130/85. Medication adjusted.
- **Mar 01** — Prescription @ Max Healthcare Delhi
  Dr. Patel — BP medication: Amlodipine 5mg daily, Telmisartan 40mg daily

### February 2026
- **Feb 15** — Imaging @ Narayana Health
  MRI Knee — Mild meniscal tear, conservative management recommended
- **Feb 10** — Lab Report @ Thyrocare
  CBC: All values normal. HbA1c: 5.8% (normal)

### January 2026
- **Jan 20** — Imaging @ Medanta
  Chest X-ray — NAD (No Abnormality Detected)
- **Jan 15** — Prescription @ Apollo Hospital Chennai
  Dr. Sharma — Antibiotics for acute pharyngitis: Amoxicillin 500mg x 5 days
- **Jan 10** — Immunization @ Apollo Clinic
  Flu vaccine (Quadrivalent) — 2025-26 season

## 2025

### December 2025
- **Dec 05** — Discharge Summary @ Fortis Gurugram
  Knee arthroscopy. Admitted Dec 03, discharged Dec 05.
  Discharge meds: Etoricoxib 90mg x 7 days, Physiotherapy referral

...
```

**Medication List Output Example (`_summaries/medication-list.md`):**

```markdown
# Current & Past Medications

*Generated: 2026-03-24 | Based on 23 parsed records*

## Currently Active
| Medication | Dosage | Frequency | Prescribed By | Since | Source Record |
|-----------|--------|-----------|---------------|-------|--------------|
| Amlodipine | 5mg | Once daily | Dr. Patel, Max Healthcare | 2026-03-01 | prescriptions/2026-03-01_max-healthcare... |
| Telmisartan | 40mg | Once daily | Dr. Patel, Max Healthcare | 2026-03-01 | prescriptions/2026-03-01_max-healthcare... |

## Past (Completed Courses)
| Medication | Dosage | Duration | Prescribed For | Source Record |
|-----------|--------|----------|---------------|--------------|
| Amoxicillin | 500mg TID | 5 days (Jan 15-20, 2026) | Acute pharyngitis | prescriptions/2026-01-15_apollo... |
| Etoricoxib | 90mg OD | 7 days (Dec 05-12, 2025) | Post-arthroscopy pain | discharge-summaries/2025-12-05... |

## Allergies & Contraindications
- No known drug allergies recorded (⚠️ confirm with doctor)
```

### 6.6 Workflow: Consent Management

```typescript
// Tool: abha_list_consents
async function abhaListConsents(context: AgentContext) {
  await context.useTool("mcp__claude-in-chrome__navigate", {
    url: "https://abha.abdm.gov.in/abha/v3/consents"
  });

  const pageText = await context.useTool("mcp__claude-in-chrome__get_page_text", {});

  const consents = await context.analyzeContent(pageText, {
    task: "Extract all consent requests: requester name, requested data types, date range, purpose, status (pending/approved/denied/expired)",
    output_format: "json"
  });

  return consents;
}

// Tool: abha_manage_consent
const AbhaManageConsentSchema = z.object({
  consent_id: z.string().describe("Consent request identifier"),
  action: z.enum(["approve", "deny"]).describe("User's decision"),
});

async function abhaManageConsent(input: any, context: AgentContext) {
  // Screenshot BEFORE action
  await captureAuditScreenshot(context, `consent_before_${input.consent_id}`);

  // This is a human-gated operation — the agent should have already
  // presented the consent details and received user confirmation
  // before this tool is called

  // Find and click the appropriate button
  await context.useTool("mcp__claude-in-chrome__find", {
    text: input.action === "approve" ? "Approve" : "Deny"
  });

  await context.useTool("mcp__claude-in-chrome__computer", {
    action: "click",
    description: `Click ${input.action} button for consent ${input.consent_id}`
  });

  // Screenshot AFTER action
  await captureAuditScreenshot(context, `consent_after_${input.consent_id}_${input.action}`);

  // Log to audit trail
  await appendAuditLog(context, {
    action: `consent_${input.action}`,
    consent_id: input.consent_id,
    timestamp: new Date().toISOString(),
    screenshots: [
      `consent_before_${input.consent_id}`,
      `consent_after_${input.consent_id}_${input.action}`
    ]
  });

  return {
    status: input.action === "approve" ? "approved" : "denied",
    consent_id: input.consent_id,
    audit_logged: true
  };
}
```

### 6.7 Workflow: Profile Management

```typescript
// Tool: abha_view_profile
async function abhaViewProfile(context: AgentContext) {
  await context.useTool("mcp__claude-in-chrome__navigate", {
    url: "https://abha.abdm.gov.in/abha/v3/profile"
  });

  const pageText = await context.useTool("mcp__claude-in-chrome__get_page_text", {});

  const profile = await context.analyzeContent(pageText, {
    task: "Extract ABHA profile details: name, ABHA number, ABHA address, mobile number, email, date of birth, gender, linked facilities list",
    output_format: "json"
  });

  return profile;
}

// Tool: abha_link_facility
const AbhaLinkFacilitySchema = z.object({
  facility_name: z.string().describe("Name or ID of the health facility to link"),
});

async function abhaLinkFacility(input: any, context: AgentContext) {
  // Navigate to facility linking section
  await context.useTool("mcp__claude-in-chrome__navigate", {
    url: "https://abha.abdm.gov.in/abha/v3/link-facility"
  });

  // Search for facility
  await context.useTool("mcp__claude-in-chrome__form_input", {
    selector: "input[placeholder*='facility']",
    value: input.facility_name
  });

  // Screenshot before linking
  await captureAuditScreenshot(context, `link_facility_${slugify(input.facility_name)}`);

  // PAUSE — this modifies the ABHA profile
  return {
    status: "awaiting_confirmation",
    message: `Found facility "${input.facility_name}". Linking this will allow the facility to share your health records via ABHA. Confirm?`,
    screenshot: "See browser window"
  };
}
```

---

## 7. Audit Trail & Screenshot System

### Action Log Schema (`_audit/action-log.json`)

```json
{
  "version": "1.0",
  "entries": [
    {
      "id": "act_001",
      "timestamp": "2026-03-24T10:30:15+05:30",
      "action": "login_initiated",
      "details": {
        "abha_id": "91-XXXX-XXXX-XXXX",
        "portal_url": "https://abha.abdm.gov.in/abha/v3/login"
      },
      "screenshot": "2026-03-24T10-30-15_login_otp-screen.png",
      "human_gate": true,
      "human_action": "entered_otp"
    },
    {
      "id": "act_002",
      "timestamp": "2026-03-24T10:31:00+05:30",
      "action": "login_success",
      "details": {
        "session_started": true
      },
      "screenshot": "2026-03-24T10-31-00_login_dashboard.png",
      "human_gate": false
    },
    {
      "id": "act_003",
      "timestamp": "2026-03-24T10:32:00+05:30",
      "action": "record_download",
      "details": {
        "record_id": "abdm-uuid-123",
        "facility": "Apollo Hospital Chennai",
        "category": "prescription",
        "file_saved": "prescriptions/2026-01-15_apollo-hospital-chennai_dr-sharma_antibiotics.pdf"
      },
      "screenshot": "2026-03-24T10-32-00_download_prescription.png",
      "human_gate": false
    },
    {
      "id": "act_004",
      "timestamp": "2026-03-24T10:35:00+05:30",
      "action": "consent_approved",
      "details": {
        "consent_id": "consent-uuid-456",
        "requester": "Max Healthcare",
        "data_requested": "Prescriptions, Lab Reports",
        "date_range": "2025-01-01 to 2026-03-24"
      },
      "screenshot": "2026-03-24T10-35-00_consent_after_consent-uuid-456_approve.png",
      "human_gate": true,
      "human_action": "approved"
    }
  ]
}
```

### Screenshot Capture Implementation

```typescript
async function captureAuditScreenshot(
  context: AgentContext,
  label: string
): Promise<string> {
  const timestamp = dayjs().format("YYYY-MM-DDTHH-mm-ss");
  const filename = `${timestamp}_${label}.png`;
  const filepath = `~/health-records/_audit/screenshots/${filename}`;

  // Use MCP Chrome to capture the current browser state
  await context.useTool("mcp__claude-in-chrome__computer", {
    action: "screenshot"
  });

  // The screenshot is captured by the browser extension
  // Move/save it to the audit folder
  await context.useTool("Bash", {
    command: `mv /tmp/latest-screenshot.png "${filepath}"`
  });

  return filename;
}
```

### Audit Integrity

- **Append-only** — the agent never modifies or deletes past audit entries
- **Sequential IDs** — `act_001`, `act_002`, etc. — gaps indicate tampering
- **Timestamps** — ISO 8601 with timezone, monotonically increasing
- **Screenshot linked** — every sensitive action has a corresponding screenshot
- **Human gates flagged** — clear record of which actions required human confirmation

---

## 8. Error Handling & Recovery

### Browser Automation Challenges

| Scenario | Detection | Strategy |
|----------|-----------|----------|
| **Portal redesign / DOM changes** | Element not found after 3 attempts | Fall back to text-based search (`find` tool), screenshot for debugging, notify user |
| **OTP timeout** | "OTP expired" text detected on page | Notify user, offer to re-trigger OTP |
| **Session expiry** | Redirect to login page detected | Re-trigger login flow, resume from last checkpoint |
| **Download failure** | File size = 0 or missing PDF header | Retry up to 3 times with 5s delay, then skip and flag |
| **CAPTCHA** | Image/challenge element detected | Screenshot + pause for human to solve |
| **Portal maintenance** | "Under maintenance" or 5xx page | Notify user, suggest retry time if displayed |
| **Slow page load** | Page content empty after 30s | Refresh once, then notify user |
| **Network failure** | Navigation timeout | Check connectivity, retry once, then pause |
| **Rate limiting** | 429 response or "too many requests" | Back off exponentially (30s, 60s, 120s), then pause |
| **Regional language UI** | Unexpected text on portal | Use Claude's multilingual capability to interpret, continue |

### Checkpoint & Resume

For long-running sync operations (many records), the agent maintains checkpoints:

```json
{
  "operation": "full_sync",
  "started_at": "2026-03-24T10:30:00+05:30",
  "status": "in_progress",
  "total_records": 47,
  "processed": 23,
  "last_processed_id": "abdm-uuid-023",
  "failed": [
    {
      "record_id": "abdm-uuid-015",
      "error": "Download timeout after 3 retries",
      "timestamp": "2026-03-24T10:38:00+05:30"
    }
  ]
}
```

If the agent is interrupted (session expiry, user stops it), it can resume from the last checkpoint on the next run.

### Deduplication Logic

```typescript
async function checkDuplicate(
  newRecord: { content_hash: string; abha_record_id: string; record_date: string; facility: string },
  manifest: Manifest
): Promise<{ isDuplicate: boolean; existingRecord?: ManifestRecord }> {
  // Strategy 1: Exact match on ABHA record ID
  const idMatch = manifest.records.find(r => r.abha_record_id === newRecord.abha_record_id);
  if (idMatch) return { isDuplicate: true, existingRecord: idMatch };

  // Strategy 2: Content hash match (same file from different download)
  const hashMatch = manifest.records.find(r => r.content_hash === newRecord.content_hash);
  if (hashMatch) return { isDuplicate: true, existingRecord: hashMatch };

  // Strategy 3: Same facility + same date + same category (likely duplicate)
  const fuzzyMatch = manifest.records.find(r =>
    r.facility.name === newRecord.facility &&
    r.record_date === newRecord.record_date &&
    r.category === categorize(newRecord)
  );
  if (fuzzyMatch) {
    // Flag for user review rather than auto-dedup
    return { isDuplicate: false, existingRecord: fuzzyMatch };
  }

  return { isDuplicate: false };
}
```

---

## 9. Security Considerations

### Data Privacy

| Principle | Implementation |
|-----------|---------------|
| **Zero cloud transmission** | All health data stays on local machine. No records uploaded to any external service. |
| **No credential storage** | ABHA credentials never saved. OTP entered by user each session. |
| **Local-only processing** | PDF parsing, OCR, categorization — all done locally. |
| **Claude API calls** | Only text content sent to Claude API for analysis (no raw PDFs). User can review what's sent. |
| **Optional encryption** | AES-256-GCM encryption for the vault, activated with user's passphrase. |

### Encryption Implementation (Optional)

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function encryptFile(filePath: string, passphrase: string): void {
  const key = crypto.scryptSync(passphrase, "abha-health-vault", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const input = fs.readFileSync(filePath);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Write: IV (16) + AuthTag (16) + Encrypted data
  const output = Buffer.concat([iv, authTag, encrypted]);
  fs.writeFileSync(filePath + ".enc", output);
  fs.unlinkSync(filePath); // Remove unencrypted original
}

function decryptFile(filePath: string, passphrase: string): Buffer {
  const key = crypto.scryptSync(passphrase, "abha-health-vault", 32);
  const data = fs.readFileSync(filePath);

  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
```

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Malicious portal impersonation** | Agent only navigates to known ABDM domains (allowlist: `*.abdm.gov.in`) |
| **Session hijacking** | Sessions exist only in browser, not stored by agent. Cleared on close. |
| **Local file access** | Standard OS file permissions. Optional encryption adds defense-in-depth. |
| **Audit log tampering** | Append-only log. Consider signing entries with HMAC if high-assurance needed. |
| **Screen recording exposure** | Screenshots contain PHI — stored in `_audit/` with same permissions as records |
| **Claude API data leakage** | Only extracted text (not raw files) sent to API. User can audit via action log. |

---

## 10. Example User Interactions

### Example 1: First-Time Setup & Full Sync

```
User: "Set up my health records. My ABHA number is 91-1234-5678-9012."

Agent: I'll set up your health records vault and sync from ABHA. Let me:
       1. Create the folder structure at ~/health-records/
       2. Save your config
       3. Log into the ABHA portal

       Creating folders...
       ✅ Created ~/health-records/ with all category folders
       ✅ Saved config to ~/health-records/_config/agent-config.json
       ✅ Initialized empty manifest.json

       Now opening the ABHA portal in Chrome...
       📸 [Screenshot: ABHA login page with ABHA number entered]

       I've entered your ABHA number. An OTP has been sent to your
       registered mobile. Please enter it in the browser window.

User: "Done, I'm logged in."

Agent: 📸 [Screenshot: ABHA dashboard]
       ✅ Logged in successfully. Browsing your health records...

       Found 23 records across 6 facilities:
       ┌────────────────────────┬────────────┬───────┐
       │ Facility               │ Records    │ Type  │
       ├────────────────────────┼────────────┼───────┤
       │ Apollo Hospital Chennai│ 5          │ Mixed │
       │ Max Healthcare Delhi   │ 4          │ Mixed │
       │ Dr. Lal PathLab        │ 6          │ Labs  │
       │ Thyrocare              │ 3          │ Labs  │
       │ Fortis Gurugram        │ 2          │ Mixed │
       │ AIIMS Delhi            │ 3          │ Mixed │
       └────────────────────────┴────────────┴───────┘

       Download all 23 records? Or would you like to pick specific ones?

User: "Download all."

Agent: Downloading... this will take a few minutes.

       ⬇️  [1/23] Prescription from Apollo Hospital — 2026-01-15
       ⬇️  [2/23] Lab report from Thyrocare — 2026-02-10
       ⬇️  [3/23] Chest X-ray from Medanta — 2026-01-20
       ...
       ⬇️  [23/23] Immunization from Apollo Clinic — 2026-01-10

       ✅ All 23 records downloaded and organized.

       📁 Records organized into:
       - prescriptions/ (5 files)
       - lab-reports/ (9 files)
       - discharge-summaries/ (2 files)
       - op-consultations/ (3 files)
       - imaging/ (2 files)
       - immunizations/ (2 files)

       Generating health summaries...
       ✅ Health timeline generated → _summaries/health-timeline.md
       ✅ Medication list generated → _summaries/medication-list.md
       ✅ Lab trends generated → _summaries/lab-trends.md
       ✅ Consolidated report → _summaries/consolidated-health-report.pdf

       Your health records vault is ready at ~/health-records/
```

### Example 2: Incremental Sync

```
User: "Sync my ABHA records."

Agent: Opening ABHA portal... 📸
       Please enter the OTP sent to your mobile.

User: "Done."

Agent: ✅ Logged in. Checking for new records since last sync (2026-03-20)...

       Found 2 new records:
       1. Lab Report — Dr. Lal PathLab — Lipid Profile (2026-03-22)
       2. Prescription — Max Healthcare — Dr. Gupta (2026-03-23)

       Downloading...
       ⬇️  [1/2] Lipid Profile → lab-reports/2026-03-22_dr-lal-pathlab_lipid-profile.pdf
       ⬇️  [2/2] Prescription → prescriptions/2026-03-23_max-healthcare_dr-gupta_statin.pdf

       ✅ Synced. Updating summaries...

       📊 Lab trend update: Your LDL cholesterol dropped from 140 → 125 mg/dL
          since the last test. Still above target (< 100), but improving.

       💊 New medication: Atorvastatin 10mg added to your active medications list.
```

### Example 3: Doctor Visit Preparation

```
User: "I have a cardiology appointment tomorrow. Prepare my records."

Agent: I'll prepare a cardiology-focused summary from your records.

       Searching your vault for cardiology-relevant records...

       Found 8 relevant records:
       - 3 OP consultations (cardiology)
       - 2 lab reports (lipid profiles)
       - 1 imaging (chest X-ray)
       - 2 prescriptions (BP + statin medications)

       Generating cardiology visit summary...
       ✅ Saved to ~/health-records/_summaries/cardiology-visit-prep-2026-03-25.pdf

       Summary includes:
       📋 Current medications: Amlodipine 5mg, Telmisartan 40mg, Atorvastatin 10mg
       📈 BP trend: 145/95 (Jan) → 135/88 (Feb) → 130/85 (Mar) — improving
       📈 Lipid trend: LDL 165 (Dec) → 140 (Feb) → 125 (Mar) — improving
       🫁 Chest X-ray (Jan): NAD
       📅 Last cardiology visit: 2026-03-10 at AIIMS Delhi

       Would you like me to open the PDF?
```

### Example 4: Insurance Claim Preparation

```
User: "I need to file an insurance claim for my knee surgery at Fortis in December."

Agent: I'll gather all records related to your Fortis knee surgery for the insurance claim.

       Searching vault for Fortis Gurugram records around December 2025...

       Found relevant records:
       1. Discharge Summary — 2025-12-05 (knee arthroscopy)
       2. Pre-admission lab reports — 2025-12-02
       3. Imaging — MRI Knee — 2025-11-28
       4. OP Consultation — Orthopedics — 2025-11-20

       Creating insurance claim package...
       ✅ Saved to ~/health-records/insurance/claim-records/2025-12-fortis-knee-surgery/

       Package contains:
       📄 discharge-summary.pdf
       📄 pre-admission-labs.pdf
       📄 mri-report.pdf
       📄 initial-consultation.pdf
       📄 claim-summary.pdf (generated — includes timeline, diagnosis, procedure details)

       The claim-summary.pdf has all details your insurer typically needs:
       - Patient details (from ABHA profile)
       - Hospital: Fortis Gurugram
       - Admission: 2025-12-03, Discharge: 2025-12-05
       - Procedure: Knee arthroscopy (right knee)
       - Diagnosis: Medial meniscal tear
       - All supporting documents listed
```

### Example 5: Consent Management

```
User: "Check if there are any pending consent requests on my ABHA."

Agent: Opening ABHA portal consent section... 📸
       Please enter OTP.

User: "Done."

Agent: ✅ Logged in. Checking consents...

       Found 2 pending consent requests:

       1️⃣  Max Healthcare Delhi
          Requesting: Prescriptions, Lab Reports
          Date range: 2025-01-01 to 2026-03-24
          Purpose: "Continuity of care — cardiology follow-up"
          Requested: 2026-03-22

       2️⃣  Star Health Insurance
          Requesting: Discharge Summaries, Lab Reports, Prescriptions
          Date range: 2024-01-01 to 2026-03-24
          Purpose: "Insurance claim processing"
          Requested: 2026-03-20

       Would you like to approve or deny either of these?

User: "Approve Max Healthcare, deny the insurance one."

Agent: 📸 [Screenshot: Consent screen for Max Healthcare]
       ✅ Approved consent for Max Healthcare — cardiology follow-up
       📸 [Screenshot: Consent confirmation]

       📸 [Screenshot: Consent screen for Star Health Insurance]
       ✅ Denied consent for Star Health Insurance
       📸 [Screenshot: Denial confirmation]

       Both actions logged to audit trail with screenshots.
```

---

## 11. Data Model

### Core Types

```typescript
// Record in the local vault
interface HealthRecord {
  id: string;                          // rec_001, rec_002, ...
  file_path: string;                   // Relative to vault root
  category: RecordCategory;
  record_date: string;                 // ISO date from the record itself
  download_date: string;               // ISO datetime when downloaded
  facility: Facility;
  doctor?: string;
  tags: string[];
  abha_record_id: string;             // ID from ABDM portal
  content_hash: string;               // sha256:... for dedup
  file_size_bytes: number;
  parsed: boolean;
  parsed_data?: ParsedRecordData;
  language?: string;                   // "en", "hi", "ta", etc.
}

type RecordCategory =
  | "prescriptions"
  | "lab-reports"
  | "discharge-summaries"
  | "op-consultations"
  | "imaging"
  | "immunizations"
  | "wellness"
  | "insurance";

interface Facility {
  name: string;
  city?: string;
  hip_id?: string;                     // ABDM Health Information Provider ID
  record_count?: number;
  last_record_date?: string;
}

// Parsed data varies by category
type ParsedRecordData =
  | PrescriptionData
  | LabReportData
  | DischargeSummaryData
  | ImagingData
  | ImmunizationData;

interface PrescriptionData {
  type: "prescription";
  doctor: string;
  specialization?: string;
  medications: Medication[];
  diagnosis?: string;
  follow_up_date?: string;
  instructions?: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  route?: string;                      // oral, topical, IV, etc.
}

interface LabReportData {
  type: "lab-report";
  test_name: string;
  lab_name: string;
  collection_date: string;
  ordering_doctor?: string;
  parameters: LabParameter[];
}

interface LabParameter {
  name: string;
  value: number | string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
  flag?: "high" | "low" | "critical";
}

interface DischargeSummaryData {
  type: "discharge-summary";
  admission_date: string;
  discharge_date: string;
  primary_diagnosis: string;
  procedures: string[];
  discharge_medications: Medication[];
  follow_up_instructions: string;
  treating_doctor: string;
  department: string;
}

interface ImagingData {
  type: "imaging";
  study_type: string;                  // X-ray, MRI, CT, USG
  body_part: string;
  findings: string;
  impression: string;
  radiologist?: string;
}

interface ImmunizationData {
  type: "immunization";
  vaccine_name: string;
  dose_number: string;                 // "1st", "2nd", "Booster"
  batch_number?: string;
  next_dose_date?: string;
}

// Manifest — the index of all records in the vault
interface Manifest {
  version: string;
  abha_number: string;
  abha_address: string;
  vault_path: string;
  last_sync: string;
  sync_history: SyncEntry[];
  total_records: number;
  records: HealthRecord[];
  facilities: Facility[];
}

interface SyncEntry {
  timestamp: string;
  records_found: number;
  records_downloaded: number;
  records_skipped_duplicate: number;
}

// Audit trail
interface AuditEntry {
  id: string;                          // act_001, act_002, ...
  timestamp: string;                   // ISO 8601 with timezone
  action: AuditAction;
  details: Record<string, any>;
  screenshot?: string;                 // Filename in _audit/screenshots/
  human_gate: boolean;
  human_action?: string;
}

type AuditAction =
  | "login_initiated"
  | "login_success"
  | "login_failed"
  | "record_listed"
  | "record_download"
  | "record_download_failed"
  | "record_parsed"
  | "record_categorized"
  | "consent_listed"
  | "consent_approved"
  | "consent_denied"
  | "profile_viewed"
  | "profile_modified"
  | "facility_linked"
  | "facility_unlinked"
  | "summary_generated"
  | "vault_encrypted"
  | "vault_decrypted";
```

---

## 12. Development Roadmap

### Phase 1: Foundation (Week 1-2)
| Task | Description | Priority |
|------|-------------|----------|
| Project scaffolding | TypeScript project, Agent SDK setup, MCP Chrome connection | P0 |
| Vault initialization | Create folder structure, manifest.json, agent-config.json | P0 |
| ABHA login flow | Browser automation for login, OTP pause, session detection | P0 |
| Screenshot & audit | Capture screenshots, append-only action log | P0 |
| Basic error handling | Session expiry detection, retry logic | P0 |

### Phase 2: Core Record Management (Week 3-4)
| Task | Description | Priority |
|------|-------------|----------|
| Record discovery | Browse ABHA portal, list records by facility | P0 |
| Record download | Download PDFs, verify integrity, save to vault | P0 |
| File organization | Auto-categorize, rename with convention, move to folders | P0 |
| Manifest management | Update manifest on every operation, deduplication | P0 |
| Incremental sync | Only download new records since last sync | P1 |

### Phase 3: Intelligence Layer (Week 5-6)
| Task | Description | Priority |
|------|-------------|----------|
| PDF text extraction | Parse downloaded records, handle scanned docs via OCR | P0 |
| Category-specific parsing | Extract medications, lab values, diagnoses, etc. | P0 |
| Health timeline | Generate chronological health history | P1 |
| Medication list | Active/past medications from all prescriptions | P1 |
| Lab trends | Track values over time, flag abnormalities | P1 |
| Consolidated PDF report | Exportable health summary | P1 |

### Phase 4: Advanced Features (Week 7-8)
| Task | Description | Priority |
|------|-------------|----------|
| Consent management | List, approve/deny consent requests with human gate | P1 |
| Profile management | View/update ABHA profile, link/unlink facilities | P1 |
| Doctor visit prep | Generate specialty-focused summaries on demand | P2 |
| Insurance claim prep | Gather and package records for insurance claims | P2 |
| Optional encryption | AES-256 vault encryption with user passphrase | P2 |
| Checkpoint & resume | Resume interrupted sync operations | P2 |

### Phase 5: Polish & Hardening (Week 9-10)
| Task | Description | Priority |
|------|-------------|----------|
| Portal change resilience | Semantic selectors, fallback strategies | P1 |
| Multi-language support | Handle records in Hindi, Tamil, Telugu, etc. | P2 |
| Bulk processing | Handle 100+ records efficiently with progress updates | P2 |
| GIF recording | Record complex multi-step interactions for user review | P2 |
| User onboarding flow | Guided first-run experience | P2 |

---

## 13. Cost Estimates

### Claude API Usage Per Sync

| Operation | Model | Tokens (est.) | Cost (est.) |
|-----------|-------|---------------|-------------|
| Portal navigation decisions (per page) | Haiku | ~500 input + 200 output | ~$0.001 |
| Record listing & parsing portal text | Sonnet | ~2,000 input + 500 output | ~$0.01 |
| Per record: PDF text analysis | Sonnet | ~3,000 input + 1,000 output | ~$0.015 |
| Health summary generation | Opus | ~10,000 input + 3,000 output | ~$0.20 |
| Consent analysis | Sonnet | ~1,500 input + 500 output | ~$0.01 |

**Typical first-time sync (25 records):**
- Navigation + discovery: ~$0.05
- Download & categorize (25 records): ~$0.15
- Parse all records: ~$0.40
- Generate summaries: ~$0.60
- **Total: ~$1.20**

**Incremental sync (2-3 new records):**
- Navigation + discovery: ~$0.03
- Download & categorize: ~$0.02
- Parse new records: ~$0.05
- Update summaries: ~$0.20
- **Total: ~$0.30**

### Local Resource Usage

| Resource | Requirement |
|----------|------------|
| **Disk space** | ~50MB per 100 records (PDFs + screenshots + summaries) |
| **Memory** | ~200MB for PDF parsing + OCR, standard for Chrome automation |
| **Network** | ABHA portal bandwidth only — no additional cloud services |
| **Chrome** | Must be running with Claude-in-Chrome extension installed |

---

## 14. Getting Started — Quick Setup

### Prerequisites

```bash
# 1. Claude Code CLI installed and authenticated
claude --version

# 2. Chrome browser with Claude-in-Chrome MCP extension
# Install from: Chrome Web Store > Claude-in-Chrome

# 3. Node.js 18+ (for PDF parsing and OCR)
node --version
```

### First Run

```bash
# Start Claude Code and ask the agent to set up
claude

> "Set up my health records vault. My ABHA number is 91-XXXX-XXXX-XXXX."
```

The agent will:
1. Create `~/health-records/` directory structure
2. Initialize `manifest.json` and `agent-config.json`
3. Open Chrome and navigate to the ABHA portal
4. Guide you through OTP login
5. Discover and download your records
6. Organize everything and generate initial summaries

### Subsequent Runs

```bash
claude

> "Sync my health records."        # Incremental sync
> "Show my medication list."       # View summary
> "Prepare for my doctor visit."   # Generate visit prep
> "Check ABHA consents."           # Consent management
```

---

## 15. Integration with Other Agents

### Statutory Compliance Calendar Agent

If used by a healthcare provider or small clinic, this agent's record-keeping could feed into the Statutory Compliance Calendar Agent:
- Patient record counts for regulatory reporting
- Consent audit logs for ABDM compliance reviews

### Personal Accounting Agent

Health expense tracking integration:
- Medical bill amounts extracted from discharge summaries
- Insurance claim amounts and status
- Out-of-pocket medication expenses from prescriptions
- Tax-saving health expense aggregation (Section 80D)

---

## 16. ABDM API Reference (Future Enhancement)

When ABDM sandbox/production API access is obtained, these endpoints can supplement browser automation:

| API Category | Endpoint | Purpose |
|-------------|----------|---------|
| **ABHA Registration** | `POST /v3/enrollment/request/otp` | Initiate ABHA creation |
| **Authentication** | `POST /v3/profile/login/request/otp` | Login via OTP |
| **Profile** | `GET /v3/profile/account` | Fetch ABHA profile |
| **Health Locker** | `GET /v1/phr/health-locker/records` | List health records |
| **Consent** | `GET /v1/consent-requests` | List consent requests |
| **Consent** | `POST /v1/consent-requests/{id}/approve` | Approve consent |
| **Facility** | `GET /v1/facility/search` | Search health facilities |

**Note:** ABDM APIs require HIU (Health Information User) registration. For an individual-use local agent, browser automation is the practical approach. API integration is documented here for when programmatic access becomes available.

### ABDM Sandbox

For development and testing:
- Sandbox URL: `https://dev.abdm.gov.in`
- Documentation: `https://sandbox.abdm.gov.in/docs`
- Test ABHA numbers available in sandbox environment

---

## 17. References

- [ABDM Official Portal](https://abdm.gov.in) — Ayushman Bharat Digital Mission
- [ABHA Portal](https://abha.abdm.gov.in) — Patient-facing ABHA management
- [ABDM Sandbox](https://sandbox.abdm.gov.in) — Developer sandbox for ABDM APIs
- [ABDM Health Data Specification](https://nrces.in/ndhm/fhir/r4/index.html) — FHIR R4 profiles for India
- [National Health Authority](https://nha.gov.in) — Governing body for ABDM
- [Claude Agent SDK Documentation](https://docs.anthropic.com/en/docs/agents) — Agent SDK reference
- [Deep Agent Infrastructure Playbook](deep-agent-infrastructure-playbook.md) — Shared infrastructure patterns for all agents in this repository
