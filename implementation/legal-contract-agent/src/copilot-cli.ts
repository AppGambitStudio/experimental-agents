#!/usr/bin/env tsx
// Interactive Copilot CLI — conversational contract review
// Usage: npm run copilot -- --file <path> --counterparty <name> --type <type> --role <role> --state <state>

import "dotenv/config";
import { startCopilot } from "./copilot.js";
import { resolve } from "path";

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--") && i + 1 < argv.length) {
      const key = arg.slice(2);
      args[key] = argv[i + 1]!;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  if (!args["file"]) {
    console.log(`
Legal Contract Copilot — Interactive Mode

Usage:
  npm run copilot -- --file <path> --counterparty <name> --type <type> --role <role> --state <state> [--value <amount>]

Options:
  --file          Path to the contract PDF or text file (required)
  --counterparty  Name of the other party (required)
  --type          Contract type: msa, nda, employment, freelancer, lease (required)
  --role          Our role: vendor, client, employer, tenant, developer (required)
  --state         Indian state for stamp duty: Gujarat, Maharashtra, Delhi (required)
  --value         Contract value in INR (optional)

Commands during session:
  playbook    Generate negotiation playbook
  summary     Get concise summary of findings
  redline     Generate redlined version with alternatives
  quit        End the session

Example:
  npm run copilot -- \\
    --file ./contracts/acme-msa.pdf \\
    --counterparty "Acme Corp" \\
    --type msa \\
    --role developer \\
    --state Gujarat
`);
    process.exit(1);
  }

  const required = ["file", "counterparty", "type", "role", "state"];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Error: --${key} is required`);
      process.exit(1);
    }
  }

  await startCopilot({
    filePath: resolve(args["file"]!),
    counterparty: args["counterparty"]!,
    contractType: args["type"]!,
    ourRole: args["role"]!,
    state: args["state"]!,
    contractValue: args["value"] ? parseInt(args["value"], 10) : undefined,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
