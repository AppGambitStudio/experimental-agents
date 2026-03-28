# Claude Agent SDK — Subagents, Slash Commands & Skills

Reference for three key SDK extension mechanisms. Source: [Claude Agent SDK docs](https://platform.claude.com/docs/en/agent-sdk/overview)

---

## 1. Subagents

Separate agent instances spawned by the main agent for focused subtasks.

### Why use subagents

| Benefit | What it means |
|---------|---------------|
| **Context isolation** | Each subagent gets a fresh context window. Tool calls and results stay inside — only the final message returns to parent. |
| **Parallelization** | Multiple subagents run concurrently. Run `rera-checker`, `ecourts-checker`, `anyror-checker` simultaneously. |
| **Specialized instructions** | Each subagent has tailored system prompts with specific expertise. |
| **Tool restrictions** | Subagents can be limited to specific tools (e.g., read-only analysis agent). |

### Programmatic definition (recommended)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review the authentication module for security issues",
  options: {
    // Agent tool is REQUIRED for subagent invocation
    allowedTools: ["Read", "Grep", "Glob", "Agent"],
    agents: {
      "code-reviewer": {
        description: "Expert code review specialist. Use for quality, security, and maintainability reviews.",
        prompt: `You are a code review specialist...`,
        tools: ["Read", "Grep", "Glob"],  // read-only
        model: "sonnet"
      },
      "test-runner": {
        description: "Runs and analyzes test suites.",
        prompt: `You are a test execution specialist...`,
        tools: ["Bash", "Read", "Grep"]  // can execute commands
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### AgentDefinition fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | When to use this agent (Claude matches tasks to agents based on this) |
| `prompt` | `string` | Yes | System prompt defining role and behavior |
| `tools` | `string[]` | No | Allowed tools. Omit = inherits all parent tools |
| `model` | `'sonnet' \| 'opus' \| 'haiku' \| 'inherit'` | No | Model override |
| `skills` | `string[]` | No | Available skills |
| `mcpServers` | `(string \| object)[]` | No | MCP servers available to this agent |

### Key constraints

- Subagents **cannot spawn their own subagents** — don't include `Agent` in a subagent's `tools`
- The parent receives the subagent's final message as the Agent tool result
- Subagent does NOT receive the parent's conversation history or system prompt
- Subagent DOES receive its own prompt + project CLAUDE.md

### Dynamic agent factory pattern

Create agents with different configurations at runtime:

```typescript
function createSecurityAgent(level: "basic" | "strict"): AgentDefinition {
  const isStrict = level === "strict";
  return {
    description: "Security code reviewer",
    prompt: `You are a ${isStrict ? "strict" : "balanced"} security reviewer...`,
    tools: ["Read", "Grep", "Glob"],
    model: isStrict ? "opus" : "sonnet"  // more capable model for strict reviews
  };
}

// Use at query time
agents: {
  "security-reviewer": createSecurityAgent("strict")
}
```

### Common tool combinations

| Use case | Tools |
|----------|-------|
| Read-only analysis | `Read`, `Grep`, `Glob` |
| Test execution | `Bash`, `Read`, `Grep` |
| Code modification | `Read`, `Edit`, `Write`, `Grep`, `Glob` |
| Full access | Omit `tools` field (inherits all) |

### Resuming subagents

Subagents can be resumed to continue where they left off with full conversation history:

```typescript
let agentId: string | undefined;
let sessionId: string | undefined;

// First invocation
for await (const message of query({
  prompt: "Use the Explore agent to find all API endpoints",
  options: { allowedTools: ["Read", "Grep", "Glob", "Agent"] }
})) {
  if ("session_id" in message) sessionId = message.session_id;
  const extractedId = extractAgentId(message);  // parse from content
  if (extractedId) agentId = extractedId;
}

// Resume with follow-up
if (agentId && sessionId) {
  for await (const message of query({
    prompt: `Resume agent ${agentId} and list the top 3 most complex endpoints`,
    options: { allowedTools: ["Read", "Grep", "Glob", "Agent"], resume: sessionId }
  })) {
    if ("result" in message) console.log(message.result);
  }
}
```

### Detecting subagent invocation

```typescript
for (const block of msg.message?.content ?? []) {
  if (block.type === "tool_use" && (block.name === "Task" || block.name === "Agent")) {
    console.log(`Subagent invoked: ${block.input.subagent_type}`);
  }
}
// Messages from within subagent have parent_tool_use_id
if (msg.parent_tool_use_id) {
  console.log("  (running inside subagent)");
}
```

---

## 2. Slash Commands

Special `/` commands to control Claude Code sessions through the SDK.

### Built-in commands

| Command | Purpose |
|---------|---------|
| `/compact` | Summarize older messages, reduce context size |
| `/clear` | Start fresh conversation |
| `/help` | Show available commands |

### Sending slash commands via SDK

```typescript
for await (const message of query({
  prompt: "/compact",
  options: { maxTurns: 1 }
})) {
  if (message.type === "system" && message.subtype === "compact_boundary") {
    console.log("Pre-compaction tokens:", message.compact_metadata.pre_tokens);
  }
}
```

### Custom slash commands

Defined as markdown files. Two locations:
- **Project**: `.claude/commands/` (shared via git)
- **Personal**: `~/.claude/commands/` (all projects)

**Note:** `.claude/skills/` is the newer recommended format (supports both slash invocation AND autonomous invocation by Claude). Legacy `.claude/commands/` still works.

#### Basic custom command

`.claude/commands/refactor.md`:
```markdown
Refactor the selected code to improve readability and maintainability.
Focus on clean code principles and best practices.
```

Creates `/refactor` command.

#### With frontmatter + arguments

`.claude/commands/fix-issue.md`:
```markdown
---
allowed-tools: Read, Grep, Glob, Bash
argument-hint: [issue-number] [priority]
description: Fix a GitHub issue
---

Fix issue #$1 with priority $2.
Check the issue description and implement the necessary changes.
```

Usage: `/fix-issue 123 high` → `$1="123"`, `$2="high"`

#### With bash execution + file references

`.claude/commands/code-review.md`:
```markdown
---
allowed-tools: Read, Grep, Glob, Bash(git diff:*)
description: Comprehensive code review
---

## Changed Files
!`git diff --name-only HEAD~1`

## Detailed Changes
!`git diff HEAD~1`

Review for: code quality, security, performance, test coverage, docs.
```

- `!`backtick`command`backtick`` — executes bash and inlines output
- `@filename` — inlines file contents

#### Namespacing with subdirectories

```
.claude/commands/
├── frontend/
│   ├── component.md      # /component
│   └── style-check.md    # /style-check
├── backend/
│   ├── api-test.md       # /api-test
│   └── db-migrate.md     # /db-migrate
└── review.md             # /review
```

---

## 3. Agent Skills

Specialized capabilities packaged as `SKILL.md` files that Claude autonomously invokes when relevant.

### Key difference from slash commands

| | Slash Commands | Skills |
|---|---|---|
| **Invocation** | User types `/command` | Claude decides autonomously based on context |
| **Also supports** | — | User can invoke with `/skill-name` |
| **Format** | `.claude/commands/name.md` | `.claude/skills/name/SKILL.md` |
| **Discovery** | Listed in init message | Claude matches description to task |

Skills are the **recommended format** — they support both autonomous and manual invocation.

### Using skills in the SDK

Two requirements:
1. Include `"Skill"` in `allowedTools`
2. Configure `settingSources` to load from filesystem

```typescript
for await (const message of query({
  prompt: "Help me process this PDF document",
  options: {
    cwd: "/path/to/project",               // must contain .claude/skills/
    settingSources: ["user", "project"],    // REQUIRED to load skills
    allowedTools: ["Skill", "Read", "Write", "Bash"]
  }
})) {
  console.log(message);
}
```

**Common mistake:** forgetting `settingSources` — without it, skills won't be loaded even if `"Skill"` is in `allowedTools`.

### Skill locations

| Location | Scope | Loaded when |
|----------|-------|-------------|
| `.claude/skills/` | Project (shared via git) | `setting_sources` includes `"project"` |
| `~/.claude/skills/` | Personal (all projects) | `setting_sources` includes `"user"` |
| Plugin skills | Plugin-bundled | Plugin installed |

### Creating skills

Directory structure:
```
.claude/skills/processing-pdfs/
└── SKILL.md
```

The `SKILL.md` file uses YAML frontmatter + markdown content. The `description` field is critical — Claude uses it to decide when to invoke the skill.

**Note:** `allowed-tools` frontmatter in SKILL.md only works in Claude Code CLI, NOT in the SDK. Control tool access via the main `allowedTools` option.

### Skills in subagents

Pass skills to subagents via the `skills` field:

```typescript
agents: {
  "pdf-processor": {
    description: "Processes PDF documents",
    prompt: "You are a PDF processing specialist...",
    tools: ["Read", "Write", "Bash", "Skill"],
    skills: ["processing-pdfs"]  // skill name matches directory name
  }
}
```

---

## Applying to Our Real Estate Agent

### Subagents for parallel portal checks

```typescript
agents: {
  "rera-checker": {
    description: "Checks GujRERA portal for project registration status",
    prompt: "You are a RERA verification specialist...",
    tools: ["Read", "Bash", "Grep"],  // portal tools
    model: "sonnet"  // cheaper model for individual checks
  },
  "ecourts-checker": {
    description: "Searches eCourts for litigation against seller/builder",
    prompt: "You are a litigation search specialist...",
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet"
  },
  "anyror-checker": {
    description: "Verifies land records on AnyRoR portal",
    prompt: "You are a land records verification specialist...",
    tools: ["Read", "Bash", "Grep"],
    model: "sonnet"
  },
  "critic-reviewer": {
    description: "Reviews due diligence reports for accuracy, completeness, and hallucinations",
    prompt: "You are a senior property lawyer reviewing a due diligence report...",
    tools: ["Read", "Grep"],  // read-only
    model: "opus"  // more capable model for review
  }
}
```

### Custom slash commands for the copilot

```
.claude/commands/
├── verify-property.md     # /verify-property <address>
├── check-builder.md       # /check-builder <name>
├── calculate-cost.md      # /calculate-cost <price> <type>
└── generate-dossier.md    # /generate-dossier
```

### Skills for domain expertise

```
.claude/skills/
├── gujarat-property-law/
│   └── SKILL.md           # Auto-invoked for Gujarat property questions
├── stamp-duty-calculator/
│   └── SKILL.md           # Auto-invoked for cost calculations
└── document-reviewer/
    └── SKILL.md           # Auto-invoked for contract/deed review
```
