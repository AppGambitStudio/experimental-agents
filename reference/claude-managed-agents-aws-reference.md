# Claude Managed Agents + AWS Cloud Reference

A practical guide to building production applications using Claude Managed Agents with AWS serverless infrastructure. Covers architecture patterns, API usage, custom tool integration, file handling, and real-world deployment with SST (Ion).

**Audience:** Developers building multi-tenant, agent-powered applications on AWS.

**Last validated:** April 2026 | **Beta header:** `managed-agents-2026-04-01` | **SDK:** `@anthropic-ai/sdk` (TypeScript), `anthropic` (Python) | **Memory stores:** public beta

---

## Table of Contents

1. [What is Claude Managed Agents](#1-what-is-claude-managed-agents)
2. [Core Concepts](#2-core-concepts)
3. [Agent Definition & Configuration](#3-agent-definition--configuration)
4. [Environments](#4-environments)
5. [Sessions](#5-sessions)
6. [Events & Streaming](#6-events--streaming)
7. [Tools — Built-in, Custom, and MCP](#7-tools--built-in-custom-and-mcp)
8. [Files API](#8-files-api)
9. [Memory Stores](#9-memory-stores)
10. [AWS Integration Architecture](#10-aws-integration-architecture)
11. [Cost Analysis](#11-cost-analysis)
12. [When to Use vs Alternatives](#12-when-to-use-vs-alternatives)
13. [Real-World Example: Multi-Tenant Contract Review Platform](#13-real-world-example-multi-tenant-contract-review-platform)

---

## 1. What is Claude Managed Agents

Claude Managed Agents is Anthropic's managed infrastructure for running Claude as an autonomous agent. Instead of building your own agent loop, tool execution, and runtime, you get:

- **Managed agent loop** with built-in prompt caching, context compaction, and performance optimizations
- **Cloud containers** with pre-installed packages and configurable networking
- **Built-in tools** — bash, file operations, web search/fetch
- **Custom tools** — your code executes, results flow back to the agent
- **MCP server support** — connect to external tool providers via Model Context Protocol
- **SSE streaming** — real-time events as the agent works
- **Session persistence** — conversation history managed server-side
- **Agent versioning** — update agents without breaking running sessions

### Managed Agents vs Messages API

| | Messages API | Claude Managed Agents |
|---|---|---|
| **What it is** | Direct model prompting access | Pre-built, configurable agent harness in managed infrastructure |
| **Best for** | Custom agent loops, fine-grained control | Long-running tasks, asynchronous work |
| **Agent loop** | You build it | Managed — tool execution, caching, compaction handled |
| **Tool execution** | You execute tools, send results back | Built-in tools run in container; custom tools callback to your code |
| **Session state** | You manage conversation history | Managed server-side, persistent across interactions |
| **Container** | N/A | Cloud container with packages, networking, file system |

### Managed Agents vs Claude Agent SDK

| | Claude Agent SDK | Claude Managed Agents |
|---|---|---|
| **Runtime** | Your infrastructure (ECS, Lambda, local) | Anthropic's cloud containers |
| **Agent loop** | SDK provides `query()` with agentic loop | Fully managed — you don't run the loop |
| **MCP servers** | In-process or stdio (you host them) | Remote URL-based MCP servers (Anthropic connects) |
| **Custom tools** | Defined in MCP servers you run | Defined on agent, executed by your callback endpoint |
| **Session state** | You manage (in-memory, DB, etc.) | Managed by Anthropic |
| **Best for** | Full control, custom orchestration | Minimal infrastructure, long-running tasks |

---

## 2. Core Concepts

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                     │
│  (React SPA, API Gateway, Lambda, DynamoDB, S3)         │
└──────────────────────┬──────────────────────────────────┘
                       │ Anthropic API
                       ▼
┌───────────────────────────────────────────────────────────┐
│              Claude Managed Agents                        │
│                                                           │
│  ┌──────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Agent   │  │ Environment │  │    Session          │   │
│  │          │  │             │  │                     │   │
│  │ model    │  │ packages    │  │ agent + environment │   │
│  │ system   │  │ networking  │  │ files (resources)   │   │
│  │ tools    │  │             │  │ events (SSE)        │   │
│  │ mcp      │  │             │  │ conversation state  │   │
│  │ skills   │  │             │  │                     │   │
│  └──────────┘  └─────────────┘  └─────────────────────┘   │
│                                                           │
│  ┌───────────────────────────────────────────────────┐    │
│  │              Cloud Container                      │    │
│  │  bash, read, write, edit, glob, grep              │    │
│  │  web_search, web_fetch                            │    │
│  │  mounted files (read-only)                        │    │
│  │  agent-created files (read-write)                 │    │
│  └───────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

| Concept | Description | Lifecycle |
|---------|-------------|-----------|
| **Agent** | Reusable, versioned configuration: model + system prompt + tools + MCP servers + skills | Create once, reference by ID. Versioned on update. |
| **Environment** | Container template: packages, networking rules | Create once, share across sessions. Not versioned. |
| **Session** | Running agent instance: agent + environment + files + conversation | One per task. Persistent. Archive or delete when done. |
| **Events** | Messages between your app and the agent | Streamed via SSE. History fetchable. |

---

## 3. Agent Definition & Configuration

### Creating an Agent

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const agent = await client.beta.agents.create({
  name: "Contract Review Agent",
  model: "claude-sonnet-4-6",
  system: `You are a Legal Contract Intelligence Agent specializing in Indian law...`,
  tools: [
    { type: "agent_toolset_20260401" },           // built-in tools
    {                                               // custom tool
      type: "custom",
      name: "search_clause_patterns",
      description: "Search for risky clause patterns in contract text",
      input_schema: {
        type: "object",
        properties: {
          clause_text: { type: "string", description: "The clause text to analyze" },
          clause_type: { type: "string", description: "Type of clause (indemnity, non_compete, etc.)" }
        },
        required: ["clause_text"]
      }
    }
  ],
  mcp_servers: [                                    // optional MCP servers
    {
      type: "url",
      name: "legal_research",
      url: "https://your-mcp-server.example.com/mcp/"
    }
  ],
  description: "Reviews Indian contracts for legal risks",
  metadata: { tier: "pro", domain: "legal" }
});

// agent.id — reference this in all sessions
// agent.version — increments on update
```

### Agent Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable name |
| `model` | Yes | Claude model ID. All Claude 4.5+ models supported. For fast mode: `{ id: "claude-opus-4-6", speed: "fast" }` |
| `system` | No | System prompt defining agent persona and behavior |
| `tools` | No | Array of tool configurations (built-in, custom, MCP toolsets) |
| `mcp_servers` | No | Array of remote MCP server connections |
| `skills` | No | Domain-specific context with progressive disclosure |
| `callable_agents` | No | Other agents this agent can invoke (multi-agent, research preview) |
| `description` | No | What the agent does |
| `metadata` | No | Arbitrary key-value pairs for your tracking |

### Updating an Agent (Versioned)

```typescript
const updated = await client.beta.agents.update(agent.id, {
  version: agent.version,   // optimistic concurrency — must match current
  system: "Updated system prompt...",
  // omitted fields are preserved
  // scalar fields (model, system, name) are replaced
  // array fields (tools, mcp_servers) are fully replaced
  // metadata is merged at key level
});
// updated.version === agent.version + 1
```

**Update semantics:**
- Omitted fields preserved
- Scalar fields replaced with new value
- Array fields fully replaced (not merged)
- Metadata merged at key level (set value to `""` to delete a key)
- No-op detection: if nothing changed, no new version created

### Agent Lifecycle

| Operation | Behavior |
|-----------|----------|
| **Create** | Returns agent with `id`, `version: 1` |
| **Update** | New version created. Pass current `version` for optimistic locking. |
| **List versions** | Full version history for audit trail |
| **Archive** | Read-only. Existing sessions continue, new sessions cannot reference it. |

```typescript
// List version history
for await (const version of client.beta.agents.versions.list(agent.id)) {
  console.log(`Version ${version.version}: ${version.updated_at}`);
}

// Archive (soft delete)
await client.beta.agents.archive(agent.id);
```

---

## 4. Environments

Environments define the container where agents run. Create once, share across sessions. Each session gets its own isolated container instance.

### Creating an Environment

```typescript
const environment = await client.beta.environments.create({
  name: "legal-analysis-env",
  config: {
    type: "cloud",
    packages: {
      pip: ["pdfplumber", "python-docx"],     // PDF and DOCX processing
      npm: ["pdf-parse"],                       // alternative PDF parser
      apt: ["poppler-utils"],                   // pdftotext utility
    },
    networking: {
      type: "limited",
      allowed_hosts: ["api.your-domain.com"],   // your custom tool endpoint
      allow_mcp_servers: true,                  // allow MCP server connections
      allow_package_managers: true,             // allow pip/npm during session
    },
  },
});
```

### Configuration Options

#### Packages

Pre-installed into the container before the agent starts. Cached across sessions sharing the same environment.

| Field | Package Manager | Version Pinning Example |
|-------|----------------|------------------------|
| `apt` | System packages (apt-get) | `"ffmpeg"` |
| `pip` | Python (pip) | `"pandas==2.2.0"` |
| `npm` | Node.js (npm) | `"express@4.18.0"` |
| `cargo` | Rust (cargo) | `"ripgrep@14.0.0"` |
| `gem` | Ruby (gem) | `"rails:7.1.0"` |
| `go` | Go modules | `"golang.org/x/tools/cmd/goimports@latest"` |

Package managers run in alphabetical order when multiple are specified.

#### Networking

| Mode | Description |
|------|-------------|
| `unrestricted` | Full outbound access (except safety blocklist). **Default.** |
| `limited` | Restricted to `allowed_hosts` list. Use `allow_mcp_servers` and `allow_package_managers` booleans for additional access. |

**Production recommendation:** Use `limited` networking with explicit `allowed_hosts`. Follow principle of least privilege.

```typescript
// Production-grade networking config
networking: {
  type: "limited",
  allowed_hosts: [
    "api.your-backend.com",          // custom tool callback endpoint
    "legal-research.example.com",    // domain-specific API
  ],
  allow_mcp_servers: true,           // allow declared MCP server URLs
  allow_package_managers: false,     // packages pre-installed, no runtime installs
}
```

### Environment Lifecycle

- Persist until explicitly archived or deleted
- Multiple sessions can reference the same environment
- Each session gets its own container instance (no shared filesystem)
- Not versioned — log updates on your side if needed

```typescript
// List, retrieve, archive, delete
const envs = await client.beta.environments.list();
const env = await client.beta.environments.retrieve(environment.id);
await client.beta.environments.archive(environment.id);   // read-only, existing sessions continue
await client.beta.environments.delete(environment.id);    // only if no sessions reference it
```

---

## 5. Sessions

A session is a running agent instance within an environment. One session per task. Sessions maintain conversation history across multiple interactions.

### Creating a Session

```typescript
const session = await client.beta.sessions.create({
  agent: agent.id,                      // uses latest agent version
  environment_id: environment.id,
  title: "Contract Review — Sharma MSA",
  resources: [                          // mount files into container
    {
      type: "file",
      file_id: uploadedFile.id,
      mount_path: "/workspace/contract.pdf",
    },
    {
      type: "file",
      file_id: annexureFile.id,
      mount_path: "/workspace/annexure-a.pdf",
    },
  ],
  vault_ids: [vault.id],               // optional: MCP auth credentials
});
```

#### Pin to specific agent version

```typescript
const session = await client.beta.sessions.create({
  agent: { type: "agent", id: agent.id, version: 3 },  // pinned
  environment_id: environment.id,
});
```

### Session Statuses

| Status | Description |
|--------|-------------|
| `idle` | Waiting for input. Sessions start here. |
| `running` | Agent actively executing tools and reasoning |
| `rescheduling` | Transient error, retrying automatically |
| `terminated` | Unrecoverable error, session ended |

### Session Lifecycle

```typescript
// Retrieve session status
const session = await client.beta.sessions.retrieve(sessionId);
console.log(session.status);  // "idle" | "running" | ...

// List all sessions
for await (const s of client.beta.sessions.list()) {
  console.log(`${s.id}: ${s.status}`);
}

// Archive (read-only, preserves history)
await client.beta.sessions.archive(sessionId);

// Delete (permanent — removes record, events, container)
// Cannot delete a "running" session — interrupt first
await client.beta.sessions.delete(sessionId);
```

**Important:** Creating a session provisions the container but does NOT start any work. Send a `user.message` event to begin.

---

## 6. Events & Streaming

Communication is event-based. You send user events, receive agent/session events back via SSE.

### Event Types

#### User Events (you send)

| Type | Description |
|------|-------------|
| `user.message` | Text message to start or continue the agent's work |
| `user.interrupt` | Stop the agent mid-execution |
| `user.custom_tool_result` | Response to a custom tool call |
| `user.tool_confirmation` | Approve/deny a tool call (when permission policy requires it) |

#### Agent Events (you receive)

| Type | Description |
|------|-------------|
| `agent.message` | Agent response with text content blocks |
| `agent.thinking` | Agent thinking content (extended thinking) |
| `agent.tool_use` | Agent invoked a built-in tool |
| `agent.tool_result` | Result of a built-in tool execution |
| `agent.mcp_tool_use` | Agent invoked an MCP tool |
| `agent.mcp_tool_result` | Result of MCP tool execution |
| `agent.custom_tool_use` | Agent invoked your custom tool — you must respond with `user.custom_tool_result` |

#### Session Events (you receive)

| Type | Description |
|------|-------------|
| `session.status_running` | Agent actively processing |
| `session.status_idle` | Agent finished, waiting for input. Includes `stop_reason`. |
| `session.status_rescheduled` | Transient error, retrying |
| `session.status_terminated` | Unrecoverable error |
| `session.error` | Error details with `retry_status` |

#### Span Events (observability)

| Type | Description |
|------|-------------|
| `span.model_request_start` | Model inference call started |
| `span.model_request_end` | Model inference completed. Includes `model_usage` with token counts. |

### Streaming Pattern (TypeScript)

```typescript
// Open the SSE stream
const stream = await client.beta.sessions.events.stream(session.id);

// Send user message after stream is open
await client.beta.sessions.events.send(session.id, {
  events: [
    {
      type: "user.message",
      content: [
        {
          type: "text",
          text: "Review this contract for legal risks under Indian law.",
        },
      ],
    },
  ],
});

// Process events as they arrive
for await (const event of stream) {
  switch (event.type) {
    case "agent.message":
      // Stream text to UI
      for (const block of event.content) {
        process.stdout.write(block.text);
      }
      break;

    case "agent.tool_use":
      // Show tool activity in UI
      console.log(`[Using tool: ${event.name}]`);
      break;

    case "agent.custom_tool_use":
      // Execute your custom tool and send result back
      const result = await executeCustomTool(event.name, event.input);
      await client.beta.sessions.events.send(session.id, {
        events: [
          {
            type: "user.custom_tool_result",
            tool_use_id: event.id,
            content: [{ type: "text", text: JSON.stringify(result) }],
          },
        ],
      });
      break;

    case "session.status_idle":
      console.log("Agent finished. Ready for follow-up questions.");
      break;

    case "span.model_request_end":
      // Track token usage for billing
      console.log(`Tokens: ${JSON.stringify(event.model_usage)}`);
      break;
  }
}
```

### Interrupting the Agent

```typescript
await client.beta.sessions.events.send(session.id, {
  events: [{ type: "user.interrupt" }],
});
```

### Steering Mid-Execution

Send additional `user.message` events while the agent is running to redirect it:

```typescript
// Agent is analyzing... but operator realizes wrong document
await client.beta.sessions.events.send(session.id, {
  events: [
    {
      type: "user.message",
      content: [
        { type: "text", text: "Stop the current analysis. Focus only on clause 7 — the non-compete." },
      ],
    },
  ],
});
```

### Fetching Event History

```typescript
// Get all events for a session (paginated)
const events = await client.beta.sessions.events.list(session.id);
for (const event of events.data) {
  console.log(`${event.type} at ${event.processed_at}`);
}
```

---

## 7. Tools — Built-in, Custom, and MCP

### Built-in Tools (agent_toolset_20260401)

Enabled by default when you include the toolset. All run inside the container.

| Tool | Name | Description |
|------|------|-------------|
| Bash | `bash` | Execute shell commands |
| Read | `read` | Read a file from the container filesystem |
| Write | `write` | Write a file to the container filesystem |
| Edit | `edit` | String replacement in a file |
| Glob | `glob` | File pattern matching |
| Grep | `grep` | Text search with regex |
| Web Fetch | `web_fetch` | Fetch content from a URL |
| Web Search | `web_search` | Search the web |

#### Disabling Specific Tools

```typescript
tools: [
  {
    type: "agent_toolset_20260401",
    configs: [
      { name: "web_fetch", enabled: false },
      { name: "web_search", enabled: false },
    ],
  },
]
```

#### Enabling Only Specific Tools

```typescript
tools: [
  {
    type: "agent_toolset_20260401",
    default_config: { enabled: false },  // disable all by default
    configs: [
      { name: "bash", enabled: true },
      { name: "read", enabled: true },
      { name: "write", enabled: true },
    ],
  },
]
```

### Custom Tools

Custom tools let you extend Claude's capabilities. Claude emits a structured request (`agent.custom_tool_use`), your code executes the operation, and you send the result back (`user.custom_tool_result`).

#### Defining Custom Tools

```typescript
const agent = await client.beta.agents.create({
  name: "Contract Agent",
  model: "claude-sonnet-4-6",
  tools: [
    { type: "agent_toolset_20260401" },
    {
      type: "custom",
      name: "get_stamp_duty",
      description: "Calculate stamp duty for an Indian contract. Returns duty amount, e-stamping availability, registration requirements, and penalty for deficiency. Use this when the user asks about contract costs or stamping requirements.",
      input_schema: {
        type: "object",
        properties: {
          state: { type: "string", description: "Indian state (gujarat, maharashtra, delhi, karnataka)" },
          document_type: { type: "string", description: "Type of document (agreement, lease, sale_deed, etc.)" },
          contract_value: { type: "number", description: "Contract value in INR (optional)" },
        },
        required: ["state", "document_type"],
      },
    },
  ],
});
```

#### Handling Custom Tool Calls

When the agent invokes a custom tool, you receive an `agent.custom_tool_use` event. Execute the tool and send the result back:

```typescript
case "agent.custom_tool_use":
  const toolResult = await handleCustomTool(event.name, event.input);
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.custom_tool_result",
        tool_use_id: event.id,
        content: [{ type: "text", text: JSON.stringify(toolResult) }],
      },
    ],
  });
  break;

async function handleCustomTool(name: string, input: any): Promise<any> {
  switch (name) {
    case "get_stamp_duty":
      return calculateStampDuty(input.state, input.document_type, input.contract_value);
    case "search_clause_patterns":
      return searchClausePatterns(input.clause_text, input.clause_type);
    case "check_enforceability":
      return checkEnforceability(input.clause_type);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
```

#### Best Practices for Custom Tool Definitions

1. **Extremely detailed descriptions** — 3-4+ sentences explaining what, when, parameters, and caveats
2. **Consolidate related operations** — group related actions into one tool with an `action` parameter
3. **Meaningful namespacing** — prefix names with the resource (`legal_get_stamp_duty`, `legal_check_enforceability`)
4. **High-signal responses** — return only fields Claude needs for reasoning. Avoid bloated responses.

### MCP Servers

Connect to remote MCP servers for external tool access. Auth is split: server URLs on the agent, credentials via vaults on the session.

#### Declaring MCP Servers

```typescript
const agent = await client.beta.agents.create({
  name: "Agent with MCP",
  model: "claude-sonnet-4-6",
  mcp_servers: [
    {
      type: "url",
      name: "github",
      url: "https://api.githubcopilot.com/mcp/",
    },
  ],
  tools: [
    { type: "agent_toolset_20260401" },
    { type: "mcp_toolset", mcp_server_name: "github" },  // reference by name
  ],
});
```

#### Providing Auth at Session Creation

```typescript
const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: environment.id,
  vault_ids: [vault.id],   // vault contains OAuth credentials for MCP servers
});
```

**Supported:** Remote MCP servers with streamable HTTP transport only. No stdio/local MCP servers.

---

## 8. Files API

Upload files via the Files API and mount them in session containers.

### Upload → Mount Flow

```typescript
import { readFile } from "fs/promises";
import { toFile } from "@anthropic-ai/sdk";

// Step 1: Upload file
const file = await client.beta.files.upload({
  file: await toFile(readFile("contract.pdf"), "contract.pdf", { type: "application/pdf" }),
});

// Step 2: Mount in session
const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: environment.id,
  resources: [
    {
      type: "file",
      file_id: file.id,
      mount_path: "/workspace/contract.pdf",   // optional but recommended
    },
  ],
});
```

### Multiple Files (up to 100 per session)

```typescript
resources: [
  { type: "file", file_id: mainContract.id, mount_path: "/workspace/main-agreement.pdf" },
  { type: "file", file_id: scheduleA.id, mount_path: "/workspace/schedule-a.pdf" },
  { type: "file", file_id: scheduleB.id, mount_path: "/workspace/schedule-b.pdf" },
  { type: "file", file_id: previousVersion.id, mount_path: "/workspace/previous-version.pdf" },
  { type: "file", file_id: companyPolicy.id, mount_path: "/workspace/company-standard-terms.pdf" },
]
```

### Managing Files on a Running Session

```typescript
// Add a file to a running session
const resource = await client.beta.sessions.resources.add(session.id, {
  type: "file",
  file_id: forgottenAnnexure.id,
});

// List all resources
const resources = await client.beta.sessions.resources.list(session.id);

// Remove a file
await client.beta.sessions.resources.delete(resource.id, { session_id: session.id });
```

### Downloading Agent-Created Files

```typescript
// List files created by the agent in this session
const files = await client.beta.files.list({ scope_id: session.id });
for (const f of files.data) {
  console.log(f.id, f.filename);
}

// Download a file
const content = await client.beta.files.download(files.data[0].id);
await content.writeToFile("analysis-report.md");
```

**Important notes:**
- Mounted files are **read-only copies** in the container
- Agent writes to new paths within the container (read-write)
- File copies in sessions don't count against storage limits
- Paths should be absolute (starting with `/`)
- Parent directories created automatically

---

## 9. Memory Stores

Memory stores give agents persistent memory that survives across sessions. Each attached store is mounted as a directory under `/mnt/memory/` inside the session container, and the agent reads/writes it using the standard agent toolset (the same file tools it uses for the rest of the filesystem). A note describing each mount — path, access mode, store `description`, and any session-level `instructions` — is automatically added to the system prompt so the agent knows where to look.

> **Public Beta (April 2026):** Memory stores graduated from research preview to public beta on the Claude Platform. Access is available to all Managed Agents users — no separate request form. All requests still require the `managed-agents-2026-04-01` beta header (SDKs set it automatically).

### Core Concepts

- **Memory Store** (`memstore_...`) — workspace-scoped collection of text documents. Described to the agent via `name` and `description`.
- **Memory** — individual document within a store, addressed by path. Capped at 100 kB each. Tune/import/export directly via API or Console.
- **Memory Version** (`memver_...`) — immutable snapshot created on every mutation. Versions belong to the store (not the memory), so history survives the memory itself. Retained for 30 days; recent versions are always kept regardless of age.

### Creating a Memory Store

```typescript
const store = await client.beta.memoryStores.create({
  name: "Client Context — Sharma Associates",
  description: "Preferences, standard terms, negotiation history, and past analysis findings for Sharma & Associates.",
});
// store.id = "memstore_01Hx..."
```

### Seeding with Content

Pre-load reference material before any session runs. `memories.create` does not overwrite — use `memories.update` to change an existing memory.

```typescript
await client.beta.memoryStores.memories.create(store.id, {
  path: "/preferences/contract_standards.md",
  content: "Sharma prefers Gujarat governing law. Standard indemnity cap: 2x contract value. Always flag non-compete clauses — they push back on these.",
});

await client.beta.memoryStores.memories.create(store.id, {
  path: "/history/2026-03-msa-abc-corp.md",
  content: "MSA with ABC Corp (March 2026): IP assignment clause was problematic — renegotiated to license-only. Limitation of liability was uncapped — negotiated to 3x annual fees.",
});
```

### Attaching to a Session

Memory stores go in the session's `resources[]` array, alongside files. Unlike files and repos, **memory stores can only be attached at session creation** — they cannot be added or removed from a running session.

```typescript
const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: environment.id,
  resources: [
    // Files
    { type: "file", file_id: contractFile.id, mount_path: "/workspace/contract.pdf" },
    // Memory — client-specific (read-write, agent learns from this session)
    {
      type: "memory_store",
      memory_store_id: clientMemoryStore.id,
      access: "read_write",
      instructions: "This client's preferences, history, and past findings. Check before starting analysis. Write new learnings when done.",
    },
    // Memory — legal knowledge base (read-only, shared across all sessions)
    {
      type: "memory_store",
      memory_store_id: legalKbStore.id,
      access: "read_only",
      instructions: "Indian contract law reference material. Search when analyzing clause enforceability.",
    },
  ],
});
```

- `access` defaults to `read_write`. Use `read_only` for reference material or any store the agent shouldn't mutate.
- `instructions` is capped at 4,096 characters and is shown to the agent alongside the store's `name`/`description`.
- The agent toolset must be enabled at agent creation for memory interactions to work.

> **Prompt-injection warning:** `read_write` mounts let any successful injection persist into memory that later sessions read as trusted. Use `read_only` for any store the agent doesn't need to modify — especially shared knowledge bases or stores touched by sessions that process untrusted input.

### How the Agent Accesses Memory

- Mounts live under `/mnt/memory/<store>/` inside the session container.
- Reads/writes use the standard agent file tools — there are no dedicated `memory_*` tools.
- `access` is enforced at the filesystem layer: `read_only` mounts reject writes; writes to `read_write` mounts produce a new **memory version** attributed to the session.
- Reads and writes appear in the event stream as ordinary `agent.tool_use` / `agent.tool_result` events.
- Writes persist to the store and stay in sync across concurrent sessions that share it. For safe concurrent edits via API, use the `content_sha256` precondition (see below).

### Managing Memories via API

```typescript
// List memories (supports path_prefix, order_by, depth)
const page = await client.beta.memoryStores.memories.list(store.id, {
  path_prefix: "/preferences/",
  order_by: "path",
  depth: 2,
});

// Read a specific memory
const mem = await client.beta.memoryStores.memories.retrieve(memoryId, {
  memory_store_id: store.id,
});

// Update content, rename, or both
await client.beta.memoryStores.memories.update(mem.id, {
  memory_store_id: store.id,
  path: "/archive/2026_q1_formatting.md", // rename
});

// Optimistic concurrency — only applies if hash still matches
await client.beta.memoryStores.memories.update(mem.id, {
  memory_store_id: store.id,
  content: "CORRECTED: Always use 2-space indentation.",
  precondition: { type: "content_sha256", content_sha256: mem.content_sha256 },
});

// Delete
await client.beta.memoryStores.memories.delete(memoryId, {
  memory_store_id: store.id,
});
```

### Audit Trail (Memory Versions)

Every mutation creates an immutable version. Use for compliance, point-in-time recovery, or debugging.

```typescript
// List version history (newest first; filter by memory_id for a single memory)
for await (const v of client.beta.memoryStores.memoryVersions.list(store.id, {
  memory_id: mem.id,
})) {
  console.log(`${v.id}: ${v.operation} at ${v.created_at}`);
}

// Retrieve a specific version (includes full content)
const version = await client.beta.memoryStores.memoryVersions.retrieve(versionId, {
  memory_store_id: store.id,
});

// Rollback: write the old content back as a new version
await client.beta.memoryStores.memories.update(mem.id, {
  memory_store_id: store.id,
  content: version.content,
});

// Redact sensitive content from history (preserves audit metadata: who/when)
// Note: the version currently serving as head of a live memory cannot be redacted —
// write a new version first (or delete the memory), then redact the old one.
await client.beta.memoryStores.memoryVersions.redact(versionId, {
  memory_store_id: store.id,
});
```

There is no dedicated restore endpoint — roll back by writing a version's `content` back via `memories.update` (or `memories.create` if the parent was deleted; versions outlive their parent).

### Managing Stores

Beyond `create`, stores support `retrieve`, `update`, `list` (pass `include_archived: true` to include archived), `archive` (one-way; makes the store read-only and blocks new session attachments), and `delete` (permanent; only if no sessions reference it).

### Beta Limits

| Limit | Value |
|------|------|
| Memory stores per organization | 1,000 |
| Memories per store | 2,000 |
| Total storage per store | 100 MB |
| Versions per store | 250,000 |
| Size per memory | 100 kB (~25K tokens) |
| Version history retention | 30 days (recent versions always kept) |
| Memory stores per session | 8 |
| `instructions` per attachment | 4,096 characters |

### Multi-Tenant Memory Architecture

For a platform with multiple operators, each serving multiple clients:

```
Memory Store: "Legal KB" (shared, read-only)
├── /indian-law/contract-act-1872.md
├── /indian-law/dpdpa-2023.md
├── /regulations/fema-compliance.md
└── /patterns/common-risky-clauses.md

Memory Store: "Client — Sharma Associates" (per-client, read-write)
├── /preferences/contract_standards.md
├── /preferences/negotiation_style.md
├── /history/2026-03-msa-abc-corp.md
├── /history/2026-04-nda-techstartup.md
└── /findings/recurring-risk-patterns.md

Memory Store: "Client — Patel Industries" (per-client, read-write)
├── /preferences/contract_standards.md
├── /history/2026-02-vendor-agreement.md
└── /findings/ip-clause-concerns.md
```

Each session attaches: shared Legal KB (read-only) + relevant client memory (read-write).

---

## 10. AWS Integration Architecture

### Reference Architecture: Multi-Tenant Agent Platform

```
┌─────────────────────────────────────────────────────────┐
│  Frontend — React SPA                                   │
│  S3 + CloudFront                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Client   │ │ Contract │ │  Chat /  │ │Deliverables│  │
│  │ Grid     │ │ View     │ │ Stream   │ │ PDF/WA     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────┐
│  API Layer — API Gateway + Lambda (SST Ion)              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐    │
│  │ Auth   │ │Clients │ │Upload  │ │Reports │ │Custom│    │
│  │Cognito │ │ CRUD   │ │S3+Files│ │PDF gen │ │Tools │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └──┬───┘    │
└──────────────────────┬───────────────────────────┬───────┘
                       │ Anthropic API             │ callback
                       ▼                           │
┌───────────────────────────────────┐              │
│  Claude Managed Agents            │◄─────────────┘
│  ┌──────────┐ ┌─────────────┐     │
│  │  Agent   │ │ Environment │     │
│  │ (legal)  │ │ (pdf tools) │     │
│  └──────────┘ └─────────────┘     │
│  ┌──────────────────────────┐     │
│  │  Sessions (per contract) │     │
│  │  files, events, history  │     │
│  └──────────────────────────┘     │
└───────────────────────────────────┘
        ▲
        │ Storage
        ▼
┌──────────────────────────────────────────────────────────┐
│  AWS Storage                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐  │
│  │ DynamoDB │ │    S3    │ │       Cognito            │  │
│  │          │ │          │ │                          │  │
│  │ Operators│ │ PDFs     │ │ Operator auth            │  │
│  │ Clients  │ │ Reports  │ │ JWT tokens               │  │
│  │ Contracts│ │ Logos    │ │                          │  │
│  │ Results  │ │          │ │                          │  │
│  └──────────┘ └──────────┘ └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow: Contract Analysis

```
1. Browser uploads PDF
   → Lambda generates S3 presigned URL
   → Browser uploads directly to S3 (encrypted)

2. Browser sends "Analyze" request
   → Lambda reads PDF from S3
   → Lambda calls client.beta.files.upload() → gets file_id
   → Lambda creates session with file mounted
   → Lambda sends initial user.message with contract context
   → Lambda stores session reference in DynamoDB

3. Frontend opens SSE stream
   → Proxied through API Gateway WebSocket (or direct to Anthropic)
   → Streams agent.message, agent.tool_use, session.status_* events

4. Agent calls custom tool
   → agent.custom_tool_use event received by your streaming handler
   → Lambda executes domain logic (stamp duty, clause patterns, etc.)
   → Lambda sends user.custom_tool_result back

5. Analysis complete
   → session.status_idle received
   → Lambda reads results, stores in DynamoDB
   → Frontend shows results, enables follow-up chat

6. Operator generates report
   → Lambda reads analysis from DynamoDB
   → Lambda renders PDF template → stores in S3
   → Returns presigned download URL
```

### SST (Ion) Infrastructure Example

```typescript
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: "contract-review",
      removal: input.stage === "production" ? "retain" : "remove",
    };
  },
  async run() {
    // Auth
    const auth = new sst.aws.Cognito("Auth", {
      userPool: { signIn: ["email"] },
    });

    // Storage
    const bucket = new sst.aws.Bucket("Uploads", {
      access: "cloudfront",
    });

    const table = new sst.aws.Dynamo("Data", {
      fields: { pk: "string", sk: "string", gsi1pk: "string", gsi1sk: "string" },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    // API
    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: true,
    });

    api.route("POST /clients", "packages/functions/src/clients.create");
    api.route("GET /clients", "packages/functions/src/clients.list");
    api.route("POST /contracts/{clientId}/analyze", "packages/functions/src/analyze.start");
    api.route("POST /tools/callback", "packages/functions/src/tools.callback");
    api.route("POST /reports/{contractId}/generate", "packages/functions/src/reports.generate");

    // Frontend
    new sst.aws.StaticSite("Web", {
      path: "packages/web",
      build: { command: "npm run build", output: "dist" },
      environment: {
        VITE_API_URL: api.url,
        VITE_AUTH_USER_POOL_ID: auth.userPoolId,
      },
    });
  },
});
```

### Custom Tool Callback Lambda

The key integration point: a Lambda that receives custom tool calls from your streaming handler and executes domain logic.

```typescript
// packages/functions/src/tools/callback.ts

export async function handler(event: {
  toolName: string;
  toolInput: any;
  sessionId: string;
  toolUseId: string;
}) {
  const { toolName, toolInput, sessionId, toolUseId } = event;

  let result: any;

  switch (toolName) {
    case "search_clause_patterns":
      result = searchClausePatterns(toolInput.clause_text, toolInput.clause_type);
      break;
    case "check_enforceability":
      result = checkEnforceability(toolInput.clause_type);
      break;
    case "get_stamp_duty":
      result = calculateStampDuty(toolInput.state, toolInput.document_type, toolInput.contract_value);
      break;
    case "get_required_clauses":
      result = getRequiredClauses(toolInput.contract_type);
      break;
    case "get_applicable_regulations":
      result = getApplicableRegulations(toolInput.contract_type);
      break;
    case "get_contract_limitations":
      result = getContractLimitations();
      break;
    default:
      result = { error: `Unknown tool: ${toolName}` };
  }

  // Send result back to the session
  const client = new Anthropic();
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.custom_tool_result",
        tool_use_id: toolUseId,
        content: [{ type: "text", text: JSON.stringify(result) }],
      },
    ],
  });

  return result;
}
```

### Streaming Architecture Options

#### Option A: Frontend streams directly from Anthropic API

```
Browser → Anthropic SSE stream (with API key proxy through your backend)
```

- Simplest. Frontend uses the SDK to stream events.
- Requires proxying the Anthropic API key (never expose to frontend).
- Custom tool callbacks handled by a separate process monitoring the stream.

#### Option B: Backend proxies the stream

```
Browser → WebSocket (API Gateway) → Lambda → Anthropic SSE stream
```

- Backend Lambda opens the SSE stream, processes events, forwards to frontend via WebSocket.
- Custom tool calls handled inline by the same Lambda.
- More control, but more complex.

#### Option C: Backend streams, frontend polls

```
Browser → GET /status (polling) → DynamoDB (updated by backend)
Backend Lambda → Anthropic SSE stream → DynamoDB (writes events)
```

- Simplest infrastructure. No WebSockets.
- Higher latency (polling interval). Acceptable for long-running analyses.
- Custom tool calls handled by the backend stream processor.

**Recommended for MVP:** Option C (polling) for simplicity, migrate to Option B (WebSocket) for real-time UX.

---

## 11. Cost Analysis

### Pricing Components

| SKU | Rate | Metering |
|-----|------|----------|
| Session runtime | $0.08 per session-hour | Running status duration |
| Model tokens | Standard Claude API pricing | Input + output tokens |

### Cost Per Contract Analysis

| Document Size | Estimated Duration | Session Cost | Token Cost (Sonnet) | Total |
|---------------|-------------------|--------------|---------------------|-------|
| 5-10 pages | 2-3 minutes | $0.003 - $0.004 | $0.10 - $0.30 | ~$0.10 - $0.30 |
| 20-40 pages | 5-10 minutes | $0.007 - $0.013 | $0.30 - $0.80 | ~$0.30 - $0.80 |
| 60-100 pages | 10-20 minutes | $0.013 - $0.027 | $0.80 - $1.50 | ~$0.80 - $1.50 |

### Operator Economics

An operator serving 15-20 clients, processing ~50 contracts/month:

| Cost Item | Monthly |
|-----------|---------|
| Session runtime | ~$0.50 |
| Model tokens (Sonnet) | $15 - $75 |
| DynamoDB | ~$1 - $5 |
| S3 | ~$0.50 |
| Lambda | ~$1 - $3 |
| Cognito | Free tier (50K MAU) |
| **Total infrastructure** | **~$20 - $85** |
| **Revenue** (20 clients x Rs 2,000/mo) | **~$480** |
| **Margin** | **~80-95%** |

Session runtime at $0.08/hour is negligible compared to model token costs. This means you can let the agent be thorough — run the critic, check every clause, use tools extensively — without worrying about container costs.

---

## 12. When to Use vs Alternatives

### Use Claude Managed Agents When

- Long-running tasks (minutes to hours)
- You want minimal infrastructure — no agent loop, no sandbox, no tool execution layer
- You need built-in file operations, bash, and web access
- You want session persistence without building it yourself
- Your custom tools can be executed via callback (not in-process)
- You're building a multi-tenant platform where each session is isolated

### Use Claude Agent SDK When

- You need full control over the agent loop
- You need in-process MCP servers (not remote)
- You need custom orchestration (subagents, parallel tool execution)
- You need sub-second response times (Managed Agents has container spin-up latency)
- You're building a CLI tool or local application

### Use Bedrock AgentCore When

- You need AWS-native governance guardrails (IAM, policies)
- You need model flexibility (switch between Claude, Titan, Llama, Mistral)
- You need Knowledge Bases with vector search (S3 → embeddings → OpenSearch/Aurora)
- You're in a regulated environment requiring AWS compliance certifications
- You need up to 8-hour workloads with microVM isolation

### Decision Matrix

| Dimension | Managed Agents | Agent SDK | Bedrock AgentCore |
|-----------|---------------|-----------|-------------------|
| Infrastructure | Anthropic manages | You manage | AWS manages |
| Agent loop | Managed | SDK provides `query()` | You build or use framework |
| Tool execution | Built-in + custom callbacks | In-process MCP servers | Action groups (OpenAPI) |
| Session state | Managed | Manual | Managed (microVM state) |
| Container | Cloud container (managed) | N/A (your runtime) | microVM (Docker on ECR) |
| Model support | Claude only (4.5+) | Claude only | Multiple (Bedrock models) |
| MCP support | Remote URL servers | In-process + stdio | Not native |
| Pricing | $0.08/session-hr + tokens | Tokens only | ~$0.01-0.05/invocation + tokens |
| Best for | SaaS platforms, async work | CLI tools, custom agents | Enterprise, multi-model, compliance |

---

## 13. Real-World Example: Multi-Tenant Contract Review Platform

### Problem

Build a platform for operators (CA consultants, legal services providers) who serve 15-20 clients each. Each client sends 2-5 contracts/month. The operator needs to:

1. Upload contracts (often with annexures/schedules)
2. Get AI-powered risk analysis under Indian law
3. Ask follow-up questions
4. Generate PDF reports and WhatsApp summaries for clients

### Architecture

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | React SPA on S3/CloudFront | Operator-facing dashboard |
| Auth | Cognito | Email/phone login for operators |
| API | API Gateway + Lambda (SST Ion) | Serverless, pay-per-use |
| Storage | DynamoDB (single-table) + S3 | Clients, contracts, results, files |
| Agent | Claude Managed Agents | Managed analysis sessions |
| Custom tools | Lambda functions | Legal KB (clause patterns, stamp duty, enforceability, regulations) |
| Reports | Lambda + PDF template | Two templates: full technical + executive summary |

### Agent Configuration

```typescript
const legalAgent = await client.beta.agents.create({
  name: "Legal Contract Intelligence Agent",
  model: "claude-sonnet-4-6",
  system: `You are a Legal Contract Intelligence Agent specializing in Indian law.
Your job is to review contracts, identify risks, and explain findings in plain language.

When analyzing a contract:
1. Read all mounted files in /workspace/
2. Identify parties, contract type, and governing law
3. Analyze each clause for risks using search_clause_patterns
4. Check enforceability of risky clauses
5. Check for missing required clauses
6. Calculate stamp duty
7. Identify applicable regulations
8. Run the critic review
9. Present consolidated findings with risk score (0-100)

Always cite specific clause numbers and applicable Indian law sections.
Use plain language explanations suitable for business teams.`,
  tools: [
    {
      type: "agent_toolset_20260401",
      configs: [
        { name: "glob", enabled: false },
        { name: "grep", enabled: false },
      ],
    },
    { type: "custom", name: "search_clause_patterns", description: "...", input_schema: { ... } },
    { type: "custom", name: "check_enforceability", description: "...", input_schema: { ... } },
    { type: "custom", name: "get_stamp_duty", description: "...", input_schema: { ... } },
    { type: "custom", name: "get_required_clauses", description: "...", input_schema: { ... } },
    { type: "custom", name: "get_applicable_regulations", description: "...", input_schema: { ... } },
    { type: "custom", name: "get_contract_limitations", description: "...", input_schema: { ... } },
    { type: "custom", name: "review_report", description: "...", input_schema: { ... } },
  ],
});

const legalEnv = await client.beta.environments.create({
  name: "legal-analysis",
  config: {
    type: "cloud",
    packages: {
      pip: ["pdfplumber"],
      apt: ["poppler-utils"],
    },
    networking: {
      type: "limited",
      allowed_hosts: ["api.your-platform.com"],
      allow_package_managers: false,
    },
  },
});
```

### Analysis Flow

```typescript
async function analyzeContract(contractId: string, fileIds: string[], context: ContractContext) {
  // Mount all files in the session
  const resources = fileIds.map((fid, i) => ({
    type: "file" as const,
    file_id: fid,
    mount_path: `/workspace/${context.fileNames[i]}`,
  }));

  // Create session
  const session = await client.beta.sessions.create({
    agent: legalAgent.id,
    environment_id: legalEnv.id,
    title: `${context.counterparty} — ${context.contractType}`,
    resources,
  });

  // Store session reference
  await db.put({
    pk: `CONTRACT#${contractId}`,
    sk: `SESSION#${session.id}`,
    sessionId: session.id,
    status: "running",
  });

  // Open stream and send initial message
  const stream = await client.beta.sessions.events.stream(session.id);

  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: `Review this contract. Context:
- Counterparty: ${context.counterparty}
- Contract type: ${context.contractType}
- Our role: ${context.ourRole}
- State: ${context.state}
${context.contractValue ? `- Value: INR ${context.contractValue.toLocaleString("en-IN")}` : ""}

Files mounted in /workspace/. Start your analysis.`,
          },
        ],
      },
    ],
  });

  // Process stream (custom tool callbacks, status updates, etc.)
  for await (const event of stream) {
    await handleEvent(session.id, contractId, event);
  }
}
```

### Multi-File Use Cases

| Scenario | Files Mounted | Agent Behavior |
|----------|--------------|----------------|
| Simple contract | 1 PDF | Standard analysis |
| Contract + schedules | 3-5 PDFs | Cross-references schedules, checks for conflicts |
| Version comparison | 2 PDFs (old + new) | Highlights what changed, flags new risks |
| Contract + company policy | 2 PDFs | Flags deviations from company standard terms |
| Batch of related docs | 3-5 PDFs (NDA + MSA + SOW) | Cross-references, checks consistency |

---

## Appendix: Rate Limits

| Operation | Limit |
|-----------|-------|
| Create endpoints (agents, sessions, environments) | 60 requests/minute |
| Read endpoints (retrieve, list, stream) | 600 requests/minute |

Organization-level spend limits and tier-based rate limits also apply.

## Appendix: Beta Access

Claude Managed Agents is in beta. All endpoints require the `managed-agents-2026-04-01` beta header. The SDK sets this automatically.

Features in research preview (require separate access request):
- **Outcomes** — define success criteria the agent works toward
- **Multi-agent** — coordinator/worker patterns with callable agents
- **Memory** — persistent memory across sessions

Request access: https://claude.com/form/claude-managed-agents
