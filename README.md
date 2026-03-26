# Experimental Agents

Research documents and specifications for building production-grade AI agents using the Claude Agent SDK.

## Playbook

| Document | Description |
|----------|-------------|
| [Deep Agent Infrastructure Playbook](deep-agent-infrastructure-playbook.md) | Comprehensive guide covering shared infrastructure patterns, architectural decisions, and implementation techniques for building deep agents. Covers tool design, MCP integration, orchestration, error handling, and deployment. |

## Agent Specs

### Healthcare & Pharma

| Agent | Description |
|-------|-------------|
| [Lab Report Intelligence Agent](lab-report-intelligence-agent-spec.md) | Automates post-analyzer result validation and intelligent report generation for diagnostics labs — reference range checks, delta checks, clinical pattern detection, AI-powered interpretive comments, and tiered autonomy (auto-validate normals, escalate abnormals). |
| [MR Copilot Agent](mr-copilot-agent-spec.md) | AI assistant for Medical Representatives in pharma — pre-call intelligence (doctor profiling, RCPA trends, visit history), in-call support (product Q&A, objection handling, clinical evidence), voice-to-DCR automation, route optimization, UCPMP compliance tracking, and manager coaching signals. |
| [ABHA Health Record Agent](abha-health-record-agent-spec.md) | Personal local agent that manages your ABHA (Ayushman Bharat Health Account) — browser automation for portal navigation, health record download and organization, health summaries, consent management, and full audit trail with screenshots. |

### Compliance & Legal

| Agent | Description |
|-------|-------------|
| [SOC 2 Compliance Agent](soc2-compliance-agent-spec.md) | Manages the complete SOC 2 compliance lifecycle — scoping, control mapping, policy generation, evidence collection, gap assessment, remediation tracking, auditor coordination, and continuous monitoring. |
| [Statutory Compliance Calendar Agent (India)](statutory-compliance-calendar-agent-spec.md) | Tracks, alerts, prepares, and assists in filing 30+ recurring statutory compliance obligations across GST, Income Tax, TDS/TCS, PF, ESI, Professional Tax, ROC/MCA, and state-level filings for Indian businesses. |
| [Legal/Contract Intelligence Agent (India)](legal-contract-intelligence-agent-spec.md) | Indian contract review agent — reads contracts holistically, flags risks against Indian law (Contract Act, DPDPA, Stamp Act, Labor Codes, FEMA), explains in plain language for business teams, generates redlines and negotiation playbooks, tracks versions through negotiation rounds, and calculates state-wise stamp duty. Legal KB in PostgreSQL + pgvector. |

### Operations & Procurement

| Agent | Description |
|-------|-------------|
| [Vendor Onboarding Agent (India)](vendor-onboarding-agent-spec.md) | Handles end-to-end vendor onboarding for Indian businesses — document collection, government API validation (GSTIN, PAN, Udyam, MCA, Bank), compliance screening, risk scoring, approval workflows, and ERP master creation. |
| [Cloud Cost Optimization Agent (AWS)](cloud-cost-optimization-agent-spec.md) | Investigates cost spikes, detects and cleans up waste, rightsizes instances with auto-rollback, optimizes Savings Plans, schedules dev/staging environments, and analyzes data transfer costs — across AWS Organizations with tiered autonomy. The agent that executes, not just recommends. |

### Personal / Finance

| Agent | Description |
|-------|-------------|
| [Personal Accounting Agent](personal-accounting-agent-research.md) | Research document for an AI-powered personal accountant that handles financial data processing, categorization, reconciliation, reporting, and insights. |
