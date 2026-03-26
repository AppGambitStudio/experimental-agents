# Deep Agent for SOC 2 Compliance — Research Document

## Overview

This document outlines how to build a **SOC 2 Compliance Agent** using the **Claude Agent SDK**. The agent autonomously manages the complete SOC 2 compliance lifecycle — from initial scoping and control mapping, through policy generation, evidence collection, gap assessment, remediation tracking, auditor coordination, and continuous monitoring. It supports first-time SOC 2 (Type I → Type II journey), ongoing annual audits, and multi-client management for consulting firms. What typically takes compliance teams 3-6 months of manual coordination becomes a streamlined, AI-orchestrated process with real-time compliance posture visibility.

---

## 1. Why This Agent Is Needed

### The Problem

SOC 2 compliance is a **coordination nightmare**:

| Pain Point | Detail |
|------------|--------|
| **3-6 month preparation cycle** | Companies spend months manually drafting policies, collecting evidence, and coordinating with auditors |
| **60+ controls to manage** | Security alone has 33 control points (CC1–CC9). Add Availability, Confidentiality, Processing Integrity, and Privacy — it grows to 60+ |
| **Evidence scattered across 10+ systems** | AWS console, GitHub, Jira, Okta, Slack, HR systems, MDM tools — evidence lives everywhere |
| **Policy-reality disconnect** | Policies are written aspirationally, not reflecting actual practices — auditors catch this immediately |
| **Auditor back-and-forth** | PBC (Prepared By Client) lists generate dozens of requests, follow-ups, and re-submissions |
| **Compliance drift** | Controls that pass audit in January may degrade by March — no continuous monitoring |
| **Tribal knowledge** | The compliance manager who "knows where everything is" becomes a single point of failure |
| **Recurring annual burden** | SOC 2 Type II requires annual audits — the entire cycle repeats every year with evidence for a new observation period |
| **Multi-criteria complexity** | Adding Availability, Privacy, or other criteria multiplies the control set and evidence requirements |

### Why Claude Agent SDK

The Agent SDK is ideal because SOC 2 compliance requires:
- **Multi-agent orchestration** — parallel policy drafting, evidence collection, gap assessment, and audit coordination
- **Session persistence** — compliance engagements span weeks/months (scope → remediate → audit → monitor)
- **MCP integrations** — connect to AWS, GitHub, Okta, Jira, Slack, HR systems, MDM tools via configurable MCP servers
- **Hooks for audit trail** — every action must be logged for the compliance audit itself
- **Human-in-the-loop** — policy approvals, remediation sign-offs, and evidence submissions require human confirmation
- **File handling** — read policies, generate documents, process evidence artifacts
- **Conversational interface** — interview stakeholders about actual practices, guide remediation owners

---

## 2. Architecture

### High-Level Design

```
                    +------------------------------------+
                    |   SOC 2 Compliance                 |
                    |      Main Agent                    |
                    |  (Orchestrator + State Machine)    |
                    +------------------------------------+
                      |       |       |       |       |       |
       +--------------+  +----+--+  +-+------++  +---+---+  ++--------+  +--+--------+
       |                 |        |            |          |              |
+------v--------+ +------v-----+ +v----------+ +v-------v--+ +v--------v--+ +v---------+
| Scoping &     | | Policy &   | | Evidence  | | Gap &      | | Audit      | | Continuous|
| Control       | | Document   | | Collection| | Remediation| | Coordination| | Monitoring|
| Mapping Agent | | Agent      | | Agent     | | Agent      | | Agent      | | Agent    |
| (Subagent)    | | (Subagent) | | (Subagent)| | (Subagent) | | (Subagent) | | (Subagent)|
+---------------+ +------------+ +-----------+ +------------+ +------------+ +----------+
       |                 |              |             |              |             |
+------v--------+ +------v-----+ +-----v-----+ +----v-------+ +----v------+ +---v-------+
| TSC criteria, | | Policy     | | MCP-based | | Gap ID,    | | Request   | | Scheduled |
| control map,  | | templates, | | system    | | task track,| | tracking, | | checks,   |
| risk assess   | | AI custom  | | connectors| | remediate  | | evidence  | | drift     |
+---------------+ +------------+ +-----------+ +------------+ | submission| | detection |
                                                               +-----------+ +-----------+
```

### End-to-End Compliance Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SOC 2 COMPLIANCE LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SCOPE            2. ASSESS           3. REMEDIATE                   │
│  ┌──────────┐       ┌──────────────┐     ┌────────────────┐            │
│  │ Business │       │ Gap analysis │     │ Fix identified │            │
│  │ context  │──────>│ against      │────>│ gaps with      │            │
│  │ interview│       │ selected TSC │     │ specific plans  │            │
│  │ + criteria│      │ criteria     │     │ + deadlines    │            │
│  │ selection│       └──────────────┘     └───────┬────────┘            │
│  └──────────┘              │                      │                     │
│       │              ┌─────v──────┐               │                     │
│  ┌────v───────┐      │ Generate   │               │                     │
│  │ Control    │      │ custom     │               │                     │
│  │ Matrix     │      │ policies   │               │                     │
│  │ creation   │      └────────────┘               │                     │
│  └────────────┘                                   │                     │
│                                                   │                     │
│  4. COLLECT          5. AUDIT            6. MONITOR                     │
│  ┌──────────────┐   ┌──────────────┐     ┌────────────────┐            │
│  │ Automated    │   │ Coordinate   │     │ Continuous     │            │
│  │ evidence     │<──│ with auditor │────>│ compliance     │            │
│  │ collection   │   │ PBC requests │     │ monitoring     │            │
│  │ from systems │   │ walkthroughs │     │ drift detect   │            │
│  │ via MCP      │   │ findings     │     │ posture score  │            │
│  └──────────────┘   └──────────────┘     └────────────────┘            │
│                                                   │                     │
│                          ┌────────────────────────┘                     │
│                          │ Annual cycle repeats                         │
│                          │ (Type II continuous)                         │
│                          └──────────────────────────►                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### State Machine

The orchestrator manages compliance state at two levels:

**Engagement-level states:**
```
SCOPING → GAP_ASSESSMENT → REMEDIATION → EVIDENCE_COLLECTION → AUDIT_PREP → AUDIT_FIELDWORK → AUDIT_COMPLETE → CONTINUOUS_MONITORING
```

**Control-level states (each control independently):**
```
NOT_ASSESSED → GAP_IDENTIFIED → REMEDIATION_IN_PROGRESS → IMPLEMENTED → EVIDENCE_COLLECTED → AUDITOR_REVIEWED → COMPLIANT
```

Key design decision: The engagement-level state machine is not strictly linear. After initial scoping, Gap Assessment, Remediation, Policy Drafting, and Evidence Collection can run in parallel. The orchestrator manages dependencies at the individual control level, not at the phase level.

### Tiered Autonomy Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMY LEVELS                               │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 1  │  Agent: Assess & Recommend                            │
│ (Trust   │  ──────────────────────────────────────────          │
│  building│  Agent reads systems via MCP, analyzes gaps, drafts   │
│  phase)  │  policies and remediation plans. ALL outputs are      │
│          │  proposals — human must review and approve every       │
│          │  control status change, policy, and evidence artifact. │
│          │  No auto-submission to auditor. No auto-closing gaps.  │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 2  │  Agent: Auto-Collect, Approve-to-Submit               │
│ (Proven  │  ──────────────────────────────────────────          │
│  trust)  │  Auto-collects evidence via MCP on schedule. Auto-    │
│          │  validates evidence (date range, completeness, hash).  │
│          │  Auto-generates monitoring alerts and posture scores.  │
│          │  Human approval still required for:                    │
│          │  - Submitting evidence to auditor                     │
│          │  - Closing gaps as "remediated"                        │
│          │  - Approving policies                                 │
│          │  - Marking controls as "compliant"                    │
│          │  - Any management response to auditor                 │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ LEVEL 3  │  Agent: Full Automation with Audit Gates               │
│ (Full    │  ──────────────────────────────────────────          │
│  trust)  │  Auto-collects, auto-validates, auto-packages         │
│          │  evidence. Auto-updates control statuses based on      │
│          │  MCP verification. Auto-sends routine monitoring       │
│          │  reports. Human approval ONLY for:                    │
│          │  - Submitting to auditor (always requires human)      │
│          │  - Policy approval (always requires human)            │
│          │  - Management responses (always requires human)       │
│          │  - Gap acceptance decisions (always requires human)   │
│          │                                                      │
├──────────┼──────────────────────────────────────────────────────┤
│          │                                                      │
│ ALL      │  ⛔ NEVER AUTO-EXECUTED (regardless of level)          │
│ LEVELS   │  - Submitting evidence or responses to auditor        │
│          │  - Approving policies on behalf of management         │
│          │  - Closing critical/high gaps without human review    │
│          │  - Generating or fabricating evidence artifacts        │
│          │  - Modifying evidence after collection (immutable)    │
│          │  - Accepting audit findings without mgmt review       │
│          │  - Changing audit scope or criteria                   │
│          │  - Granting system access or changing permissions     │
│          │  - Communicating directly with auditors               │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Enforcement — Role-Based Approval Gates:**

```typescript
// Approval gates enforced at the database level, not just prompt level
type ApprovalAction =
  | "submit_evidence_to_auditor"
  | "approve_policy"
  | "close_gap"
  | "mark_control_compliant"
  | "send_management_response"
  | "accept_risk"
  | "change_audit_scope"
  | "modify_control_matrix";

type Role = "admin" | "compliance_manager" | "control_owner" | "auditor_readonly";

const APPROVAL_MATRIX: Record<ApprovalAction, Role[]> = {
  submit_evidence_to_auditor:  ["compliance_manager", "admin"],
  approve_policy:              ["compliance_manager", "admin"],
  close_gap:                   ["compliance_manager", "control_owner", "admin"],
  mark_control_compliant:      ["compliance_manager", "admin"],
  send_management_response:    ["admin"],  // Only admin/management can respond to auditor
  accept_risk:                 ["admin"],  // Risk acceptance is a management decision
  change_audit_scope:          ["compliance_manager", "admin"],
  modify_control_matrix:       ["compliance_manager", "admin"],
};

// Database-level enforcement — agent cannot bypass this
async function requestApproval(
  action: ApprovalAction,
  entityId: string,
  requestedBy: string,  // "agent:evidence-agent" or user email
  details: Record<string, unknown>,
): Promise<{ approved: boolean; approver?: string }> {
  // 1. Create approval request in DB
  const request = await db.approvalRequests.create({
    action,
    entity_id: entityId,
    requested_by: requestedBy,
    details: JSON.stringify(details),
    required_roles: APPROVAL_MATRIX[action],
    status: "pending",
    created_at: new Date(),
  });

  // 2. Notify eligible approvers
  const approvers = await db.users.findByRoles(APPROVAL_MATRIX[action]);
  await notifyApprovers(approvers, request);

  // 3. Agent WAITS — cannot proceed without approval
  // This is a blocking operation. The agent saves state and resumes
  // when a human approves or rejects.
  return { approved: false };  // Will be updated by human action
}

// Pre-tool hook: intercept actions that require approval
const approvalGateHook: HookCallback = async (input) => {
  const toolName = (input as any).tool_name;
  const toolInput = (input as any).tool_input;

  const actionMap: Record<string, ApprovalAction> = {
    "submit_evidence_package": "submit_evidence_to_auditor",
    "approve_policy_version": "approve_policy",
    "close_gap": "close_gap",
    "update_control_status_compliant": "mark_control_compliant",
    "send_auditor_response": "send_management_response",
    "accept_gap_risk": "accept_risk",
  };

  const requiredAction = actionMap[toolName];
  if (requiredAction) {
    const approval = await checkExistingApproval(requiredAction, toolInput.entity_id);
    if (!approval?.approved) {
      return {
        decision: "block",
        message: `This action requires approval from: ${APPROVAL_MATRIX[requiredAction].join(" or ")}. Approval request created.`,
      };
    }
  }

  return {};
};
```

### Data Flow

1. **Scope** — Interview stakeholders, select TSC criteria, generate Control Matrix
2. **Assess** — Evaluate current state against each control, identify gaps
3. **Document** — Generate/customize policies based on actual practices (hybrid approach)
4. **Remediate** — Create remediation plans, assign owners, track progress, verify fixes
5. **Collect** — Connect to systems via MCP, gather evidence artifacts, validate completeness
6. **Audit** — Coordinate PBC requests, submit evidence, manage walkthroughs, draft management responses
7. **Monitor** — Continuous compliance checks, drift detection, posture scoring, annual cycle prep

---

## 3. Tech Stack

```
Language:        TypeScript (Node.js)
Agent SDK:       @anthropic-ai/claude-agent-sdk
Model:           claude-opus-4-6 (orchestrator, risk assessment, gap analysis, auditor responses)
                 claude-sonnet-4-6 (policy generation, evidence validation, control mapping)
                 claude-haiku-4-5 (monitoring checks, notifications, status lookups)

Hosting:         AWS ECS / Fargate (agent execution)
Storage:         Aurora PostgreSQL (multi-tenant, compliance data, audit trail)
                 DynamoDB (monitoring alerts, real-time state, session data)
File Storage:    S3 (evidence repository with versioning + server-side encryption)
CDN:             CloudFront (React dashboard delivery)
Secrets:         AWS Secrets Manager (MCP server credentials, API keys)
Queue:           BullMQ + Redis (scheduled monitoring jobs, evidence collection jobs)

MCP Servers:     Cloud Provider (AWS/GCP/Azure), SCM (GitHub/GitLab),
                 Identity Provider (Okta/Google Workspace), PM (Jira/Linear),
                 Communication (Slack/Email), HRIS (BambooHR/Rippling),
                 MDM (Jamf/Intune), Custom integrations
Frontend:        React dashboard (compliance posture, control matrix, audit tracker)
```

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
npm install @aws-sdk/client-s3 @aws-sdk/client-secrets-manager  # AWS services
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb       # DynamoDB
npm install pg                          # Aurora PostgreSQL
npm install bullmq ioredis              # Job scheduling
npm install zod                         # Schema validation
npm install dayjs                       # Date handling
npm install xlsx                        # Excel export (control matrix, evidence tracker)
npm install pdf-lib                     # PDF generation (audit packages)
npm install handlebars                  # Policy template engine
```

---

## 4. SOC 2 Trust Services Criteria Coverage

### 4.1 Security (Common Criteria — CC)

The Security category is the mandatory baseline for every SOC 2 audit.

| Control Area | Control Points | Description |
|-------------|---------------|-------------|
| **CC1 — Control Environment** | CC1.1–CC1.5 | Board/management oversight, organizational structure, commitment to competence, accountability, HR policies |
| **CC2 — Communication & Information** | CC2.1–CC2.3 | Internal/external communication of policies, objectives, and responsibilities |
| **CC3 — Risk Assessment** | CC3.1–CC3.4 | Risk identification, fraud risk, change identification, risk assessment process |
| **CC4 — Monitoring Activities** | CC4.1–CC4.2 | Ongoing monitoring, evaluation and communication of deficiencies |
| **CC5 — Control Activities** | CC5.1–CC5.3 | Selection/development of controls, technology controls, policy deployment |
| **CC6 — Logical & Physical Access** | CC6.1–CC6.8 | Access provisioning, authentication (MFA), access removal, physical access, data transmission encryption |
| **CC7 — System Operations** | CC7.1–CC7.5 | Change management, infrastructure monitoring, incident detection, incident response, recovery |
| **CC8 — Change Management** | CC8.1 | Authorized, tested, approved changes to infrastructure and software |
| **CC9 — Risk Mitigation** | CC9.1–CC9.2 | Vendor/business partner risk management, risk mitigation activities |

### 4.2 Availability (A)

| Control Area | Control Points | Description |
|-------------|---------------|-------------|
| **A1 — System Availability** | A1.1–A1.3 | Capacity planning, recovery objectives (RPO/RTO), backup/restoration testing, BCP/DR plans |

### 4.3 Confidentiality (C)

| Control Area | Control Points | Description |
|-------------|---------------|-------------|
| **C1 — Confidential Information** | C1.1–C1.2 | Identification of confidential info, disposal procedures, NDA/confidentiality agreements |

### 4.4 Processing Integrity (PI)

| Control Area | Control Points | Description |
|-------------|---------------|-------------|
| **PI1 — Processing Integrity** | PI1.1–PI1.5 | Data input validation, processing accuracy, output review, error handling, audit trails |

### 4.5 Privacy (P)

| Control Area | Control Points | Description |
|-------------|---------------|-------------|
| **P1 — Privacy** | P1.0–P1.8 | Privacy notice, consent, collection limitation, use/retention/disposal, access rights, disclosure to third parties, quality, monitoring |

### 4.6 Control-to-Evidence Mapping (Security Baseline)

| Control | What Auditors Look For | Evidence Sources |
|---------|----------------------|------------------|
| CC6.1 — Logical Access | Role-based access, least privilege, MFA enforcement | IAM policies, Okta MFA reports, access review logs |
| CC6.3 — Access Removal | Timely deprovisioning on termination | HRIS termination records ↔ IdP deprovisioning logs, access removal tickets |
| CC6.6 — Encryption | Data encrypted in transit and at rest | TLS/SSL configs, AWS KMS policies, S3 encryption settings |
| CC7.1 — Infrastructure Monitoring | Logging enabled, alerts configured | CloudTrail settings, CloudWatch alarms, SIEM dashboards |
| CC7.2 — Change Management | Changes approved, tested, documented | PR approval history, CI/CD configs, change tickets |
| CC7.3 — Vulnerability Management | Regular scanning, timely patching | Vulnerability scan reports, patch deployment records |
| CC7.4 — Incident Response | Documented plan, tested procedures, post-mortems | IR plan document, tabletop exercise records, incident tickets |
| CC8.1 — Change Authorization | Segregation of duties in deployments | Branch protection rules, deployment approval gates |
| CC9.1 — Vendor Management | Third-party risk assessment, SOC 2 reports from vendors | Vendor risk assessments, vendor SOC 2 reports, SLA tracking |

---

## 5. Subagent Specifications

### 5.1 Scoping & Control Mapping Agent

**Role:** Foundation agent — everything else depends on its output.

**Responsibilities:**
- Interview the company to understand business context (industry, product type, data handled, infrastructure, team size, compliance history)
- Determine which Trust Services Criteria apply based on business profile
- Map selected TSC criteria to specific controls
- Perform initial risk assessment per control
- Generate the Control Matrix — the master tracking document

**Business Context Interview (first-time companies):**

```typescript
interface BusinessContext {
  // Company profile
  company_name: string;
  industry: string;                    // SaaS, Fintech, Healthcare, etc.
  product_description: string;
  year_founded: number;
  employee_count: number;
  engineering_team_size: number;

  // Data & customers
  data_types_handled: DataType[];      // PII, PHI, financial, proprietary
  customer_segments: string[];         // Enterprise, SMB, Consumer, Government
  geographic_regions: string[];        // US, EU, APAC
  data_residency_requirements: string[];

  // Infrastructure
  cloud_providers: CloudProvider[];    // AWS, GCP, Azure, multi-cloud
  hosting_model: "cloud_native" | "hybrid" | "on_prem";
  key_services: string[];             // e.g., EC2, RDS, S3, Lambda, EKS
  environments: string[];             // prod, staging, dev
  ci_cd_tools: string[];              // GitHub Actions, Jenkins, CircleCI
  monitoring_tools: string[];         // Datadog, CloudWatch, PagerDuty

  // Identity & access
  identity_provider: string;          // Okta, Google Workspace, Azure AD
  mfa_enforced: boolean;
  sso_configured: boolean;

  // Existing compliance
  previous_soc2: boolean;
  previous_audit_type?: "type_i" | "type_ii";
  other_certifications: string[];     // ISO 27001, HIPAA, PCI-DSS, SOC 1
  existing_policies: string[];        // List of policies already in place

  // Audit preferences
  target_criteria: TSCCriteria[];     // Security + selected additional criteria
  target_audit_type: "type_i" | "type_ii";
  desired_audit_period?: {            // For Type II
    start: string;
    end: string;                      // Typically 3-12 months
  };
  preferred_auditor?: string;         // CPA firm already engaged
}

type DataType = "pii" | "phi" | "financial" | "proprietary" | "public";
type CloudProvider = "aws" | "gcp" | "azure" | "other";
type TSCCriteria = "security" | "availability" | "confidentiality" | "processing_integrity" | "privacy";
```

**Control Matrix output:**

```typescript
interface ControlMatrix {
  engagement_id: string;
  organization_id: string;
  criteria_in_scope: TSCCriteria[];
  generated_date: string;
  controls: Control[];
}

interface Control {
  control_id: string;                  // e.g., CC6.1, A1.2, P1.3
  tsc_criteria: TSCCriteria;
  control_area: string;                // e.g., "Logical & Physical Access"
  control_description: string;         // AICPA description
  control_objective: string;           // What the control aims to achieve
  risk_level: "high" | "medium" | "low";
  applicability: "applicable" | "not_applicable" | "partially_applicable";
  applicability_rationale?: string;    // Why N/A if excluded
  owner: string;                       // Role/person responsible
  status: ControlStatus;
  evidence_requirements: EvidenceRequirement[];
  implementation_guidance: string;     // Specific guidance for this company
}

type ControlStatus =
  | "not_assessed"
  | "gap_identified"
  | "remediation_in_progress"
  | "implemented"
  | "evidence_collected"
  | "auditor_reviewed"
  | "compliant";

interface EvidenceRequirement {
  evidence_id: string;
  description: string;                 // What evidence is needed
  source_system: string;               // Where to get it
  collection_method: "automated" | "semi_automated" | "manual";
  frequency: "point_in_time" | "periodic" | "continuous";
  status: "not_collected" | "collected" | "validated" | "submitted" | "accepted";
}
```

**Key behaviors:**
- For first-time companies: full discovery interview (20-30 questions about infrastructure, data flow, team, processes)
- For existing SOC 2 companies: import previous audit report, identify what's changed, update the Control Matrix
- For consulting firms: template the scoping process across clients, flag industry-specific controls (e.g., HIPAA overlap for healthcare SaaS)

### 5.2 Policy & Documentation Agent

**Role:** Hybrid policy engine — templates + AI customization based on actual practices.

**Responsibilities:**
- Maintain a library of SOC 2 policy templates covering all TSC criteria
- Interview stakeholders about actual practices (not aspirational — what they really do today)
- Generate customized policies reflecting reality while meeting SOC 2 requirements
- Identify gaps where actual practices fall short and flag for remediation
- Manage version control and annual review cycles

**Core policy set (Security baseline):**

| Policy | Purpose | Key Contents |
|--------|---------|-------------|
| Information Security Policy | Master policy | Scope, roles, risk appetite, governance structure |
| Access Control Policy | Logical & physical access | Provisioning, deprovisioning, MFA, least privilege, access reviews |
| Change Management Policy | System changes | Approval workflows, testing requirements, rollback procedures, emergency changes |
| Incident Response Plan | Security incidents | Detection, triage, escalation matrix, communication plan, post-mortem template |
| Risk Assessment Policy | Risk management | Risk identification methodology, scoring criteria, treatment plans, risk register |
| Data Classification Policy | Data handling | Classification levels (Public/Internal/Confidential/Restricted), handling procedures per level |
| Vendor Management Policy | Third-party risk | Vendor assessment questionnaire, ongoing monitoring, contractual security requirements |
| Business Continuity & DR Plan | Availability | RPO/RTO targets, backup procedures, failover architecture, DR testing schedule |
| Acceptable Use Policy | Employee conduct | Approved tools and devices, data handling rules, reporting obligations |
| HR Security Policy | People controls | Background checks, onboarding security training, offboarding checklist |
| Encryption Policy | Data protection | Encryption standards (AES-256 at rest, TLS 1.2+ in transit), key management |
| Logging & Monitoring Policy | Audit trails | What to log, retention periods, alert thresholds, log access controls |

**Additional policies activated by criteria:**

| Criteria | Additional Policies |
|----------|-------------------|
| Availability | Capacity Planning Policy, SLA Management Policy, Disaster Recovery Testing Procedures |
| Confidentiality | Data Retention & Disposal Policy, NDA Management Procedures, Confidential Data Access Log |
| Processing Integrity | Data Validation Procedures, Error Handling & Correction Policy, Processing Reconciliation Procedures |
| Privacy | Privacy Notice, Data Subject Rights Procedures, Cookie & Consent Policy, Data Processing Agreements, Privacy Impact Assessment Template |

**Hybrid generation flow:**

```typescript
interface PolicyGenerationFlow {
  steps: [
    {
      step: 1;
      action: "load_template";
      description: "Load base template for the policy type with AICPA-aligned structure";
    },
    {
      step: 2;
      action: "interview_stakeholder";
      description: "Ask about actual practices for this domain";
      example_questions: [
        "How do you handle access provisioning today? Who approves?",
        "How quickly is access revoked when someone leaves?",
        "Do you have an automated deprovisioning process?",
        "When was the last time you tested your incident response plan?"
      ];
    },
    {
      step: 3;
      action: "draft_policy";
      description: "Merge template structure with actual practices — reflect reality, not aspirations";
    },
    {
      step: 4;
      action: "gap_identification";
      description: "Flag where practices fall short of SOC 2 requirements";
      example: "Your policy says access is revoked within 24 hours, but you mentioned there's no automated deprovisioning — this is a gap";
    },
    {
      step: 5;
      action: "human_review";
      description: "Present draft to policy owner for review and approval";
    },
    {
      step: 6;
      action: "version_and_store";
      description: "Store approved version with metadata: version, approver, approval date, next review date";
    }
  ];
}

interface PolicyDocument {
  policy_id: string;
  title: string;
  version: string;                     // Semantic versioning: 1.0.0
  status: "draft" | "in_review" | "approved" | "deprecated";
  content: string;                     // Markdown/HTML content
  controls_addressed: string[];        // Control IDs this policy covers
  owner: string;                       // Policy owner (role/name)
  approved_by: string;
  approved_date: string;
  effective_date: string;
  next_review_date: string;            // Typically annual
  change_log: PolicyChange[];
  acknowledgements: PolicyAcknowledgement[];
}

interface PolicyChange {
  version: string;
  date: string;
  changed_by: string;
  summary: string;
}

interface PolicyAcknowledgement {
  employee_id: string;
  employee_name: string;
  acknowledged_date: string;
  policy_version: string;
}
```

### 5.3 Evidence Collection Agent

**Role:** The workhorse — connects to actual systems and gathers proof that controls are operating.

**Responsibilities:**
- Connect to company systems via MCP servers to automatically collect evidence
- Map each control to specific evidence artifacts
- Validate collected evidence (complete? covers audit period? actually proves the control?)
- Maintain an evidence repository with proper naming, timestamps, and chain of custody
- Generate evidence collection status reports

**Evidence types by source:**

| Source | Evidence Collected | MCP Server |
|--------|-------------------|------------|
| AWS/GCP/Azure | IAM policies, security group configs, KMS encryption settings, CloudTrail logs, backup configs, VPC flow logs | Cloud Provider MCP |
| GitHub/GitLab | Branch protection rules, PR approval history, CI/CD pipeline configs, code review logs, CODEOWNERS files | SCM MCP |
| Jira/Linear | Change management tickets with approval workflows, incident tickets with timelines, sprint/backlog data | Project Management MCP |
| Okta/Google Workspace | MFA enrollment status, SSO configs, access provisioning/deprovisioning logs, access review exports, conditional access policies | Identity Provider MCP |
| Slack/Email | Security awareness training completion, incident communication threads, policy acknowledgement records | Communication MCP |
| MDM (Jamf/Intune) | Device encryption status, OS patch levels, endpoint protection status, approved software lists | MDM MCP |
| HR System (BambooHR/Rippling) | Background check records, onboarding/offboarding checklists, training records, org chart | HRIS MCP |
| Vulnerability Scanner | Scan reports, remediation SLAs, patching records | Security Tools MCP |
| Custom/Manual | Physical security photos, signed acknowledgements, board meeting minutes, insurance certificates | File Upload |

**Collection modes:**

```typescript
interface EvidenceCollectionConfig {
  automated: {
    description: "Agent pulls evidence directly from connected systems";
    examples: [
      "Export AWS IAM policy JSON via AWS MCP",
      "Pull GitHub branch protection rules via SCM MCP",
      "Export Okta MFA enrollment report via IdP MCP"
    ];
    human_review: "Required before submission to auditor";
  };
  semi_automated: {
    description: "Agent tells user exactly what to export and where to find it, validates upload";
    examples: [
      "Navigate to AWS Console → CloudTrail → Event History → Download CSV for date range",
      "In Okta Admin → Reports → MFA Enrollment → Export"
    ];
    human_review: "User performs the export, agent validates the artifact";
  };
  manual: {
    description: "Agent provides checklist for evidence that can't be automated";
    examples: [
      "Upload photo of server room access badge reader",
      "Upload signed board resolution approving Information Security Policy",
      "Upload certificate of cyber liability insurance"
    ];
    human_review: "User collects and uploads, agent confirms receipt";
  };
}
```

**Evidence validation logic:**

```typescript
interface EvidenceValidation {
  date_range_check: {
    description: "Evidence must cover the audit observation period";
    for_type_i: "Point-in-time — evidence must be current as of audit date";
    for_type_ii: "Period-based — evidence must cover the full observation period (typically 3-12 months)";
    alert: "Evidence dated outside the audit period will be flagged";
  };
  completeness_check: {
    description: "Does the evidence address all aspects of the control?";
    example: "For CC6.1 (access controls), we need both the IAM policy AND evidence it's enforced (access review logs)";
  };
  freshness_check: {
    description: "Is this evidence current or stale?";
    rules: [
      "Configuration screenshots older than 30 days should be refreshed",
      "Access reviews must be within the review cycle (quarterly/semi-annual)",
      "Vulnerability scans must be within the scanning frequency"
    ];
  };
  format_check: {
    description: "Is it in a format the auditor will accept?";
    preferred_formats: ["PDF", "CSV", "JSON", "PNG/screenshot with timestamp"];
    rejected: "Word documents with tracked changes, incomplete exports, redacted content";
  };
}

interface EvidenceArtifact {
  evidence_id: string;
  control_id: string;                  // Which control this proves
  title: string;
  description: string;
  source_system: string;
  collection_method: "automated" | "semi_automated" | "manual";
  file_path: string;                   // S3 path
  file_hash: string;                   // SHA-256 for integrity
  collected_by: string;                // Agent or user
  collected_date: string;
  valid_from: string;
  valid_to: string;
  validation_status: "pending" | "valid" | "invalid" | "stale";
  validation_notes: string;
  auditor_status: "not_submitted" | "submitted" | "accepted" | "rejected";
  auditor_feedback?: string;
}
```

### 5.4 Gap Assessment & Remediation Agent

**Role:** Turns findings into action — identifies gaps, creates remediation plans, tracks fixes, verifies closure.

**Responsibilities:**
- Analyze the Control Matrix against collected evidence and policies to identify gaps
- Classify gaps by severity and audit impact
- Generate remediation plans with specific steps, owners, and deadlines
- Track remediation progress and verify fixes
- Prioritize based on what auditors care about most

**Gap classification:**

| Severity | Definition | Example | Audit Impact |
|----------|-----------|---------|-------------|
| Critical | Control missing entirely | No incident response plan exists | Will result in qualified opinion / exception |
| High | Control exists but not operating effectively | MFA policy exists but 30% of users don't have it enabled | Likely exception with management response |
| Medium | Control partially implemented | Access reviews happen but aren't documented | Finding with remediation recommendation |
| Low | Minor documentation gap | Policy exists but hasn't been reviewed in 18 months | Observation, unlikely to be an exception |

**Remediation plan structure:**

```typescript
interface Gap {
  gap_id: string;
  control_id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;                 // What's wrong
  audit_impact: string;                // Why it matters — which TSC criteria affected
  status: "open" | "in_progress" | "remediated" | "verified" | "accepted_risk";
  identified_date: string;
  target_remediation_date: string;
  remediation_plan: RemediationPlan;
}

interface RemediationPlan {
  steps: RemediationStep[];
  owner: string;                       // Person/role responsible
  estimated_effort: string;            // e.g., "2 hours", "1 sprint"
  verification_method: string;         // How the agent confirms the fix
  evidence_after_fix: string;          // What artifacts prove the gap is closed
}

interface RemediationStep {
  order: number;
  description: string;                 // Specific, actionable instruction
  responsible: string;
  status: "pending" | "in_progress" | "done";
  completed_date?: string;
  notes?: string;
}
```

**Example gap with remediation:**

```
Gap: MFA not enforced for all production system access
Gap ID: GAP-2026-001
Control: CC6.1, CC6.3
Severity: Critical
Audit Impact: Exception — auditors will flag this as a control failure

Remediation Plan:
  1. Enable MFA enforcement in Okta for all AWS Console access (DevOps Lead, 1 day)
  2. Enable MFA requirement for GitHub organization (Engineering Lead, 1 day)
  3. Configure AWS IAM policy to deny console access without MFA condition (DevOps Lead, 2 hours)
  4. Run MFA enrollment report — target 100% (IT Admin, 1 day for follow-up)
  5. Document the MFA policy in Access Control Policy (Compliance Manager, 2 hours)

Owner: DevOps Lead
Deadline: 2 weeks before audit start
Verification: Agent pulls Okta MFA report + AWS IAM policy via MCP — confirms 100% enforcement
Evidence After Fix: Okta MFA enrollment report (100%), AWS IAM policy JSON with MFA condition, GitHub org security settings screenshot
```

**Closed-loop behavior:** The agent doesn't just find gaps — it re-checks via MCP after remediation deadline, verifies the fix, and updates the Control Matrix status. If verification fails, it re-opens the gap with updated notes.

### 5.5 Audit Coordination Agent

**Role:** Manages the auditor relationship and keeps the audit on track.

**Responsibilities:**
- Manage the audit timeline from engagement kickoff through report issuance
- Track PBC (Prepared By Client) requests and ensure timely responses
- Package and submit evidence in auditor-friendly formats
- Track findings, management responses, and remediation commitments
- Manage communication log between company and auditor

**Audit lifecycle:**

```
Engagement    →  Planning    →  Fieldwork     →  Findings     →  Report
Kickoff          Call           (Evidence        Review          Issuance
                                Requests)
   │               │              │                │               │
   ▼               ▼              ▼                ▼               ▼
Set audit       Confirm       Track PBC        Draft mgmt      Archive
period &        scope &       requests,        responses,      evidence,
timeline        walkthroughs  submit evidence  negotiate       store report
```

**PBC request tracking:**

```typescript
interface PBCRequest {
  request_id: string;
  engagement_id: string;
  control_id: string;                  // Which control this relates to
  description: string;                 // What the auditor is asking for
  auditor_notes?: string;              // Additional context from auditor
  status: "pending" | "in_progress" | "submitted" | "accepted" | "rejected" | "resubmission_needed";
  due_date: string;
  submitted_date?: string;
  evidence_ids: string[];              // Links to evidence artifacts
  auditor_feedback?: string;
  submission_notes?: string;           // Notes included with submission
  priority: "standard" | "urgent";
}

interface AuditTimeline {
  engagement_id: string;
  audit_type: "type_i" | "type_ii";
  observation_period?: {               // Type II only
    start: string;
    end: string;
  };
  key_dates: {
    engagement_signed: string;
    planning_call: string;
    fieldwork_start: string;
    fieldwork_end: string;
    draft_report: string;
    management_response_due: string;
    final_report: string;
  };
  walkthroughs: Walkthrough[];
}

interface Walkthrough {
  walkthrough_id: string;
  control_area: string;                // e.g., "Access Controls", "Change Management"
  scheduled_date: string;
  attendees: string[];                 // Who needs to be present
  talking_points: string[];            // Prepared by agent
  supporting_evidence: string[];       // Evidence IDs to have ready
  pre_walkthrough_checklist: string[]; // e.g., "Verify MFA is still enforced before demo"
  status: "scheduled" | "completed" | "rescheduled";
  auditor_notes?: string;
}
```

**Key behaviors:**
- When auditor sends a PBC request → agent maps it to controls in the Control Matrix and checks if evidence already exists
- If evidence exists → packages it and presents for human review before submission
- If evidence missing → routes to Evidence Collection Agent with urgency flag
- Tracks auditor feedback — if rejected, routes back for re-collection with specific auditor notes
- Drafts management responses for audit findings (human must review and approve before submission)
- Sends alerts for approaching (T-7, T-3, T-1) and overdue PBC deadlines

### 5.6 Continuous Monitoring Agent

**Role:** Keeps you compliant between audits — critical for Type II ongoing compliance.

**Responsibilities:**
- Run scheduled compliance checks against connected systems via MCP
- Detect configuration drift that could break controls
- Monitor for new risks (new users without MFA, expired certs, disabled logging)
- Generate compliance posture reports
- Alert on issues before they become audit findings

**Monitoring categories:**

| Category | What It Checks | Frequency | Example Alert |
|----------|---------------|-----------|--------------|
| Access Control | New users without MFA, stale accounts, privilege escalations, orphaned accounts | Daily | "3 users added to AWS admin group without access review ticket" |
| Change Management | Deploys without PR approval, direct production changes, missing tickets | Daily | "5 commits merged to main without required approvals this week" |
| Logging & Monitoring | CloudTrail enabled, log retention, alerting configured | Daily | "CloudTrail logging disabled in us-west-2 region" |
| Encryption | Data-at-rest encryption, TLS configs, certificate expiry | Weekly | "SSL certificate for api.company.com expires in 14 days" |
| Backup & DR | Backup job status, recovery test due dates, RPO/RTO compliance | Daily | "Database backup failed for 2 consecutive days" |
| Vendor Risk | Vendor SOC 2 report expiry, SLA compliance, security questionnaire due dates | Monthly | "AWS SOC 2 report expires next month — request updated version" |
| Training | Security awareness training completion, new hire training overdue | Weekly | "4 employees haven't completed annual security training (due in 10 days)" |
| Policy Review | Policy review dates approaching, policy acknowledgements pending | Monthly | "Incident Response Plan due for annual review in 30 days" |

**Compliance posture score:**

```typescript
interface CompliancePosture {
  organization_id: string;
  calculated_at: string;
  overall_score: number;               // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  components: {
    controls_compliant: {
      score: number;                   // % of controls with status = compliant
      weight: 30;
      details: string;                 // e.g., "28/33 security controls compliant"
    };
    evidence_current: {
      score: number;                   // % of evidence artifacts that are valid and current
      weight: 25;
      details: string;
    };
    policies_current: {
      score: number;                   // % of policies approved and within review cycle
      weight: 15;
      details: string;
    };
    gaps_resolved: {
      score: number;                   // % of identified gaps remediated and verified
      weight: 15;
      details: string;
    };
    monitoring_healthy: {
      score: number;                   // % of monitoring checks passing, no unresolved alerts
      weight: 15;
      details: string;
    };
  };
  open_issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  trend: "improving" | "stable" | "declining";
  next_audit_readiness: "ready" | "on_track" | "at_risk" | "not_ready";
}
```

**Drift detection:**

When the agent detects a configuration change that affects a control:
1. Identify which control(s) are affected
2. Assess whether the change breaks compliance
3. If breaking → create a remediation task with urgency flag
4. If benign → log the change for audit trail
5. Update the Control Matrix status accordingly

---

## 6. MCP Integrations

### 6.1 MCP Server Architecture

The agent uses a pluggable MCP server architecture. Each integration is an independent MCP server that can be added/removed without affecting the core agent.

```typescript
interface MCPServerConfig {
  server_id: string;
  server_type: MCPServerType;
  display_name: string;
  connection: {
    url: string;
    auth_method: "api_key" | "oauth2" | "iam_role" | "service_account";
    credentials_secret_id: string;     // AWS Secrets Manager ARN
  };
  capabilities: string[];             // What evidence this server can collect
  controls_supported: string[];        // Which controls this server provides evidence for
}

type MCPServerType =
  | "cloud_provider"                   // AWS, GCP, Azure
  | "scm"                             // GitHub, GitLab, Bitbucket
  | "identity_provider"               // Okta, Google Workspace, Azure AD
  | "project_management"              // Jira, Linear, Asana
  | "communication"                   // Slack, Email
  | "hris"                            // BambooHR, Rippling, Gusto
  | "mdm"                             // Jamf, Intune, Kandji
  | "security_tools"                  // Snyk, Qualys, CrowdStrike
  | "custom";                         // Custom integrations
```

### 6.2 Reference MCP Implementations

**AWS Cloud Provider MCP:**

```typescript
const AWS_MCP_TOOLS = [
  {
    name: "get_iam_policies",
    description: "List all IAM policies, roles, and users with their permissions",
    controls: ["CC6.1", "CC6.2", "CC6.3"],
    evidence: "IAM policy documents, role assignments, user list with MFA status"
  },
  {
    name: "get_cloudtrail_status",
    description: "Check CloudTrail configuration — enabled, multi-region, log file validation",
    controls: ["CC7.1", "CC4.1"],
    evidence: "CloudTrail trail configuration, S3 log bucket settings"
  },
  {
    name: "get_encryption_config",
    description: "Check encryption at rest (KMS, S3, RDS, EBS) and in transit (ALB/NLB TLS)",
    controls: ["CC6.6", "CC6.7"],
    evidence: "KMS key policies, S3 bucket encryption, RDS encryption status, ALB listener configs"
  },
  {
    name: "get_security_groups",
    description: "List security groups and their rules, flag overly permissive rules",
    controls: ["CC6.1", "CC6.6"],
    evidence: "Security group rules, VPC configurations"
  },
  {
    name: "get_backup_config",
    description: "Check AWS Backup plans, RDS automated backups, S3 versioning",
    controls: ["A1.2", "A1.3"],
    evidence: "Backup plan configurations, retention settings, last successful backup timestamps"
  },
  {
    name: "get_vpc_flow_logs",
    description: "Check VPC flow log configuration and sample recent entries",
    controls: ["CC7.1", "CC7.2"],
    evidence: "Flow log configuration, destination settings"
  },
  {
    name: "get_config_compliance",
    description: "Pull AWS Config rules and compliance status",
    controls: ["CC7.1", "CC5.2"],
    evidence: "Config rules, compliance evaluation results"
  }
];
```

**GitHub SCM MCP:**

```typescript
const GITHUB_MCP_TOOLS = [
  {
    name: "get_branch_protection",
    description: "Get branch protection rules for all repositories",
    controls: ["CC8.1", "CC7.2"],
    evidence: "Branch protection settings — required reviews, status checks, force push restrictions"
  },
  {
    name: "get_pr_history",
    description: "Pull PR history with approval data for the audit period",
    controls: ["CC8.1", "CC7.2"],
    evidence: "PR list with reviewers, approval timestamps, merge dates"
  },
  {
    name: "get_org_security",
    description: "Organization-level security settings — 2FA requirement, SSO, IP allowlist",
    controls: ["CC6.1", "CC6.3"],
    evidence: "Org security settings, member 2FA status"
  },
  {
    name: "get_ci_cd_config",
    description: "CI/CD workflow configurations — build, test, deploy pipelines",
    controls: ["CC8.1", "CC7.2"],
    evidence: "GitHub Actions workflow YAML files, environment protection rules"
  },
  {
    name: "get_dependabot_alerts",
    description: "Dependency vulnerability alerts and remediation status",
    controls: ["CC7.3"],
    evidence: "Open/closed vulnerability alerts, remediation timelines"
  }
];
```

**Okta Identity Provider MCP:**

```typescript
const OKTA_MCP_TOOLS = [
  {
    name: "get_mfa_enrollment",
    description: "MFA enrollment status for all users",
    controls: ["CC6.1", "CC6.6"],
    evidence: "User list with MFA enrollment status, MFA factor types"
  },
  {
    name: "get_sso_config",
    description: "SSO/SAML application integrations",
    controls: ["CC6.1"],
    evidence: "List of SSO-integrated applications, sign-on policies"
  },
  {
    name: "get_provisioning_logs",
    description: "User provisioning and deprovisioning events for the audit period",
    controls: ["CC6.2", "CC6.3"],
    evidence: "User lifecycle events — created, activated, deactivated, with timestamps"
  },
  {
    name: "get_access_policies",
    description: "Conditional access policies, password policies, session policies",
    controls: ["CC6.1", "CC6.6"],
    evidence: "Authentication policies, password complexity rules, session timeout settings"
  },
  {
    name: "get_admin_roles",
    description: "Administrative role assignments and privileged access",
    controls: ["CC6.1", "CC6.2"],
    evidence: "Admin role assignments, super admin list, custom admin roles"
  }
];
```

**Jira Project Management MCP:**

```typescript
const JIRA_MCP_TOOLS = [
  {
    name: "get_change_tickets",
    description: "Change management tickets with approval workflows for the audit period",
    controls: ["CC8.1", "CC7.2"],
    evidence: "Change tickets with status transitions, approver information, implementation dates"
  },
  {
    name: "get_incident_tickets",
    description: "Security incident tickets with full timeline",
    controls: ["CC7.3", "CC7.4", "CC7.5"],
    evidence: "Incident tickets — detection, response, resolution, post-mortem links"
  },
  {
    name: "get_risk_register",
    description: "Risk register items if tracked in Jira",
    controls: ["CC3.1", "CC3.2"],
    evidence: "Risk items with assessment, treatment plans, review dates"
  }
];
```

### 6.3 Custom MCP Server Template

For systems without a reference implementation:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

function createCustomMCPServer(config: {
  name: string;
  description: string;
  tools: CustomTool[];
}) {
  const server = new Server({
    name: config.name,
    version: "1.0.0",
  }, {
    capabilities: { tools: {} },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: config.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = config.tools.find(t => t.name === request.params.name);
    if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
    const result = await tool.handler(request.params.arguments);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  return server;
}

interface CustomTool {
  name: string;
  description: string;
  inputSchema: object;
  controls_supported: string[];
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}
```

---

## 7. Implementation Guide

### 7.1 Main Orchestrator Agent

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `You are a SOC 2 Compliance Agent that manages the complete compliance lifecycle.
You help organizations achieve and maintain SOC 2 compliance by orchestrating scoping, policy generation,
evidence collection, gap assessment, remediation, auditor coordination, and continuous monitoring.

YOUR RESPONSIBILITIES:
- Manage compliance engagements from scoping through audit completion
- Delegate work to specialized subagents for each compliance domain
- Track cross-cutting dependencies between controls, evidence, and remediation
- Maintain the Control Matrix as the single source of truth
- Provide real-time compliance posture visibility
- Support multiple engagement types: first-time SOC 2, annual renewal, multi-client

CRITICAL RULES:
- NEVER submit evidence to auditors without human review and approval
- NEVER auto-close gaps without verification that the fix actually works
- NEVER fabricate or embellish evidence — if a control isn't implemented, flag it honestly
- ALWAYS maintain complete audit trail of every action taken
- ALWAYS flag when collected evidence doesn't cover the full audit observation period
- NEVER modify evidence after collection — maintain chain of custody integrity
- If a connected system is unavailable, fall back to semi-automated collection, don't skip the control
- Policies must reflect actual practices, not aspirational goals
- All dates in UTC unless otherwise specified
- For Type II audits, evidence must cover the entire observation period

MULTI-TENANT:
- Each organization has its own isolated data context
- Never cross-reference data between organizations
- Consulting firm users can switch between client contexts

Store all compliance data in the organization's designated workspace.`;

async function runSOC2ComplianceAgent(userPrompt: string, orgId: string) {
  for await (const message of query({
    prompt: userPrompt,
    options: {
      cwd: `/compliance-workspace/${orgId}`,
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: [
        "Read", "Write", "Edit", "Bash", "Glob", "Grep",
        "Agent", "WebSearch", "WebFetch"
      ],
      permissionMode: "default",
      maxTurns: 100,
      agents: {
        "scoping-agent": {
          description: "Interviews stakeholders, selects TSC criteria, maps controls, generates the Control Matrix. Start here for new engagements.",
          model: "claude-sonnet-4-6",
          prompt: SCOPING_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        },
        "policy-agent": {
          description: "Generates and customizes SOC 2 policies using hybrid template + AI approach. Interviews stakeholders about actual practices.",
          model: "claude-sonnet-4-6",
          prompt: POLICY_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        },
        "evidence-agent": {
          description: "Collects evidence from connected systems via MCP. Validates completeness, date ranges, and formats. Maintains evidence repository.",
          model: "claude-sonnet-4-6",
          prompt: EVIDENCE_AGENT_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch"],
        },
        "gap-remediation-agent": {
          description: "Identifies control gaps, classifies severity, creates remediation plans with owners and deadlines, tracks progress, verifies fixes.",
          model: "claude-opus-4-6",
          prompt: GAP_REMEDIATION_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        },
        "audit-coordination-agent": {
          description: "Manages auditor PBC requests, packages evidence for submission, tracks findings, drafts management responses, manages audit timeline.",
          model: "claude-opus-4-6",
          prompt: AUDIT_COORDINATION_PROMPT,
          tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        },
        "monitoring-agent": {
          description: "Runs continuous compliance checks, detects drift, generates posture scores, sends alerts for issues and upcoming deadlines.",
          model: "claude-haiku-4-5",
          prompt: MONITORING_AGENT_PROMPT,
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

### 7.2 Scoping Agent — Detailed Prompt

```typescript
const SCOPING_AGENT_PROMPT = `You are a SOC 2 Scoping and Control Mapping Specialist.
Your job is to understand the company's business context and generate a comprehensive Control Matrix.

YOUR TASKS:

1. BUSINESS CONTEXT INTERVIEW:
   For first-time companies, gather:
   - Company profile: industry, product, size, structure
   - Data types handled: PII, PHI, financial, proprietary
   - Customer segments: enterprise, SMB, consumer, government
   - Infrastructure: cloud providers, key services, environments
   - Identity & access: IdP, MFA status, SSO
   - Existing compliance: prior audits, certifications, existing policies
   - Audit scope: criteria selection, audit type (I/II), desired observation period

   For returning companies:
   - Import previous Control Matrix
   - Identify infrastructure/org changes since last audit
   - Update controls based on changes
   - Flag new criteria or controls to add

2. CRITERIA SELECTION:
   - Security (CC1-CC9) is always included
   - Recommend additional criteria based on:
     * Availability: if SaaS product with uptime SLAs
     * Confidentiality: if handling client proprietary data
     * Processing Integrity: if financial transactions or data pipelines
     * Privacy: if collecting consumer PII, especially for EU/California customers

3. CONTROL MAPPING:
   For each selected criterion:
   - List all applicable control points from AICPA TSC framework
   - Assess applicability based on company's actual environment
   - Mark non-applicable controls with rationale (e.g., "No physical data center — N/A")
   - Assign risk level (high/medium/low) based on data sensitivity and exposure
   - Define evidence requirements per control
   - Suggest control owner (role, not specific person)

4. INITIAL RISK ASSESSMENT:
   - Identify highest-risk controls based on company profile
   - Flag controls likely to have gaps based on company maturity
   - Recommend priority order for gap assessment

OUTPUT:
- Write Control Matrix to ./control-matrix.json
- Write business context to ./business-context.json
- Write scoping summary to ./scoping-summary.md (human-readable)
- Include rationale for all criteria and control decisions`;
```

### 7.3 Evidence Collection Agent — Detailed Prompt

```typescript
const EVIDENCE_AGENT_PROMPT = `You are a SOC 2 Evidence Collection Specialist.
Your job is to gather, validate, and organize evidence that proves controls are implemented and operating.

YOUR TASKS:

1. READ THE CONTROL MATRIX:
   - Load ./control-matrix.json to understand all controls and evidence requirements
   - Prioritize evidence collection by control risk level (high → medium → low)

2. COLLECT EVIDENCE VIA MCP:
   For each control with automated evidence sources:
   - Call the appropriate MCP server tool to pull evidence
   - Save raw evidence to ./evidence/{control_id}/{evidence_id}/
   - Include metadata: source, timestamp, collection method, hash

3. GUIDE SEMI-AUTOMATED COLLECTION:
   For evidence requiring user action:
   - Provide exact step-by-step instructions for the export
   - Specify the exact path in the system's UI
   - After user uploads, validate the artifact meets requirements

4. TRACK MANUAL EVIDENCE:
   For evidence that can't be automated:
   - Generate a checklist with descriptions of what's needed
   - Confirm receipt when uploaded
   - Validate format and completeness

5. VALIDATE ALL EVIDENCE:
   - Date range: covers the audit observation period?
   - Completeness: addresses all aspects of the control?
   - Freshness: current, not stale?
   - Format: auditor-acceptable format?
   - Chain of custody: who collected, when, how?

6. GENERATE REPORTS:
   - Evidence collection status per control
   - Missing evidence alerts
   - Stale evidence requiring refresh

CRITICAL RULES:
- NEVER fabricate or modify evidence
- NEVER skip validation steps
- If MCP call fails, retry once, then flag for semi-automated collection
- All evidence files must include SHA-256 hash for integrity
- Maintain ./evidence/manifest.json with all collected evidence metadata

OUTPUT:
- Evidence files in ./evidence/{control_id}/
- Evidence manifest at ./evidence/manifest.json
- Collection status report at ./evidence/status-report.md`;
```

### 7.4 Gap & Remediation Agent — Detailed Prompt

```typescript
const GAP_REMEDIATION_PROMPT = `You are a SOC 2 Gap Assessment and Remediation Specialist.
Your job is to identify compliance gaps and create actionable remediation plans.

YOUR TASKS:

1. ANALYZE CURRENT STATE:
   - Read ./control-matrix.json for all controls and their status
   - Read ./evidence/manifest.json for collected evidence
   - Read all policy documents in ./policies/
   - Cross-reference: does evidence prove each control is implemented and operating?

2. IDENTIFY GAPS:
   For each control, check:
   - Is there a policy covering this control? → if no, policy gap
   - Does actual practice match the policy? → if no, implementation gap
   - Is there evidence proving the control works? → if no, evidence gap
   - Has the control been operating for the full audit period? → if no, observation period gap

3. CLASSIFY GAPS:
   - Critical: control missing entirely → will result in exception
   - High: control exists but not operating effectively → likely exception
   - Medium: control partially implemented → finding with recommendation
   - Low: documentation gap → observation only

4. CREATE REMEDIATION PLANS:
   For each gap:
   - What's wrong (specific, factual description)
   - Why it matters (which controls and criteria affected, audit consequence)
   - What to do (numbered steps, specific and actionable)
   - Who owns it (role assignment)
   - Deadline (work backward from audit date)
   - How to verify (what the agent will check to confirm closure)
   - Evidence needed after fix

5. TRACK AND VERIFY:
   - Monitor remediation status
   - After owner marks step complete, verify via MCP or manual check
   - If verification fails, re-open with updated notes
   - Update Control Matrix status as gaps are closed

CRITICAL RULES:
- Be specific in remediation steps — "enable MFA in Okta" not "improve access controls"
- Never close a gap without verification
- Prioritize critical/high gaps that block audit readiness
- If a gap cannot be remediated before audit, flag it as "accepted risk" with management sign-off

OUTPUT:
- Gap register at ./gaps/gap-register.json
- Individual remediation plans in ./gaps/{gap_id}/remediation-plan.md
- Gap summary dashboard at ./gaps/gap-summary.md`;
```

### 7.5 Audit Coordination Agent — Detailed Prompt

```typescript
const AUDIT_COORDINATION_PROMPT = `You are a SOC 2 Audit Coordination Specialist.
Your job is to manage the auditor relationship and ensure a smooth audit process.

YOUR TASKS:

1. AUDIT TIMELINE MANAGEMENT:
   - Maintain ./audit/timeline.json with all key dates
   - Send alerts at T-14, T-7, T-3, T-1 for each milestone
   - Track overall audit progress

2. PBC REQUEST MANAGEMENT:
   When auditor sends a PBC (Prepared By Client) list:
   - Parse each request item
   - Map to controls in the Control Matrix
   - Check if evidence already exists in ./evidence/
   - If exists: package it, add submission notes, present for human review
   - If missing: create urgent evidence collection task for evidence-agent
   - Track submission status for each PBC item
   - Alert on approaching and overdue items

3. EVIDENCE PACKAGING:
   - Format evidence in auditor-friendly packages (PDF compilation, organized folders)
   - Add cover sheets with control mapping and descriptions
   - Include metadata: source system, collection date, validation status
   - NEVER submit without human review and approval

4. FINDINGS MANAGEMENT:
   When auditor reports findings:
   - Log each finding with control reference and severity
   - Draft management response (factual, specific remediation commitment)
   - Present draft to management for review before submission
   - Track committed remediation timeline

5. WALKTHROUGH PREPARATION:
   For each scheduled walkthrough:
   - Prepare talking points for each control area
   - List supporting evidence to have ready
   - Identify who needs to attend (control owners)
   - Generate pre-walkthrough checklist
   - Send calendar reminders

6. COMMUNICATION LOG:
   - Maintain ./audit/communication-log.json with all auditor interactions
   - Track open items and action items from each communication

CRITICAL RULES:
- NEVER submit evidence or responses to auditor without human approval
- NEVER commit to remediation timelines without management sign-off
- Keep all communication professional and factual
- Flag any scope creep from auditor (requesting evidence outside agreed scope)

OUTPUT:
- PBC tracker at ./audit/pbc-tracker.json
- Audit timeline at ./audit/timeline.json
- Communication log at ./audit/communication-log.json
- Walkthrough prep docs in ./audit/walkthroughs/`;
```

### 7.6 Continuous Monitoring Agent — Detailed Prompt

```typescript
const MONITORING_AGENT_PROMPT = `You are a SOC 2 Continuous Monitoring Specialist.
Your job is to keep the organization compliant between audits by detecting issues early.

YOUR TASKS:

1. SCHEDULED COMPLIANCE CHECKS:
   Run via MCP at configured intervals:
   - Daily: access control checks, change management checks, logging status, backup status
   - Weekly: encryption config, training completion, certificate expiry
   - Monthly: vendor risk reviews, policy review dates, comprehensive posture scan

2. DRIFT DETECTION:
   When a check reveals a change from last known good state:
   - Identify which control(s) are affected
   - Assess if the change breaks compliance (e.g., MFA disabled = breaking)
   - If breaking: create alert + remediation task with urgency
   - If benign: log the change for audit trail
   - Update Control Matrix status

3. COMPLIANCE POSTURE SCORING:
   Calculate and maintain real-time score based on:
   - % of controls with valid, current evidence (weight: 30%)
   - % of policies up-to-date and acknowledged (weight: 15%)
   - % of gaps remediated and verified (weight: 15%)
   - % of evidence artifacts current and valid (weight: 25%)
   - % of monitoring checks passing (weight: 15%)
   Write score to ./monitoring/posture-score.json

4. ALERTING:
   Send alerts via configured channels (Slack MCP, Email):
   - Critical: control broken, immediate action needed
   - Warning: control degraded or approaching deadline
   - Info: routine status update, FYI changes

5. ANNUAL CYCLE PREPARATION:
   30-60 days before next audit period:
   - Identify evidence that will need refreshing
   - Flag policies due for annual review
   - Check all monitoring integrations are still working
   - Generate pre-audit readiness report

CRITICAL RULES:
- Never auto-remediate without human approval (detect and alert, don't fix)
- False positives erode trust — validate before alerting
- Keep monitoring non-intrusive — read-only access to systems
- Log all monitoring activities for meta-compliance

OUTPUT:
- Monitoring results in ./monitoring/checks/{date}/
- Alerts in ./monitoring/alerts/
- Posture score at ./monitoring/posture-score.json
- Monitoring dashboard data at ./monitoring/dashboard.json`;
```

---

## 8. Example User Interactions

### 8.1 First-Time SOC 2 (Startup)

```
User: We're a 30-person SaaS startup. Our biggest enterprise prospect requires SOC 2 Type II.
      We've never done this before. Where do we start?

Agent: I'll help you through the entire SOC 2 journey. Let me start by understanding your business.

      First question: What does your product do, and what kind of data do you handle?

User: We're a project management tool for construction companies. We handle company names,
      project details, blueprints, and employee schedules. No financial data or health data.

Agent: Got it. Based on construction PM SaaS handling company/project data:

      Recommended criteria:
      ✅ Security (mandatory) — protecting client project data
      ✅ Availability — your clients depend on uptime for active construction projects
      ❓ Confidentiality — blueprints may be proprietary. Do clients consider their data confidential?
      ❌ Processing Integrity — not processing financial transactions
      ❌ Privacy — no consumer PII (B2B with business contact info only)

      Does that sound right? And are blueprints considered confidential by your clients?

User: Yes, blueprints are definitely confidential. Let's add that.

Agent: Perfect. Security + Availability + Confidentiality.

      Next: tell me about your infrastructure.
      - Cloud provider(s)?
      - Where's your code hosted?
      - How do users authenticate?
      - What do you use for internal communication?

User: AWS (EC2, RDS, S3), GitHub, Okta for SSO, Slack for comms.

Agent: Great stack. I'm generating your Control Matrix now...

      [Scoping Agent generates control-matrix.json with 42 controls across Security, Availability, and Confidentiality]

      Your Control Matrix is ready with 42 applicable controls:
      - Security (CC1-CC9): 33 controls
      - Availability (A1): 3 controls
      - Confidentiality (C1): 6 controls

      I've marked 5 controls as high-risk based on your profile:
      1. CC6.1 — Logical access controls (MFA, least privilege)
      2. CC6.3 — Access deprovisioning
      3. CC7.4 — Incident response
      4. CC8.1 — Change management
      5. A1.2 — Disaster recovery

      Shall I start the gap assessment, or would you like to review the Control Matrix first?
```

### 8.2 Evidence Collection Session

```
User: Start collecting evidence for our access control controls (CC6.x).

Agent: I'll collect evidence for CC6.1 through CC6.8. Let me check connected systems...

      ✅ AWS MCP connected
      ✅ GitHub MCP connected
      ✅ Okta MCP connected

      Collecting now...

      [Evidence Agent runs in parallel]

      Results for CC6 — Logical & Physical Access:

      CC6.1 (Access Controls):
      ✅ AWS IAM policies — collected (23 policies, 8 roles)
      ✅ Okta MFA enrollment — collected (28/30 users enrolled)
      ⚠️ 2 users without MFA: john@company.com (Engineering), sarah@company.com (Sales)
      ✅ GitHub org 2FA — required and enforced

      CC6.2 (Access Provisioning):
      ✅ Okta provisioning logs — collected (covers full audit period)
      ⚠️ No formal access request process found — access is granted via Slack DMs to IT

      CC6.3 (Access Removal):
      ✅ Okta deprovisioning logs — collected
      ⚠️ Found 3 deprovisioning events >48 hours after termination date in HRIS
      ✅ GitHub org member list reconciled with active employees

      CC6.6 (Encryption):
      ✅ S3 bucket encryption — all buckets use AES-256 (SSE-S3)
      ✅ RDS encryption at rest — enabled
      ✅ ALB TLS — TLS 1.2 minimum configured
      ⚠️ 1 S3 bucket with public read access: marketing-assets (contains public website images — likely intentional but needs documentation)

      I've identified 4 issues to address. Shall I create remediation tasks for these?
```

### 8.3 Auditor PBC Response

```
User: The auditor just sent their PBC list. Here it is:
      1. IAM policy documentation for production environment
      2. Evidence of quarterly access reviews for the observation period
      3. Change management tickets for all production deployments
      4. Incident response plan and evidence of testing
      5. Business continuity / DR test results

Agent: Let me map these to our Control Matrix and check what we have...

      PBC-001: IAM policy documentation (CC6.1)
      ✅ Evidence exists — collected 5 days ago via AWS MCP
      → Ready to package. 23 IAM policies + 8 role definitions in PDF format.

      PBC-002: Quarterly access reviews (CC6.1, CC6.2)
      ⚠️ Partial — We have Okta access review exports for Q1 and Q2.
      ❌ Missing Q3 review. The review was conducted but not exported.
      → Action needed: Export Q3 access review from Okta Admin → Reports → Access Reviews

      PBC-003: Change management tickets (CC8.1)
      ✅ Evidence exists — 347 Jira tickets pulled via PM MCP covering full observation period
      → Ready to package. Includes ticket ID, description, approver, implementation date.

      PBC-004: Incident response plan + test evidence (CC7.4)
      ✅ IR Plan — approved version in evidence repo (v2.1, approved March 2026)
      ⚠️ Test evidence — tabletop exercise was conducted but notes weren't uploaded
      → Action needed: Upload tabletop exercise notes and attendance record

      PBC-005: DR test results (A1.3)
      ✅ DR test report from January 2026 — in evidence repo
      ✅ Includes RPO/RTO achievement metrics and test scenarios

      Summary: 3/5 ready to submit, 2 need action from you.

      Shall I package the 3 ready items for your review before submission?
```

### 8.4 Continuous Monitoring Alert

```
Agent: [Automated monitoring alert — Critical]

      🔴 DRIFT DETECTED: CloudTrail logging disabled in us-east-1

      Control affected: CC7.1 (Infrastructure Monitoring)
      Detected: 2026-03-24 14:32 UTC
      Previous state: CloudTrail enabled, multi-region, S3 delivery
      Current state: Trail "production-audit-trail" — logging STOPPED

      Impact: This is a critical control for SOC 2. Audit evidence requires continuous logging
      during the observation period. Any gap in logging will be flagged by auditors.

      Recommended immediate action:
      1. Re-enable CloudTrail logging in us-east-1 immediately
      2. Investigate who/what disabled it (check CloudTrail event history for the disable action)
      3. Document the gap period and root cause
      4. Add CloudTrail-disable prevention via SCP (Service Control Policy)

      Compliance posture score impact: Dropped from 92 → 78

      Shall I create a remediation task and notify the DevOps team via Slack?
```

### 8.5 Deep Scoping Interview — Probing Beyond Surface Answers

This shows how the agent digs into reality, not just what the company claims:

```
User: We handle access provisioning through Okta. When someone joins, IT sets them up same day.

Agent: Good. Let me dig into a few specifics auditors will ask about:

      1. When a new employee is provisioned, is there a formal ACCESS REQUEST process?
         (e.g., a Jira ticket, an email from the manager, an HR workflow)
         Or does someone on IT just "know" to create the account?

User: Usually the manager pings our IT person on Slack and says "set up John for engineering."

Agent: ⚠️ That's a gap for CC6.2 (Access Provisioning). Auditors will want to see:
      - A documented approval trail (who requested, who approved, when)
      - Separation: the requester shouldn't be the provisioner

      Your current process: manager DMs IT on Slack → IT creates account.
      What auditors see: no formal approval, no audit trail, no separation of duties.

      Quick fix options:
      A) Use Okta Workflows — manager submits request, IT admin approves, Okta provisions
      B) Create a Jira ticket template: "New User Access Request" with manager approval step
      C) Minimum: use a Slack workflow form that logs to a channel (auditable, not ideal but passable)

      Which approach fits your team's workflow best?

User: Option B sounds easiest. But honestly, for the last 6 months we've been doing Slack DMs.

Agent: Understood. Here's the honest picture for auditors:

      📊 SITUATION:
      - Observation period: Jan 1 - Jun 30, 2026
      - Months 1-6: access provisioning via informal Slack DMs (no audit trail)
      - If we implement Jira workflow now (late March), we'll have:
        * Months 1-3: no formal process (gap)
        * Months 4-6: formal process with Jira tickets (compliant)

      🎯 AUDITOR IMPACT:
      This will likely be a FINDING (not an exception) because:
      - The control was implemented partway through the observation period
      - Auditor will note: "Control was not operating for the full period"
      - Management response: "Process was informal prior to [date]. Formal
        Jira-based workflow implemented on [date] and has been operating since."

      💡 OPTIONS:
      1. Accept the finding — implement Jira workflow NOW, have 3 months of evidence
      2. Shorten observation period — start from April 1 (only 3 months, some auditors won't accept)
      3. Postpone audit to October — gives you 6+ months of clean evidence

      My recommendation: Option 1. A management-response finding is much better than
      no process at all. Auditors expect startups to improve during the observation
      period. Let's implement the Jira workflow this week.

      Shall I create the remediation plan with steps and timeline?
```

### 8.6 Evidence Agent Handling Conflicting Data

```
Agent: [Evidence Collection — CC6.3 Access Removal]

      I found a CONFLICT between systems:

      📊 DATA FROM OKTA (via MCP):
      - Employee: Sarah Chen
      - Okta status: DEACTIVATED
      - Deactivation date: 2026-02-15 09:30 UTC

      📊 DATA FROM HRIS / BAMBOOHR:
      - Employee: Sarah Chen
      - Termination date: 2026-02-12
      - Last working day: 2026-02-12

      ⚠️ CONFLICT:
      Access was revoked 3 DAYS after termination date.
      Your Access Control Policy states: "Access revoked within 24 hours of termination."

      This is exactly the kind of thing auditors will sample and catch.

      📋 WHAT I NEED FROM YOU:
      1. Was there a reason for the 3-day delay? (e.g., handover period, error?)
      2. Is this an isolated case or a pattern?

      I'm checking all other terminations in the observation period now...

      [Scanning 12 termination events in observation period]

      RESULTS:
      ✅ 9/12 deprovisioned within 24 hours (compliant)
      ⚠️ 3/12 deprovisioned after 24 hours:
         - Sarah Chen: 3 days late (Feb 12 → Feb 15)
         - Mike Rodriguez: 2 days late (Mar 3 → Mar 5)
         - Priya Nair: 5 days late (Apr 20 → Apr 25)

      📊 COMPLIANCE RATE: 75% (9/12)

      🎯 AUDITOR ASSESSMENT:
      This is likely a HIGH finding. Auditors typically sample 25+ events
      and expect >95% compliance. 75% will be flagged as a control deficiency.

      💡 RECOMMENDED ACTIONS:
      1. For each late deprovisioning, document the root cause
      2. Implement automated deprovisioning: HRIS termination → Okta deactivation
         (Okta has a BambooHR integration that does this automatically)
      3. Create a weekly reconciliation check: compare active Okta users vs HRIS active employees
      4. For the 3 exceptions, prepare management explanations for auditor

      Shall I create the remediation plan and draft the management explanations?
```

### 8.7 Consulting Firm Multi-Client View

```
User: Show me the compliance posture across all my clients.

Agent: Client Compliance Dashboard — March 2026

      | Client | Audit Type | Criteria | Posture | Next Audit | Status |
      |--------|-----------|----------|---------|------------|--------|
      | Acme Corp | Type II | S, A | 94/100 (A) | Apr 2026 | ✅ Audit-ready |
      | BuildSoft | Type I | S | 72/100 (C) | May 2026 | ⚠️ 8 gaps open |
      | DataFlow Inc | Type II | S, A, C, PI | 88/100 (B) | Jun 2026 | ✅ On track |
      | SecureHR | Type II | S, P | 61/100 (D) | Apr 2026 | 🔴 At risk — 3 critical gaps |

      Priority attention needed:
      1. SecureHR — 3 critical gaps (no MFA enforcement, missing IR plan, access reviews overdue)
         Audit in 4 weeks. Recommend urgent remediation sprint.
      2. BuildSoft — 8 medium/high gaps typical for first-time SOC 2.
         On track if remediation stays on schedule.

      Shall I drill into any specific client?
```

---

## 9. Data Model

### 9.1 Aurora PostgreSQL Schema

```sql
-- Multi-tenant organization
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    employee_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance engagement (one per audit cycle)
CREATE TABLE engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    audit_type VARCHAR(10) NOT NULL CHECK (audit_type IN ('type_i', 'type_ii')),
    criteria JSONB NOT NULL,           -- ["security", "availability", ...]
    status VARCHAR(30) NOT NULL DEFAULT 'scoping',
    observation_period_start DATE,
    observation_period_end DATE,
    auditor_firm VARCHAR(255),
    auditor_contact VARCHAR(255),
    key_dates JSONB,                   -- {planning_call, fieldwork_start, ...}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Control Matrix
CREATE TABLE controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id),
    control_id VARCHAR(20) NOT NULL,   -- CC6.1, A1.2, etc.
    tsc_criteria VARCHAR(30) NOT NULL,
    control_area VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    objective TEXT,
    risk_level VARCHAR(10) CHECK (risk_level IN ('high', 'medium', 'low')),
    applicability VARCHAR(20) DEFAULT 'applicable',
    applicability_rationale TEXT,
    owner VARCHAR(100),
    status VARCHAR(30) DEFAULT 'not_assessed',
    implementation_guidance TEXT,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(engagement_id, control_id)
);

-- Policies
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    policy_type VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    content TEXT NOT NULL,
    controls_addressed JSONB,          -- ["CC6.1", "CC6.3"]
    owner VARCHAR(100),
    approved_by VARCHAR(100),
    approved_date DATE,
    effective_date DATE,
    next_review_date DATE,
    s3_path VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE policy_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES policies(id),
    employee_name VARCHAR(255) NOT NULL,
    employee_email VARCHAR(255) NOT NULL,
    acknowledged_date TIMESTAMPTZ NOT NULL,
    policy_version VARCHAR(20) NOT NULL
);

-- Evidence
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id),
    control_id VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_system VARCHAR(100),
    collection_method VARCHAR(20) CHECK (collection_method IN ('automated', 'semi_automated', 'manual')),
    s3_path VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,    -- SHA-256
    collected_by VARCHAR(100),
    collected_at TIMESTAMPTZ NOT NULL,
    valid_from DATE,
    valid_to DATE,
    validation_status VARCHAR(20) DEFAULT 'pending',
    validation_notes TEXT,
    auditor_status VARCHAR(20) DEFAULT 'not_submitted',
    auditor_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gaps
CREATE TABLE gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id),
    control_id VARCHAR(20) NOT NULL,
    severity VARCHAR(10) CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    audit_impact TEXT,
    status VARCHAR(20) DEFAULT 'open',
    owner VARCHAR(100),
    target_date DATE,
    remediated_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verification_method TEXT,
    verification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE remediation_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID REFERENCES gaps(id),
    step_order INTEGER NOT NULL,
    description TEXT NOT NULL,
    responsible VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    notes TEXT
);

-- Audit PBC Requests
CREATE TABLE pbc_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id),
    control_id VARCHAR(20),
    description TEXT NOT NULL,
    auditor_notes TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    due_date DATE NOT NULL,
    submitted_at TIMESTAMPTZ,
    evidence_ids JSONB,                -- [evidence_id, ...]
    auditor_feedback TEXT,
    submission_notes TEXT,
    priority VARCHAR(10) DEFAULT 'standard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail (every action logged)
CREATE TABLE audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    engagement_id UUID REFERENCES engagements(id),
    actor VARCHAR(100) NOT NULL,       -- user email or "agent:{agent_name}"
    action VARCHAR(50) NOT NULL,       -- "evidence_collected", "gap_created", "policy_approved", etc.
    entity_type VARCHAR(30) NOT NULL,  -- "control", "evidence", "policy", "gap", "pbc_request"
    entity_id UUID NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_controls_engagement ON controls(engagement_id);
CREATE INDEX idx_controls_status ON controls(engagement_id, status);
CREATE INDEX idx_evidence_control ON evidence(engagement_id, control_id);
CREATE INDEX idx_gaps_engagement ON gaps(engagement_id);
CREATE INDEX idx_gaps_status ON gaps(engagement_id, status);
CREATE INDEX idx_pbc_engagement ON pbc_requests(engagement_id);
CREATE INDEX idx_audit_trail_org ON audit_trail(organization_id, timestamp);
CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
```

### 9.2 DynamoDB Tables (Real-time State)

```typescript
// Monitoring alerts — high-write, time-series
interface MonitoringAlertDDB {
  pk: string;                          // "ORG#{orgId}"
  sk: string;                          // "ALERT#{timestamp}#{alertId}"
  category: string;                    // "access_control", "encryption", etc.
  severity: "critical" | "warning" | "info";
  control_id: string;
  description: string;
  detected_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  ttl: number;                         // Auto-expire resolved alerts after 90 days
}

// Compliance posture scores — frequently updated
interface PostureScoreDDB {
  pk: string;                          // "ORG#{orgId}"
  sk: string;                          // "POSTURE#{date}"
  overall_score: number;
  grade: string;
  components: Record<string, number>;
  open_issues: Record<string, number>;
  trend: string;
  calculated_at: string;
}

// Agent session state — ephemeral
interface AgentSessionDDB {
  pk: string;                          // "SESSION#{sessionId}"
  sk: string;                          // "STATE"
  organization_id: string;
  engagement_id: string;
  current_phase: string;
  subagent_states: Record<string, unknown>;
  last_activity: string;
  ttl: number;                         // Auto-expire after 24 hours of inactivity
}
```

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Evidence integrity** | SHA-256 hash on all artifacts, S3 versioning enabled, append-only during audit period |
| **Credential management** | All MCP server credentials in AWS Secrets Manager, never in DB or code |
| **Access control** | Role-based: Admin, Compliance Manager, Control Owner, Auditor (read-only) |
| **Multi-tenancy** | Organization-level data isolation, no cross-org queries, separate S3 prefixes |
| **Audit trail** | Every agent action logged with actor, timestamp, and entity reference |
| **Encryption at rest** | Aurora encryption, S3 SSE-KMS, DynamoDB encryption |
| **Encryption in transit** | TLS 1.2+ for all connections, VPC endpoints for AWS services |
| **Data retention** | Evidence retained per engagement policy, configurable retention periods |
| **Agent permissions** | MCP servers configured with read-only access where possible |
| **Meta-compliance** | The agent itself follows SOC 2 controls — logging, access control, encryption |

---

## 11. SOC 2 Realities — What the Textbooks Don't Tell You

### The Delvé Lesson: Why AI Must Make Compliance Harder to Fake, Not Easier

In 2025-2026, audit firm Delvé was found to have allegedly issued SOC 2 reports without conducting proper examinations — rubber-stamping compliance for clients who may not have actually met the criteria. This is the nightmare scenario for the compliance industry and a critical design constraint for any AI agent in this space.

**The temptation with AI compliance tools:** Make the process faster and easier. Auto-generate policies. Auto-collect evidence. Auto-close gaps. Ship the report.

**The correct design philosophy:** Make the process faster BUT harder to fake. The agent should be the **honest broker** — the system that flags when evidence is missing, when controls aren't actually operating, when a gap can't be remediated in time, and when the right answer is "postpone the audit."

**Design principles derived from the Delvé incident:**

| Principle | Implementation |
|-----------|---------------|
| **Evidence immutability** | SHA-256 hash on all artifacts at collection time. S3 versioning prevents modification. Any re-collection creates a new artifact, not an overwrite. Audit trail logs every access. |
| **No evidence fabrication** | The agent can COLLECT evidence from systems and VALIDATE it. It can NEVER generate, create, or synthesize evidence artifacts. If evidence doesn't exist in the source system, the control has a gap — period. |
| **Human-in-the-loop at every gate** | Evidence submission to auditor, policy approval, gap closure, management responses — all require human sign-off. The agent prepares and recommends; humans decide. |
| **Honest gap reporting** | If a control isn't implemented, the agent says so. No euphemisms, no "partially implemented when it's really missing. Gap severity classification must be calibrated to what auditors will actually find. |
| **Anti-rubber-stamping** | The agent tracks whether a human actually reviewed evidence before approving (time spent, annotations, questions asked). A "reviewed" timestamp 2 seconds after creation is flagged as suspicious. |
| **Observation period integrity** | If CloudTrail was enabled 3 months into a 12-month observation period, the agent flags that evidence covers only 9 months. It doesn't pretend the full period is covered. |
| **Auditor independence** | The agent helps the CLIENT prepare, not the auditor audit. It never suggests how to present evidence to "look better" — it presents factual evidence and lets auditors draw conclusions. |

```typescript
// Anti-rubber-stamping: track review quality
interface ReviewMetrics {
  approval_id: string;
  entity_type: "evidence" | "policy" | "gap_closure" | "management_response";
  entity_id: string;
  reviewer: string;
  presented_at: string;         // When agent presented for review
  approved_at: string;          // When human approved
  time_spent_seconds: number;   // Time between presentation and approval
  reviewer_annotations: number; // Did they add comments/changes?
  reviewer_questions: number;   // Did they ask the agent questions?
  suspicious: boolean;          // Flag if review looks rubber-stamped
}

function assessReviewQuality(metrics: ReviewMetrics): ReviewQualityAssessment {
  const warnings: string[] = [];

  // Flag suspiciously fast reviews
  if (metrics.entity_type === "policy" && metrics.time_spent_seconds < 120) {
    warnings.push("Policy approved in under 2 minutes — typical policy review takes 10-30 minutes");
  }
  if (metrics.entity_type === "evidence" && metrics.time_spent_seconds < 30) {
    warnings.push("Evidence approved in under 30 seconds — was it actually reviewed?");
  }
  if (metrics.entity_type === "management_response" && metrics.time_spent_seconds < 60) {
    warnings.push("Management response approved in under 1 minute — auditor responses should be carefully reviewed");
  }

  // Flag batch approvals (human approving many items without reading)
  // Tracked at session level, not individual item

  return {
    quality: warnings.length === 0 ? "adequate" : "flagged",
    warnings,
    logged_at: new Date().toISOString(),
  };
}
```

### 11.1 Observation Period Realities

The spec says "evidence must cover the full observation period." Reality is messier:

| Scenario | What Happens in Practice | Agent Should Do |
|----------|------------------------|-----------------|
| **CloudTrail enabled late** | Company enabled CloudTrail 4 months into a 12-month observation period | Flag: "Evidence covers 8/12 months. Options: (1) Shorten observation period to 8 months, (2) Provide management certification for months 1-4 + spot checks, (3) Postpone audit start to accumulate 12 months." |
| **New control implemented mid-period** | Company implemented MFA 6 months into observation period | Flag: "MFA evidence available for 6/12 months. For Type II, auditor needs evidence the control was operating for the ENTIRE period. This will likely be a finding with management response." |
| **Employee left, no HRIS integration existed** | Deprovisioning happened but wasn't logged in first 3 months | Flag: "Access removal evidence exists for months 4-12 only. Months 1-3 covered by: (1) Manager attestation that departures were handled, (2) Current active user list showing no stale accounts." |
| **Tool migration mid-period** | Company moved from Jenkins to GitHub Actions at month 6 | Flag: "Change management evidence split across two systems. Collect from both: Jenkins (months 1-6) + GitHub Actions (months 7-12). Ensure no gap at transition." |
| **Audit period too short** | Enterprise prospect needs the report in 2 months, wants 3-month Type II | Recommend: "3-month observation period is the minimum. Some auditors won't accept less than 6 months. Your prospect may question a 3-month report. If timing allows, 6 months is standard." |

### 11.2 Control Effectiveness vs. Existence

This is the gap most first-time companies don't understand. Auditors don't just check if a control EXISTS — they test if it's OPERATING EFFECTIVELY.

| Control | "Exists" (Not Enough) | "Operates Effectively" (What Auditors Want) |
|---------|----------------------|---------------------------------------------|
| **Access reviews** | Policy says "quarterly access reviews" | Auditor samples 3 quarters of the observation period and verifies: (1) Reviews actually happened, (2) Findings were actioned, (3) Inappropriate access was revoked |
| **MFA enforcement** | MFA is available in Okta | Auditor checks: (1) MFA is REQUIRED (not optional), (2) 100% enrollment, (3) No exceptions or bypass policies active |
| **Change management** | PR approval is required | Auditor samples 25-40 PRs from the observation period: (1) All have approvals, (2) No self-approvals, (3) Approvals happened BEFORE merge, not after |
| **Incident response** | IR plan document exists | Auditor checks: (1) Plan was tested (tabletop exercise), (2) A real incident was handled per the plan, or (3) If no incidents occurred, test exercise + documented readiness |
| **Backup & DR** | Backups are configured | Auditor checks: (1) Backups ran successfully throughout the period, (2) A restore test was performed, (3) RPO/RTO targets were met in the test |

**Agent behavior:** When the agent collects evidence for a control, it should explicitly check for effectiveness, not just existence:

```typescript
interface EffectivenessCheck {
  control_id: string;
  existence_verified: boolean;      // Is the control configured/documented?
  effectiveness_evidence: {
    sampling_method: string;        // "Full population" | "Sample of 25" | "Quarterly check"
    sample_size?: number;
    pass_count: number;
    fail_count: number;
    pass_rate: number;              // Must be 100% for many controls
    exceptions: EffectivenessException[];
  };
  agent_assessment: "operating_effectively" | "exists_not_effective" | "not_implemented";
  auditor_likely_finding: string;   // Agent's prediction of what auditor will say
}

interface EffectivenessException {
  description: string;              // "PR #1247 merged without required approval on 2026-01-15"
  control_id: string;
  date: string;
  severity: "exception" | "observation";
  management_explanation?: string;  // "Emergency hotfix — approved retroactively by CTO"
}
```

### 11.3 When to Advise Postponing the Audit

Sometimes the right answer is "you're not ready." The agent should recognize these situations:

| Signal | Threshold | Agent Recommendation |
|--------|-----------|---------------------|
| **Critical gaps with < 4 weeks to audit** | Any critical gap without a clear 2-week fix | "Postpone. A critical gap = qualified opinion. Better to delay 2 months and get clean report than rush and get qualified." |
| **MFA < 90% enrollment** | >10% of users without MFA | "This is the #1 thing auditors check. Get to 100% before audit starts. Postpone if you can't achieve it." |
| **No DR test in observation period** | DR test > 12 months ago or never performed | "Auditors will sample DR test evidence. No test = finding. Schedule one before audit fieldwork." |
| **Observation period < 3 months** | Less than 3 months of evidence | "Most auditors won't issue a Type II report with < 3 months. Standard is 6-12 months. Postpone to accumulate evidence." |
| **Access review never performed** | Zero documented access reviews in observation period | "Auditors sample quarterly reviews. Zero reviews = exception on CC6.1 and CC6.2. Conduct one immediately and postpone audit to accumulate at least 2 reviews." |
| **New critical system with no logging** | Production system without audit logging | "If a production system has no logging, multiple CC7 controls fail. Enable logging NOW and accumulate at least 3 months of logs before audit." |

```typescript
// Pre-audit readiness assessment — run before confirming audit start date
async function assessAuditReadiness(engagementId: string): Promise<ReadinessAssessment> {
  const controls = await db.controls.findByEngagement(engagementId);
  const gaps = await db.gaps.findOpen(engagementId);
  const evidence = await db.evidence.findByEngagement(engagementId);
  const engagement = await db.engagements.findById(engagementId);

  const criticalGaps = gaps.filter(g => g.severity === "critical");
  const highGaps = gaps.filter(g => g.severity === "high");
  const daysToFieldwork = dayjs(engagement.key_dates.fieldwork_start).diff(dayjs(), "days");

  const blockers: ReadinessBlocker[] = [];

  // Check: critical gaps with insufficient time
  for (const gap of criticalGaps) {
    const estimatedFixDays = estimateRemediationDays(gap);
    if (estimatedFixDays > daysToFieldwork - 14) {  // Need 2 weeks buffer
      blockers.push({
        type: "critical_gap_insufficient_time",
        gap_id: gap.id,
        description: `Critical gap "${gap.title}" needs ~${estimatedFixDays} days to fix. Only ${daysToFieldwork} days to fieldwork.`,
        recommendation: "postpone",
      });
    }
  }

  // Check: observation period coverage
  const observationMonths = dayjs(engagement.observation_period_end)
    .diff(dayjs(engagement.observation_period_start), "months");
  if (observationMonths < 3) {
    blockers.push({
      type: "observation_period_too_short",
      description: `Observation period is ${observationMonths} months. Minimum recommended is 6 months.`,
      recommendation: "postpone",
    });
  }

  // Check: evidence coverage
  const controlsWithEvidence = new Set(evidence.map(e => e.control_id));
  const controlsWithoutEvidence = controls
    .filter(c => c.applicability === "applicable" && !controlsWithEvidence.has(c.control_id));
  if (controlsWithoutEvidence.length > controls.length * 0.3) {
    blockers.push({
      type: "insufficient_evidence",
      description: `${controlsWithoutEvidence.length}/${controls.length} applicable controls have no evidence collected.`,
      recommendation: "delay_fieldwork",
    });
  }

  const readiness = blockers.length === 0 ? "ready"
    : blockers.some(b => b.recommendation === "postpone") ? "not_ready"
    : "at_risk";

  return {
    readiness,
    blockers,
    critical_gaps_open: criticalGaps.length,
    high_gaps_open: highGaps.length,
    evidence_coverage: `${controlsWithEvidence.size}/${controls.filter(c => c.applicability === "applicable").length}`,
    days_to_fieldwork: daysToFieldwork,
    recommendation: readiness === "not_ready"
      ? "Recommend postponing audit start. See blockers above."
      : readiness === "at_risk"
      ? "Proceed with caution. Address blockers before fieldwork."
      : "Audit-ready. Proceed with scheduled fieldwork.",
  };
}
```

### 11.4 Error Handling & Failure Modes

| Failure | Detection | Agent Response |
|---------|-----------|---------------|
| **MCP call fails (timeout/auth)** | HTTP error or timeout from MCP server | Retry once after 30s. If still fails, log the failure, mark evidence as "collection_failed", fall back to semi-automated (provide manual export instructions to user). NEVER skip the control. |
| **MCP returns partial data** | Response truncated, pagination incomplete, rate limit hit | Detect via expected vs actual record count. Retry with smaller date range or pagination. Log partial collection with coverage notes. Alert user: "Only 60% of access logs retrieved — API rate limited. Will retry in 1 hour." |
| **Conflicting evidence** | Okta says user has MFA, AWS IAM says no MFA condition on policy | Flag as "evidence_conflict". Present both pieces to user: "Okta reports MFA enabled for user X, but AWS IAM policy doesn't require MFA condition. Which is the source of truth? Both need to be aligned for CC6.1." |
| **Evidence covers wrong date range** | Collected evidence dated outside observation period | Auto-reject and re-collect with correct date parameters. If source system doesn't support date filtering, collect full range and annotate which portion is relevant. |
| **Stale evidence** | Evidence was collected 45+ days ago, systems may have changed | Mark as "stale" in manifest. Auto-trigger refresh if MCP is available. Alert: "IAM policy evidence collected 52 days ago. Systems may have changed. Refreshing now." |
| **Source system decommissioned** | MCP call returns 404 or "resource not found" | Flag: "Source system for [evidence] is no longer available. If the system was migrated, update MCP config. If decommissioned, document the change and collect equivalent evidence from new system." |
| **User uploads wrong file** | Uploaded file doesn't match expected format/content | Validate upload against expected schema. "You uploaded an S3 bucket list, but this control requires IAM policy documents. Please upload the correct file." |
| **Auditor rejects evidence** | Evidence submitted but auditor marks as insufficient | Parse auditor feedback, map to specific gaps in evidence. Create targeted re-collection task with auditor's specific requirements. "Auditor rejected PBC-003: needs PR approval screenshots, not just merge logs." |

```typescript
// Resilient evidence collection with retry and fallback
async function collectEvidenceResilient(
  controlId: string,
  evidenceReq: EvidenceRequirement,
  engagementId: string,
): Promise<CollectionResult> {
  const maxRetries = 2;
  const retryDelayMs = 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt automated collection via MCP
      const result = await mcpClient.callTool(
        evidenceReq.mcp_server,
        evidenceReq.mcp_tool,
        {
          ...evidenceReq.mcp_params,
          date_from: engagement.observation_period_start,
          date_to: engagement.observation_period_end,
        },
        { timeout: 60000 }  // 60s timeout
      );

      // Validate the result
      const validation = validateEvidence(result, evidenceReq, engagement);
      if (validation.issues.length > 0) {
        await logCollectionIssue(controlId, validation.issues);
      }

      // Hash and store
      const hash = crypto.createHash("sha256").update(JSON.stringify(result)).digest("hex");
      const artifact = await storeEvidence({
        engagement_id: engagementId,
        control_id: controlId,
        title: evidenceReq.description,
        source_system: evidenceReq.source_system,
        collection_method: "automated",
        content: result,
        file_hash: hash,
        collected_by: "agent:evidence-agent",
        valid_from: engagement.observation_period_start,
        valid_to: engagement.observation_period_end,
        validation_status: validation.issues.length === 0 ? "valid" : "needs_review",
        validation_notes: validation.issues.join("; "),
      });

      return { success: true, artifact, attempt };

    } catch (error) {
      if (attempt < maxRetries) {
        await logRetry(controlId, evidenceReq, error, attempt + 1);
        await sleep(retryDelayMs);
        continue;
      }

      // All retries exhausted — fall back to semi-automated
      await logCollectionFailure(controlId, evidenceReq, error);
      return {
        success: false,
        fallback: "semi_automated",
        instructions: generateManualExportInstructions(evidenceReq),
        error: error.message,
      };
    }
  }
}
```

---

## 12. Configuration Examples

### 12.1 Business Context — SaaS Startup (30 people)

```json
{
  "company_name": "BuildTrack",
  "industry": "Construction SaaS",
  "product_description": "Project management platform for construction companies",
  "employee_count": 30,
  "engineering_team_size": 12,
  "data_types_handled": ["pii", "proprietary"],
  "customer_segments": ["Enterprise", "SMB"],
  "geographic_regions": ["US"],
  "cloud_providers": ["aws"],
  "hosting_model": "cloud_native",
  "key_services": ["ECS", "RDS", "S3", "CloudFront", "Lambda"],
  "environments": ["production", "staging", "development"],
  "ci_cd_tools": ["GitHub Actions"],
  "monitoring_tools": ["CloudWatch", "PagerDuty"],
  "identity_provider": "Okta",
  "mfa_enforced": true,
  "sso_configured": true,
  "previous_soc2": false,
  "other_certifications": [],
  "existing_policies": ["Acceptable Use Policy"],
  "target_criteria": ["security", "availability", "confidentiality"],
  "target_audit_type": "type_ii",
  "desired_audit_period": {
    "start": "2026-01-01",
    "end": "2026-06-30"
  }
}
```

### 12.2 Business Context — Healthcare SaaS (100 people)

```json
{
  "company_name": "MedFlow",
  "industry": "Healthcare SaaS",
  "product_description": "Patient engagement and appointment scheduling platform for hospitals",
  "employee_count": 100,
  "engineering_team_size": 35,
  "data_types_handled": ["pii", "phi"],
  "customer_segments": ["Enterprise"],
  "geographic_regions": ["US", "EU"],
  "cloud_providers": ["aws"],
  "hosting_model": "cloud_native",
  "key_services": ["EKS", "RDS", "S3", "ElastiCache", "SQS", "Lambda"],
  "environments": ["production", "staging", "development", "dr"],
  "ci_cd_tools": ["GitHub Actions", "ArgoCD"],
  "monitoring_tools": ["Datadog", "PagerDuty", "Sentry"],
  "identity_provider": "Okta",
  "mfa_enforced": true,
  "sso_configured": true,
  "previous_soc2": true,
  "previous_audit_type": "type_ii",
  "other_certifications": ["HIPAA", "ISO 27001"],
  "existing_policies": [
    "Information Security Policy", "Access Control Policy", "Incident Response Plan",
    "Change Management Policy", "Data Classification Policy", "Encryption Policy",
    "Business Continuity Plan", "Vendor Management Policy", "Privacy Policy"
  ],
  "target_criteria": ["security", "availability", "confidentiality", "privacy"],
  "target_audit_type": "type_ii",
  "desired_audit_period": {
    "start": "2026-01-01",
    "end": "2026-12-31"
  },
  "preferred_auditor": "Schellman"
}
```

### 12.3 MCP Server Configuration

```json
{
  "mcp_servers": {
    "aws": {
      "server_type": "cloud_provider",
      "display_name": "AWS Production Account",
      "connection": {
        "auth_method": "iam_role",
        "role_arn": "arn:aws:iam::123456789012:role/SOC2AgentReadRole",
        "external_id": "soc2-agent-UNIQUE-ID",
        "regions": ["us-east-1", "us-west-2"]
      },
      "capabilities": [
        "iam_policies", "cloudtrail_status", "encryption_config",
        "security_groups", "backup_config", "vpc_flow_logs", "config_compliance"
      ],
      "controls_supported": [
        "CC6.1", "CC6.2", "CC6.3", "CC6.6", "CC6.7",
        "CC7.1", "CC7.2", "CC4.1", "CC5.2",
        "A1.2", "A1.3"
      ]
    },
    "github": {
      "server_type": "scm",
      "display_name": "GitHub Organization",
      "connection": {
        "auth_method": "oauth2",
        "org_name": "buildtrack-inc",
        "credentials_secret_id": "arn:aws:secretsmanager:us-east-1:123456789012:secret:soc2/github-token"
      },
      "capabilities": [
        "branch_protection", "pr_history", "org_security",
        "ci_cd_config", "dependabot_alerts"
      ],
      "controls_supported": ["CC8.1", "CC7.2", "CC7.3", "CC6.1", "CC6.3"]
    },
    "okta": {
      "server_type": "identity_provider",
      "display_name": "Okta",
      "connection": {
        "auth_method": "api_key",
        "domain": "buildtrack.okta.com",
        "credentials_secret_id": "arn:aws:secretsmanager:us-east-1:123456789012:secret:soc2/okta-api-key"
      },
      "capabilities": [
        "mfa_enrollment", "sso_config", "provisioning_logs",
        "access_policies", "admin_roles"
      ],
      "controls_supported": ["CC6.1", "CC6.2", "CC6.3", "CC6.6"]
    },
    "jira": {
      "server_type": "project_management",
      "display_name": "Jira Cloud",
      "connection": {
        "auth_method": "api_key",
        "url": "https://buildtrack.atlassian.net",
        "credentials_secret_id": "arn:aws:secretsmanager:us-east-1:123456789012:secret:soc2/jira-api-key"
      },
      "capabilities": [
        "change_tickets", "incident_tickets", "risk_register"
      ],
      "controls_supported": ["CC8.1", "CC7.2", "CC7.3", "CC7.4", "CC7.5", "CC3.1"]
    }
  },
  "monitoring_schedule": {
    "daily": {
      "cron": "0 6 * * *",
      "checks": ["access_control", "change_management", "logging_status", "backup_status"]
    },
    "weekly": {
      "cron": "0 6 * * 1",
      "checks": ["encryption_config", "training_completion", "certificate_expiry"]
    },
    "monthly": {
      "cron": "0 6 1 * *",
      "checks": ["vendor_risk_review", "policy_review_dates", "full_posture_scan"]
    }
  }
}
```

### 12.4 Sample Control Matrix Entry

```json
{
  "control_id": "CC6.1",
  "tsc_criteria": "security",
  "control_area": "Logical & Physical Access",
  "control_description": "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.",
  "control_objective": "Access to systems and data is restricted to authorized users based on business need, using MFA, SSO, and role-based access controls.",
  "risk_level": "high",
  "applicability": "applicable",
  "owner": "DevOps Lead",
  "status": "evidence_collected",
  "implementation_guidance": "For BuildTrack: verify Okta MFA enforcement (100% enrollment), AWS IAM policies follow least privilege, GitHub org requires 2FA, no shared credentials, privileged access is logged.",
  "evidence_requirements": [
    {
      "evidence_id": "CC6.1-E1",
      "description": "AWS IAM policies showing role-based access and least privilege",
      "source_system": "AWS",
      "collection_method": "automated",
      "mcp_tool": "get_iam_policies",
      "frequency": "point_in_time"
    },
    {
      "evidence_id": "CC6.1-E2",
      "description": "Okta MFA enrollment report showing 100% enrollment",
      "source_system": "Okta",
      "collection_method": "automated",
      "mcp_tool": "get_mfa_enrollment",
      "frequency": "point_in_time"
    },
    {
      "evidence_id": "CC6.1-E3",
      "description": "GitHub organization security settings showing 2FA requirement",
      "source_system": "GitHub",
      "collection_method": "automated",
      "mcp_tool": "get_org_security",
      "frequency": "point_in_time"
    },
    {
      "evidence_id": "CC6.1-E4",
      "description": "Quarterly access review documentation",
      "source_system": "Manual",
      "collection_method": "manual",
      "frequency": "periodic",
      "notes": "Upload access review meeting notes and action items for each quarter in the observation period"
    }
  ]
}
```

---

## 13. AWS Infrastructure Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         AWS Account                               │
│                                                                    │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      │
│  │  CloudFront   │────>│  S3 (Static) │     │  S3 (Evidence)│     │
│  │  (Dashboard)  │     │  React App   │     │  Versioned +  │     │
│  └──────────────┘     └──────────────┘     │  Encrypted    │     │
│                                             └──────────────┘      │
│  ┌──────────────────────────────────────────────┐                 │
│  │              ECS / Fargate                     │                │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │                │
│  │  │Orchestrat│  │ Subagent │  │ Subagent │   │                │
│  │  │or Agent  │  │ Workers  │  │ Workers  │   │                │
│  │  │(Service) │  │(Service) │  │(Service) │   │                │
│  │  └──────────┘  └──────────┘  └──────────┘   │                │
│  └──────────────────────────────────────────────┘                 │
│         │              │              │                            │
│  ┌──────v──────┐ ┌─────v─────┐ ┌─────v──────┐                   │
│  │ Aurora       │ │ DynamoDB  │ │ ElastiCache │                  │
│  │ PostgreSQL   │ │ (Alerts,  │ │ Redis       │                  │
│  │ (Core data)  │ │  Sessions)│ │ (BullMQ)    │                  │
│  └─────────────┘ └───────────┘ └─────────────┘                   │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Secrets       │  │ CloudWatch   │  │ EventBridge  │           │
│  │ Manager       │  │ (Logs +      │  │ (Scheduled   │           │
│  │ (Credentials) │  │  Metrics)    │  │  Monitoring) │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

**Service roles:**
- **ECS/Fargate** — Runs agent containers (orchestrator + subagent workers), auto-scales based on active engagements
- **Aurora PostgreSQL** — Core compliance data (controls, evidence metadata, gaps, policies, audit trail)
- **DynamoDB** — High-throughput real-time data (monitoring alerts, posture scores, agent sessions)
- **S3** — Evidence artifact storage (versioned, encrypted, lifecycle policies) + React dashboard static hosting
- **CloudFront** — CDN for React dashboard
- **ElastiCache Redis** — BullMQ job queue for scheduled monitoring, evidence collection jobs
- **Secrets Manager** — MCP server credentials, API keys, Anthropic API key
- **EventBridge** — Cron-based triggers for monitoring agent (daily, weekly, monthly schedules)
- **CloudWatch** — Agent execution logs, metrics, alerting on agent failures

---

## 14. Development Roadmap

### Phase 1: Foundation (Weeks 1-4)
| Task | Details |
|------|---------|
| Project scaffolding | TypeScript project, AWS CDK/SST infra, CI/CD pipeline |
| Data model | Aurora PostgreSQL schema, DynamoDB tables, S3 bucket config |
| Orchestrator agent | Main agent with state machine, subagent routing |
| Scoping agent | Business context interview, Control Matrix generation |
| Basic dashboard | React app with Control Matrix view |

### Phase 2: Core Compliance Engine (Weeks 5-8)
| Task | Details |
|------|---------|
| Policy agent | Template library (12 core policies), hybrid generation flow |
| Gap assessment agent | Gap identification, classification, remediation plan generation |
| Evidence agent (manual) | Checklist generation, upload validation, evidence repository |
| AWS MCP server | IAM, CloudTrail, S3, RDS, VPC evidence collection |
| GitHub MCP server | Branch protection, PR history, org security, CI/CD configs |

### Phase 3: Automation & Integrations (Weeks 9-12)
| Task | Details |
|------|---------|
| Okta MCP server | MFA enrollment, provisioning logs, access policies |
| Jira MCP server | Change tickets, incident tickets, risk register |
| Evidence agent (automated) | MCP-based evidence collection, validation logic |
| Audit coordination agent | PBC tracking, evidence packaging, walkthrough prep |
| Notification system | Slack/email alerts for deadlines, drift, gaps |

### Phase 4: Monitoring & Multi-Tenant (Weeks 13-16)
| Task | Details |
|------|---------|
| Continuous monitoring agent | Scheduled checks, drift detection, posture scoring |
| EventBridge integration | Cron-based monitoring schedules |
| Multi-tenant support | Organization isolation, consulting firm multi-client view |
| Dashboard v2 | Compliance posture, gap tracker, evidence status, audit timeline |
| Additional MCP servers | Slack, HRIS (BambooHR), MDM (Jamf) |

### Phase 5: Polish & Scale (Weeks 17-20)
| Task | Details |
|------|---------|
| Custom MCP server template | Documentation + starter kit for new integrations |
| Audit report import | Parse previous SOC 2 reports for returning clients |
| Advanced analytics | Compliance trends, auditor response time tracking, cost analysis |
| API layer | REST/GraphQL API for external integrations |
| Load testing | Multi-tenant scale testing, concurrent monitoring jobs |

---

## 15. Cost Estimates

### Claude API Costs (per engagement)

| Phase | Model | Estimated Tokens | Cost Estimate |
|-------|-------|-----------------|---------------|
| Scoping | Sonnet | ~50K in + 20K out | ~$0.50 |
| Policy generation (12 policies) | Sonnet | ~200K in + 100K out | ~$2.50 |
| Gap assessment | Opus | ~100K in + 50K out | ~$3.00 |
| Evidence collection | Sonnet | ~150K in + 50K out | ~$1.50 |
| Audit coordination (per PBC cycle) | Opus | ~80K in + 40K out | ~$2.50 |
| Continuous monitoring (per month) | Haiku | ~500K in + 100K out | ~$0.80 |
| **Total per engagement** | | | **~$10-15** |
| **Annual (Type II + monitoring)** | | | **~$25-35** |

### AWS Infrastructure Costs (estimated monthly)

| Service | Configuration | Monthly Cost |
|---------|--------------|-------------|
| ECS/Fargate | 2 tasks (0.5 vCPU, 1GB), burst to 6 during audits | ~$30-80 |
| Aurora PostgreSQL | db.t4g.medium, single AZ (dev) / multi-AZ (prod) | ~$60-200 |
| DynamoDB | On-demand, ~1M reads + 500K writes/month | ~$5-15 |
| S3 | 50-500 GB evidence storage | ~$1-12 |
| ElastiCache Redis | cache.t4g.micro | ~$15 |
| CloudFront | Dashboard CDN | ~$1-5 |
| Secrets Manager | ~20 secrets | ~$8 |
| EventBridge | Monitoring schedules | ~$1 |
| **Total monthly** | | **~$120-340** |

---

## 16. Getting Started — Quick Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd soc2-compliance-agent
npm install

# 2. Configure AWS credentials
aws configure --profile soc2-agent

# 3. Set environment variables
cp .env.example .env
# Edit .env:
#   ANTHROPIC_API_KEY=sk-ant-...
#   AWS_REGION=us-east-1
#   DATABASE_URL=postgresql://...
#   REDIS_URL=redis://...

# 4. Deploy infrastructure (AWS CDK or SST)
npx sst deploy --stage dev

# 5. Run database migrations
npm run db:migrate

# 6. Configure MCP servers
# Edit ./config/mcp-servers.json with your integrations:
# - AWS account details
# - GitHub org and token
# - Okta domain and API key
# - Jira instance and credentials

# 7. Start the agent
npm run agent:start

# 8. Open the dashboard
# Visit the CloudFront URL output from step 4
```

---

## 17. Key SOC 2 References

| Resource | URL/Reference |
|----------|--------------|
| AICPA Trust Services Criteria | aicpa.org — TSP Section 100 |
| SOC 2 Reporting Framework | SSAE 18 (AT-C Section 205) |
| AICPA SOC 2 Guide | "SOC 2 Reporting on an Examination of Controls" |
| Common Criteria (2017) | AICPA Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy |
| Point of Focus | AICPA supplemental guidance for each control point |
| COSO Framework | Committee of Sponsoring Organizations — Internal Control framework (foundation for CC1-CC5) |

---

## 18. References

- Anthropic Claude Agent SDK documentation
- AICPA Trust Services Criteria (2017 framework with 2022 revisions)
- SSAE 18 / AT-C Section 205 — Examination Engagements
- SOC 2 Academy — Common control implementations
- AWS Well-Architected Framework — Security Pillar
- NIST Cybersecurity Framework (CSF) — complementary controls mapping
