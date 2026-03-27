# Agentic Design Patterns — Reference Guide

Source: "Agentic Design Patterns" by Antonio Gulli (Google), 2025. 482 pages.
Distilled to patterns actionable for our agent implementations.

---

## Core Patterns (Part 1)

### 1. Prompt Chaining
Sequential pipeline — break complex tasks into focused sub-tasks, each step's output feeding the next.

**Key insight:** The win is not just decomposition but **focused context per step** — each LLM call sees only what it needs, preventing cognitive overload.

**Apply to:** Portal verification pipeline (RERA check → eCourts check → AnyRoR check → cross-reference → report).

**Anti-pattern:** Monolithic prompts with multiple constraints cause the LLM to overlook instructions and generate incorrect information.

### 2. Routing
Dynamic dispatch — classify input then route to specialized handlers based on intent.

**Four mechanisms (ranked by tradeoff):**
1. **LLM-based:** Most flexible, handles novel inputs
2. **Embedding-based:** Semantic similarity routing
3. **Rule-based:** Fastest, most deterministic (if-else on keywords)
4. **ML classifier:** Routing logic in learned weights

**Apply to:** Copilot mode — route buyer questions to the right phase handler (cost question → total cost tool, registration question → registration guide, etc.)

**Anti-pattern:** Always include a fallback route for unclassifiable inputs.

### 3. Parallelization (Fan-out/Fan-in)
Execute independent sub-tasks concurrently, then aggregate results.

**Key insights:**
- The synthesis/merge step after parallel execution benefits from a **more powerful model** than the parallel workers
- Python asyncio is concurrency (not parallelism) but effective because LLM/API calls are I/O-bound
- Non-obvious use: A/B testing — generate variants in parallel, select best

**Apply to:** Run all 6 portal checks simultaneously instead of sequentially. Merge with cross-portal verification.

**Anti-pattern:** Parallelization makes debugging and logging substantially harder — design for observability.

### 4. Reflection (Generate-Critique-Refine)
Agent evaluates its own output and iteratively improves it.

**Key insights:**
- **Separate producer and critic** — using a distinct agent/persona for critique prevents cognitive bias
- Stopping condition: Critic outputs a sentinel token (`REPORT_COMPLETE`) when satisfied
- Conversation history is the mechanism — each iteration builds on previous critique
- **Dramatically more effective with memory**

**Apply to:** Due diligence report review — a "senior property lawyer" critic agent reviews the report before presenting to the buyer.

**Anti-pattern:** Cost/latency multiply with each iteration. Set max iteration cap (2-3 rounds max).

---

## Tool & Planning Patterns (Part 1 cont.)

### 5. Tool Use
LLM decides when/how to call external functions.

**Key insights:**
- Tools should **raise exceptions** rather than returning error strings — lets the agent reason about failures
- **Agent-as-Tool pattern:** Wrap a sub-agent as a callable tool for a parent agent. The parent sees it as just another function. Cleanest composition primitive.
- Design tools with clean typed data contracts (JSON), not free-form text

**Apply to:** Each portal module could be wrapped as an Agent-as-Tool for the orchestrator.

### 6. Planning
Agent decomposes a goal into a sequenced plan, then executes and adapts.

**Key decision heuristic:** "Does the 'how' need to be discovered, or is it already known?" If known, use a fixed workflow. If unknown, use planning. Do NOT default to planning when a deterministic pipeline suffices.

**Google DeepResearch architecture (most mature planning implementation):**
1. Decompose query into multi-point research plan
2. Present plan to user for review/edit before execution
3. Iterative search-and-filter with dynamic query refinement
4. Async execution resilient to single-source failures
5. Synthesis into structured report with citations

**Apply to:** Our copilot's phase-based workflow is already a good fixed plan. Dynamic planning would be useful for complex cross-portal investigations where the search strategy depends on findings.

**Anti-pattern:** Plans without user review before execution — always show the plan first.

### 7. Multi-Agent Collaboration
Specialized agents with distinct roles coordinate to solve complex tasks.

**6 communication topologies:**
1. Single Agent
2. Network (peer-to-peer)
3. Supervisor (hub-spoke) — single point of failure warning
4. Supervisor-as-Tool (guidance, not control) — less brittle
5. Hierarchical (multi-layer supervisors)
6. Custom (hybrid)

**Key insight:** `output_key` on agents stores results in `session.state` — agents pass data via state, not return values.

**Anti-pattern:** Network topology without coordination = communication overhead explosion. Missing shared ontology causes incoherent outputs.

---

## Memory & Learning (Part 2)

### 8. Memory Management
Dual-component: short-term context + long-term persistent store.

**Three types of long-term memory:**
- **Semantic** (facts/preferences) — user profile JSON, continuously updated
- **Episodic** (past experiences) — few-shot examples from successful past interactions
- **Procedural** (rules/instructions) — agent reviews its own instructions via reflection and rewrites its system prompt

**State key prefixes (from ADK):**
- `user:` — cross-session user data (buyer preferences, gender, first-property)
- `app:` — app-global shared data (jantri rates, red flags)
- `temp:` — current-turn throwaway data

**Anti-patterns:**
- Never mutate state directly — always update via events/deltas
- Long context windows are still ephemeral and costly — don't rely on them as substitute for persistent memory

### 9. MCP (Model Context Protocol)
Client-server protocol for standardized LLM-to-external-system communication.

**Non-obvious insight:** MCP does NOT guarantee agent-friendly data. Wrapping a legacy API that returns PDFs is useless — convert output to Markdown/text first. The data format matters more than the connection.

**Key point:** Agents need STRONGER deterministic support from underlying APIs. If a portal only fetches full pages, add filtering/sorting to the underlying tool first.

**Apply to:** Our portal tools should return structured JSON, not raw HTML or screenshots. Screenshots are evidence; JSON is for reasoning.

---

## Safety & Recovery (Part 3)

### 10. Exception Handling and Recovery
Three-phase: Detection → Handling → Recovery.

**Fallback chain pattern:** primary_handler → fallback_handler → response_agent. Each checks state to determine if the previous step failed and uses an alternative approach.

**State rollback:** Treat agent state like a database transaction — reverse recent changes on error, then replan.

**Apply to:** Portal tool failures: dev-browser → Chrome MCP fallback → mark as "not_checked" with limitation. Never halt the entire analysis because one portal is unavailable.

**Anti-pattern:** Do NOT retry the same invalid action repeatedly. Detect error class (CAPTCHA vs portal down vs bad input) and change strategy.

### 11. Human-in-the-Loop
Strategic human oversight integration.

**"Human-on-the-loop" variant:** Human defines policy/rules; agent executes autonomously within constraints. Scales far better than per-action approval.

**Escalation as a first-class tool:** `escalate_to_human` is a tool the agent can call, not just a fallback. Agent instructions explicitly define when to use it.

**Apply to:** Our phase checkpoints are HITL. Could add escalation tool for critical red flags that require immediate buyer attention.

### 12. Guardrails/Safety Patterns
Multi-layered defense at input, processing, and output stages.

**Key techniques:**
- **Cheap guardrail model:** Use Haiku/Flash at temperature=0 as policy enforcer before the expensive model
- **Per-tool authorization:** Intercept every tool call, check user context before executing
- **"Agents as Contractors":** Formalized contracts with deliverables, specs, acceptable data sources, compute budget. Agent can negotiate before execution.
- **Checkpoint/rollback:** Treat agent state like DB transactions

**Apply to:**
- Haiku as gatekeeper for input validation
- Per-portal tool authorization checks
- Structured quality checklist before presenting report to buyer

**Anti-patterns:**
- Sanitize ALL model-generated content before display — prevent XSS
- Principle of least privilege — agent accesses only what it needs
- Log entire chain of thought (tools called, data received, reasoning) — final output alone is insufficient for debugging

---

## Reasoning (Part 4)

### 13. Reasoning Techniques

**PALMs (Program-Aided Language Models):** Offload calculations to code execution. Agent generates Python, executes it, returns results. Use for stamp duty calculations, cost breakdowns.

**ReAct loop:** Thought → Action → Observation → Thought. Adjust thought frequency by task type: high for knowledge-intensive (every portal check), low for action-heavy tasks.

**Scaling Inference Law:** A smaller model with more "thinking budget" can outperform a larger model with simple generation. Allocate compute where it matters most.

**MASS framework:** Three-stage optimization: (1) optimize individual agent prompts, (2) optimize topology/workflow, (3) re-optimize prompts for the final workflow as a whole. Key finding: optimize agents individually BEFORE composing them.

