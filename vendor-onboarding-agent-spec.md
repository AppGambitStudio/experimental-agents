# Deep Agent for Vendor Onboarding (India) — Research Document

## Overview

This document outlines how to build a **Vendor Onboarding Agent** using the **Claude Agent SDK**. The agent autonomously handles the complete vendor onboarding lifecycle for Indian businesses — from initial request and document collection, through real-time government API validation (GSTIN, PAN, Udyam, MCA, Bank), compliance screening, risk scoring, multi-level approval workflows, and ERP master creation. What typically takes procurement teams 3-7 business days becomes a same-day, zero-error process.

---

## 1. Why This Agent Is Needed

### The Problem

Vendor onboarding in Indian enterprises is broken:

| Pain Point | Detail |
|------------|--------|
| **3-7 day cycle time** | Procurement teams manually collect documents, verify registrations, and chase vendors for missing information |
| **30+ data points to verify** | GSTIN, PAN, MSME/Udyam, CIN, bank account, TDS applicability, HSN/SAC codes, FSSAI, Drug License, IEC, etc. |
| **Manual government portal checks** | Staff log into gst.gov.in, mca.gov.in, udyamregistration.gov.in separately to validate each vendor |
| **Data entry errors** | Manual ERP entry leads to wrong GSTINs, mismatched PANs, incorrect TDS sections — causing downstream filing issues |
| **No risk assessment** | Most companies onboard vendors without checking GST filing compliance, MCA active status, or related party conflicts |
| **Regulatory non-compliance** | Missing MSME classification means companies unknowingly violate the 45-day payment mandate (MSME Act, Sec 15-16) |
| **Vendor fatigue** | Vendors submit documents via email/WhatsApp, get asked for the same docs by different departments |
| **No audit trail** | Who approved the vendor? When? What documents were verified? — often undocumented |

### Why Claude Agent SDK

The Agent SDK is ideal because vendor onboarding requires:
- **Multi-agent orchestration** — parallel document collection, government validation, risk scoring, and approval routing
- **Session persistence** — onboarding spans multiple interactions (vendor submits → agent validates → requests missing docs → re-validates)
- **MCP integrations** — connect to GST API, MCA API, bank verification, ERP systems (Tally/SAP/Zoho)
- **Hooks for audit** — every verification step must be logged for compliance audits
- **Human-in-the-loop** — approval workflows require human sign-off at configurable thresholds
- **File handling** — read uploaded documents (PDF, images), extract data, validate formats
- **Conversational interface** — interact with vendors via WhatsApp/Email for document collection

---

## 2. Architecture

### High-Level Design

```
                    +------------------------------------+
                    |   Vendor Onboarding                |
                    |      Main Agent                    |
                    |  (Orchestrator + Workflow Engine)   |
                    +------------------------------------+
                      |       |       |       |       |
       +--------------+  +----+--+  +-+------++  +---+-------+
       |                 |        |            |              |
+------v--------+ +------v-----+ +v----------+ +v-----------+ +v--------------+
| Document      | | Government | | Risk &    | | Approval   | | ERP           |
| Collector     | | Validator  | | Compliance| | Workflow   | | Integration   |
| Agent         | | Agent      | | Agent     | | Agent      | | Agent         |
| (Subagent)    | | (Subagent) | | (Subagent)| | (Subagent) | | (Subagent)    |
+---------------+ +------------+ +-----------+ +------------+ +---------------+
       |                 |              |             |              |
+------v--------+ +------v-----+ +-----v-----+ +----v-------+ +----v----------+
| WhatsApp/     | | GST, PAN,  | | Blacklist,| | Multi-tier | | Tally, SAP,   |
| Email/Portal  | | MCA, Udyam | | Related   | | Approvals  | | Zoho, Oracle  |
| Collection    | | Bank APIs  | | Party,    | | Escalation | | Master Create |
+---------------+ +------------+ | Scoring   | +------------+ +---------------+
                                  +-----------+
```

### End-to-End Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VENDOR ONBOARDING LIFECYCLE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. REQUEST          2. COLLECT           3. VALIDATE               │
│  ┌──────────┐       ┌──────────────┐     ┌────────────────┐        │
│  │ Internal │       │ Send vendor  │     │ Government API │        │
│  │ request  │──────>│ registration │────>│ validations    │        │
│  │ or self- │       │ form via     │     │ (parallel)     │        │
│  │ service  │       │ WhatsApp/    │     │ - GSTIN check  │        │
│  └──────────┘       │ Email/Portal │     │ - PAN verify   │        │
│                     └──────────────┘     │ - MCA lookup   │        │
│                           │              │ - Udyam verify │        │
│                     ┌─────v──────┐       │ - Bank verify  │        │
│                     │ Extract &  │       └───────┬────────┘        │
│                     │ parse docs │               │                  │
│                     │ (OCR/PDF)  │               │                  │
│                     └────────────┘               │                  │
│                                                  │                  │
│  4. ASSESS           5. APPROVE           6. ACTIVATE              │
│  ┌──────────────┐   ┌──────────────┐     ┌────────────────┐       │
│  │ Risk score   │   │ Route to     │     │ Create vendor  │       │
│  │ calculation  │<──│ appropriate  │────>│ master in ERP  │       │
│  │ - Compliance │   │ approver(s)  │     │ - Map GL codes │       │
│  │ - Financial  │   │ based on     │     │ - Set payment  │       │
│  │ - Operational│   │ risk tier    │     │   terms        │       │
│  │ - Blacklist  │   │ and value    │     │ - TDS config   │       │
│  └──────────────┘   └──────────────┘     │ - MSME flag    │       │
│                                          └────────────────┘       │
│                                                  │                  │
│  7. MONITOR (Ongoing)                            │                  │
│  ┌──────────────────────────────────────────────┐│                  │
│  │ Periodic re-validation: GSTIN active? MCA    ││                  │
│  │ status? MSME still valid? Bank details same? │◄┘                 │
│  └──────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request** — Internal team raises vendor onboarding request (or vendor self-registers via portal)
2. **Collect** — Agent sends registration form to vendor via WhatsApp/Email, collects documents
3. **Extract** — Parse uploaded documents (PAN card, GST certificate, cancelled cheque, MSME cert)
4. **Validate** — Parallel API calls to government databases (GST, PAN, MCA, Udyam, Bank IFSC)
5. **Screen** — Risk scoring, blacklist check, related party identification, compliance history
6. **Approve** — Route to appropriate approver(s) based on risk tier and procurement value
7. **Activate** — Create vendor master in ERP with all validated data, TDS configuration, payment terms
8. **Monitor** — Periodic re-validation of vendor compliance status (quarterly/annually)

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (orchestrator, complex risk assessment)
                 claude-sonnet-4-6 (document extraction, validation logic)
                 claude-haiku-4-5 (notifications, simple lookups, form parsing)
Storage:         PostgreSQL (vendor master, audit trail)
Queue:           BullMQ + Redis (async validation jobs, approval workflows)
File Storage:    S3-compatible (MinIO for on-prem) for vendor documents
OCR:             Tesseract.js or Google Vision API (for scanned documents)
MCP Servers:     GST API, MCA API, Bank Verification, Tally/SAP, WhatsApp Business
Frontend:        React portal (vendor self-service + internal dashboard)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install pg                          # PostgreSQL
npm install bullmq ioredis              # Job queue
npm install @aws-sdk/client-s3          # Document storage
npm install tesseract.js                # OCR for scanned docs
npm install xlsx                        # Excel export
npm install pdf-parse                   # PDF extraction
npm install zod                         # Schema validation
npm install dayjs                       # Date handling
npm install libphonenumber-js           # Indian phone number validation
```

---

## 4. Vendor Data Requirements

### 4.1 Core Vendor Information

| Field | Required | Validation | Source |
|-------|----------|------------|--------|
| **Legal Entity Name** | Yes | Must match PAN/GSTIN records | Vendor input → API verify |
| **Trade Name** | Yes | Cross-reference with GST certificate | Vendor input |
| **PAN** | Yes | Format: AAAAA0000A, verify via NSDL/UTIITSL | Vendor input → API verify |
| **Entity Type** | Yes | Individual/HUF/Partnership/LLP/Pvt Ltd/Public Ltd/Trust/AOP | Derived from PAN 4th char |
| **GSTIN** | Conditional | 15-digit, mandatory if GST registered | Vendor input → GST API verify |
| **CIN/LLPIN** | Conditional | For companies/LLPs | Vendor input → MCA API verify |
| **Udyam Registration** | If applicable | Format: UDYAM-XX-00-0000000 | Vendor input → Udyam API verify |
| **Date of Incorporation** | Yes | Must match MCA/registrar records | API-derived |
| **Registered Address** | Yes | Full address with PIN code | Vendor input → GSTIN cross-check |
| **Contact Person** | Yes | Name, designation, email, mobile | Vendor input |
| **Authorized Signatory** | Yes | Name, designation, PAN | Vendor input |

### 4.2 Bank Details

| Field | Required | Validation |
|-------|----------|------------|
| **Bank Name** | Yes | Must match IFSC lookup |
| **Branch** | Yes | Must match IFSC lookup |
| **Account Number** | Yes | Penny drop verification |
| **IFSC Code** | Yes | 11-char format, verify via RBI IFSC API |
| **Account Type** | Yes | Current/Savings/CC/OD |
| **Account Holder Name** | Yes | Must match legal entity name (fuzzy match allowed for trade names) |
| **Cancelled Cheque / Bank Letter** | Yes | Document upload + OCR extraction |

### 4.3 Tax & Compliance Details

| Field | Required | Validation | Impact |
|-------|----------|------------|--------|
| **GST Registration Type** | If GST registered | Regular/Composition/SEZ/Casual/ISD | Determines ITC eligibility |
| **GST Filing Status** | Auto-checked | Last 6 returns filed on time? | Risk scoring |
| **HSN/SAC Codes** | Yes | Mapped to goods/services supplied | GST invoice validation |
| **TDS Section Applicable** | Auto-determined | Based on payment type + vendor type | TDS deduction at payment |
| **Lower TDS Certificate** | If available | Section 197 certificate — verify validity period | Reduced TDS rate |
| **Form 15G/15H** | If applicable | For interest payments to individuals/seniors | No TDS deduction |
| **MSME Category** | Auto-checked | Micro/Small/Medium via Udyam API | 45-day payment mandate |
| **Tax Residency** | Yes | Resident/Non-resident | TDS section (194 vs 195) |
| **Country of Origin** | If import vendor | For customs and IGST | Duty calculations |

### 4.4 Specialized Registrations (Industry-Specific)

| Registration | Applicable When | Validation |
|--------------|-----------------|------------|
| **FSSAI License** | Food/beverage vendors | 14-digit, verify via FSSAI portal |
| **Drug License** | Pharmaceutical vendors | State drug controller verification |
| **Import-Export Code (IEC)** | Import/export vendors | 10-digit, verify via DGFT |
| **ISO Certifications** | Quality-critical vendors | Certificate number + validity |
| **RERA Registration** | Real estate vendors | State RERA portal verification |
| **Pollution Control (PCB)** | Manufacturing vendors | State PCB portal verification |
| **Factory License** | Manufacturing vendors | State-specific verification |
| **Labour License** | Contractor/manpower vendors | CLRA registration verification |
| **BIS Certification** | Product vendors (notified goods) | BIS portal verification |
| **Startup Recognition** | DPIIT-recognized startups | DPIIT certificate verification |

### 4.5 Document Checklist

| Document | Format | Required For | Extraction |
|----------|--------|--------------|------------|
| **PAN Card** | PDF/Image | All vendors | OCR → PAN, Name, DOB/DOI |
| **GST Certificate** | PDF | GST-registered vendors | OCR → GSTIN, Trade Name, Address |
| **Certificate of Incorporation** | PDF | Companies | OCR → CIN, Date, Name |
| **Partnership Deed** | PDF | Partnerships | OCR → Partners, Date |
| **Cancelled Cheque** | Image | All vendors | OCR → A/C No, IFSC, Name |
| **Bank Letter** | PDF | Alternative to cheque | OCR → A/C details |
| **Udyam Certificate** | PDF | MSME vendors | OCR → Udyam No, Category |
| **FSSAI License** | PDF | Food vendors | OCR → License No, Validity |
| **IEC Certificate** | PDF | Import/Export vendors | OCR → IEC, Name |
| **Lower TDS Certificate** | PDF | If applicable | OCR → Section, Rate, Validity |
| **Board Resolution** | PDF | Companies (for authorized signatory) | Manual review |
| **Address Proof** | PDF/Image | All vendors | OCR → Address verification |
| **MSME Declaration** | PDF | Non-MSME vendors | Signed declaration of non-MSME status |

---

## 5. Government API Validations

### 5.1 GSTIN Validation

```typescript
interface GSTINValidationResult {
  gstin: string;
  legal_name: string;
  trade_name: string;
  registration_date: string;
  status: "Active" | "Cancelled" | "Suspended" | "Inactive";
  taxpayer_type: "Regular" | "Composition" | "SEZ Developer" | "SEZ Unit" | "Casual" | "ISD" | "TDS" | "TCS" | "NRTP";
  constitution_of_business: string;  // "Private Limited Company", "Partnership", etc.
  state: string;
  state_code: string;
  principal_place_of_business: string;
  additional_places_of_business: string[];
  nature_of_business: string[];
  last_return_filed: {
    return_type: string;
    tax_period: string;
    date_of_filing: string;
  };
  filing_status_last_6_months: {
    period: string;
    gstr1_filed: boolean;
    gstr3b_filed: boolean;
    filing_date?: string;
  }[];
  hsn_codes?: string[];
  e_invoicing_applicable: boolean;  // Turnover > ₹5 Cr

  // Derived flags
  is_active: boolean;
  is_composition: boolean;
  is_filing_compliant: boolean;      // All returns filed in last 6 months
  pan_from_gstin: string;            // Characters 3-12 of GSTIN
  state_match: boolean;              // GSTIN state vs vendor address state
}
```

**Validation Rules:**
- GSTIN must be in `Active` status — reject `Cancelled`/`Suspended`
- PAN embedded in GSTIN (chars 3-12) must match declared PAN
- Legal name must match (fuzzy match for minor variations)
- Filing compliance: flag if any of last 6 GSTR-3B returns are unfiled
- Composition dealer: flag that ITC is NOT claimable from this vendor
- E-invoicing: if vendor turnover > ₹5 Cr, they must issue e-invoices

### 5.2 PAN Verification

```typescript
interface PANValidationResult {
  pan: string;
  name: string;
  name_on_card: string;
  pan_status: "Active" | "Inactive" | "Deactivated" | "Inoperative";
  pan_type: "Individual" | "Company" | "HUF" | "Firm" | "AOP" | "Trust" | "Government" | "LLP" | "Artificial Juridical Person";
  aadhaar_linked: boolean;           // Mandatory for individuals
  last_assessed: boolean;

  // Derived
  pan_type_code: string;             // 4th character: P=Individual, C=Company, F=Firm, H=HUF, A=AOP, T=Trust, L=Local Auth, J=AJP, G=Govt
  matches_declared_entity_type: boolean;
  matches_declared_name: boolean;
}
```

**Validation Rules:**
- PAN must be `Active` — reject `Inoperative` (not linked with Aadhaar after deadline)
- 4th character of PAN must match entity type (C=Company, F=Firm, P=Individual, etc.)
- Name on PAN must match declared legal entity name
- If PAN is `Inoperative`, TDS must be deducted at higher rate (20% u/s 206AA)

### 5.3 MCA/ROC Verification (Companies & LLPs)

```typescript
interface MCAValidationResult {
  cin_or_llpin: string;
  company_name: string;
  company_type: "Private" | "Public" | "OPC" | "LLP" | "Section 8";
  company_status: "Active" | "Strike Off" | "Under Liquidation" | "Dormant" | "Under Process of Striking Off";
  date_of_incorporation: string;
  registered_address: string;
  authorized_capital?: number;
  paid_up_capital?: number;
  directors: {
    din: string;
    name: string;
    designation: string;
    date_of_appointment: string;
    is_disqualified: boolean;
  }[];
  annual_filing_status: {
    fy: string;
    aoc4_filed: boolean;
    mgt7_filed: boolean;
  }[];
  charges: {
    charge_id: string;
    charge_holder: string;
    amount: number;
    status: "Open" | "Satisfied" | "Modified";
  }[];

  // Derived
  is_active: boolean;
  has_disqualified_directors: boolean;
  is_filing_compliant: boolean;
  is_under_action: boolean;           // Strike off / liquidation proceedings
}
```

**Validation Rules:**
- Company status must be `Active` — reject `Strike Off`, `Under Liquidation`
- Flag if any director is disqualified under Section 164
- Flag if annual filings (AOC-4, MGT-7) are pending for >2 financial years
- Check for open charges (may indicate financial distress)
- Cross-verify CIN/LLPIN with company name and date of incorporation

### 5.4 Udyam (MSME) Verification

```typescript
interface UdyamValidationResult {
  udyam_number: string;              // UDYAM-XX-00-0000000
  enterprise_name: string;
  type: "Micro" | "Small" | "Medium";
  date_of_incorporation: string;
  date_of_udyam_registration: string;
  major_activity: "Manufacturing" | "Services";
  nic_codes: {
    code: string;
    description: string;
  }[];
  investment: number;
  turnover: number;
  address: string;
  district: string;
  state: string;
  owner_name: string;
  social_category: string;
  gender: string;

  // Derived
  is_valid: boolean;
  classification_valid: boolean;      // Investment + turnover within MSME limits
  payment_mandate: {
    max_payment_days: 45;             // MSME Act Section 15-16
    interest_rate_if_delayed: number; // 3x bank rate (currently ~18-20%)
  };
}
```

**Validation Rules:**
- Udyam number format must match: UDYAM-XX-00-0000000
- Enterprise name should match declared vendor name
- Verify MSME classification is current (based on latest investment + turnover thresholds)
- **CRITICAL**: If vendor is MSME, the buying company MUST pay within 45 days (MSME Act)
- Flag for MSME-1 half-yearly filing requirement (buyers must report payments to MSMEs)

**MSME Classification Thresholds (current):**

| Category | Investment (₹) | Turnover (₹) |
|----------|----------------|---------------|
| Micro | ≤ 1 Cr | ≤ 5 Cr |
| Small | ≤ 10 Cr | ≤ 50 Cr |
| Medium | ≤ 50 Cr | ≤ 250 Cr |

### 5.5 Bank Account Verification

```typescript
interface BankVerificationResult {
  account_number: string;
  ifsc: string;
  bank_name: string;
  branch: string;
  branch_address: string;
  micr_code: string;
  account_holder_name: string;
  account_type: "Current" | "Savings" | "CC" | "OD";
  is_valid_account: boolean;
  name_match_score: number;           // 0-100 fuzzy match with declared name
  upi_id?: string;

  // Verification method
  method: "penny_drop" | "reverse_penny_drop" | "name_match_only";
  verification_timestamp: string;
  verification_reference: string;
}
```

**Validation Rules:**
- IFSC must be valid and active (cross-reference RBI IFSC master)
- Penny drop verification: send ₹1 and verify account holder name returned by bank
- Name match threshold: ≥75% fuzzy match between bank name and declared legal name
- Flag mismatches for manual review (trade name vs legal name differences are common)
- Verify account type: businesses should have Current accounts (flag Savings for companies)

---

## 6. Risk Assessment & Compliance Scoring

### 6.1 Vendor Risk Score Model

```typescript
interface VendorRiskScore {
  vendor_id: string;
  overall_score: number;              // 0-100 (higher = lower risk)
  risk_tier: "low" | "medium" | "high" | "critical";
  components: {
    identity_verification: {
      score: number;                  // 0-25 points
      checks: {
        pan_verified: boolean;        // 5 pts
        gstin_active: boolean;        // 5 pts
        mca_active: boolean;          // 5 pts
        bank_verified: boolean;       // 5 pts
        address_matched: boolean;     // 5 pts
      };
    };
    compliance_health: {
      score: number;                  // 0-25 points
      checks: {
        gst_filing_regular: boolean;  // 10 pts (6/6 returns filed)
        mca_filings_current: boolean; // 5 pts
        no_disqualified_dirs: boolean;// 5 pts
        tds_section_determined: boolean; // 5 pts
      };
    };
    financial_stability: {
      score: number;                  // 0-25 points
      checks: {
        years_in_business: number;    // 0-10 pts (1pt per year, max 10)
        paid_up_capital_adequate: boolean; // 5 pts (for companies)
        no_open_charges: boolean;     // 5 pts
        msme_status_verified: boolean;// 5 pts
      };
    };
    operational_risk: {
      score: number;                  // 0-25 points
      checks: {
        not_blacklisted: boolean;     // 10 pts
        not_related_party: boolean;   // 5 pts
        industry_licenses_valid: boolean; // 5 pts
        no_adverse_media: boolean;    // 5 pts
      };
    };
  };
  flags: VendorFlag[];
  recommendation: "auto_approve" | "standard_approval" | "enhanced_review" | "reject";
}

interface VendorFlag {
  severity: "info" | "warning" | "critical" | "blocker";
  category: string;
  message: string;
  action_required: string;
}
```

### 6.2 Risk Tier Determination

| Score Range | Tier | Approval Path | Monitoring |
|-------------|------|---------------|------------|
| 80-100 | Low Risk | Auto-approve (if within value limit) | Annual re-validation |
| 60-79 | Medium Risk | Single approver (Procurement Head) | Semi-annual re-validation |
| 40-59 | High Risk | Dual approval (Procurement + Finance) | Quarterly re-validation |
| 0-39 | Critical Risk | Committee approval + enhanced due diligence | Reject or monthly monitoring |

### 6.3 Blocker Conditions (Automatic Rejection)

The agent automatically rejects onboarding if ANY of these are true:

| Condition | Reason |
|-----------|--------|
| GSTIN status = Cancelled/Suspended | Cannot claim ITC, legal risk |
| PAN status = Inoperative/Deactivated | Non-compliant identity |
| MCA status = Strike Off/Under Liquidation | Entity may not legally transact |
| Vendor on internal blacklist | Previous fraud/performance issues |
| Director on DIN debarment list | Section 164 disqualification |
| Bank account verification failed | Payment fraud risk |
| Vendor is a shell company indicator | Multiple flags: low capital + no employees + recent incorporation + high-value transactions |

### 6.4 Warning Conditions (Proceed with Caution)

| Condition | Flag | Impact |
|-----------|------|--------|
| Composition dealer | ITC not claimable | Procurement should factor in higher effective cost |
| GST returns not filed (3+ months) | Compliance risk | May face input denial in GSTR-2B reconciliation |
| MSME vendor | 45-day payment mandate | Finance team must prioritize payment |
| Related party identified | Transfer pricing risk | Requires arm's length pricing documentation |
| Recently incorporated (<2 years) | Higher risk | May need bank guarantee or advance payment |
| Lower TDS certificate about to expire | TDS rate change | Track renewal to avoid under-deduction |
| Multi-state GSTIN but only one provided | Possible compliance gap | Request all GSTINs for relevant states |

### 6.5 Blacklist & Debarment Checks

```typescript
interface BlacklistCheck {
  sources: {
    internal_blacklist: boolean;        // Company's own blacklist database
    gem_debarred: boolean;              // Government e-Marketplace debarred list
    world_bank_debarred: boolean;       // World Bank sanctions list
    rbi_defaulter_list: boolean;        // CRILC defaulter directory
    cbi_case_check: boolean;            // Known fraud entities
    mca_vanishing_companies: boolean;   // MCA list of vanishing companies
    sebi_debarred: boolean;             // SEBI debarred entities (if listed)
  };
  related_party_check: {
    is_related_party: boolean;
    relationship_type?: "director_common" | "shareholder_common" | "family_member" | "subsidiary" | "associate";
    related_entity?: string;
    disclosure_required: boolean;       // AS-18 / Ind AS 24
  };
  adverse_media_check: {
    has_adverse_media: boolean;
    articles?: { source: string; title: string; date: string; summary: string }[];
  };
}
```

---

## 7. TDS Section Auto-Determination

A critical onboarding function — the agent determines the correct TDS section for future payments to this vendor.

### 7.1 TDS Section Decision Tree

```typescript
interface TDSSectionDetermination {
  vendor_type: string;
  payment_nature: string;
  applicable_section: string;
  rate_individual_huf: number;
  rate_others: number;
  threshold_per_annum: number;
  surcharge_applicable: boolean;
  lower_deduction_certificate?: {
    section_197_certificate_no: string;
    rate: number;
    valid_from: string;
    valid_to: string;
    limit_amount: number;
  };
  higher_rate_applicable: boolean;    // 20% if PAN not provided (206AA)
  non_filer_higher_rate: boolean;     // Higher rate for non-filers of ITR (206AB)
}
```

### 7.2 Section Mapping Matrix

| Payment Nature | Section | Rate (Ind/HUF) | Rate (Others) | Threshold |
|----------------|---------|-----------------|---------------|-----------|
| Salary | 192 | Slab rates | N/A | N/A |
| Interest (non-bank) | 194A | 10% | 10% | ₹5,000/year |
| Dividend | 194 | 10% | 10% | ₹5,000/year |
| Contractor — single payment | 194C | 1% | 2% | ₹30,000/payment |
| Contractor — aggregate | 194C | 1% | 2% | ₹1,00,000/year |
| Commission/Brokerage | 194H | 5% | 5% | ₹15,000/year |
| Rent — Land/Building | 194I(b) | 10% | 10% | ₹2,40,000/year |
| Rent — Plant/Machinery | 194I(a) | 2% | 2% | ₹2,40,000/year |
| Professional/Technical fees | 194J | 10% | 10% | ₹30,000/year |
| Technical services (royalty) | 194J | 2% | 2% | ₹30,000/year |
| Purchase of goods | 194Q | 0.1% | 0.1% | ₹50,00,000/year |
| Perquisites/Benefits | 194R | 10% | 10% | ₹20,000/year |
| E-commerce operator | 194O | 1% | 1% | ₹5,00,000/year |
| Payment to NRI | 195 | As applicable | As applicable | ₹0 |
| Sale of goods (TCS) | 206C(1H) | 0.1% TCS | 0.1% TCS | ₹50,00,000/year |

### 7.3 Agent Logic for TDS Determination

```
Input: Vendor entity type + nature of goods/services

Decision flow:
1. Is vendor an NRI/foreign company?
   → Yes: Section 195 (withholding on all payments, check DTAA for treaty rates)

2. What is the primary payment nature?
   → Goods purchase: Section 194Q (if buyer turnover > ₹10 Cr)
   → Contract/Job work: Section 194C (1% individual, 2% others)
   → Professional/Consulting: Section 194J (10% professional, 2% technical)
   → Rent: Section 194I (2% machinery, 10% land/building)
   → Commission: Section 194H (5%)
   → Interest: Section 194A (10%)

3. Does vendor have a Lower TDS Certificate (Section 197)?
   → Yes: Apply the rate and limit specified in certificate
   → Track certificate validity and amount consumed

4. Is vendor PAN available and valid?
   → No: Apply 20% rate (Section 206AA) instead of standard rate
   → PAN Inoperative: Same as no PAN — 20% rate

5. Is vendor a non-filer of ITR (check Section 206AB)?
   → Yes: Apply higher of 5% or 2x standard rate
   → Check via TRACES "Specified Person" verification

6. Apply surcharge + cess if payment exceeds ₹50L/₹1Cr thresholds
```

---

## 8. Implementation Guide

### 8.1 Main Orchestrator Agent

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `You are a Vendor Onboarding Agent for Indian businesses.
You manage the complete vendor onboarding lifecycle — from document collection
through government validation, risk assessment, approval routing, and ERP activation.

YOUR RESPONSIBILITIES:
- Collect and validate vendor registration documents
- Verify registrations against government databases (GST, PAN, MCA, Udyam, Bank)
- Calculate risk scores and flag compliance issues
- Route approvals based on risk tier and procurement value
- Create vendor master records in the ERP system
- Monitor vendor compliance status periodically

CRITICAL RULES:
- NEVER skip government API validation — all registrations must be verified
- ALWAYS determine correct TDS section before vendor activation
- ALWAYS check MSME status — missing this violates MSME Act payment mandates
- Flag composition dealers — ITC is not claimable from them
- Maintain complete audit trail for every validation step
- NEVER auto-approve high-risk or critical-risk vendors
- Protect sensitive data — mask PAN/bank details in logs (show only last 4 chars)
- If any API validation fails, retry once, then flag for manual verification
- All dates in IST, financial year April-March

Store all data in ./vendor-data/ directory.`;

async function runVendorOnboardingAgent(userPrompt: string) {
  for await (const message of query({
    prompt: userPrompt,
    options: {
      cwd: "/path/to/vendor-workspace",
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"],
      permissionMode: "default",
      maxTurns: 80,
      agents: {
        "document-collector": {
          description: "Collects vendor registration documents via WhatsApp/Email/Portal. Sends forms, tracks submissions, follows up on missing documents.",
          model: "claude-haiku-4-5",
          prompt: DOCUMENT_COLLECTOR_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob"],
        },
        "government-validator": {
          description: "Validates vendor registrations against government APIs — GSTIN, PAN, MCA/CIN, Udyam, Bank IFSC. Runs all validations in parallel.",
          model: "claude-sonnet-4-6",
          prompt: GOVERNMENT_VALIDATOR_PROMPT,
          tools: ["Read", "Write", "Bash", "Glob", "Grep", "WebFetch"],
        },
        "risk-compliance-agent": {
          description: "Calculates vendor risk score, checks blacklists, identifies related parties, determines TDS section, flags compliance issues.",
          model: "claude-opus-4-6",
          prompt: RISK_COMPLIANCE_PROMPT,
          tools: ["Read", "Write", "Edit", "Glob", "Grep", "WebSearch"],
        },
        "approval-workflow-agent": {
          description: "Routes vendor approval requests based on risk tier and procurement value. Tracks approval status, handles escalations.",
          model: "claude-haiku-4-5",
          prompt: APPROVAL_WORKFLOW_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob"],
        },
        "erp-integration-agent": {
          description: "Creates vendor master in ERP (Tally/SAP/Zoho) with validated data, TDS config, payment terms, GL code mapping.",
          model: "claude-sonnet-4-6",
          prompt: ERP_INTEGRATION_PROMPT,
          tools: ["Read", "Write", "Bash", "Glob", "Grep"],
        },
        "document-extractor": {
          description: "Extracts structured data from uploaded vendor documents (PAN card, GST certificate, cancelled cheque, MSME cert) using OCR.",
          model: "claude-sonnet-4-6",
          prompt: DOCUMENT_EXTRACTOR_PROMPT,
          tools: ["Read", "Write", "Bash", "Glob"],
        },
        "vendor-monitor": {
          description: "Periodically re-validates vendor compliance — GST active status, MCA status, MSME validity, bank details changes.",
          model: "claude-sonnet-4-6",
          prompt: VENDOR_MONITOR_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch"],
        },
      },
    },
  })) {
    if ("result" in message) {
      console.log(message.result);
    }
  }
}
```

### 8.2 Government Validator Subagent — Detailed Prompt

```typescript
const GOVERNMENT_VALIDATOR_PROMPT = `You are a Government Registration Validation Specialist.
Your job is to verify vendor registrations against official government databases.

VALIDATIONS TO PERFORM (in parallel where possible):

1. GSTIN VALIDATION (GST Portal API / GSP):
   - Hit GST API with GSTIN → verify status, legal name, trade name, state, taxpayer type
   - Check filing status for last 6 return periods
   - Extract PAN from GSTIN (characters 3-12) and cross-verify with declared PAN
   - Flag: Cancelled/Suspended GSTIN, composition dealer, non-filer (3+ months)

2. PAN VERIFICATION (NSDL/UTIITSL API):
   - Verify PAN exists and is Active
   - Confirm name matches legal entity name
   - Check if PAN is Inoperative (Aadhaar not linked)
   - Verify PAN type matches entity type (4th character)

3. MCA/CIN VERIFICATION (MCA API — for companies/LLPs only):
   - Verify CIN/LLPIN and company status (Active/Strike Off/Liquidation)
   - Check director DIN status (any disqualified under Section 164?)
   - Verify annual filings are current (AOC-4, MGT-7)
   - Check for open charges
   - Cross-verify company name and date of incorporation

4. UDYAM VERIFICATION (Udyam API — if MSME):
   - Verify Udyam registration number
   - Confirm MSME category (Micro/Small/Medium)
   - Verify enterprise name matches vendor name
   - Extract NIC codes for business activity verification

5. BANK ACCOUNT VERIFICATION:
   - Validate IFSC code against RBI master
   - Perform penny drop verification (₹1 transfer)
   - Compare bank-returned name with declared legal/trade name
   - Flag if name match score < 75%

6. IFSC VALIDATION (RBI IFSC API):
   - Verify IFSC is valid and active
   - Extract bank name, branch, address, MICR code
   - Cross-verify with declared bank name

OUTPUT FORMAT:
- Write validation results to ./vendor-data/validations/{vendor_id}/
- One JSON file per validation type: gstin.json, pan.json, mca.json, udyam.json, bank.json
- Include raw API response + derived flags + timestamp
- Write summary to ./vendor-data/validations/{vendor_id}/validation-summary.json

ERROR HANDLING:
- If API is down, retry once after 5 seconds
- If still failing, mark as "pending_manual_verification" (do not block entire flow)
- Log all API errors to ./vendor-data/validations/{vendor_id}/errors.log`;
```

### 8.3 Risk & Compliance Subagent — Detailed Prompt

```typescript
const RISK_COMPLIANCE_PROMPT = `You are a Vendor Risk Assessment and Compliance Specialist.
Your job is to analyze validation results and produce a comprehensive risk score.

YOUR TASKS:

1. RISK SCORE CALCULATION (0-100 scale):
   Component weights:
   - Identity Verification: 25 points (PAN, GSTIN, MCA, Bank, Address)
   - Compliance Health: 25 points (GST filing, MCA filing, director status, TDS)
   - Financial Stability: 25 points (age, capital, charges, MSME status)
   - Operational Risk: 25 points (blacklist, related party, licenses, media)

2. TDS SECTION DETERMINATION:
   - Analyze vendor type (entity type from PAN) + payment nature (from procurement request)
   - Map to correct TDS section and rate
   - Check for Lower TDS Certificate (Section 197) — verify validity period
   - Check Section 206AB (non-filer higher rate) via TRACES lookup
   - If PAN unavailable/inoperative → flag 20% rate under Section 206AA

3. MSME COMPLIANCE:
   - If vendor is MSME: set payment_mandate = 45 days
   - Calculate interest rate for delayed payment (3x RBI bank rate)
   - Flag for MSME-1 reporting requirement
   - Determine if buyer needs to report this vendor in MSME-1 filing

4. RELATED PARTY CHECK:
   - Compare vendor directors (from MCA data) with company's own director list
   - Check for common shareholders
   - Check if vendor's registered address matches any group company address
   - Flag for Ind AS 24 / AS-18 disclosure if related party found

5. BLACKLIST SCREENING:
   - Check internal blacklist database
   - Search for entity name + PAN on GeM debarment list
   - Check MCA vanishing companies list
   - Run adverse media screening (web search for fraud/legal issues)

6. APPROVAL RECOMMENDATION:
   - Score 80+: "auto_approve" (if procurement value < configured threshold)
   - Score 60-79: "standard_approval" (single approver)
   - Score 40-59: "enhanced_review" (dual approval)
   - Score 0-39: "reject" or "committee_approval"

OUTPUT:
- Risk report: ./vendor-data/risk/{vendor_id}/risk-score.json
- TDS determination: ./vendor-data/risk/{vendor_id}/tds-section.json
- Compliance flags: ./vendor-data/risk/{vendor_id}/flags.json
- Human-readable summary: ./vendor-data/risk/{vendor_id}/risk-report.md

CRITICAL:
- NEVER approve a vendor with blocker conditions (see blocker list)
- Always explain the "why" behind every flag
- If risk score < 40, provide specific reasons for rejection
- Include suggested remediation actions for flagged items`;
```

### 8.4 Approval Workflow Engine

```typescript
interface ApprovalWorkflow {
  vendor_id: string;
  vendor_name: string;
  risk_tier: "low" | "medium" | "high" | "critical";
  risk_score: number;
  procurement_value?: number;
  procurement_category?: string;

  approval_chain: {
    level: number;
    approver_role: string;
    approver_name: string;
    approver_email: string;
    status: "pending" | "approved" | "rejected" | "escalated";
    comments?: string;
    action_date?: string;
    sla_hours: number;
  }[];

  current_level: number;
  overall_status: "in_progress" | "approved" | "rejected" | "escalated" | "expired";
  created_at: string;
  expires_at: string;          // Auto-escalate if not actioned
}

// Approval matrix
const APPROVAL_MATRIX = {
  low_risk: {
    auto_approve_limit: 500000,     // ₹5L — auto approve below this
    levels: [
      { role: "procurement_head", sla_hours: 24 },
    ],
  },
  medium_risk: {
    auto_approve_limit: 0,          // No auto-approve
    levels: [
      { role: "procurement_head", sla_hours: 24 },
    ],
  },
  high_risk: {
    auto_approve_limit: 0,
    levels: [
      { role: "procurement_head", sla_hours: 24 },
      { role: "finance_head", sla_hours: 24 },
    ],
  },
  critical_risk: {
    auto_approve_limit: 0,
    levels: [
      { role: "procurement_head", sla_hours: 12 },
      { role: "finance_head", sla_hours: 12 },
      { role: "cfo_or_committee", sla_hours: 48 },
    ],
  },
};
```

### 8.5 ERP Integration Subagent

```typescript
const ERP_INTEGRATION_PROMPT = `You are an ERP Integration Specialist.
Your job is to create vendor master records in the company's ERP system.

SUPPORTED ERPs:
- Tally Prime (via XML Gateway API on port 9000)
- SAP Business One (via Service Layer REST API)
- Zoho Books (via Zoho Books API)
- Oracle NetSuite (via SuiteTalk REST API)

VENDOR MASTER FIELDS TO MAP:

1. BASIC DETAILS:
   - Vendor Code (auto-generated per company scheme)
   - Legal Name, Trade Name
   - Entity Type
   - PAN, GSTIN(s), CIN/LLPIN
   - Contact Person, Email, Phone
   - Registered Address, Billing Address, Shipping Address

2. FINANCIAL CONFIGURATION:
   - Payment Terms (Net 30/45/60 — 45 max if MSME)
   - Credit Limit
   - Currency (INR default, USD/EUR for importers)
   - GL Account Code (mapped to vendor category)
   - Cost Center (if applicable)
   - Bank Details (Account No, IFSC, Bank Name)

3. TAX CONFIGURATION:
   - TDS Section and Rate
   - TDS Threshold Amount
   - Lower TDS Certificate details (if any)
   - GST Registration Type (Regular/Composition/Unregistered)
   - Place of Supply (state code from GSTIN)
   - HSN/SAC Codes for default line items
   - Reverse Charge applicable? (for specific sections)

4. COMPLIANCE TAGS:
   - MSME Flag + Category (Micro/Small/Medium)
   - MSME Payment Mandate Days (45)
   - Related Party Flag
   - Composition Dealer Flag (ITC not claimable)
   - E-invoicing applicable
   - Risk Tier

5. APPROVAL & AUDIT:
   - Onboarding Date
   - Approved By (from workflow)
   - Risk Score at onboarding
   - Next Re-validation Date
   - Document Repository Path

OUTPUT:
- ERP creation payload: ./vendor-data/erp/{vendor_id}/erp-payload.json
- ERP response (vendor code assigned): ./vendor-data/erp/{vendor_id}/erp-response.json
- Mapping log: ./vendor-data/erp/{vendor_id}/field-mapping.json

TALLY-SPECIFIC:
- Use TallyPrime XML format for ledger creation under "Sundry Creditors"
- Map GST details to Tally's "GST Registration" fields
- Set "Is Bill-wise" = Yes for invoice tracking
- Create sub-ledger under appropriate group (Raw Material/Services/etc.)

SAP-SPECIFIC:
- Use BusinessPartners entity via Service Layer
- Set BPType = "cSupplier"
- Map TDS to Withholding Tax configuration
- Set PaymentTermsGroupCode based on payment terms`;
```

### 8.6 Vendor Monitoring Subagent (Post-Onboarding)

```typescript
const VENDOR_MONITOR_PROMPT = `You are a Vendor Compliance Monitoring Specialist.
Your job is to periodically re-validate vendor compliance status.

MONITORING SCHEDULE:
- Low risk vendors: Annual re-validation
- Medium risk vendors: Semi-annual re-validation
- High risk vendors: Quarterly re-validation
- Critical risk vendors: Monthly re-validation (or reject)

CHECKS TO PERFORM:
1. GSTIN still Active? Filing status still compliant?
2. PAN still Active? Not become Inoperative?
3. MCA status still Active? Any new charges? Director changes?
4. MSME status still valid? Category change?
5. Bank account still active? (periodic penny drop)
6. Lower TDS certificate expiry check
7. Trade/industry license renewals (FSSAI, Drug License, etc.)
8. Blacklist re-screening (quarterly)
9. Related party re-check (if company director changes)

ACTIONS:
- If GSTIN cancelled → IMMEDIATE alert + vendor deactivation recommendation
- If PAN inoperative → Flag for TDS rate change to 20%
- If MSME status changed → Update payment terms
- If MCA status changed → Escalate to finance/legal
- If bank details changed → Re-verify before next payment

OUTPUT:
- Monitoring report: ./vendor-data/monitoring/{vendor_id}/{date}-report.md
- Alert notifications via Slack/WhatsApp for critical changes
- Update vendor master record with new compliance status`;
```

### 8.7 Hooks for Audit & Security

```typescript
import { HookCallback } from "@anthropic-ai/claude-agent-sdk";

// Comprehensive audit hook — every action is logged
const vendorAuditHook: HookCallback = async (input) => {
  const toolInput = (input as any).tool_input ?? {};
  const entry = {
    timestamp: new Date().toISOString(),
    tool: (input as any).tool_name,
    agent: (input as any).agent_name || "orchestrator",
    action: toolInput.file_path || toolInput.command || "unknown",
    vendor_id: extractVendorId(toolInput),
  };
  const fs = await import("fs/promises");
  await fs.appendFile(
    "./vendor-data/audit-trail.jsonl",
    JSON.stringify(entry) + "\n"
  );
  return {};
};

// PII masking hook — mask sensitive data before any external communication
const piiMaskingHook: HookCallback = async (input) => {
  const toolName = (input as any).tool_name;
  // If sending notifications, mask PAN, bank account numbers
  if (toolName === "send_slack_message" || toolName === "send_whatsapp_alert") {
    let text = (input as any).tool_input?.text || (input as any).tool_input?.message || "";
    // Mask PAN: ABCDE1234F → XXXXX1234X
    text = text.replace(/[A-Z]{5}[0-9]{4}[A-Z]/g, (match: string) => `XXXXX${match.slice(5, 9)}X`);
    // Mask bank account: show only last 4 digits
    text = text.replace(/\b\d{9,18}\b/g, (match: string) => `XXXX${match.slice(-4)}`);
    (input as any).tool_input.text = text;
    (input as any).tool_input.message = text;
  }
  return {};
};

// Immutability hook — protect approved/filed vendor records
const immutabilityHook: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "";
  if (
    filePath.includes("/approved/") ||
    filePath.includes("/filed/") ||
    filePath.includes("/audit-trail")
  ) {
    if (["Write", "Edit"].includes((input as any).tool_name)) {
      return { error: "Cannot modify approved vendor records or audit trail. These are immutable." };
    }
  }
  return {};
};

// Sensitive file access hook
const sensitiveAccessHook: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "";
  const blocked = [".env", "credentials", "secret", ".ssh", ".aws", "api_key"];
  if (blocked.some((b) => filePath.toLowerCase().includes(b))) {
    return { error: `Access denied: ${filePath} is restricted` };
  }
  return {};
};

// Usage in query options:
// hooks: {
//   PostToolUse: [{ matcher: ".*", hooks: [vendorAuditHook] }],
//   PreToolUse: [
//     { matcher: "Write|Edit", hooks: [immutabilityHook] },
//     { matcher: "Read|Bash", hooks: [sensitiveAccessHook] },
//     { matcher: "send_slack|send_whatsapp", hooks: [piiMaskingHook] },
//   ],
// }
```

---

## 9. MCP Integrations

### 9.1 GST Portal API MCP Server

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const searchGSTIN = tool(
  "search_gstin",
  "Search and validate a GSTIN against the GST Portal. Returns registration details, filing status, and compliance flags.",
  {
    gstin: z.string().describe("15-digit GSTIN to validate"),
  },
  async (args) => {
    // Via GST Suvidha Provider (GSP) like ClearTax, Masters India, IRIS
    const token = await getGSPAuthToken();
    const response = await fetch(`${GSP_BASE_URL}/taxpayer/gstin/${args.gstin}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await response.json();

    // Also fetch filing status
    const filingResponse = await fetch(`${GSP_BASE_URL}/taxpayer/gstin/${args.gstin}/returns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const filingData = await filingResponse.json();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ registration: data, filing_status: filingData }),
      }],
    };
  }
);

const checkGSTFiling = tool(
  "check_gst_filing_status",
  "Check GST return filing status for a GSTIN for the last N months",
  {
    gstin: z.string(),
    months: z.number().default(6).describe("Number of months to check (default 6)"),
  },
  async (args) => {
    const filingData = await fetchGSTFilingStatus(args.gstin, args.months);
    return { content: [{ type: "text", text: JSON.stringify(filingData) }] };
  }
);

const gstServer = createSdkMcpServer({
  name: "gst-portal",
  tools: [searchGSTIN, checkGSTFiling],
});
```

### 9.2 PAN Verification MCP Server

```typescript
const verifyPAN = tool(
  "verify_pan",
  "Verify PAN against NSDL/UTIITSL database. Returns PAN status, holder name, and type.",
  {
    pan: z.string().describe("10-character PAN to verify"),
    name: z.string().describe("Name to match against PAN records"),
    dob_or_doi: z.string().optional().describe("Date of birth (individuals) or incorporation (companies) — DD/MM/YYYY"),
  },
  async (args) => {
    // Via NSDL PAN verification API or Karza/Digio/Signzy
    const response = await fetch(`${KYC_PROVIDER_URL}/pan/verify`, {
      method: "POST",
      headers: { "x-api-key": process.env.KYC_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ pan: args.pan, name: args.name, dob: args.dob_or_doi }),
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

// Section 206AB check — is this person a "specified person" (ITR non-filer)?
const check206AB = tool(
  "check_206ab_status",
  "Check if PAN holder is a 'specified person' under Section 206AB (non-filer of ITR) requiring higher TDS rate",
  {
    pan: z.string(),
  },
  async (args) => {
    // Via TRACES API or compliance check provider
    const response = await fetch(`${TRACES_URL}/206ab/check`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getTRACESToken()}` },
      body: JSON.stringify({ pan: args.pan }),
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const panServer = createSdkMcpServer({
  name: "pan-verification",
  tools: [verifyPAN, check206AB],
});
```

### 9.3 MCA Verification MCP Server

```typescript
const searchMCA = tool(
  "search_mca_company",
  "Search company details on MCA portal by CIN, LLPIN, or company name",
  {
    search_type: z.enum(["cin", "llpin", "name"]),
    search_value: z.string(),
  },
  async (args) => {
    // Via MCA API or data providers like Tofler, Zaubacorp, SignalX
    const response = await fetch(`${MCA_PROVIDER_URL}/company/search`, {
      method: "POST",
      body: JSON.stringify({ type: args.search_type, value: args.search_value }),
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const checkDirectorDIN = tool(
  "check_director_status",
  "Check if a Director's DIN is active or disqualified under Section 164",
  {
    din: z.string().describe("8-digit DIN"),
  },
  async (args) => {
    const response = await fetch(`${MCA_PROVIDER_URL}/director/${args.din}`);
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const mcaServer = createSdkMcpServer({
  name: "mca-portal",
  tools: [searchMCA, checkDirectorDIN],
});
```

### 9.4 Bank Verification MCP Server

```typescript
const verifyBankAccount = tool(
  "verify_bank_account",
  "Verify bank account via penny drop — sends ₹1 to the account and returns the account holder name from the bank",
  {
    account_number: z.string(),
    ifsc: z.string(),
    expected_name: z.string().describe("Expected account holder name for matching"),
  },
  async (args) => {
    // Via Razorpay, Cashfree, or Decentro bank verification API
    const response = await fetch(`${BANK_VERIFY_URL}/penny-drop`, {
      method: "POST",
      headers: { "x-api-key": process.env.BANK_VERIFY_API_KEY! },
      body: JSON.stringify({
        account_number: args.account_number,
        ifsc: args.ifsc,
      }),
    });
    const data = await response.json();

    // Fuzzy name match
    const nameMatchScore = fuzzyMatch(data.beneficiary_name, args.expected_name);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ...data,
          expected_name: args.expected_name,
          name_match_score: nameMatchScore,
          name_match_pass: nameMatchScore >= 75,
        }),
      }],
    };
  }
);

const validateIFSC = tool(
  "validate_ifsc",
  "Validate IFSC code against RBI master and return bank/branch details",
  {
    ifsc: z.string().describe("11-character IFSC code"),
  },
  async (args) => {
    const response = await fetch(`https://ifsc.razorpay.com/${args.ifsc}`);
    if (!response.ok) return { content: [{ type: "text", text: `Invalid IFSC: ${args.ifsc}` }] };
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const bankServer = createSdkMcpServer({
  name: "bank-verification",
  tools: [verifyBankAccount, validateIFSC],
});
```

### 9.5 Udyam (MSME) Verification MCP Server

```typescript
const verifyUdyam = tool(
  "verify_udyam",
  "Verify Udyam (MSME) registration number and return enterprise details and classification",
  {
    udyam_number: z.string().describe("Udyam registration number (UDYAM-XX-00-0000000)"),
  },
  async (args) => {
    // Via Udyam Registration portal API or KYC provider
    const response = await fetch(`${KYC_PROVIDER_URL}/udyam/verify`, {
      method: "POST",
      headers: { "x-api-key": process.env.KYC_API_KEY! },
      body: JSON.stringify({ udyam_number: args.udyam_number }),
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const udyamServer = createSdkMcpServer({
  name: "udyam-verification",
  tools: [verifyUdyam],
});
```

### 9.6 ERP MCP Servers

```typescript
// Tally Prime MCP
const createTallyVendor = tool(
  "create_tally_vendor",
  "Create a vendor ledger in Tally Prime via XML Gateway API",
  {
    company_name: z.string(),
    vendor_data: z.object({
      name: z.string(),
      group: z.string().default("Sundry Creditors"),
      gstin: z.string().optional(),
      pan: z.string(),
      state: z.string(),
      payment_terms: z.number().default(30),
      credit_limit: z.number().optional(),
      tds_applicable: z.boolean(),
      tds_section: z.string().optional(),
      msme_flag: z.boolean(),
      bank_details: z.object({
        account_number: z.string(),
        ifsc: z.string(),
        bank_name: z.string(),
      }).optional(),
    }),
  },
  async (args) => {
    const xml = buildTallyLedgerXML(args.company_name, args.vendor_data);
    const response = await fetch("http://localhost:9000", {
      method: "POST",
      body: xml,
      headers: { "Content-Type": "application/xml" },
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
);

const tallyServer = createSdkMcpServer({
  name: "tally-erp",
  tools: [createTallyVendor],
});
```

### 9.7 Notification MCP Servers

```typescript
const sendWhatsAppForm = tool(
  "send_whatsapp_vendor_form",
  "Send vendor registration form to vendor via WhatsApp Business API. Uses interactive message with document upload links.",
  {
    phone: z.string().describe("Vendor phone number with country code (+91...)"),
    vendor_name: z.string(),
    company_name: z.string().describe("Your company name (the buyer)"),
    required_documents: z.array(z.string()).describe("List of required documents"),
    form_link: z.string().describe("Link to vendor self-service registration portal"),
  },
  async (args) => {
    const message = {
      messaging_product: "whatsapp",
      to: args.phone,
      type: "interactive",
      interactive: {
        type: "button",
        header: { type: "text", text: `Vendor Registration — ${args.company_name}` },
        body: {
          text: `Hi ${args.vendor_name},\n\nPlease complete your vendor registration by submitting the following documents:\n\n${args.required_documents.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\nClick below to start:`,
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "start_registration", title: "Start Registration" } },
          ],
        },
      },
    };
    await sendViaWhatsAppBusinessAPI(message);
    return { content: [{ type: "text", text: "WhatsApp registration form sent" }] };
  }
);

const sendApprovalRequest = tool(
  "send_approval_request",
  "Send vendor approval request to approver via Slack with one-click approve/reject",
  {
    channel: z.string(),
    approver_slack_id: z.string(),
    vendor_summary: z.string(),
    risk_score: z.number(),
    risk_tier: z.string(),
    vendor_id: z.string(),
    flags: z.array(z.string()),
  },
  async (args) => {
    const color = args.risk_tier === "low" ? "#36a64f" : args.risk_tier === "medium" ? "#daa520" : "#ff0000";
    const message = {
      channel: args.channel,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<@${args.approver_slack_id}> 📋 *Vendor Approval Request*\n\n${args.vendor_summary}\n\n*Risk Score:* ${args.risk_score}/100 (*${args.risk_tier}* risk)`,
          },
        },
        ...(args.flags.length > 0 ? [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `⚠️ *Flags:*\n${args.flags.map(f => `• ${f}`).join("\n")}`,
          },
        }] : []),
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "✅ Approve" }, style: "primary", action_id: `approve_${args.vendor_id}` },
            { type: "button", text: { type: "plain_text", text: "❌ Reject" }, style: "danger", action_id: `reject_${args.vendor_id}` },
            { type: "button", text: { type: "plain_text", text: "📄 View Details" }, action_id: `details_${args.vendor_id}` },
          ],
        },
      ],
    };
    await postToSlack(message);
    return { content: [{ type: "text", text: "Approval request sent to Slack" }] };
  }
);

const notificationServer = createSdkMcpServer({
  name: "notifications",
  tools: [sendWhatsAppForm, sendApprovalRequest],
});
```

### 9.8 Full MCP Integration Map

| MCP Server | Tools | Use Case |
|------------|-------|----------|
| **gst-portal** | search_gstin, check_gst_filing_status | GSTIN validation, filing compliance check |
| **pan-verification** | verify_pan, check_206ab_status | PAN validation, TDS non-filer check |
| **mca-portal** | search_mca_company, check_director_status | Company verification, director DIN check |
| **udyam-verification** | verify_udyam | MSME registration verification |
| **bank-verification** | verify_bank_account, validate_ifsc | Penny drop verification, IFSC lookup |
| **tally-erp** | create_tally_vendor, update_tally_vendor | Vendor master creation in Tally |
| **sap-b1** | create_sap_vendor | Vendor master creation in SAP |
| **zoho-books** | create_zoho_vendor | Vendor master creation in Zoho |
| **notifications** | send_whatsapp_vendor_form, send_approval_request, send_completion_notice | WhatsApp forms, Slack approvals |
| **document-store** | upload_document, get_document, list_documents | S3/MinIO document management |
| **playwright** | navigate, screenshot, extract | Scrape government portals if APIs unavailable |

---

## 10. Example User Interactions

### New Vendor Onboarding Request

```
User: "Onboard vendor 'Raj Steel Industries'. Contact: Rajesh Kumar, +91-9876543210.
       They supply raw materials. GSTIN: 27AABCR1234F1ZM, PAN: AABCR1234F"

Agent flow:
1. Creates vendor record with status "initiated"
2. Dispatches government-validator in parallel:
   - GSTIN validation → Active, Regular taxpayer, Maharashtra
   - PAN verification → Active, matches "Raj Steel Industries"
   - MCA lookup → Not a company (partnership firm)
   - Bank details → Pending (not provided yet)
3. Sends WhatsApp to +91-9876543210:
   "Hi Rajesh, please complete registration for ABC Pvt Ltd.
    Upload: Cancelled cheque, MSME certificate (if applicable), Address proof"
4. Preliminary risk assessment:
   - GSTIN: Active ✅, 6/6 returns filed ✅
   - PAN: Active ✅, name matches ✅
   - MSME: Not yet verified (awaiting Udyam number)
   - Bank: Pending
5. Returns: "Vendor initiated. GSTIN and PAN verified successfully.
   GST filing is compliant (6/6 returns filed).
   Awaiting: Bank details, MSME certificate from vendor.
   WhatsApp sent to Rajesh for document collection."
```

### Bulk Vendor Verification

```
User: "We have 50 vendors in our Excel sheet. Verify all GSTINs and flag non-compliant ones."

Agent flow:
1. Reads Excel file, extracts GSTIN column
2. Dispatches government-validator to check all 50 GSTINs (batched, 10 at a time)
3. Generates compliance report:
   "📊 Bulk GSTIN Verification — 50 vendors

   ✅ Active & Compliant: 38 vendors
   ⚠️ Active but Filing Issues: 7 vendors
      - XYZ Traders (27AABCX1234F1ZM) — GSTR-3B not filed for 3 months
      - ABC Services (29AABCA5678F1ZP) — GSTR-1 late by 45 days
      [... 5 more]
   🔴 Inactive/Cancelled: 3 vendors
      - DEF Enterprises (27AABCD9999F1ZM) — GSTIN Cancelled on 2025-11-15
      [... 2 more]
   ❓ Composition Dealers: 2 vendors (ITC NOT claimable)

   Report saved: ./vendor-data/reports/bulk-verification-2026-03-24.xlsx"
```

### TDS Section Determination

```
User: "We're hiring CloudTech Solutions (Pvt Ltd) for IT consulting at ₹5L/month.
       PAN: AABCC1234F, GSTIN: 29AABCC1234F1ZP"

Agent flow:
1. Validates PAN → Active, Company (4th char = C)
2. Validates GSTIN → Active, Regular, Karnataka
3. Determines TDS:
   "TDS Configuration for CloudTech Solutions:

   Payment Nature: Professional/Technical Services
   Section: 194J
   Rate: 10% (Professional services to a company)
   Annual Threshold: ₹30,000
   Monthly Payment: ₹5,00,000 → Monthly TDS: ₹50,000

   Additional Checks:
   ✅ PAN available — standard rate applies (not 20%)
   ✅ Not a 'specified person' under 206AB — standard rate applies
   ❌ No Lower TDS Certificate on file

   Note: If services are purely 'technical services' (not professional),
   rate would be 2% under 194J. Please confirm nature of services."
```

### MSME Vendor Detection

```
User: "Check if Vishwa Packaging is an MSME. Their Udyam number is UDYAM-MH-02-0012345"

Agent flow:
1. Dispatches government-validator → Udyam API verification
2. Returns:
   "✅ MSME Verified — Vishwa Packaging

   Udyam Number: UDYAM-MH-02-0012345
   Category: Small Enterprise
   Activity: Manufacturing
   Investment: ₹4.2 Cr | Turnover: ₹18 Cr
   State: Maharashtra

   ⚠️ COMPLIANCE IMPACT:
   - Payment MUST be made within 45 days of acceptance (MSME Act Sec 15)
   - If delayed: Interest @ 3x RBI bank rate (currently ~19.5% p.a.)
   - Must report in MSME-1 filing (half-yearly to MCA)
   - Payment terms in ERP will be set to NET 45 (max)

   Updating vendor master with MSME flag..."
```

### Risk Assessment Report

```
User: "Show me the risk report for the vendor we just onboarded — Quick Logistics LLP"

Agent flow:
1. Reads risk score from ./vendor-data/risk/VND-2026-0152/risk-report.md
2. Returns:
   "📋 Risk Assessment — Quick Logistics LLP (VND-2026-0152)

   Overall Score: 62/100 — MEDIUM RISK

   Identity Verification: 20/25
   ✅ PAN verified (Active)
   ✅ GSTIN active (27AADFL1234F1ZM)
   ✅ Bank account verified (penny drop passed)
   ❌ LLPIN verification failed — LLP not found on MCA (-5)

   Compliance Health: 15/25
   ✅ GST returns filed (5/6 months) — 1 month late
   ❌ LLP Form 8 & 11 not filed for FY2024-25 (-10)

   Financial Stability: 15/25
   ✅ In business since 2019 (7 years)
   ⚠️ MSME status: Not registered
   ❌ Designated Partner's DPIN has compliance notice

   Operational Risk: 12/25
   ✅ Not on any blacklist
   ❌ Related party flag — Partner Suresh Mehta is also on Board of your subsidiary ABC Logistics Pvt Ltd (-5)
   ⚠️ Adverse media: 1 article found (payment dispute, 2024) (-3)

   🟡 RECOMMENDATION: Standard Approval (Procurement Head)
   FLAGS:
   • Related party — requires Ind AS 24 disclosure
   • LLP filings not current — request compliance certificate
   • DPIN compliance notice — monitor"
```

---

## 11. Data Model

### Directory Structure

```
./vendor-data/
  entity-config.json                        # Buying company's configuration
  vendors/
    VND-2026-0001/
      profile.json                          # Vendor profile data
      documents/
        pan-card.pdf
        gst-certificate.pdf
        cancelled-cheque.jpg
        udyam-certificate.pdf
        board-resolution.pdf
      extracted/
        pan-ocr.json                        # OCR extraction results
        cheque-ocr.json
      validations/
        gstin.json                          # GSTIN API response + flags
        pan.json                            # PAN verification result
        mca.json                            # MCA/CIN lookup result
        udyam.json                          # Udyam verification result
        bank.json                           # Bank penny drop result
        validation-summary.json             # Consolidated validation status
      risk/
        risk-score.json                     # Detailed risk score breakdown
        tds-section.json                    # TDS determination
        flags.json                          # All compliance flags
        risk-report.md                      # Human-readable report
        blacklist-check.json                # Screening results
      approval/
        workflow.json                       # Approval chain and status
        approval-history.jsonl              # Timestamped approval actions
      erp/
        erp-payload.json                    # Data sent to ERP
        erp-response.json                   # ERP vendor code and confirmation
        field-mapping.json                  # Field mapping log
      monitoring/
        2026-03-quarterly-check.md          # Periodic re-validation reports
        2026-06-quarterly-check.md
  reports/
    bulk-verification-2026-03-24.xlsx       # Bulk reports
    onboarding-summary-2026-03.md           # Monthly summary
    msme-vendor-list.json                   # MSME vendors (for MSME-1 filing)
    tds-vendor-matrix.json                  # All vendors with TDS sections
  templates/
    vendor-registration-form.json           # WhatsApp/Email form template
    document-checklist.json                 # Required docs per entity type
    approval-matrix.json                    # Risk-based approval rules
  blacklists/
    internal-blacklist.json                 # Company's own blacklist
    gem-debarred.json                       # Cached GeM debarment list
  audit-trail.jsonl                         # Immutable audit log
```

### Vendor Profile Schema

```json
{
  "vendor_id": "VND-2026-0152",
  "status": "active",
  "onboarding_status": "completed",
  "onboarding_date": "2026-03-24",
  "legal_name": "Quick Logistics LLP",
  "trade_name": "Quick Logistics",
  "entity_type": "llp",
  "pan": "AADFL1234F",
  "gstins": [
    {
      "gstin": "27AADFL1234F1ZM",
      "state": "Maharashtra",
      "state_code": "27",
      "registration_type": "regular",
      "status": "active"
    }
  ],
  "cin_or_llpin": "AAB-1234",
  "udyam_number": null,
  "msme_category": null,
  "bank_details": {
    "account_number": "50200012345678",
    "ifsc": "HDFC0001234",
    "bank_name": "HDFC Bank",
    "branch": "Andheri West",
    "account_holder_name": "Quick Logistics LLP",
    "verified": true,
    "verification_date": "2026-03-24"
  },
  "tds": {
    "section": "194C",
    "rate": 2,
    "entity_rate_type": "others",
    "lower_tds_certificate": null,
    "is_specified_person_206ab": false,
    "pan_available": true
  },
  "contacts": [
    {
      "name": "Suresh Mehta",
      "designation": "Designated Partner",
      "email": "suresh@quicklogistics.in",
      "phone": "+91-9876543210"
    }
  ],
  "address": {
    "line1": "Plot 42, MIDC Industrial Area",
    "line2": "Andheri East",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pin": "400093"
  },
  "risk": {
    "score": 62,
    "tier": "medium",
    "last_assessed": "2026-03-24",
    "next_review": "2026-09-24",
    "flags": ["related_party", "llp_filings_pending"]
  },
  "compliance_tags": {
    "is_msme": false,
    "is_composition_dealer": false,
    "is_related_party": true,
    "payment_terms_days": 30,
    "e_invoicing_applicable": false
  },
  "erp": {
    "vendor_code": "V-10152",
    "erp_system": "tally",
    "ledger_group": "Sundry Creditors",
    "created_at": "2026-03-24"
  },
  "documents": {
    "pan_card": { "uploaded": true, "verified": true, "path": "documents/pan-card.pdf" },
    "gst_certificate": { "uploaded": true, "verified": true, "path": "documents/gst-certificate.pdf" },
    "cancelled_cheque": { "uploaded": true, "verified": true, "path": "documents/cancelled-cheque.jpg" },
    "udyam_certificate": { "uploaded": false, "verified": false },
    "board_resolution": { "uploaded": false, "verified": false }
  },
  "audit": {
    "created_by": "procurement_team",
    "approved_by": ["procurement_head"],
    "approval_date": "2026-03-24",
    "last_modified": "2026-03-24"
  }
}
```

---

## 12. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **PII/Sensitive data (PAN, bank A/C, Aadhaar)** | PII masking hook in notifications; data at rest encryption; access control per role |
| **Bank fraud (fake account details)** | Mandatory penny drop verification; name match threshold ≥75%; flag savings accounts for companies |
| **Identity fraud (fake PAN/GSTIN)** | Real-time government API validation; cross-verify PAN in GSTIN with declared PAN; OCR cross-check |
| **Approved record tampering** | Immutability hooks prevent modification of approved vendor records and audit trail |
| **Unauthorized vendor approval** | Multi-level approval workflows; approval matrix enforced by system; no auto-approve for high/critical risk |
| **Data isolation (multi-entity)** | Each buying entity has separate vendor-data directory; hooks enforce access boundaries |
| **API credential security** | All API keys in .env (blocked by sensitive access hook); never logged or transmitted |
| **Vendor document storage** | Documents stored in S3/MinIO with server-side encryption; signed URLs for time-limited access |
| **Audit compliance** | Every tool call logged to audit-trail.jsonl; immutable; includes timestamp, agent, action |
| **Blacklist evasion** | Cross-reference PAN + director DINs + addresses across blacklists (not just entity name) |
| **Related party concealment** | Automated director/shareholder cross-matching; address proximity checks |
| **Session security** | Agent sessions scoped to specific vendor onboarding; no cross-vendor data access |

---

## 13. Development Roadmap

### Phase 1 — Core Onboarding (Week 1-3)
- [ ] Entity config setup (buying company profile)
- [ ] Vendor profile creation and document checklist generation
- [ ] GSTIN validation via GSP API
- [ ] PAN verification via KYC provider API
- [ ] Bank account verification (penny drop via Razorpay/Cashfree)
- [ ] IFSC validation via RBI master
- [ ] Basic risk scoring (identity + compliance components)
- [ ] Single-level approval workflow
- [ ] Slack notification for approvals
- [ ] Audit trail logging

### Phase 2 — Advanced Validation (Week 4-5)
- [ ] MCA/ROC company verification
- [ ] Director DIN status check
- [ ] Udyam/MSME verification
- [ ] Section 206AB non-filer check via TRACES
- [ ] TDS section auto-determination engine
- [ ] Lower TDS certificate tracking
- [ ] Document OCR extraction (PAN card, cancelled cheque, GST cert)
- [ ] Multi-level approval workflow with escalation

### Phase 3 — Risk Intelligence (Week 6-7)
- [ ] Full risk score model (4 components, 100-point scale)
- [ ] Internal blacklist management
- [ ] GeM debarment list integration
- [ ] MCA vanishing companies check
- [ ] Related party detection (director/shareholder cross-match)
- [ ] Adverse media screening (web search)
- [ ] Composition dealer flagging with cost impact analysis
- [ ] MSME compliance: 45-day payment mandate enforcement

### Phase 4 — ERP Integration (Week 8-9)
- [ ] Tally Prime vendor master creation via XML Gateway
- [ ] SAP Business One vendor creation via Service Layer
- [ ] Zoho Books vendor creation via API
- [ ] TDS configuration in ERP
- [ ] MSME flag and payment terms auto-set
- [ ] GL code and cost center mapping
- [ ] HSN/SAC code mapping for default line items

### Phase 5 — Vendor Communication (Week 10-11)
- [ ] WhatsApp Business API integration for document collection
- [ ] Vendor self-service registration portal (React)
- [ ] Email-based document collection (parse attachments)
- [ ] Multi-language support (Hindi, Marathi, Tamil, etc.)
- [ ] Automated follow-ups for missing documents (T+2, T+5, T+7)
- [ ] WhatsApp status updates to vendor during onboarding

### Phase 6 — Monitoring & Reporting (Week 12-14)
- [ ] Periodic vendor re-validation (quarterly/semi-annual/annual)
- [ ] GSTIN status change detection
- [ ] MCA status change alerts
- [ ] Lower TDS certificate expiry tracking
- [ ] MSME vendor list for MSME-1 filing
- [ ] TDS vendor matrix report (for quarterly TDS returns)
- [ ] Bulk vendor verification from Excel
- [ ] Onboarding analytics dashboard
- [ ] Vendor compliance score trends

---

## 14. Cost Estimates

| Operation | Model | Est. Tokens | Est. Cost |
|-----------|-------|-------------|-----------|
| Single vendor onboarding (full) | Mixed | ~50K total | ~₹42 |
| Government validation (5 APIs) | Sonnet 4.6 | ~15K in / 5K out | ~₹7 |
| Risk score calculation | Opus 4.6 | ~20K in / 5K out | ~₹20 |
| TDS section determination | Sonnet 4.6 | ~5K in / 2K out | ~₹2.50 |
| Document OCR + extraction | Sonnet 4.6 | ~10K in / 3K out | ~₹4 |
| Approval workflow routing | Haiku 4.5 | ~3K in / 1K out | ~₹0.85 |
| ERP master creation | Sonnet 4.6 | ~8K in / 3K out | ~₹3.50 |
| Bulk verification (50 vendors) | Mixed | ~200K total | ~₹170 |
| Quarterly monitoring (per vendor) | Sonnet 4.6 | ~10K total | ~₹4 |
| Monthly cost (50 vendors, ongoing) | Mixed | ~500K total | ~₹425 |

**Optimization tips:**
- Use Haiku 4.5 for notifications, simple lookups, and form parsing
- Use Sonnet 4.6 for validation logic, document extraction, and ERP integration
- Reserve Opus 4.6 for risk assessment and complex compliance decisions
- Cache government API responses for 24 hours (GSTIN/PAN don't change frequently)
- Batch process bulk verifications to minimize API call overhead
- Use prompt caching for system prompts and entity configuration

---

## 15. Getting Started — Quick Setup

```bash
# 1. Create project
mkdir vendor-onboarding-agent && cd vendor-onboarding-agent
npm init -y
npm install @anthropic-ai/claude-agent-sdk pg bullmq ioredis xlsx pdf-parse tesseract.js zod dayjs

# 2. Set API keys
export ANTHROPIC_API_KEY=your-anthropic-key
export GSP_API_KEY=your-gst-suvidha-provider-key      # ClearTax/Masters India/IRIS
export KYC_API_KEY=your-kyc-provider-key               # Karza/Signzy/Digio
export BANK_VERIFY_API_KEY=your-bank-verify-key        # Razorpay/Cashfree/Decentro
export MCA_API_KEY=your-mca-provider-key               # Tofler/Zaubacorp/SignalX
export WHATSAPP_API_KEY=your-whatsapp-business-key     # Meta/Twilio
export SLACK_BOT_TOKEN=your-slack-bot-token

# 3. Create directory structure
mkdir -p vendor-data/{vendors,reports,templates,blacklists}
mkdir -p vendor-data/templates

# 4. Initialize entity configuration
# Edit vendor-data/entity-config.json with your company's details, approval matrix

# 5. Run first vendor onboarding
npx tsx agent.ts "Onboard vendor 'ABC Traders'. PAN: AABCA1234F, GSTIN: 27AABCA1234F1ZM, Contact: +91-9876543210"

# 6. Run bulk verification
npx tsx agent.ts "Verify all vendors in ./vendor-data/reports/vendor-list.xlsx"

# 7. Start monitoring scheduler
npx tsx scheduler.ts
```

---

## 16. Integration with Statutory Compliance Calendar Agent

The Vendor Onboarding Agent feeds critical data to the [Statutory Compliance Calendar Agent](./statutory-compliance-calendar-agent-spec.md):

| Data from Vendor Onboarding | Used by Compliance Calendar For |
|-----------------------------|-------------------------------|
| **MSME vendor list** | MSME-1 half-yearly filing (MCA) — report payments >45 days to MSMEs |
| **TDS section per vendor** | Monthly TDS payment calculations and quarterly return preparation (24Q/26Q) |
| **Vendor PAN master** | TDS return filing (populate deductee details) |
| **Lower TDS certificates** | Track expiry, alert before certificate lapses |
| **GSTIN list of vendors** | GSTR-2A/2B reconciliation (match vendor invoices) |
| **Composition dealer flags** | Exclude from ITC claims in GSTR-3B |
| **Vendor payment terms** | Cash flow forecasting for advance tax (Section 234C) |

This creates a powerful **compliance pipeline**: vendor onboarding ensures clean master data → compliance calendar uses that data for accurate filings.

---

## 17. API Provider Reference (India)

| Service | Recommended Providers | Pricing |
|---------|-----------------------|---------|
| **GSTIN Verification** | ClearTax GSP, Masters India, IRIS Business | ₹0.50-2/lookup |
| **PAN Verification** | Karza, Signzy, Digio, Surepass | ₹1-3/lookup |
| **Bank Account Verification** | Razorpay, Cashfree, Decentro | ₹2-5/penny drop |
| **IFSC Lookup** | Razorpay IFSC (free), RBI master | Free |
| **MCA/CIN Lookup** | Tofler, Zaubacorp, SignalX, Probe42 | ₹2-10/lookup |
| **Udyam Verification** | Karza, Signzy | ₹1-3/lookup |
| **206AB Check** | TRACES (free for TAN holders), Karza | Free/₹1 |
| **Aadhaar Verification** | Digilocker, UIDAI (restricted) | Restricted |
| **WhatsApp Business API** | Meta Cloud API, Twilio, Gupshup | ₹0.50-1/message |
| **OCR/Document Extraction** | Google Vision API, Tesseract (free), Nanonets | Free-₹0.10/page |
| **Adverse Media/Screening** | Dow Jones, Refinitiv, or web search | Varies |

---

## 18. References

- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Agent SDK Demo Agents](https://github.com/anthropics/claude-agent-sdk-demos)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)
- [GST Portal — Taxpayer Search](https://services.gst.gov.in/services/searchtp)
- [NSDL PAN Verification](https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html)
- [MCA Company Master](https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do)
- [Udyam Registration Portal](https://udyamregistration.gov.in/)
- [RBI IFSC Directory](https://www.rbi.org.in/Scripts/IFSCMICRDetails.aspx)
- [TRACES — TDS Compliance](https://www.tdscpc.gov.in/)
- [MSME Act — Payment Provisions](https://msme.gov.in/acts-and-rules)
- [Section 206AB — Specified Person Lookup](https://report.insight.gov.in/reporting-webapp/complianceCheck)
- [GeM Debarred Vendors](https://gem.gov.in/)
- [Razorpay IFSC API](https://ifsc.razorpay.com/)
