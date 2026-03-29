# Experimental Agents

Research documents, specifications, and reference implementations for building production-grade AI agents. Built by [Antigravity Apps](https://antigravityapps.dev) / [AppGambit](https://appgambit.com).

## Repository Structure

```
├── reference/          # Agentic knowledge base — patterns, playbooks, failure modes
├── specs/              # Real-world agent specifications
├── implementation/     # Working code (TypeScript, MCP servers, tests)
```

## Reference

| Document | Description |
|----------|-------------|
| [Deep Agent Infrastructure Playbook](reference/deep-agent-infrastructure-playbook.md) | Comprehensive guide covering shared infrastructure patterns, architectural decisions, and implementation techniques for building deep agents. Covers tool design, MCP integration, orchestration, error handling, and deployment. |
| [Agent Framework Implementation Playbook](reference/agent-framework-implementation-playbook.md) | Technical guide for implementing agents across 5 frameworks — Claude Agent SDK, LangChain/LangGraph, CrewAI, Mastra, and AWS Bedrock AgentCore. Includes framework selection matrix, reference implementations, hosting patterns (Docker/ECS/Fargate/Serverless), and migration guides. |
| [Agentic Design Patterns Reference](reference/agentic-design-patterns-reference.md) | Distilled patterns from Google's 482-page guide — prompt chaining, routing, parallelization, reflection, tool use, planning, multi-agent, memory, guardrails, reasoning. With priority implementation table. |
| [Common Agent Failure Modes](reference/common-agent-failure-modes.md) | 10 failure modes with symptoms, root causes, and mitigations — recursive loops, tool over-reliance, cascade failure, hallucinated results, context saturation, prompt injection, over-confident risk, state without rollback, blind retry, information hoarding. |
| [Claude Agent SDK Patterns](reference/claude-agent-sdk-patterns.md) | Subagents (parallel execution, context isolation, tool restrictions), Slash Commands (built-in + custom with arguments/bash execution), and Agent Skills (autonomous invocation, SKILL.md format). With application examples for our real estate agent. |

## Agent Specs

### Healthcare & Pharma

| Agent | Description |
|-------|-------------|
| [Lab Report Intelligence Agent](specs/lab-report-intelligence-agent-spec.md) | Automates post-analyzer result validation and intelligent report generation for diagnostics labs — reference range checks, delta checks, clinical pattern detection, AI-powered interpretive comments, and tiered autonomy (auto-validate normals, escalate abnormals). |
| [MR Copilot Agent](specs/mr-copilot-agent-spec.md) | AI assistant for Medical Representatives in pharma — pre-call intelligence (doctor profiling, RCPA trends, visit history), in-call support (product Q&A, objection handling, clinical evidence), voice-to-DCR automation, route optimization, UCPMP compliance tracking, and manager coaching signals. |
| [ABHA Health Record Agent](specs/abha-health-record-agent-spec.md) | Personal local agent that manages your ABHA (Ayushman Bharat Health Account) — browser automation for portal navigation, health record download and organization, health summaries, consent management, and full audit trail with screenshots. |

### Compliance & Legal

| Agent | Description |
|-------|-------------|
| [SOC 2 Compliance Agent](specs/soc2-compliance-agent-spec.md) | Manages the complete SOC 2 compliance lifecycle — scoping, control mapping, policy generation, evidence collection, gap assessment, remediation tracking, auditor coordination, and continuous monitoring. |
| [Statutory Compliance Calendar Agent (India)](specs/statutory-compliance-calendar-agent-spec.md) | Tracks, alerts, prepares, and assists in filing 30+ recurring statutory compliance obligations across GST, Income Tax, TDS/TCS, PF, ESI, Professional Tax, ROC/MCA, and state-level filings for Indian businesses. |
| [Legal/Contract Intelligence Agent (India)](specs/legal-contract-intelligence-agent-spec.md) | Indian contract review agent — reads contracts holistically, flags risks against Indian law (Contract Act, DPDPA, Stamp Act, Labor Codes, FEMA), explains in plain language for business teams, generates redlines and negotiation playbooks, tracks versions through negotiation rounds, and calculates state-wise stamp duty. Legal KB in PostgreSQL + pgvector. |

### Operations & Procurement

| Agent | Description |
|-------|-------------|
| [Vendor Onboarding Agent (India)](specs/vendor-onboarding-agent-spec.md) | Handles end-to-end vendor onboarding for Indian businesses — document collection, government API validation (GSTIN, PAN, Udyam, MCA, Bank), compliance screening, risk scoring, approval workflows, and ERP master creation. |
| [Cloud Cost Optimization Agent (AWS)](specs/cloud-cost-optimization-agent-spec.md) | Investigates cost spikes, detects and cleans up waste, rightsizes instances with auto-rollback, optimizes Savings Plans, schedules dev/staging environments, and analyzes data transfer costs — across AWS Organizations with tiered autonomy. The agent that executes, not just recommends. |

### Real Estate

| Agent | Description |
|-------|-------------|
| [Real Estate Transaction Agent (Gujarat)](specs/real-estate-transaction-agent-spec.md) | End-to-end property purchase companion for Gujarat — browser automation for 6 government portals (AnyRoR, Gujarat RERA, eCourts, GARVI, SMC, GSTN), due diligence with dispute search, builder agreement review, total cost breakdown (jantri vs market rate), stamp duty calculation, registration guide, and immutable purchase dossier with timestamped evidence. |

### Personal / Finance

| Agent | Description |
|-------|-------------|
| [Personal Accounting Agent](specs/personal-accounting-agent-research.md) | Research document for an AI-powered personal accountant that handles financial data processing, categorization, reconciliation, reporting, and insights. |

## Implementations

Working code with MCP servers, tests, web UI, and interactive copilot.

| Agent | Stack | Tools | Tests | Features |
|-------|-------|-------|-------|----------|
| [Real Estate Transaction Agent](implementation/real-estate-agent/) | TypeScript, Claude Agent SDK, Hono, Vite+React | 4 MCP servers (24 in-process tools + Playwright browser) | 139 | Web UI (wizard → chat), 11 slash commands, 5 subagents, 5 skills, reflection/critic agent, Playwright MCP fallback for CAPTCHA |
| [Legal Contract Intelligence Agent](implementation/legal-contract-agent/) | TypeScript, Claude Agent SDK | 3 MCP servers (14 tools) | 36 | CLI copilot, 11 slash commands, 4 subagents, 5 skills, reflection/critic agent, multi-state stamp duty |

## Contributing

Contributions are welcome! Whether it's a new agent spec, improvements to existing ones, or additions to the reference material.

1. **Fork** the repository
2. **Create a branch** for your contribution (`git checkout -b feature/your-agent-spec`)
3. **Follow the existing structure:**
   - Agent specs go in `specs/` — use existing specs as a template for format and depth
   - Reference/knowledge docs go in `reference/`
   - Working implementations go in `implementation/`
4. **Submit a pull request** with a clear description of what you're adding

### What makes a good contribution?

- **Agent specs** that solve real business problems with enough depth to be implementable
- **Reference material** that distills practical, non-obvious insights from building agents
- **Implementation code** with tests and clear MCP tool interfaces
- **Bug fixes** or improvements to existing specs based on real-world testing

## License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.

## Contact

- **Dhaval Nagar** — [dhaval@appgambit.com](mailto:dhaval@appgambit.com)
- [Antigravity Apps](https://antigravityapps.dev) — Product studio building AI-native applications
- [AppGambit](https://appgambit.com) — Cloud consulting and engineering
