#!/usr/bin/env tsx
// CLI entry point for analyzing contracts
// Usage: npm run analyze -- --file <path> --counterparty <name> --type <type> --role <role> --state <state>

import "dotenv/config";
import { analyzeContract } from "./agent.js";
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
Legal/Contract Intelligence Agent — Indian Contract Review

Usage:
  npm run analyze -- --file <path> --counterparty <name> --type <type> --role <role> --state <state> [--value <amount>]

Options:
  --file          Path to the contract PDF or text file (required)
  --counterparty  Name of the other party (required)
  --type          Contract type: msa, nda, employment, freelancer, lease, sow, service_agreement (required)
  --role          Our role: vendor, client, employer, tenant, developer (required)
  --state         Indian state for stamp duty: Gujarat, Maharashtra, Delhi, Karnataka (required)
  --value         Contract value in INR (optional, for stamp duty calculation)

Example:
  npm run analyze -- \\
    --file ./contracts/acme-msa.pdf \\
    --counterparty "Acme Corp" \\
    --type msa \\
    --role developer \\
    --state Gujarat \\
    --value 6000000
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

  const filePath = resolve(args["file"]!);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Legal/Contract Intelligence Agent                          ║
║  Analyzing: ${args["file"]!.slice(0, 46).padEnd(46)}║
║  Counterparty: ${(args["counterparty"] ?? "").slice(0, 43).padEnd(43)}║
║  Type: ${(args["type"] ?? "").slice(0, 51).padEnd(51)}║
║  State: ${(args["state"] ?? "").slice(0, 50).padEnd(50)}║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log("Analyzing contract against Indian law...\n");

  try {
    const result = await analyzeContract({
      filePath,
      counterparty: args["counterparty"]!,
      contractType: args["type"]!,
      ourRole: args["role"]!,
      state: args["state"]!,
      contractValue: args["value"] ? parseInt(args["value"], 10) : undefined,
    });

    console.log(result);
  } catch (error) {
    console.error("Error analyzing contract:", error);
    process.exit(1);
  }
}

main();
