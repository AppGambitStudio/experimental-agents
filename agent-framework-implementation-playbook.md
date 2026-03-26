# Agent Framework Implementation Playbook

A practical guide to implementing production-grade AI agents using five major frameworks: Claude Agent SDK, LangChain/LangGraph, CrewAI, Mastra, and AWS Bedrock AgentCore. This document is a companion to the [Deep Agent Infrastructure Playbook](./deep-agent-infrastructure-playbook.md) which covers patterns and architecture — this playbook covers HOW to build agents using specific frameworks.

**Audience:** Developers choosing a framework and building their first (or next) production agent.

**How to use this document:** Start with the Framework Selection Guide to pick a framework. Then jump to that framework's section for architecture, reference implementation, real-world mapping, and deployment. Use Section 7 (Hosting & Deployment) and Section 8 (Migration) as cross-cutting references.

**Last validated:** March 2026 | **Frameworks:** Claude Agent SDK v0.1.48, LangGraph 1.0 GA, CrewAI v1.10.1, Mastra v1.0, AWS Bedrock AgentCore GA

---

## Table of Contents

1. [Framework Selection Guide](#1-framework-selection-guide)
2. [Claude Agent SDK](#2-claude-agent-sdk)
3. [LangChain / LangGraph](#3-langchain--langgraph)
4. [CrewAI](#4-crewai)
5. [Mastra](#5-mastra)
6. [AWS Bedrock AgentCore](#6-aws-bedrock-agentcore)
7. [Hosting & Deployment Patterns](#7-hosting--deployment-patterns)
8. [Framework Migration Guide](#8-framework-migration-guide)

---

## 1. Framework Selection Guide

### Decision Matrix

| Dimension | Claude Agent SDK | LangGraph | CrewAI | Mastra | Bedrock AgentCore |
|-----------|-----------------|-----------|--------|--------|-------------------|
| **Language** | TypeScript, Python | Python (primary), TypeScript | Python | TypeScript | Any (Docker) |
| **Model Support** | Claude only | Any (OpenAI, Claude, Gemini, Llama, etc.) | Any (via LiteLLM) | Any (OpenAI, Claude, Gemini, etc.) | Bedrock models + any via custom inference |
| **Multi-Agent** | Manual orchestration via sub-agents | Native (supervisor, swarm, hierarchical) | Native (Crews + delegation) | Native (supervisor pattern) | Native (multi-agent collaboration) |
| **MCP Support** | Native (first-class, in-process servers) | Via langchain-mcp-adapters | Community adapters | Native (built-in) | Action groups (not MCP) |
| **State Management** | Manual (you own state) | Built-in checkpointing + time travel | Context window management | AgentFS for persistent file storage | Managed session state (microVM) |
| **Observability** | Custom (hooks + logging) | LangSmith (native, excellent) | AgentOps / custom | Built-in telemetry | CloudWatch + X-Ray |
| **Learning Curve** | Low (minimal abstractions) | Medium-High (graph concepts) | Low (role-based is intuitive) | Low-Medium (DAG workflows) | Medium (AWS service ecosystem) |
| **Community/Stars** | N/A (Anthropic-maintained) | 45k+ (LangChain org) | 45.9k | 22.3k | N/A (AWS managed) |
| **Production Readiness** | High (simple = fewer failure modes) | Highest (GA since Oct 2025) | High (standalone, battle-tested) | Medium (launched Jan 2026) | High (AWS SLA-backed) |
| **Best For** | Claude-native apps, MCP-heavy architectures | Complex workflows, stateful agents, multi-model | Role-based teams, rapid prototyping | TypeScript teams, Next.js/Vercel stack | Enterprise, compliance-heavy, managed infra |

### Pick This If...

| Framework | One-liner |
|-----------|-----------|
| **Claude Agent SDK** | You're building Claude-first, want MCP-native integration with minimal abstractions, and prefer to own the orchestration logic. |
| **LangGraph** | You need complex stateful workflows with branching, checkpointing, time-travel debugging, and model-agnostic flexibility. |
| **CrewAI** | You want to model your problem as a team of specialists with distinct roles, and want fast time-to-prototype with good defaults. |
| **Mastra** | Your team is TypeScript-native, you're deploying to Vercel/Railway, and you want workflow-as-code with built-in persistence. |
| **Bedrock AgentCore** | You need managed infrastructure, governance guardrails, long-running agent sessions (up to 8 hours), and you're already on AWS. |

### Cost Comparison

| Framework | API Overhead | Hosting Cost (typical) | Hidden Costs |
|-----------|-------------|----------------------|-------------|
| **Claude Agent SDK** | Minimal — direct API calls, no wrapper tax | $50-200/mo (ECS/Fargate) / ₹4,200-16,800/mo | None — you pay Anthropic API only |
| **LangGraph** | Low — thin orchestration layer, ~2-5% token overhead from state serialization | $50-200/mo (self-hosted) or $0-500/mo (LangGraph Cloud) / ₹4,200-42,000/mo | LangSmith: $39/seat/mo for Plus, free tier for dev |
| **CrewAI** | Medium — role/goal prompts add ~500-1000 tokens per agent per turn | $50-200/mo (self-hosted) or CrewAI Enterprise pricing / ₹4,200-16,800/mo | Extra tokens from verbose system prompts per agent |
| **Mastra** | Low — minimal wrapper overhead | $20-100/mo (Vercel/Railway) / ₹1,680-8,400/mo | AgentFS storage if using persistent files |
| **Bedrock AgentCore** | Medium — Gateway + Runtime overhead | Consumption-based: ~$0.01-0.05 per invocation + model costs / ₹0.84-4.20 per invocation | microVM session costs for long-running agents |

### When NOT to Use Each Framework (Anti-patterns)

| Framework | Do NOT use when... |
|-----------|-------------------|
| **Claude Agent SDK** | You need model-agnostic flexibility (switching between OpenAI/Gemini/Llama). You need built-in checkpointing or complex state management out of the box. |
| **LangGraph** | Your agent is simple (linear tool calls — a StateGraph is overkill). Your team is TypeScript-only and uncomfortable with Python. Time-to-market is critical and the learning curve is a blocker. |
| **CrewAI** | Your workflow is a fixed DAG (not role-based). You need fine-grained control over every LLM call. You're building for TypeScript environments. |
| **Mastra** | Your team is Python-native. You need battle-tested production maturity (Mastra is newer, launched Jan 2026). You need complex multi-agent hierarchies beyond supervisor pattern. |
| **Bedrock AgentCore** | You're multi-cloud or cloud-agnostic. You need sub-100ms response times (microVM cold starts). You want full control over agent runtime behavior. Budget is tight — managed services cost more at scale. |

---

## 2. Claude Agent SDK

### Overview

The Claude Agent SDK is Anthropic's official framework for building agents with Claude. It's MCP-native (Model Context Protocol is a first-class citizen, not an adapter), supports in-process MCP servers (no separate process needed), and provides lifecycle hooks (`PreToolUse`, `PostToolUse`) for guardrails and observability. The SDK is intentionally minimal — it gives you a solid agentic loop and tool execution pipeline, and gets out of your way for everything else.

**Key characteristics:**
- **MCP-native:** MCP servers are the primary mechanism for tool integration, not an afterthought
- **In-process MCP servers:** Run MCP servers in the same process as your agent (no IPC overhead for local tools)
- **Lifecycle hooks:** Intercept tool calls before and after execution for guardrails, logging, cost tracking
- **Minimal abstractions:** No graph DSL, no role system — you write the orchestration logic
- **Model tiering:** Easy to route different tasks to Opus/Sonnet/Haiku based on complexity

**Current version:** v0.1.48 (TypeScript), v0.1.x (Python)

### Architecture Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK Application                │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Agentic Loop                           │  │
│  │                                                          │  │
│  │  User Message ──► Claude API ──► Tool Calls? ──► Yes ──┐│  │
│  │       ▲                                    │            ││  │
│  │       │                                    No           ││  │
│  │       │                                    │            ││  │
│  │       │                                    ▼            ││  │
│  │       │                              Final Response     ││  │
│  │       │                                                 ││  │
│  │       │    ┌────────────────────────────────────────┐   ││  │
│  │       │    │         Tool Execution Pipeline        │   ││  │
│  │       │    │                                        │   ││  │
│  │       │    │  PreToolUse ──► Execute ──► PostToolUse│   ││  │
│  │       │    │   (hook)        (MCP)        (hook)    │   ││  │
│  │       │    └────────────────────────────────────────┘   ││  │
│  │       │                                                 ││  │
│  │       └─────────── Tool Results ◄───────────────────────┘│  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ MCP Server 1 │  │ MCP Server 2 │  │ MCP Server 3     │    │
│  │ (in-process) │  │ (stdio)      │  │ (HTTP remote)    │    │
│  │              │  │              │  │                   │    │
│  │ e.g. custom  │  │ e.g. postgres│  │ e.g. shared       │    │
│  │ business     │  │ MCP server   │  │ knowledge base    │    │
│  │ logic tools  │  │              │  │ service           │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Reference Implementation: Research Agent

This Research Agent takes a research topic, searches the web for sources, reads and analyzes documents, and produces a structured research report. The same agent is implemented in all five frameworks for comparison.

**Tools:**
1. `web_search` — Search the web for relevant sources
2. `read_document` — Fetch and read a URL or document
3. `write_report` — Save the final research report

```typescript
// research-agent-claude-sdk.ts
// Claude Agent SDK v0.1.48
// npm install @anthropic-ai/sdk zod

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ============================================================
// Tool Definitions
// ============================================================

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for information on a topic. Returns a list of results with titles, URLs, and snippets. Use this to find relevant sources for research.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "read_document",
    description:
      "Fetch and read the content of a URL or document. Returns the text content. Use this to read articles, papers, or web pages found via web_search.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch and read",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "write_report",
    description:
      "Save the final research report to a file. Use this after you have gathered and analyzed all sources. The report should be comprehensive and well-structured.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Report title",
        },
        content: {
          type: "string",
          description: "Full report content in Markdown format",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "List of source URLs used in the report",
        },
      },
      required: ["title", "content", "sources"],
    },
  },
];

// ============================================================
// Tool Execution
// ============================================================

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function executeWebSearch(
  query: string,
  maxResults: number = 10,
): Promise<{ results: SearchResult[]; count: number }> {
  // In production: integrate with Brave Search API, Serper, or Tavily
  // This is the integration point — swap the implementation, keep the interface
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
    {
      headers: { "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY! },
    },
  );
  const data = await response.json();
  const results = (data.web?.results || []).map(
    (r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }),
  );
  return { results, count: results.length };
}

async function executeReadDocument(
  url: string,
): Promise<{ content: string; word_count: number }> {
  // In production: use a proper scraping service or Jina Reader API
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
  });
  const content = await response.text();
  return { content: content.slice(0, 50000), word_count: content.split(/\s+/).length };
}

async function executeWriteReport(
  title: string,
  content: string,
  sources: string[],
): Promise<{ file_path: string; status: string }> {
  const fs = await import("fs/promises");
  const filename = `report-${title.toLowerCase().replace(/\s+/g, "-").slice(0, 50)}.md`;
  const fullContent = `# ${title}\n\n${content}\n\n---\n\n## Sources\n\n${sources.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`;
  await fs.writeFile(filename, fullContent, "utf-8");
  return { file_path: filename, status: "saved" };
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "web_search":
      return executeWebSearch(
        input.query as string,
        (input.max_results as number) || 10,
      );
    case "read_document":
      return executeReadDocument(input.url as string);
    case "write_report":
      return executeWriteReport(
        input.title as string,
        input.content as string,
        input.sources as string[],
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================================
// Lifecycle Hooks (Guardrails + Observability)
// ============================================================

function preToolUse(
  toolName: string,
  toolInput: Record<string, unknown>,
): { allow: boolean; reason?: string } {
  // Example guardrail: block write_report if no sources
  if (toolName === "write_report") {
    const sources = toolInput.sources as string[];
    if (!sources || sources.length === 0) {
      return { allow: false, reason: "Cannot write report with no sources" };
    }
  }

  // Example guardrail: limit read_document to trusted domains in production
  // if (toolName === "read_document") {
  //   const url = toolInput.url as string;
  //   if (!ALLOWED_DOMAINS.some(d => url.includes(d))) {
  //     return { allow: false, reason: `Domain not in allowlist: ${url}` };
  //   }
  // }

  console.log(`[PreToolUse] ${toolName}`, JSON.stringify(toolInput).slice(0, 200));
  return { allow: true };
}

function postToolUse(
  toolName: string,
  _toolInput: Record<string, unknown>,
  result: unknown,
  durationMs: number,
): void {
  console.log(
    `[PostToolUse] ${toolName} completed in ${durationMs}ms`,
  );
  // In production: emit metrics to CloudWatch/Datadog
  // metrics.trackToolCall(toolName, durationMs, result.status);
}

// ============================================================
// Main Agent Loop
// ============================================================

const SYSTEM_PROMPT = `You are a Research Agent. Your job is to research a given topic thoroughly and produce a well-structured report.

YOUR PROCESS:
1. Start by searching the web for the topic to find relevant sources (3-5 searches with different angles)
2. Read the most promising sources (aim for 3-5 high-quality sources)
3. Analyze and synthesize the information
4. Write a comprehensive report with proper citations

REPORT FORMAT:
- Executive Summary (3-5 sentences)
- Key Findings (numbered, with source attribution)
- Analysis (synthesize across sources, identify agreements/contradictions)
- Conclusion
- Sources list

RULES:
- Always cite your sources
- If sources disagree, present both perspectives
- Flag any information you're uncertain about
- Focus on recent information (prefer sources from the last 12 months)
- The report should be 800-1500 words`;

async function runResearchAgent(topic: string): Promise<string> {
  const client = new Anthropic();

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `Research the following topic and produce a comprehensive report:\n\n${topic}`,
    },
  ];

  let response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  let totalTokens = {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
  };
  let toolCallCount = 0;

  // Agentic loop — keep going until the model stops calling tools
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const input = toolUse.input as Record<string, unknown>;

      // PreToolUse hook
      const preCheck = preToolUse(toolUse.name, input);
      if (!preCheck.allow) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            error: `Tool call blocked: ${preCheck.reason}`,
          }),
        });
        continue;
      }

      // Execute tool
      const startTime = Date.now();
      try {
        const result = await executeTool(toolUse.name, input);
        const duration = Date.now() - startTime;

        // PostToolUse hook
        postToolUse(toolUse.name, input, result, duration);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
        toolCallCount++;
      } catch (err) {
        const duration = Date.now() - startTime;
        postToolUse(toolUse.name, input, { error: String(err) }, duration);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            error: `Tool execution failed: ${String(err)}`,
            suggestion: "Try a different approach or skip this source",
          }),
          is_error: true,
        });
      }
    }

    // Append assistant response and tool results to conversation
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    // Continue the loop
    response = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    totalTokens.input += response.usage.input_tokens;
    totalTokens.output += response.usage.output_tokens;
  }

  // Extract final text response
  const finalText = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  console.log(`\n[Agent Complete] Tool calls: ${toolCallCount} | Tokens: ${totalTokens.input} in / ${totalTokens.output} out`);

  return finalText;
}

// ============================================================
// Entry Point
// ============================================================

async function main() {
  const topic = process.argv[2] || "Current state of AI agent frameworks in 2026";
  console.log(`Researching: ${topic}\n`);
  const report = await runResearchAgent(topic);
  console.log("\n" + report);
}

main().catch(console.error);
```

### Real-World Mapping: Legal/Contract Intelligence Agent

The [Legal/Contract Intelligence Agent spec](./legal-contract-intelligence-agent-spec.md) is built on the Claude Agent SDK. Here's how its architecture maps to the SDK's primitives:

| Agent Spec Component | Claude Agent SDK Primitive | Implementation |
|---------------------|---------------------------|----------------|
| Orchestrator | Agentic loop (`while stop_reason === "tool_use"`) | The main `analyzeContract()` function runs the loop |
| 3 MCP Servers | MCP server connections (stdio/in-process) | `document-mcp`, `legal-kb-mcp`, `contract-mcp` |
| 16 tools across servers | `tools` array in `messages.create()` | Each MCP server exposes 3-7 tools |
| Model tiering (Opus/Sonnet/Haiku) | Conditional `model` parameter per iteration | Opus for cross-clause reasoning, Sonnet for analysis, Haiku for lookups |
| Guardrails (never provide legal advice) | System prompt + PreToolUse hooks | Block store_analysis if disclaimer missing |
| Tiered autonomy (L1/L2/L3) | Conditional tool availability per user config | L1: read-only tools only. L2: adds write/redline tools. L3: adds monitoring tools |

**Key pattern from the spec** — model escalation within the agentic loop:

```typescript
// From legal-contract-intelligence-agent-spec.md, Section 7
// The agent starts with Sonnet for document reading and clause analysis.
// When it hits cross-clause reasoning or negotiation strategy, it escalates to Opus.

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
```

This pattern — routing to a more capable (and expensive) model mid-loop based on what the agent is doing — is natural in the Claude Agent SDK because you control the loop. In LangGraph, you'd implement this as conditional routing between nodes. In CrewAI, you'd assign different models to different agents.

### MCP Server Integration Patterns

**Pattern 1: In-process MCP server (lowest latency, same process)**

```typescript
import { McpServer } from "@anthropic-ai/sdk/mcp";

// Define an in-process MCP server for custom business logic
const legalKbServer = new McpServer({
  name: "legal-kb",
  version: "1.0.0",
});

legalKbServer.tool(
  "search_statutes",
  "Search Indian legal statutes by semantic similarity",
  {
    query: z.string().describe("Natural language query about Indian law"),
    acts: z.array(z.string()).optional().describe("Filter to specific acts"),
    limit: z.number().default(5),
  },
  async ({ query, acts, limit }) => {
    const embedding = await generateEmbedding(query);
    const results = await db.query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
       FROM legal_statutes
       WHERE status = 'active'
       ${acts ? "AND act_name = ANY($3)" : ""}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      acts ? [embedding, limit, acts] : [embedding, limit],
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            statutes: results.rows,
            count: results.rows.length,
          }),
        },
      ],
    };
  },
);
```

**Pattern 2: stdio MCP server (separate process, standard protocol)**

```typescript
// Connect to an external MCP server running as a separate process
import { StdioClientTransport } from "@anthropic-ai/sdk/mcp";

const documentMcp = new StdioClientTransport({
  command: "node",
  args: ["./mcp-servers/document-mcp/index.js"],
  env: {
    DOCPROOF_API_KEY: process.env.DOCPROOF_API_KEY!,
    SARVAM_API_KEY: process.env.SARVAM_API_KEY!,
  },
});
```

**Pattern 3: HTTP remote MCP server (shared service, multi-tenant)**

```typescript
// Connect to a remote MCP server over HTTP (e.g., shared Legal KB service)
import { StreamableHttpClientTransport } from "@anthropic-ai/sdk/mcp";

const remoteLegalKb = new StreamableHttpClientTransport({
  url: "https://legal-kb.internal.example.com/mcp",
  headers: {
    Authorization: `Bearer ${process.env.LEGAL_KB_API_KEY}`,
  },
});
```

### Hosting: Docker + ECS/Fargate

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S agent && adduser -S agent -G agent
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER agent
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "dist/server.js"]
```

**SST v3 config for ECS deployment:**

```typescript
// sst.config.ts
import { Cluster, Service } from "sst/aws/ecs";

const cluster = new Cluster("AgentCluster", {
  vpc: { id: "vpc-xxx" },
});

const agentService = new Service("ResearchAgent", {
  cluster,
  cpu: "0.5 vCPU",
  memory: "1 GB",
  image: {
    dockerfile: "Dockerfile",
    context: ".",
  },
  scaling: {
    min: 1,
    max: 5,
    cpuUtilization: 70,
  },
  environment: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY!,
    NODE_ENV: "production",
  },
});
```

**Serverless pattern: Lambda with streaming**

For short-lived agents (< 15 min), Lambda with response streaming works well:

```typescript
// lambda-handler.ts
import { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  const { topic } = JSON.parse(event.body || "{}");

  // Run the agent (same code as above)
  const result = await runResearchAgent(topic);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: result }),
  };
};
```

> **Note:** Lambda has a 15-minute timeout. For agents that may run longer (e.g., the Legal/Contract Agent analyzing a 50-page document), use ECS/Fargate or Step Functions.

### Pros, Cons, Gotchas

**Pros:**
- Minimal abstraction = minimal magic. You see exactly what's happening
- MCP is a first-class citizen — best MCP integration of any framework
- Lifecycle hooks give you clean guardrail and observability injection points
- Model tiering (Opus/Sonnet/Haiku routing) is trivial because you control the loop
- Smallest dependency footprint — just `@anthropic-ai/sdk` and `zod`

**Cons:**
- Claude-only. If you need model-agnostic flexibility, this isn't it
- No built-in state management — you implement checkpointing yourself
- No built-in multi-agent patterns — you code supervisor/delegation logic
- No built-in observability dashboard — you integrate LangSmith, Datadog, or roll your own
- Python SDK lags behind TypeScript in features

**Gotchas:**
- `stop_reason === "tool_use"` can return multiple tool calls in one response. Handle all of them, not just the first
- Token counts grow fast in the agentic loop — the full conversation is sent each iteration. For long-running agents, implement conversation summarization or truncation
- In-process MCP servers share memory with the agent — a memory leak in the MCP server crashes the agent
- The SDK API surface is still evolving (v0.x) — pin your version and test before upgrading

---

## 3. LangChain / LangGraph

### Overview

LangGraph is the agent orchestration framework from the LangChain ecosystem. While LangChain provides chains (linear sequences) and agents (ReAct-style tool calling), LangGraph adds graph-based orchestration: you define your agent as a `StateGraph` with nodes (functions), edges (transitions), and conditional routing. This makes complex, multi-step, branching workflows explicit and debuggable.

**Key characteristics:**
- **StateGraph:** Agent logic as a directed graph with typed state
- **Checkpointing:** Built-in persistence with time travel — pause, resume, replay, rewind
- **Conditional routing:** Branch on state values (e.g., route to different nodes based on risk level)
- **Parallel execution:** Run nodes in parallel when they don't depend on each other
- **LangSmith:** Native observability — traces every LLM call, tool call, state transition
- **Model-agnostic:** Works with any LLM provider via LangChain's ChatModel interface

**Current version:** LangGraph 1.0 GA (since October 2025)

### Architecture Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                     LangGraph Application                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    StateGraph                           │ │
│  │                                                         │ │
│  │  ┌─────────┐    ┌──────────┐    ┌──────────────────┐    │ │
│  │  │ START   │───►│ search   │───►│ should_continue  │    │ │
│  │  └─────────┘    │ (node)   │    │ (conditional     │    │ │
│  │                 └──────────┘    │  edge)           │    │ │
│  │                                 └────────┬─────────┘    │ │
│  │                                    ┌─────┴──────┐       │ │
│  │                                    │            │       │ │
│  │                                    ▼            ▼       │ │
│  │                              ┌──────────┐  ┌─────────┐  │ │
│  │                              │ analyze  │  │  END    │  │ │
│  │                              │ (node)   │  └─────────┘  │ │
│  │                              └────┬─────┘               │ │
│  │                                   │                     │ │
│  │                                   ▼                     │ │
│  │                              ┌──────────┐               │ │
│  │                              │ report   │               │ │
│  │                              │ (node)   │───► END       │ │
│  │                              └──────────┘               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ State          │  │ Checkpointer │  │ LangSmith        │  │
│  │ (TypedDict)    │  │ (SQLite/     │  │ (traces every    │  │
│  │                │  │  Postgres)   │  │  node + edge)    │  │
│  └────────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Reference Implementation: Research Agent in LangGraph

```python
# research_agent_langgraph.py
# LangGraph 1.0 GA
# pip install langgraph langchain-anthropic langchain-community

from typing import TypedDict, Annotated, Sequence
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.sqlite import SqliteSaver
import json
import httpx
import os

# ============================================================
# State Definition
# ============================================================

class ResearchState(TypedDict):
    """State that flows through the graph."""
    messages: Annotated[Sequence[BaseMessage], "The conversation messages"]
    topic: str
    sources_found: list[dict]  # [{title, url, snippet}]
    sources_read: list[dict]   # [{url, content, word_count}]
    report: str | None
    tool_call_count: int
    max_tool_calls: int

# ============================================================
# Tool Definitions
# ============================================================

@tool
def web_search(query: str, max_results: int = 10) -> str:
    """Search the web for information on a topic.
    Returns a list of results with titles, URLs, and snippets.
    Use this to find relevant sources for research."""
    response = httpx.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query, "count": max_results},
        headers={"X-Subscription-Token": os.environ["BRAVE_SEARCH_API_KEY"]},
    )
    data = response.json()
    results = [
        {"title": r["title"], "url": r["url"], "snippet": r.get("description", "")}
        for r in data.get("web", {}).get("results", [])
    ]
    return json.dumps({"results": results, "count": len(results)})


@tool
def read_document(url: str) -> str:
    """Fetch and read the content of a URL or document.
    Returns the text content for analysis.
    Use this to read articles, papers, or web pages found via web_search."""
    response = httpx.get(
        f"https://r.jina.ai/{url}",
        headers={"Accept": "text/plain"},
        timeout=30,
    )
    content = response.text[:50000]
    return json.dumps({"content": content, "word_count": len(content.split())})


@tool
def write_report(title: str, content: str, sources: list[str]) -> str:
    """Save the final research report to a file.
    Use this after you have gathered and analyzed all sources.
    The report should be comprehensive and well-structured."""
    filename = f"report-{title.lower().replace(' ', '-')[:50]}.md"
    full_content = f"# {title}\n\n{content}\n\n---\n\n## Sources\n\n"
    full_content += "\n".join(f"{i+1}. {s}" for i, s in enumerate(sources))
    with open(filename, "w") as f:
        f.write(full_content)
    return json.dumps({"file_path": filename, "status": "saved"})


tools_list = [web_search, read_document, write_report]

# ============================================================
# Nodes
# ============================================================

llm = ChatAnthropic(
    model="claude-sonnet-4-6-20250514",
    max_tokens=4096,
).bind_tools(tools_list)

SYSTEM_PROMPT = """You are a Research Agent. Your job is to research a given topic thoroughly and produce a well-structured report.

YOUR PROCESS:
1. Start by searching the web for the topic to find relevant sources (3-5 searches with different angles)
2. Read the most promising sources (aim for 3-5 high-quality sources)
3. Analyze and synthesize the information
4. Write a comprehensive report with proper citations

REPORT FORMAT:
- Executive Summary (3-5 sentences)
- Key Findings (numbered, with source attribution)
- Analysis (synthesize across sources, identify agreements/contradictions)
- Conclusion
- Sources list

RULES:
- Always cite your sources
- If sources disagree, present both perspectives
- Flag any information you're uncertain about
- Focus on recent information (prefer sources from the last 12 months)
- The report should be 800-1500 words"""


def research_node(state: ResearchState) -> dict:
    """Main research node — invokes the LLM with tools."""
    messages = state["messages"]
    if not messages:
        messages = [
            HumanMessage(
                content=f"Research the following topic and produce a comprehensive report:\n\n{state['topic']}"
            )
        ]
    response = llm.invoke(
        [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    )
    return {
        "messages": [response],
        "tool_call_count": state.get("tool_call_count", 0),
    }


# Use LangGraph's prebuilt ToolNode for tool execution
tool_node = ToolNode(tools_list)


def should_continue(state: ResearchState) -> str:
    """Conditional edge: continue calling tools or finish."""
    messages = state["messages"]
    last_message = messages[-1]

    # Check if the model wants to call tools
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # Safety: limit total tool calls
        if state.get("tool_call_count", 0) >= state.get("max_tool_calls", 30):
            return "end"
        return "tools"

    return "end"


def update_counters(state: ResearchState) -> dict:
    """Track tool call count after tool execution."""
    messages = state["messages"]
    # Count tool results in the latest batch
    new_tool_results = sum(
        1 for m in messages[-5:] if isinstance(m, ToolMessage)
    )
    return {
        "tool_call_count": state.get("tool_call_count", 0) + new_tool_results,
    }


# ============================================================
# Graph Assembly
# ============================================================

def build_research_graph():
    """Build the LangGraph StateGraph for the research agent."""
    workflow = StateGraph(ResearchState)

    # Add nodes
    workflow.add_node("research", research_node)
    workflow.add_node("tools", tool_node)
    workflow.add_node("update_counters", update_counters)

    # Set entry point
    workflow.set_entry_point("research")

    # Add edges
    workflow.add_conditional_edges(
        "research",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )
    workflow.add_edge("tools", "update_counters")
    workflow.add_edge("update_counters", "research")

    # Compile with checkpointing
    memory = SqliteSaver.from_conn_string(":memory:")
    return workflow.compile(checkpointer=memory)


# ============================================================
# Entry Point
# ============================================================

async def run_research_agent(topic: str) -> str:
    graph = build_research_graph()

    initial_state: ResearchState = {
        "messages": [],
        "topic": topic,
        "sources_found": [],
        "sources_read": [],
        "report": None,
        "tool_call_count": 0,
        "max_tool_calls": 30,
    }

    config = {"configurable": {"thread_id": "research-1"}}

    # Run the graph
    final_state = await graph.ainvoke(initial_state, config)

    # Extract the final response
    last_message = final_state["messages"][-1]
    return last_message.content if isinstance(last_message.content, str) else str(last_message.content)


if __name__ == "__main__":
    import asyncio
    import sys

    topic = sys.argv[1] if len(sys.argv) > 1 else "Current state of AI agent frameworks in 2026"
    print(f"Researching: {topic}\n")
    result = asyncio.run(run_research_agent(topic))
    print(result)
```

### Real-World Mapping: Legal/Contract Agent in LangGraph

The Legal/Contract Intelligence Agent maps naturally to LangGraph because the analysis lifecycle is a graph with conditional branches:

```
┌───────────┐    ┌──────────┐    ┌────────────┐    ┌────────────────┐
│ parse_doc │───►│ read_doc │───►│ risk_      │───►│ should_        │
│ (node)    │    │ (node)   │    │ analysis   │    │ generate_      │
│           │    │          │    │ (node)     │    │ redline?       │
│ DocProof  │    │ Claude   │    │ Legal KB   │    │ (conditional)  │
│ + Sarvam  │    │ reads    │    │ search per │    └──┬──────────┬──┘
│ OCR       │    │ full doc │    │ clause     │       │          │
└───────────┘    └──────────┘    └────────────┘       │          │
                                                      ▼          ▼
                                           ┌───────────────┐  ┌──────────┐
                                           │ redline_and   │  │ report   │
                                           │ negotiate     │  │ (node)   │
                                           │ (node, Opus)  │  │          │
                                           └───────┬───────┘  └───┬──────┘
                                                   │              │
                                                   ▼              │
                                           ┌──────────────┐       │
                                           │ version_diff │       │
                                           │ (if v2+)     │───────┘
                                           └──────────────┘
```

The key advantage of LangGraph here is **checkpointing**: if the agent crashes after parsing and risk analysis (which takes 2-3 minutes for a 50-page contract), you can resume from the checkpoint instead of re-processing the entire document.

```python
# Simplified: Legal/Contract Agent as LangGraph nodes

class ContractAnalysisState(TypedDict):
    messages: Sequence[BaseMessage]
    contract_text: str | None
    contract_type: str
    state_for_stamp_duty: str
    autonomy_level: int
    risks: list[dict]
    missing_clauses: list[dict]
    stamp_duty_result: dict | None
    redlined_text: str | None
    negotiation_playbook: str | None
    version_diff: dict | None
    final_report: str | None


def parse_document_node(state: ContractAnalysisState) -> dict:
    """Parse uploaded contract via DocProof / Sarvam AI."""
    # Call document-mcp tools
    parsed = call_mcp_tool("document-mcp", "parse_document", {
        "file_path": state["contract_file"],
    })
    return {"contract_text": parsed["text"]}


def risk_analysis_node(state: ContractAnalysisState) -> dict:
    """Analyze each clause against the Legal KB."""
    # Claude reads the full document, identifies clauses,
    # then queries legal-kb-mcp for each flagged clause
    llm_opus = ChatAnthropic(model="claude-opus-4-6-20250514")
    # ... invoke with contract_text and legal KB tools
    return {"risks": identified_risks, "missing_clauses": missing}


def should_generate_redline(state: ContractAnalysisState) -> str:
    """Route based on autonomy level."""
    if state["autonomy_level"] >= 2:
        return "redline"
    return "report"


def redline_node(state: ContractAnalysisState) -> dict:
    """Generate redlined version and negotiation playbook (Opus)."""
    # Uses Opus for nuanced negotiation language
    return {
        "redlined_text": redlined,
        "negotiation_playbook": playbook,
    }


def report_node(state: ContractAnalysisState) -> dict:
    """Generate the final analysis report."""
    return {"final_report": report_text}
```

### MCP Integration via langchain-mcp-adapters

```python
# pip install langchain-mcp-adapters

from langchain_mcp_adapters import MultiServerMCPClient

async def get_mcp_tools():
    """Load tools from MCP servers for use in LangGraph."""
    async with MultiServerMCPClient(
        {
            "document-mcp": {
                "command": "node",
                "args": ["./mcp-servers/document-mcp/index.js"],
                "env": {"DOCPROOF_API_KEY": os.environ["DOCPROOF_API_KEY"]},
                "transport": "stdio",
            },
            "legal-kb-mcp": {
                "url": "http://localhost:3001/mcp",
                "transport": "streamable_http",
            },
        }
    ) as client:
        tools = client.get_tools()
        # These tools work directly with LangGraph's ToolNode
        return tools
```

### Hosting: Docker/ECS + LangServe

**LangServe deployment (REST API for LangGraph agents):**

```python
# server.py
from fastapi import FastAPI
from langserve import add_routes

app = FastAPI(title="Research Agent API")

graph = build_research_graph()

add_routes(app, graph, path="/research")

# Run: uvicorn server:app --host 0.0.0.0 --port 8080
```

**Lambda deployment (short-lived agents):**

```python
# lambda_handler.py
from mangum import Mangum
from server import app

handler = Mangum(app, lifespan="off")
```

### LangSmith Observability Setup

```python
# Set environment variables for automatic tracing
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls_..."
os.environ["LANGCHAIN_PROJECT"] = "research-agent-prod"

# That's it — every LLM call, tool call, and state transition is traced automatically.
# No code changes needed.

# For custom spans:
from langsmith import traceable

@traceable(name="custom_analysis_step")
def my_analysis_function(data):
    # This function's execution is tracked in LangSmith
    pass
```

### Pros, Cons, Gotchas

**Pros:**
- Best production maturity — GA since October 2025, battle-tested at scale
- Checkpointing with time travel is a killer feature for debugging and resuming long agents
- Model-agnostic — switch between Claude, GPT-4, Gemini, Llama with one line
- LangSmith provides the best observability experience of any framework
- Graph-based architecture makes complex workflows explicit and testable
- Parallel node execution for independent tasks

**Cons:**
- Learning curve is real — StateGraph, TypedDict state, conditional edges, reducers take time
- Python-first — TypeScript support exists but is less mature
- Abstraction overhead: simple agents feel over-engineered in LangGraph
- LangChain ecosystem is large and can be confusing (chains vs agents vs graphs)
- State serialization adds token overhead (~2-5% per turn)

**Gotchas:**
- State must be serializable — no functions, no classes, no open file handles in state
- Checkpointer storage grows fast for long conversations — implement TTL cleanup
- `langchain-mcp-adapters` is community-maintained, not official LangChain — pin the version and test updates
- Conditional edges must return exact string keys that match the routing dict — typos cause silent failures
- The `ToolNode` from `langgraph.prebuilt` wraps tool errors as `ToolMessage` with error content, which is good, but the LLM may not recover well from cryptic error messages — format errors for the LLM

---

## 4. CrewAI

### Overview

CrewAI models agents as a crew of specialists, each with a role, goal, and backstory. Tasks define what needs to be accomplished, and the Crew orchestrates execution. The framework has a dual-layer architecture: **Crews** handle multi-agent collaboration (agents working together), and **Flows** handle multi-step orchestration (sequencing crews and tasks into pipelines).

CrewAI is a standalone framework — it is NOT built on LangChain (a common misconception from its early days). It has its own LLM integration, tool system, and execution engine.

**Key characteristics:**
- **Role-based agents:** Each agent has a role, goal, backstory, and set of tools — the LLM reasons within that persona
- **Task delegation:** Agents can delegate work to other agents in the crew
- **Crews + Flows:** Crews for multi-agent tasks, Flows for orchestrating multiple crews/steps
- **Context window management:** Automatic handling of context overflow
- **Built-in tool ecosystem:** 30+ integrations (search, scraping, file operations)
- **2-3x faster** than comparable frameworks (optimized execution engine)

**Current version:** v1.10.1

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                     CrewAI Application                          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                        Flow                                │ │
│  │  (orchestrates multiple crews and standalone tasks)        │ │
│  │                                                            │ │
│  │  step_1() ──► step_2() ──► step_3() ──► ...                │ │
│  └──────────┬─────────────────────────────────────────────────┘ │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                        Crew                                │ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐     │ │
│  │  │  Agent A     │  │  Agent B     │  │  Agent C     │      │ │
│  │  │  Role: ...   │  │  Role: ...   │  │  Role: ...   │      │ │
│  │  │  Goal: ...   │  │  Goal: ...   │  │  Goal: ...   │      │ │
│  │  │  Tools: [...] │  │  Tools: [...] │  │  Tools: [...] │   │ │
│  │  └──────┬───────┘  └──────┬──────┘  └──────┬──────────┘    │ │
│  │         │                │                │                │ │
│  │         ▼                ▼                ▼                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ │
│  │  │  Task 1      │  │  Task 2      │  │  Task 3      │      │ │
│  │  │  Agent: A    │  │  Agent: B    │  │  Agent: C    │      │ │
│  │  │  Output: ... │  │  Output: ... │  │  Output: ... │      │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │ │
│  │                                                            │ │
│  │  Process: sequential | hierarchical                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Reference Implementation: Research Agent as a CrewAI Crew

```python
# research_agent_crewai.py
# CrewAI v1.10.1
# pip install crewai crewai-tools

from crewai import Agent, Task, Crew, Process
from crewai.tools import tool
import json
import httpx
import os

# ============================================================
# Tool Definitions
# ============================================================

@tool("Web Search")
def web_search(query: str) -> str:
    """Search the web for information on a topic.
    Returns a list of results with titles, URLs, and snippets.
    Use this to find relevant sources for research."""
    response = httpx.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query, "count": 10},
        headers={"X-Subscription-Token": os.environ["BRAVE_SEARCH_API_KEY"]},
    )
    data = response.json()
    results = [
        {"title": r["title"], "url": r["url"], "snippet": r.get("description", "")}
        for r in data.get("web", {}).get("results", [])
    ]
    return json.dumps({"results": results, "count": len(results)})


@tool("Read Document")
def read_document(url: str) -> str:
    """Fetch and read the content of a URL or document.
    Returns the text content for analysis.
    Use this to read articles, papers, or web pages found via web search."""
    response = httpx.get(
        f"https://r.jina.ai/{url}",
        headers={"Accept": "text/plain"},
        timeout=30,
    )
    content = response.text[:50000]
    return json.dumps({"content": content, "word_count": len(content.split())})


@tool("Write Report")
def write_report(title: str, content: str, sources: str) -> str:
    """Save the final research report to a file.
    The 'sources' parameter should be a JSON array of source URLs.
    Use this after you have gathered and analyzed all sources."""
    sources_list = json.loads(sources) if isinstance(sources, str) else sources
    filename = f"report-{title.lower().replace(' ', '-')[:50]}.md"
    full_content = f"# {title}\n\n{content}\n\n---\n\n## Sources\n\n"
    full_content += "\n".join(f"{i+1}. {s}" for i, s in enumerate(sources_list))
    with open(filename, "w") as f:
        f.write(full_content)
    return json.dumps({"file_path": filename, "status": "saved"})


# ============================================================
# Agent Definitions
# ============================================================

research_searcher = Agent(
    role="Research Searcher",
    goal="Find the most relevant and recent sources on the given research topic",
    backstory="""You are an expert research assistant who excels at finding
    high-quality sources. You search with multiple angles and queries to ensure
    comprehensive coverage. You prioritize recent sources (last 12 months)
    and authoritative publications.""",
    tools=[web_search],
    llm="anthropic/claude-sonnet-4-6-20250514",
    verbose=True,
    max_iter=10,
)

document_analyst = Agent(
    role="Document Analyst",
    goal="Read and extract key information from research sources",
    backstory="""You are a meticulous analyst who reads documents thoroughly
    and extracts the most important facts, figures, and insights. You note
    when sources agree or contradict each other. You always attribute
    information to its source.""",
    tools=[read_document],
    llm="anthropic/claude-sonnet-4-6-20250514",
    verbose=True,
    max_iter=15,
)

report_writer = Agent(
    role="Report Writer",
    goal="Synthesize research findings into a comprehensive, well-structured report",
    backstory="""You are a skilled technical writer who creates clear,
    well-organized reports. You synthesize information from multiple
    sources, identify key themes, and present findings in a logical
    structure. Your reports include an executive summary, key findings
    with source attribution, analysis, and conclusions. You always
    cite your sources.""",
    tools=[write_report],
    llm="anthropic/claude-sonnet-4-6-20250514",
    verbose=True,
    max_iter=5,
)

# ============================================================
# Task Definitions
# ============================================================

def create_research_tasks(topic: str) -> list[Task]:
    search_task = Task(
        description=f"""Search the web for information on: {topic}

        Perform 3-5 searches with different angles and queries.
        Collect at least 5-8 relevant sources.
        Return a JSON list of the best sources with title, URL, and why it's relevant.""",
        expected_output="A JSON list of 5-8 relevant sources with titles, URLs, and relevance notes",
        agent=research_searcher,
    )

    analysis_task = Task(
        description=f"""Read and analyze the top 3-5 sources from the search results.

        For each source:
        1. Read the full content
        2. Extract key facts, figures, and insights
        3. Note the publication date and author credibility
        4. Identify points that agree or contradict other sources

        Topic: {topic}""",
        expected_output="Detailed analysis of each source with key findings, agreements, and contradictions",
        agent=document_analyst,
        context=[search_task],  # This task gets the output of search_task as context
    )

    report_task = Task(
        description=f"""Write a comprehensive research report on: {topic}

        Use the analysis from the previous task to create a report with:
        - Executive Summary (3-5 sentences)
        - Key Findings (numbered, with source attribution)
        - Analysis (synthesize across sources, note agreements and contradictions)
        - Conclusion
        - Sources list

        The report should be 800-1500 words.
        Save the report using the write_report tool.""",
        expected_output="A saved Markdown research report file",
        agent=report_writer,
        context=[search_task, analysis_task],
    )

    return [search_task, analysis_task, report_task]


# ============================================================
# Crew Assembly and Execution
# ============================================================

def run_research_crew(topic: str) -> str:
    tasks = create_research_tasks(topic)

    crew = Crew(
        agents=[research_searcher, document_analyst, report_writer],
        tasks=tasks,
        process=Process.sequential,  # Tasks run in order
        verbose=True,
    )

    result = crew.kickoff()
    return str(result)


# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    import sys

    topic = sys.argv[1] if len(sys.argv) > 1 else "Current state of AI agent frameworks in 2026"
    print(f"Researching: {topic}\n")
    result = run_research_crew(topic)
    print(result)
```

### Real-World Mapping: Legal/Contract Agent as a CrewAI Crew

The Legal/Contract Intelligence Agent maps beautifully to CrewAI because the agent spec already describes distinct specialist roles:

```python
# legal_contract_crew.py (simplified structure)

# Agent definitions map directly to the spec's components

document_reader = Agent(
    role="Document Reader",
    goal="Extract clean text from uploaded contracts, handling PDF, DOCX, and regional languages",
    backstory="""You are a document processing specialist who handles
    Indian contract documents in English, Hindi, Marathi, Gujarati, and Tamil.
    You use DocProof for PDF/DOCX and Sarvam AI for regional language OCR.
    You preserve document structure, section numbers, and defined terms.""",
    tools=[parse_document, parse_regional_document, extract_metadata],
    llm="anthropic/claude-sonnet-4-6-20250514",
)

legal_risk_analyst = Agent(
    role="Indian Legal Risk Analyst",
    goal="Identify legal risks in contracts against Indian law statutes and precedents",
    backstory="""You are a senior Indian corporate lawyer with expertise
    in the Indian Contract Act, DPDPA 2023, Labor Codes, FEMA, and Stamp Act.
    You read contracts holistically, understanding cross-references and
    conditions within conditions. You know that post-termination non-competes
    are void under Section 27. You check for missing mandatory clauses.""",
    tools=[search_statutes, search_clause_patterns, search_precedents,
           get_required_clauses, check_enforceability, get_stamp_duty],
    llm="anthropic/claude-opus-4-6-20250514",  # Opus for complex legal reasoning
)

negotiation_strategist = Agent(
    role="Negotiation Strategist",
    goal="Generate redlined alternatives and negotiation playbooks for flagged clauses",
    backstory="""You are an experienced contract negotiator who creates
    commercially reasonable alternative clause language and practical
    negotiation talking points. You understand Indian business culture
    and frame suggestions that counterparties are likely to accept.
    You never provide definitive legal advice.""",
    tools=[search_clause_patterns, search_precedents],
    llm="anthropic/claude-opus-4-6-20250514",  # Opus for nuanced language
    allow_delegation=False,  # This agent doesn't delegate — it writes
)

report_generator = Agent(
    role="Report Generator",
    goal="Produce analysis reports scaled to the user's expertise level",
    backstory="""You create three tiers of output: executive summary
    (3 sentences for founders), risk scorecard (for procurement), and
    detailed clause-by-clause analysis (for legal teams). Every report
    includes the disclaimer that this is AI-assisted and does not
    constitute legal advice.""",
    tools=[store_analysis, store_clause_analysis, generate_version_diff],
    llm="anthropic/claude-sonnet-4-6-20250514",
)

# Task definitions mirror the analysis lifecycle

parse_task = Task(
    description="Parse the uploaded contract document and extract clean text...",
    expected_output="Clean contract text with structure preserved",
    agent=document_reader,
)

risk_analysis_task = Task(
    description="Read the full contract, identify risks against Indian law...",
    expected_output="List of clause analyses with risk levels and legal references",
    agent=legal_risk_analyst,
    context=[parse_task],
)

negotiation_task = Task(
    description="For each flagged clause, generate alternative language and talking points...",
    expected_output="Redlined contract text and negotiation playbook",
    agent=negotiation_strategist,
    context=[risk_analysis_task],
)

report_task = Task(
    description="Generate the final analysis report with executive summary, risk scorecard...",
    expected_output="Saved analysis report with risk score and recommendations",
    agent=report_generator,
    context=[risk_analysis_task, negotiation_task],
)

legal_crew = Crew(
    agents=[document_reader, legal_risk_analyst, negotiation_strategist, report_generator],
    tasks=[parse_task, risk_analysis_task, negotiation_task, report_task],
    process=Process.sequential,
    verbose=True,
)
```

### Tool Integration Patterns

CrewAI has three ways to define tools:

```python
# Pattern 1: @tool decorator (simplest)
@tool("Search Statutes")
def search_statutes(query: str, acts: str = "") -> str:
    """Search Indian legal statutes by semantic similarity."""
    # implementation
    pass

# Pattern 2: BaseTool subclass (more control)
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

class SearchStatutesInput(BaseModel):
    query: str = Field(description="Natural language query about Indian law")
    acts: list[str] = Field(default=[], description="Filter to specific acts")

class SearchStatutesTool(BaseTool):
    name: str = "Search Statutes"
    description: str = "Search Indian legal statutes by semantic similarity"
    args_schema: type[BaseModel] = SearchStatutesInput

    def _run(self, query: str, acts: list[str] = []) -> str:
        # implementation
        pass

# Pattern 3: LangChain tool adapter (if migrating from LangChain)
from crewai.tools import LangChainToolAdapter
from langchain_community.tools import BraveSearchResults

brave_tool = LangChainToolAdapter(tool=BraveSearchResults())
```

### Hosting: Docker/ECS + CrewAI Enterprise

**Docker deployment:**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
```

**FastAPI wrapper:**

```python
# api.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Legal Contract Analysis API")

class AnalysisRequest(BaseModel):
    contract_file: str
    contract_type: str
    counterparty: str
    state: str

@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    result = legal_crew.kickoff(inputs={
        "contract_file": request.contract_file,
        "contract_type": request.contract_type,
        "counterparty": request.counterparty,
        "state": request.state,
    })
    return {"analysis": str(result)}
```

**CrewAI Enterprise** is the managed hosting option — deploy crews with `crewai deploy`. Pricing is per-execution.

### Pros, Cons, Gotchas

**Pros:**
- Most intuitive mental model — "team of specialists" is immediately understandable
- Fastest time-to-prototype — define roles + tasks, kickoff, done
- Built-in context window management handles long conversations automatically
- Task delegation between agents works well for hierarchical workflows
- 2-3x faster execution than comparable frameworks (optimized engine)
- Standalone — no LangChain dependency despite the common misconception

**Cons:**
- Role/goal/backstory prompts add token overhead (~500-1000 tokens per agent per turn)
- Less fine-grained control over individual LLM calls compared to Claude Agent SDK
- Python-only — no TypeScript support
- No built-in checkpointing — if a crew crashes, it restarts from the beginning
- Debugging is harder when agents delegate unexpectedly

**Gotchas:**
- `allow_delegation=True` (the default) lets agents hand off tasks to other agents — this is powerful but can create infinite loops if two agents keep delegating to each other. Set `allow_delegation=False` for agents that should always do their own work
- `max_iter` limits per agent, not per task — an agent with `max_iter=5` may only use 5 tool calls total across all tasks
- CrewAI uses its own LLM wrapper — model names use the format `provider/model-name` (e.g., `anthropic/claude-sonnet-4-6-20250514`). Check supported providers in the docs
- Task `context` is a list of other tasks — the output of those tasks is injected as context. Large task outputs can blow up the context window
- `Process.hierarchical` creates a manager agent that delegates — this adds an extra LLM call per task and can be slow

---

## 5. Mastra

### Overview

Mastra is a TypeScript-native agent framework created by the team behind Gatsby (the React static site generator), backed by Y Combinator (W25, $13M raised). It launched in January 2026 and has quickly gained traction in the TypeScript ecosystem — 22.3k GitHub stars and 300k weekly npm downloads as of March 2026.

**Key characteristics:**
- **TypeScript-native:** Built for TypeScript from the ground up, not a Python port
- **Workflows as DAGs:** Fixed execution DAGs with `.then()`, `.parallel()`, `.foreach()` chaining
- **AgentFS:** Persistent file storage for agents — agents can read/write files that persist across sessions
- **Supervisor pattern:** Built-in multi-agent orchestration via supervisor agents
- **MCP-native:** First-class MCP support (not an adapter)
- **Vercel/Railway-friendly:** Designed for the modern TypeScript deployment stack

**Current version:** v1.0 (launched January 2026)

### Architecture Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                     Mastra Application                         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                      Agent                                │ │
│  │  name: "research-agent"                                   │ │
│  │  instructions: "You are a Research Agent..."              │ │
│  │  model: claude-sonnet-4-6                                 │ │
│  │  tools: [web_search, read_document, write_report]         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           │                                    │
│                           ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Workflow (DAG)                          │ │
│  │                                                           │ │
│  │  search_step ──► analyze_step ──► report_step             │ │
│  │      │                │                                   │ │
│  │      ▼                ▼                                   │ │
│  │  .foreach(urls)   .parallel([                             │ │
│  │     read_step       risk_check,                           │ │
│  │                     stamp_check                           │ │
│  │                   ])                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ AgentFS      │  │ MCP Servers  │  │ Telemetry        │    │
│  │ (persistent  │  │ (native)     │  │ (built-in)       │    │
│  │  file store) │  │              │  │                   │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Reference Implementation: Research Agent in Mastra

```typescript
// research-agent-mastra.ts
// Mastra v1.0
// npm install mastra @mastra/core @mastra/anthropic

import { Mastra } from "mastra";
import { Agent, createTool, Workflow } from "@mastra/core";
import { AnthropicProvider } from "@mastra/anthropic";
import { z } from "zod";

// ============================================================
// Tool Definitions
// ============================================================

const webSearchTool = createTool({
  id: "web_search",
  description:
    "Search the web for information on a topic. Returns results with titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    max_results: z.number().default(10).describe("Maximum results to return"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async ({ context }) => {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(context.query)}&count=${context.max_results}`,
      {
        headers: {
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
        },
      },
    );
    const data = await response.json();
    const results = (data.web?.results || []).map(
      (r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.description || "",
      }),
    );
    return { results, count: results.length };
  },
});

const readDocumentTool = createTool({
  id: "read_document",
  description:
    "Fetch and read the content of a URL. Returns text content for analysis.",
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch and read"),
  }),
  outputSchema: z.object({
    content: z.string(),
    word_count: z.number(),
  }),
  execute: async ({ context }) => {
    const response = await fetch(`https://r.jina.ai/${context.url}`, {
      headers: { Accept: "text/plain" },
    });
    const content = await response.text();
    return {
      content: content.slice(0, 50000),
      word_count: content.split(/\s+/).length,
    };
  },
});

const writeReportTool = createTool({
  id: "write_report",
  description:
    "Save the final research report to a file. Use after gathering all sources.",
  inputSchema: z.object({
    title: z.string().describe("Report title"),
    content: z.string().describe("Full report content in Markdown"),
    sources: z.array(z.string()).describe("List of source URLs"),
  }),
  outputSchema: z.object({
    file_path: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    const fs = await import("fs/promises");
    const filename = `report-${context.title.toLowerCase().replace(/\s+/g, "-").slice(0, 50)}.md`;
    const fullContent = `# ${context.title}\n\n${context.content}\n\n---\n\n## Sources\n\n${context.sources.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n`;
    await fs.writeFile(filename, fullContent, "utf-8");
    return { file_path: filename, status: "saved" };
  },
});

// ============================================================
// Agent Definition
// ============================================================

const anthropic = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const researchAgent = new Agent({
  name: "Research Agent",
  instructions: `You are a Research Agent. Your job is to research a given topic thoroughly and produce a well-structured report.

YOUR PROCESS:
1. Start by searching the web for the topic (3-5 searches with different angles)
2. Read the most promising sources (aim for 3-5 high-quality sources)
3. Analyze and synthesize the information
4. Write a comprehensive report with proper citations

REPORT FORMAT:
- Executive Summary (3-5 sentences)
- Key Findings (numbered, with source attribution)
- Analysis (synthesize across sources, identify agreements/contradictions)
- Conclusion
- Sources list

RULES:
- Always cite your sources
- If sources disagree, present both perspectives
- Flag any information you are uncertain about
- Focus on recent information (prefer sources from the last 12 months)
- The report should be 800-1500 words`,
  model: anthropic.model("claude-sonnet-4-6-20250514"),
  tools: {
    web_search: webSearchTool,
    read_document: readDocumentTool,
    write_report: writeReportTool,
  },
});

// ============================================================
// Workflow Definition (DAG)
// ============================================================

const researchWorkflow = new Workflow({
  name: "research-workflow",
  triggerSchema: z.object({
    topic: z.string().describe("The research topic"),
  }),
});

// Step 1: Search for sources
const searchStep = researchWorkflow.step({
  id: "search",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Research Agent");
    const result = await agent.generate(
      `Search for information on: ${context.trigger.topic}. Perform 3-5 searches with different angles. Return a summary of the best sources you found.`,
    );
    return { searchResults: result.text };
  },
});

// Step 2: Analyze sources
const analyzeStep = researchWorkflow.step({
  id: "analyze",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Research Agent");
    const result = await agent.generate(
      `Based on the search results, read the top 3-5 most relevant sources and extract key information. Previous search results:\n\n${context.getStepResult("search").searchResults}`,
    );
    return { analysis: result.text };
  },
});

// Step 3: Write report
const reportStep = researchWorkflow.step({
  id: "report",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Research Agent");
    const result = await agent.generate(
      `Write a comprehensive research report on "${context.trigger.topic}" and save it using the write_report tool. Use this analysis:\n\n${context.getStepResult("analyze").analysis}`,
    );
    return { report: result.text };
  },
});

// Chain the steps
searchStep.then(analyzeStep).then(reportStep);
researchWorkflow.commit();

// ============================================================
// Mastra Instance
// ============================================================

const mastra = new Mastra({
  agents: { "Research Agent": researchAgent },
  workflows: { "research-workflow": researchWorkflow },
});

// ============================================================
// Entry Point
// ============================================================

async function main() {
  const topic =
    process.argv[2] || "Current state of AI agent frameworks in 2026";
  console.log(`Researching: ${topic}\n`);

  // Option 1: Run the agent directly (simple agentic loop)
  const agentResult = await researchAgent.generate(
    `Research the following topic and produce a comprehensive report:\n\n${topic}`,
  );
  console.log(agentResult.text);

  // Option 2: Run the workflow (structured DAG)
  // const workflowResult = await mastra.runWorkflow("research-workflow", {
  //   topic,
  // });
  // console.log(workflowResult);
}

main().catch(console.error);
```

### Real-World Mapping: Legal/Contract Agent in Mastra

Mastra's workflow DAG maps well to the contract analysis lifecycle because the steps are sequential with one parallel fork:

```typescript
// legal-contract-mastra.ts (simplified structure)

const contractWorkflow = new Workflow({
  name: "contract-analysis",
  triggerSchema: z.object({
    contractFile: z.string(),
    contractType: z.string(),
    counterparty: z.string(),
    state: z.string(),
    autonomyLevel: z.number().min(1).max(3),
  }),
});

// Step 1: Parse document
const parseStep = contractWorkflow.step({
  id: "parse",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Document Reader");
    const result = await agent.generate(
      `Parse the contract at ${context.trigger.contractFile}`,
    );
    return { contractText: result.text };
  },
});

// Step 2: Risk analysis (parallel: clause analysis + stamp duty + missing clauses)
const clauseAnalysisStep = contractWorkflow.step({
  id: "clause-analysis",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Legal Analyst");
    // Uses Opus model for complex reasoning
    return { risks: [] };
  },
});

const stampDutyStep = contractWorkflow.step({
  id: "stamp-duty",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Stamp Duty Checker");
    return { stampDuty: {} };
  },
});

// Run clause analysis and stamp duty in parallel after parsing
parseStep.then(
  contractWorkflow.parallel([clauseAnalysisStep, stampDutyStep]),
);

// Step 3: Conditional — generate redline if autonomy >= 2
const redlineStep = contractWorkflow.step({
  id: "redline",
  when: ({ context }) => context.trigger.autonomyLevel >= 2,
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Negotiation Strategist");
    return { redline: "", playbook: "" };
  },
});

// Step 4: Generate report
const reportStep = contractWorkflow.step({
  id: "report",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("Report Generator");
    return { report: "" };
  },
});

// Note: Mastra's `.foreach()` is useful for processing each clause in the contract
// against the Legal KB — iterate over identified clauses and analyze each one.
```

### MCP Integration (Native)

Mastra has native MCP support — MCP servers are first-class:

```typescript
import { MCPClient } from "@mastra/mcp";

const legalKbMcp = new MCPClient({
  servers: {
    "legal-kb": {
      command: "node",
      args: ["./mcp-servers/legal-kb-mcp/index.js"],
      env: {
        DATABASE_URL: process.env.DATABASE_URL!,
      },
    },
    "document-mcp": {
      url: "http://localhost:3001/mcp",
      transport: "streamable-http",
    },
  },
});

// Get tools from MCP servers and pass to agents
const mcpTools = await legalKbMcp.getTools();

const legalAgent = new Agent({
  name: "Legal Analyst",
  tools: { ...mcpTools },  // MCP tools work like native Mastra tools
  // ...
});
```

### Hosting: Docker/ECS, Vercel/Railway

**Vercel deployment (serverless, ideal for TypeScript stack):**

```typescript
// app/api/research/route.ts (Next.js API route)
import { mastra } from "@/lib/mastra";

export async function POST(request: Request) {
  const { topic } = await request.json();
  const agent = mastra.getAgent("Research Agent");
  const result = await agent.generate(
    `Research and report on: ${topic}`,
  );
  return Response.json({ report: result.text });
}
```

**Railway deployment:**

```toml
# railway.toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/server.js"
healthcheckPath = "/health"
```

### Pros, Cons, Gotchas

**Pros:**
- TypeScript-native — best choice for TypeScript teams, no Python bridge needed
- Workflow DAGs with `.then()/.parallel()/.foreach()` are ergonomic and readable
- AgentFS provides persistent file storage out of the box — agents can save/load files across sessions
- Native MCP support — as good as Claude Agent SDK for MCP integration
- Vercel/Railway deployment is trivial for teams already in that ecosystem
- Backed by Y Combinator with strong momentum (22.3k stars in 2 months)

**Cons:**
- Newest framework (launched January 2026) — less battle-tested in production
- TypeScript-only — no Python support
- Smaller community compared to LangGraph or CrewAI
- No built-in observability dashboard (LangSmith equivalent doesn't exist)
- Workflow DAG is fixed at definition time — can't dynamically add nodes at runtime

**Gotchas:**
- Workflow steps get the trigger context plus results from previous steps via `context.getStepResult("step-id")` — if you typo the step ID, you get `undefined` with no error
- `.foreach()` executes sequentially by default — for parallel iteration, use `.parallel()` with an array of steps
- AgentFS file paths are scoped per agent — one agent can't read another agent's files unless you explicitly share the path
- Model providers require their own `@mastra/*` packages — check that your provider is supported before committing to Mastra
- The API surface is still stabilizing — expect breaking changes in minor versions through 2026

---

## 6. AWS Bedrock AgentCore

### Overview

AWS Bedrock AgentCore is a managed platform for running AI agents. It provides dedicated microVM runtime per agent session, a Gateway for action execution, Identity and Access management, and a Policy layer for governance guardrails. It's the "let AWS manage the infrastructure" option — you package your agent as a Docker image, push to ECR, and deploy to AgentCore Runtime.

**Key characteristics:**
- **AgentCore Runtime:** Dedicated microVM per session — isolated, secure, up to 8-hour workloads
- **AgentCore Gateway:** Executes actions on behalf of agents (API calls, database queries)
- **AgentCore Identity:** Manages agent identity and access to AWS/external services
- **AgentCore Policy:** Governance guardrails — limit what agents can do, what data they can access
- **Framework-agnostic:** Bring any framework (LangGraph, CrewAI, custom) — just Docker package it
- **Consumption-based pricing:** Pay per invocation + model usage, no idle costs

**Status:** GA across 13 AWS regions

### Architecture Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                   AWS Bedrock AgentCore                        │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                  AgentCore Runtime                      │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  microVM (per session)                            │  │   │
│  │  │                                                   │  │   │
│  │  │  Your Docker Image:                               │  │   │
│  │  │  ┌─────────────────────────────────────────────┐  │  │   │
│  │  │  │  Agent Application                          │  │  │   │
│  │  │  │  (any framework: SDK, LangGraph, CrewAI...) │  │  │   │
│  │  │  └──────────┬──────────────────────────────────┘  │  │   │
│  │  │             │                                     │  │   │
│  │  └─────────────┼─────────────────────────────────────┘  │   │
│  └────────────────┼────────────────────────────────────────┘   │
│                   │                                             │
│    ┌──────────────┼──────────────┬──────────────────────┐      │
│    │              │              │                      │      │
│    ▼              ▼              ▼                      ▼      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ AgentCore│ │ AgentCore│ │  Bedrock     │ │  AgentCore   │ │
│  │ Gateway  │ │ Identity │ │  Models      │ │  Policy      │ │
│  │          │ │          │ │              │ │              │ │
│  │ Execute  │ │ IAM +    │ │ Claude       │ │ Guardrails   │ │
│  │ actions  │ │ OAuth +  │ │ Titan        │ │ Cost limits  │ │
│  │ (APIs,   │ │ service  │ │ Llama        │ │ Data access  │ │
│  │  DBs,    │ │ accounts │ │ Mistral      │ │ Action       │ │
│  │  tools)  │ │          │ │ Cohere       │ │ restrictions │ │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  Knowledge Bases                          │ │
│  │  (S3 → embeddings → OpenSearch/Aurora pgvector)          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Reference Implementation: Research Agent on AgentCore

**Step 1: Agent definition (Bedrock console or CDK)**

```python
# bedrock_research_agent.py
# Using boto3 for Bedrock Agents API

import boto3
import json

bedrock_agent = boto3.client("bedrock-agent", region_name="us-east-1")

# Create the agent
response = bedrock_agent.create_agent(
    agentName="research-agent",
    agentResourceRoleArn="arn:aws:iam::123456789012:role/BedrockAgentRole",
    foundationModel="anthropic.claude-sonnet-4-6-20250514-v1:0",
    instruction="""You are a Research Agent. Your job is to research a given topic
thoroughly and produce a well-structured report.

YOUR PROCESS:
1. Search the web for the topic (3-5 searches with different angles)
2. Read the most promising sources (3-5 high-quality sources)
3. Analyze and synthesize the information
4. Write a comprehensive report with proper citations

REPORT FORMAT:
- Executive Summary (3-5 sentences)
- Key Findings (numbered, with source attribution)
- Analysis (synthesize across sources)
- Conclusion
- Sources list

The report should be 800-1500 words. Always cite your sources.""",
    idleSessionTTLInSeconds=600,
)

agent_id = response["agent"]["agentId"]
```

**Step 2: Define action groups (equivalent to tools)**

```python
# Action group for web search
bedrock_agent.create_agent_action_group(
    agentId=agent_id,
    agentVersion="DRAFT",
    actionGroupName="WebSearchActions",
    actionGroupExecutor={
        "lambda": "arn:aws:lambda:us-east-1:123456789012:function:web-search-handler"
    },
    apiSchema={
        "payload": json.dumps({
            "openapi": "3.0.0",
            "info": {"title": "Web Search API", "version": "1.0.0"},
            "paths": {
                "/search": {
                    "post": {
                        "operationId": "webSearch",
                        "description": "Search the web for information on a topic",
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "query": {
                                                "type": "string",
                                                "description": "The search query",
                                            },
                                            "max_results": {
                                                "type": "integer",
                                                "description": "Maximum results",
                                                "default": 10,
                                            },
                                        },
                                        "required": ["query"],
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "Search results",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "results": {
                                                    "type": "array",
                                                    "items": {
                                                        "type": "object",
                                                        "properties": {
                                                            "title": {"type": "string"},
                                                            "url": {"type": "string"},
                                                            "snippet": {"type": "string"},
                                                        },
                                                    },
                                                },
                                            },
                                        }
                                    }
                                },
                            }
                        },
                    }
                }
            },
        })
    },
)
```

**Step 3: Lambda handler for action groups**

```python
# lambda_web_search_handler.py
import json
import httpx
import os

def handler(event, context):
    """Lambda handler for Bedrock Agent action group."""
    action = event.get("actionGroup")
    api_path = event.get("apiPath")
    parameters = event.get("requestBody", {}).get("content", {}).get(
        "application/json", {}
    ).get("properties", [])

    # Parse parameters
    params = {p["name"]: p["value"] for p in parameters}

    if api_path == "/search":
        query = params.get("query", "")
        max_results = int(params.get("max_results", 10))

        response = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": max_results},
            headers={
                "X-Subscription-Token": os.environ["BRAVE_SEARCH_API_KEY"]
            },
        )
        data = response.json()
        results = [
            {
                "title": r["title"],
                "url": r["url"],
                "snippet": r.get("description", ""),
            }
            for r in data.get("web", {}).get("results", [])
        ]

        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": action,
                "apiPath": api_path,
                "httpMethod": "POST",
                "httpStatusCode": 200,
                "responseBody": {
                    "application/json": {
                        "body": json.dumps({"results": results, "count": len(results)})
                    }
                },
            },
        }

    return {
        "messageVersion": "1.0",
        "response": {
            "actionGroup": action,
            "apiPath": api_path,
            "httpMethod": "POST",
            "httpStatusCode": 404,
            "responseBody": {
                "application/json": {"body": json.dumps({"error": "Unknown action"})}
            },
        },
    }
```

**Step 4: Knowledge base setup (for document analysis)**

```python
# Create a knowledge base for the agent to query
bedrock_agent.create_knowledge_base(
    name="research-knowledge-base",
    roleArn="arn:aws:iam::123456789012:role/BedrockKBRole",
    knowledgeBaseConfiguration={
        "type": "VECTOR",
        "vectorKnowledgeBaseConfiguration": {
            "embeddingModelArn": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
        },
    },
    storageConfiguration={
        "type": "OPENSEARCH_SERVERLESS",
        "opensearchServerlessConfiguration": {
            "collectionArn": "arn:aws:aoss:us-east-1:123456789012:collection/xxx",
            "vectorIndexName": "research-index",
            "fieldMapping": {
                "vectorField": "embedding",
                "textField": "text",
                "metadataField": "metadata",
            },
        },
    },
)
```

**Step 5: Deploy to AgentCore Runtime (for long-running agents)**

```dockerfile
# Dockerfile for AgentCore Runtime deployment
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# AgentCore Runtime expects a specific entry point
ENV AGENT_HANDLER=agent_handler.handler
EXPOSE 8080

CMD ["python", "-m", "uvicorn", "agent_handler:app", "--host", "0.0.0.0", "--port", "8080"]
```

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker build -t research-agent .
docker tag research-agent:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/research-agent:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/research-agent:latest

# Deploy to AgentCore Runtime
aws bedrock-agent create-agent-runtime \
  --agent-id $AGENT_ID \
  --runtime-configuration '{
    "containerImage": "123456789012.dkr.ecr.us-east-1.amazonaws.com/research-agent:latest",
    "cpu": "1 vCPU",
    "memory": "2 GB",
    "maxSessionDuration": 3600
  }'
```

### Real-World Mapping: Legal/Contract Agent on Bedrock

| Agent Spec Component | Bedrock AgentCore Mapping |
|---------------------|--------------------------|
| Document Reader Engine | Action Group: DocumentActions (Lambda handler calling DocProof/Sarvam) |
| Legal KB (pgvector) | Knowledge Base with OpenSearch Serverless or Aurora pgvector |
| Clause Pattern Matching | Knowledge Base with custom metadata filtering |
| Stamp Duty Calculator | Action Group: StampDutyActions (Lambda with stamp duty matrix lookup) |
| Contract Repository | Action Group: ContractRepoActions (Lambda → DynamoDB or Aurora) |
| Report Generator | Agent instruction + return type: structured JSON |
| Tiered Autonomy | AgentCore Policy: restrict action groups based on user's autonomy level |
| Model Tiering | Bedrock model selection per action group (Opus for analysis, Haiku for lookups) |

**AgentCore Policy for governance/guardrails:**

```python
# Create a guardrail for the Legal/Contract Agent
bedrock = boto3.client("bedrock", region_name="us-east-1")

bedrock.create_guardrail(
    name="legal-agent-guardrail",
    description="Guardrails for Legal/Contract Intelligence Agent",
    topicPolicyConfig={
        "topicsConfig": [
            {
                "name": "legal-advice",
                "definition": "Providing definitive legal advice or recommendations to sign/not sign",
                "examples": [
                    "You should sign this contract",
                    "I advise you to reject this agreement",
                    "This contract is safe to sign",
                ],
                "type": "DENY",
            },
        ]
    },
    contentPolicyConfig={
        "filtersConfig": [
            {"type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH"},
        ]
    },
    wordPolicyConfig={
        "wordsConfig": [
            {"text": "I recommend you sign"},
            {"text": "you should definitely"},
        ]
    },
)
```

### Hosting: Fully Managed

AgentCore is fully managed. Pricing:

| Component | Pricing | INR Equivalent |
|-----------|---------|----------------|
| Agent invocation | ~$0.01-0.05 per invocation | ₹0.84-4.20 |
| Model inference | Standard Bedrock model pricing | Varies by model |
| Knowledge Base queries | ~$0.01 per query | ₹0.84 |
| AgentCore Runtime (microVM) | Per-second billing during session | ~$0.0001/sec / ₹0.008/sec |
| S3 storage (documents) | Standard S3 pricing | ~$0.023/GB/mo / ₹1.93/GB/mo |

### Pros, Cons, Gotchas

**Pros:**
- Fully managed — no servers to maintain, auto-scaling, AWS SLA
- microVM isolation provides strong security boundaries per session
- AgentCore Policy provides governance guardrails (critical for enterprise/compliance)
- Up to 8-hour workloads — supports long-running agents that other platforms can't
- Framework-agnostic — bring LangGraph, CrewAI, or any framework in a Docker container
- Knowledge Bases handle RAG (ingestion, embedding, retrieval) end-to-end

**Cons:**
- AWS vendor lock-in — heavily tied to the AWS ecosystem
- No MCP support (uses OpenAPI action groups instead) — different paradigm
- Action groups via Lambda add latency (cold starts) compared to in-process tools
- Bedrock model selection is limited to what's on Bedrock (may lag behind latest model releases)
- Pricing can add up for high-volume, long-running agents
- Debugging is harder — logs are in CloudWatch, not in your local terminal

**Gotchas:**
- Action group Lambda functions have strict request/response format — follow the `messageVersion: "1.0"` schema exactly or calls silently fail
- Knowledge Base ingestion is async — uploaded documents aren't queryable immediately. Plan for a delay (minutes, not seconds)
- microVM cold starts add 2-5 seconds to first request — pre-warm sessions for latency-sensitive use cases
- AgentCore Policy guardrails are evaluated per-turn, not per-session — they can't track multi-turn policy violations
- The Bedrock agent API limits `max_tokens` — check the current limit (it's lower than the direct Claude API)
- Session state is lost when the microVM is recycled — persist critical state to DynamoDB/S3

---

## 7. Hosting & Deployment Patterns

### Self-hosted Overview

#### Docker Containerization

Every agent, regardless of framework, starts with a Docker image. Here's a production template:

```dockerfile
# Multi-stage build — common for all frameworks
# Adjust base image: node:20-alpine for TS, python:3.12-slim for Python

# === TypeScript (Claude Agent SDK, Mastra) ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S agent && adduser -S agent -G agent
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER agent
ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "dist/server.js"]

# === Python (LangGraph, CrewAI) ===
# FROM python:3.12-slim
# WORKDIR /app
# RUN groupadd -r agent && useradd -r -g agent agent
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt
# COPY . .
# USER agent
# ENV PYTHONUNBUFFERED=1
# EXPOSE 8080
# HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
#   CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1
# CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### ECS/Fargate Deployment with SST/CDK

**SST v3 configuration:**

```typescript
// sst.config.ts — SST v3 for agent deployment
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "agent-platform",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: { region: "ap-south-1" },  // Mumbai for India-focused agents
      },
    };
  },
  async run() {
    // Shared infrastructure
    const vpc = new sst.aws.Vpc("AgentVpc", {
      bastion: true,  // For SSH debugging
      nat: "managed",
    });

    const database = new sst.aws.Postgres("AgentDb", {
      vpc,
      scaling: {
        min: "0.5 ACU",
        max: "4 ACU",
      },
    });

    const bucket = new sst.aws.Bucket("AgentStorage", {
      access: "private",
    });

    // Agent service — ECS Fargate
    const cluster = new sst.aws.Cluster("AgentCluster", { vpc });

    const agentService = new sst.aws.Service("LegalContractAgent", {
      cluster,
      cpu: "1 vCPU",
      memory: "2 GB",
      image: {
        dockerfile: "Dockerfile",
        context: ".",
      },
      scaling: {
        min: 1,
        max: 10,
        cpuUtilization: 70,
        memoryUtilization: 80,
      },
      health: {
        path: "/health",
        interval: "30 seconds",
      },
      environment: {
        ANTHROPIC_API_KEY: new sst.Secret("AnthropicApiKey").value,
        DATABASE_URL: database.url,
        S3_BUCKET: bucket.name,
        NODE_ENV: "production",
      },
      loadBalancer: {
        ports: [{ listen: "443/https", forward: "8080/http" }],
        health: { path: "/health" },
      },
    });

    return {
      serviceUrl: agentService.url,
      databaseHost: database.host,
    };
  },
});
```

**CDK example for ECS + Aurora + S3:**

```typescript
// cdk-stack.ts
import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class AgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "AgentVpc", {
      maxAzs: 2,
      natGateways: 1,
    });

    // Aurora Serverless v2 with pgvector
    const database = new rds.DatabaseCluster(this, "AgentDb", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_1,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc,
      defaultDatabaseName: "agent_db",
    });

    // S3 for document storage
    const bucket = new s3.Bucket(this, "AgentStorage", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(365), prefix: "temp/" },
      ],
    });

    // ECS Fargate service
    const cluster = new ecs.Cluster(this, "AgentCluster", { vpc });

    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "AgentService",
      {
        cluster,
        cpu: 1024,        // 1 vCPU
        memoryLimitMiB: 2048, // 2 GB
        desiredCount: 2,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset("."),
          containerPort: 8080,
          environment: {
            NODE_ENV: "production",
            S3_BUCKET: bucket.bucketName,
          },
          secrets: {
            ANTHROPIC_API_KEY: ecs.Secret.fromSsmParameter(
              cdk.aws_ssm.StringParameter.fromStringParameterName(
                this,
                "AnthropicKey",
                "/agent/anthropic-api-key",
              ),
            ),
            DATABASE_URL: ecs.Secret.fromSsmParameter(
              cdk.aws_ssm.StringParameter.fromStringParameterName(
                this,
                "DbUrl",
                "/agent/database-url",
              ),
            ),
          },
        },
        publicLoadBalancer: true,
      },
    );

    // Auto-scaling
    const scaling = service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
    });

    // Grant permissions
    bucket.grantReadWrite(service.taskDefinition.taskRole);
    database.connections.allowDefaultPortFrom(service.service);
  }
}
```

#### Serverless with Lambda + Step Functions

**When to use Lambda vs ECS:**

| Factor | Lambda | ECS/Fargate |
|--------|--------|-------------|
| Agent run time | < 15 minutes | 15 min to hours |
| Cold start tolerance | Yes (add 1-3 seconds) | No (always-on) |
| Concurrency | Auto-scaling, pay-per-use | Configured task count |
| Memory | Up to 10 GB | Up to 30 GB |
| Cost at low volume | Cheaper (pay per invocation) | More expensive (minimum 1 task) |
| Cost at high volume | More expensive (per-ms billing) | Cheaper (dedicated capacity) |
| Best for | Simple agents, webhooks, triggers | Complex agents, streaming, long-running |

**Step Functions for multi-step agent workflows:**

When an agent workflow has distinct phases that may take different amounts of time, Step Functions provides durable orchestration:

```json
{
  "Comment": "Contract Analysis Workflow",
  "StartAt": "ParseDocument",
  "States": {
    "ParseDocument": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-south-1:123456789012:function:parse-document",
      "TimeoutSeconds": 120,
      "Next": "AnalyzeInParallel"
    },
    "AnalyzeInParallel": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "RiskAnalysis",
          "States": {
            "RiskAnalysis": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:ap-south-1:123456789012:function:risk-analysis",
              "TimeoutSeconds": 300,
              "End": true
            }
          }
        },
        {
          "StartAt": "StampDutyCheck",
          "States": {
            "StampDutyCheck": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:ap-south-1:123456789012:function:stamp-duty",
              "TimeoutSeconds": 30,
              "End": true
            }
          }
        },
        {
          "StartAt": "MissingClauseCheck",
          "States": {
            "MissingClauseCheck": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:ap-south-1:123456789012:function:missing-clauses",
              "TimeoutSeconds": 120,
              "End": true
            }
          }
        }
      ],
      "Next": "ShouldGenerateRedline"
    },
    "ShouldGenerateRedline": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.autonomyLevel",
          "NumericGreaterThanEquals": 2,
          "Next": "GenerateRedline"
        }
      ],
      "Default": "GenerateReport"
    },
    "GenerateRedline": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-south-1:123456789012:function:generate-redline",
      "TimeoutSeconds": 300,
      "Next": "GenerateReport"
    },
    "GenerateReport": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-south-1:123456789012:function:generate-report",
      "TimeoutSeconds": 180,
      "End": true
    }
  }
}
```

### Managed Platforms

**AWS Bedrock AgentCore** — Covered in detail in Section 6.

**Vertex AI Agent Engine (Google Cloud):**
- Managed agent runtime on GCP
- Supports Gemini models natively, others via Model Garden
- Integrated with Google Cloud services (BigQuery, Cloud Storage, Pub/Sub)
- Good choice if you're on GCP and using Gemini
- Pricing: per-request + model inference costs
- Not covered in depth here because our primary stack is AWS

### CI/CD for Agent Deployments

```yaml
# .github/workflows/deploy-agent.yml
name: Deploy Agent

on:
  push:
    branches: [main]
    paths:
      - 'agents/**'
      - 'mcp-servers/**'
      - 'Dockerfile'

env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY: agent-platform
  ECS_SERVICE: legal-contract-agent
  ECS_CLUSTER: agent-cluster

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run agent integration tests
        run: npm run test:integration
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}

      # Agent-specific tests: run the agent against known inputs and verify outputs
      - name: Run agent smoke tests
        run: npm run test:agent-smoke
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE

      - name: Post-deploy smoke test
        run: |
          SERVICE_URL=$(aws ecs describe-services \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE \
            --query 'services[0].loadBalancers[0].containerName' \
            --output text)
          curl -sf "$SERVICE_URL/health" || exit 1
```

### Monitoring & Observability Per Hosting Option

| Hosting | Metrics | Logs | Traces | Dashboard |
|---------|---------|------|--------|-----------|
| **ECS/Fargate** | CloudWatch (CPU, memory, request count) | CloudWatch Logs (structured JSON) | X-Ray (optional) | CloudWatch Dashboard or Grafana |
| **Lambda** | CloudWatch (invocations, duration, errors, throttles) | CloudWatch Logs | X-Ray (built-in) | CloudWatch Dashboard |
| **Bedrock AgentCore** | CloudWatch (invocation count, latency) | CloudWatch Logs | X-Ray | CloudWatch Dashboard |
| **LangGraph + LangSmith** | LangSmith (tokens, latency, success rate per node) | LangSmith traces | LangSmith | LangSmith Dashboard |
| **Vercel (Mastra)** | Vercel Analytics | Vercel Logs | Vercel Traces | Vercel Dashboard |

**Custom metrics for agent performance (framework-agnostic):**

```typescript
// metrics.ts — emit custom metrics for any agent framework

interface AgentMetrics {
  trackRun(params: {
    agentName: string;
    topic: string;
    durationMs: number;
    toolCallCount: number;
    inputTokens: number;
    outputTokens: number;
    success: boolean;
    errorType?: string;
  }): void;

  trackToolCall(params: {
    toolName: string;
    durationMs: number;
    success: boolean;
    inputTokens?: number;
  }): void;
}

// CloudWatch implementation
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cw = new CloudWatchClient({ region: "ap-south-1" });

const cloudWatchMetrics: AgentMetrics = {
  async trackRun(params) {
    await cw.send(new PutMetricDataCommand({
      Namespace: "AgentPlatform",
      MetricData: [
        {
          MetricName: "AgentRunDuration",
          Value: params.durationMs,
          Unit: "Milliseconds",
          Dimensions: [{ Name: "AgentName", Value: params.agentName }],
        },
        {
          MetricName: "ToolCallCount",
          Value: params.toolCallCount,
          Unit: "Count",
          Dimensions: [{ Name: "AgentName", Value: params.agentName }],
        },
        {
          MetricName: "TotalTokens",
          Value: params.inputTokens + params.outputTokens,
          Unit: "Count",
          Dimensions: [{ Name: "AgentName", Value: params.agentName }],
        },
        {
          MetricName: params.success ? "SuccessCount" : "ErrorCount",
          Value: 1,
          Unit: "Count",
          Dimensions: [{ Name: "AgentName", Value: params.agentName }],
        },
      ],
    }));
  },

  async trackToolCall(params) {
    await cw.send(new PutMetricDataCommand({
      Namespace: "AgentPlatform",
      MetricData: [
        {
          MetricName: "ToolCallDuration",
          Value: params.durationMs,
          Unit: "Milliseconds",
          Dimensions: [{ Name: "ToolName", Value: params.toolName }],
        },
      ],
    }));
  },
};
```

**Cost tracking (critical for agent economics):**

```typescript
// cost-tracker.ts

const MODEL_COSTS = {
  // Per 1M tokens (March 2026 pricing)
  "claude-opus-4-6":   { input: 15.00, output: 75.00 },    // $15/$75 per 1M
  "claude-sonnet-4-6": { input: 3.00,  output: 15.00 },    // $3/$15 per 1M
  "claude-haiku-4-5":  { input: 0.80,  output: 4.00  },    // $0.80/$4 per 1M
} as const;

function calculateCost(
  model: keyof typeof MODEL_COSTS,
  inputTokens: number,
  outputTokens: number,
): { usd: number; inr: number } {
  const costs = MODEL_COSTS[model];
  const usd =
    (inputTokens / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output;
  return { usd, inr: usd * 84 };  // 1 USD = ~84 INR
}

// Example: Legal/Contract Agent analyzing a 30-page contract
// ~20K input tokens (contract + system prompt + legal KB results) × 8 turns
// ~2K output tokens per turn
// Using Sonnet for most turns, Opus for 2 turns
//
// Sonnet: 6 turns × (20K in + 2K out) = 120K in + 12K out = $0.36 + $0.18 = $0.54
// Opus:   2 turns × (20K in + 2K out) = 40K in + 4K out = $0.60 + $0.30 = $0.90
// Total: ~$1.44 / ₹121 per contract analysis
```

---

## 8. Framework Migration Guide

### Common Abstraction Layer (What's Portable)

The following components are portable across all frameworks:

| Component | Portability | Notes |
|-----------|------------|-------|
| **Tool implementations** | High | The actual function that calls an API, queries a DB, etc. is framework-independent. Only the wrapper/registration changes. |
| **System prompts** | High | The LLM instructions work across all frameworks. Minor adjustments for role-based prompts (CrewAI). |
| **MCP servers** | High | MCP servers are protocol-standard. Any framework with MCP support can connect to the same server. |
| **Business logic** | High | Validation, data transformation, error handling — pure functions that don't depend on the framework. |
| **Database schema** | High | PostgreSQL, pgvector, S3 — all infrastructure is framework-independent. |
| **Docker/infra** | High | The hosting layer is the same — ECS, Lambda, etc. don't care about the framework inside. |

### Framework-Specific Lock-in Points (What's NOT Portable)

| Framework | Lock-in Points |
|-----------|---------------|
| **Claude Agent SDK** | Claude-only model calls. Direct Anthropic API usage. Lifecycle hooks (PreToolUse/PostToolUse) are SDK-specific. |
| **LangGraph** | StateGraph definition, conditional edges, checkpointing API. LangSmith tracing integration. State reducers. |
| **CrewAI** | Agent role/goal/backstory definitions. Task context chaining. Crew process types. Delegation patterns. |
| **Mastra** | Workflow DAG definition (`.then()/.parallel()/.foreach()`). AgentFS file storage. Mastra-specific tool registration. |
| **Bedrock AgentCore** | OpenAPI action group definitions. Knowledge Base configuration. AgentCore Policy rules. AWS IAM integration. |

### Migration Paths

#### Claude Agent SDK to LangGraph

**When:** You need checkpointing, multi-model support, or LangSmith observability.

**Effort:** Medium (1-2 weeks for a production agent)

**What changes:**
1. Agentic loop becomes a StateGraph
2. Tool definitions change from Anthropic tool schema to LangChain `@tool` decorator
3. Model calls change from `Anthropic().messages.create()` to `ChatAnthropic().invoke()`
4. Lifecycle hooks become graph edges or middleware

**Before (Claude Agent SDK):**

```typescript
// Agentic loop in Claude Agent SDK
let response = await client.messages.create({
  model: "claude-sonnet-4-6-20250514",
  tools,
  messages,
});

while (response.stop_reason === "tool_use") {
  // Execute tools
  const toolResults = await executeTools(response);
  messages.push({ role: "assistant", content: response.content });
  messages.push({ role: "user", content: toolResults });

  response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    tools,
    messages,
  });
}
```

**After (LangGraph):**

```python
# Same logic as a StateGraph
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)       # LLM call
workflow.add_node("tools", ToolNode(tools))  # Tool execution
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
workflow.add_edge("tools", "agent")
graph = workflow.compile(checkpointer=SqliteSaver.from_conn_string(":memory:"))
```

**Migration checklist:**
- [ ] Convert tool definitions from Anthropic schema to `@tool` decorator
- [ ] Convert system prompt (usually copy-paste, no changes needed)
- [ ] Define `TypedDict` state schema
- [ ] Build `StateGraph` with nodes and edges
- [ ] Add checkpointer for state persistence
- [ ] Replace lifecycle hooks with node middleware or separate nodes
- [ ] Set up LangSmith for observability
- [ ] Update tests

#### CrewAI to LangGraph

**When:** You need fine-grained control over the execution flow, checkpointing, or hit limitations with CrewAI's agent delegation model.

**Effort:** Medium-High (2-3 weeks — the mental model shift from roles to graphs is significant)

**What changes:**
1. Agents with roles become graph nodes with specific LLM configurations
2. Tasks become node functions
3. `Process.sequential` becomes linear edges; `Process.hierarchical` becomes conditional routing
4. Delegation becomes explicit inter-node communication via state

**Before (CrewAI):**

```python
# CrewAI: Role-based agents with task delegation
analyst = Agent(
    role="Legal Risk Analyst",
    goal="Identify legal risks in contracts",
    tools=[search_statutes, search_patterns],
    llm="anthropic/claude-opus-4-6-20250514",
)

analysis_task = Task(
    description="Analyze the contract for legal risks...",
    agent=analyst,
    expected_output="List of risks with severity levels",
)

crew = Crew(agents=[analyst], tasks=[analysis_task], process=Process.sequential)
result = crew.kickoff()
```

**After (LangGraph):**

```python
# LangGraph: Same logic, but as explicit graph nodes
from langchain_anthropic import ChatAnthropic

opus = ChatAnthropic(model="claude-opus-4-6-20250514").bind_tools(tools)

def risk_analysis_node(state: ContractState) -> dict:
    """Replaces the CrewAI Agent + Task combo."""
    system = """You are a Legal Risk Analyst. Your goal is to identify
    legal risks in contracts against Indian law."""  # Same as CrewAI backstory
    response = opus.invoke([
        {"role": "system", "content": system},
        *state["messages"],
    ])
    return {"messages": [response], "risks": extract_risks(response)}

workflow = StateGraph(ContractState)
workflow.add_node("risk_analysis", risk_analysis_node)
# ... rest of graph
```

**Migration checklist:**
- [ ] Map each CrewAI Agent to a LangGraph node with its own LLM config
- [ ] Convert Agent backstory/goal to system prompts for each node
- [ ] Convert Tasks to node functions
- [ ] Map `Process.sequential` to linear edges
- [ ] Map task `context` dependencies to state fields
- [ ] Replace delegation with explicit conditional edges
- [ ] Add checkpointing
- [ ] Port tools (usually straightforward — both use function decorators)

#### LangGraph to Bedrock AgentCore

**When:** You want managed infrastructure, governance guardrails, or your organization mandates AWS-managed services.

**Effort:** High (3-4 weeks — significant architectural change)

**What changes:**
1. StateGraph becomes a Bedrock Agent with action groups
2. LangGraph nodes become Lambda functions behind action groups
3. Tool definitions change from `@tool` decorators to OpenAPI schemas
4. Checkpointing becomes DynamoDB session state
5. LangSmith observability becomes CloudWatch + X-Ray

**Before (LangGraph):**

```python
@tool
def search_statutes(query: str) -> str:
    """Search Indian legal statutes."""
    # implementation
    pass

workflow = StateGraph(State)
workflow.add_node("search", search_node)
workflow.add_node("tools", ToolNode([search_statutes]))
```

**After (Bedrock AgentCore):**

```python
# Tool becomes a Lambda behind an OpenAPI action group
# lambda_search_statutes.py
def handler(event, context):
    params = extract_params(event)
    results = search_statutes_impl(params["query"])
    return format_bedrock_response(results)

# Agent definition
bedrock_agent.create_agent(
    agentName="legal-analyst",
    foundationModel="anthropic.claude-opus-4-6-20250514-v1:0",
    instruction="You are a Legal Risk Analyst...",
)

bedrock_agent.create_agent_action_group(
    actionGroupName="LegalKBActions",
    actionGroupExecutor={"lambda": "arn:aws:lambda:...:search-statutes"},
    apiSchema={"payload": openapi_schema_json},
)
```

**Migration checklist:**
- [ ] Convert each tool to a Lambda function with Bedrock action group response format
- [ ] Define OpenAPI schemas for each action group
- [ ] Create Bedrock Agent with system instructions
- [ ] Set up Knowledge Bases for any RAG components
- [ ] Migrate checkpointing from LangGraph to DynamoDB
- [ ] Create AgentCore Policy guardrails
- [ ] Replace LangSmith with CloudWatch + X-Ray
- [ ] Update CI/CD pipeline for ECR + Bedrock deployment

#### Any Framework to Mastra (Moving to TypeScript)

**When:** Your team is TypeScript-native and you want to consolidate on one language.

**Effort:** Low-Medium from Claude Agent SDK (1 week), Medium from LangGraph/CrewAI (2 weeks, includes Python-to-TypeScript port)

**What changes:**
1. Python tools become TypeScript tools with `createTool()`
2. Agent definitions use Mastra's `Agent` class
3. Workflow logic uses `.then()/.parallel()/.foreach()` DAG syntax
4. MCP integration is native (similar to Claude Agent SDK)

**Before (LangGraph Python):**

```python
@tool
def web_search(query: str) -> str:
    """Search the web for information."""
    response = httpx.get(...)
    return json.dumps(response.json())

workflow = StateGraph(ResearchState)
workflow.add_node("search", search_node)
workflow.add_node("analyze", analyze_node)
workflow.add_edge("search", "analyze")
```

**After (Mastra TypeScript):**

```typescript
const webSearchTool = createTool({
  id: "web_search",
  description: "Search the web for information.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ context }) => {
    const response = await fetch(...);
    return response.json();
  },
});

const searchStep = workflow.step({ id: "search", execute: searchFn });
const analyzeStep = workflow.step({ id: "analyze", execute: analyzeFn });
searchStep.then(analyzeStep);
```

**Migration checklist:**
- [ ] Port tool implementations from Python to TypeScript
- [ ] Convert tool schemas to Zod (from Pydantic or raw JSON schema)
- [ ] Create Mastra agents with instructions (from system prompts)
- [ ] Build workflow DAG (from StateGraph or CrewAI tasks)
- [ ] Port MCP server connections (usually minimal changes)
- [ ] Set up TypeScript build pipeline
- [ ] Update deployment config for Node.js runtime

---

## Quick Reference: Which Framework For Which Agent Spec?

As a practical guide, here's how we'd map existing agent specs in this repository to frameworks:

| Agent Spec | Recommended Framework | Why |
|-----------|----------------------|-----|
| Legal/Contract Intelligence Agent | **Claude Agent SDK** | MCP-heavy, needs model tiering (Opus/Sonnet/Haiku), Claude-native, lifecycle hooks for legal guardrails |
| Lab Report Intelligence Agent | **LangGraph** | Complex multi-step analysis with branching (normal vs abnormal results), benefits from checkpointing for long reports |
| Cloud Cost Optimization Agent (AWS) | **Bedrock AgentCore** | AWS-native workload, needs governance guardrails for cost changes, long-running analysis sessions |
| ABHA Health Record Agent | **CrewAI** | Role-based (data fetcher, analyzer, report generator), rapid prototyping for healthcare compliance |
| Multi-agent customer support system | **Mastra** | TypeScript frontend team, supervisor pattern for routing, Vercel deployment |

---

## Appendix: Version Reference

All framework versions and key dependencies referenced in this document:

| Framework/Library | Version | Release Date | Notes |
|-------------------|---------|-------------|-------|
| Claude Agent SDK (TypeScript) | v0.1.48 | Mar 2026 | Rapid iteration, pin version |
| Claude Agent SDK (Python) | v0.1.x | Mar 2026 | Lags TypeScript by ~2 weeks |
| LangGraph | 1.0 GA | Oct 2025 | Stable API, safe to track latest minor |
| LangChain Core | 0.3.x | 2025 | Required by LangGraph |
| langchain-anthropic | 0.3.x | 2025 | ChatAnthropic provider |
| langchain-mcp-adapters | 0.2.x | 2026 | Community-maintained |
| LangSmith | SaaS | - | Free tier for dev, $39/seat for Plus |
| CrewAI | v1.10.1 | Mar 2026 | Stable, standalone framework |
| Mastra | v1.0 | Jan 2026 | New, API still stabilizing |
| @mastra/core | v1.0 | Jan 2026 | Core package |
| @mastra/anthropic | v1.0 | Jan 2026 | Anthropic provider |
| AWS Bedrock AgentCore | GA | 2025 | Managed, 13 regions |
| Anthropic API | 2025-11-25 | Nov 2025 | Messages API version |
| MCP Specification | 2025-11-25 | Nov 2025 | Model Context Protocol |
| Node.js | 20 LTS | - | Recommended for TypeScript agents |
| Python | 3.12 | - | Recommended for Python agents |
| Zod | 3.x | - | Schema validation (TypeScript) |
| Pydantic | 2.x | - | Schema validation (Python) |

> **Warning:** Agent framework APIs are evolving rapidly. The code examples in this document were tested as of March 2026. Before starting a new project, check the latest docs for each framework. Pin your dependency versions and test before upgrading.
