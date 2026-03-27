#!/usr/bin/env tsx
// CLI entry point for one-shot property due diligence
// Usage: npm run analyze -- --rera-id <id> --address <addr> --builder <name> --type <type> --budget <amount> --state <state>

import "dotenv/config";
import { analyzeProperty, type ProgressEvent } from "./agent.js";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

function formatProgress(event: ProgressEvent): void {
  const time = new Date(event.timestamp).toLocaleTimeString("en-IN", { hour12: false });
  const prefix = `${colors.dim}[${time}]${colors.reset}`;

  switch (event.type) {
    case "init":
      console.log(`${prefix} ${colors.cyan}*${colors.reset} ${event.message}`);
      break;
    case "tool_call":
      console.log(
        `${prefix} ${colors.blue}>${colors.reset} ${colors.bold}${event.message}${colors.reset}${event.detail ? ` ${colors.dim}(${event.detail})${colors.reset}` : ""}`
      );
      break;
    case "streaming":
      console.log(`${prefix} ${colors.dim}  ${event.message}${colors.reset}`);
      break;
    case "done": {
      const duration = event.duration ? `${(event.duration / 1000).toFixed(1)}s` : "?";
      const cost = event.cost !== undefined ? `$${event.cost.toFixed(4)}` : "?";
      const turns = event.turnNumber ?? "?";
      console.log(
        `\n${prefix} ${colors.green}Done: ${event.message}${colors.reset} ${colors.dim}(${turns} turns, ${duration}, ${cost})${colors.reset}\n`
      );
      break;
    }
  }
}

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

  if (!args["address"]) {
    console.log(`
Real Estate Transaction Agent — Gujarat Property Due Diligence

Usage:
  npm run analyze -- --address <addr> --type <type> --budget <amount> --state <state> [options]

Required:
  --address       Property address (required)
  --type          Property type: residential_flat, commercial_office, plot, row_house, villa (required)
  --budget        Budget or expected price in INR (required)
  --state         Indian state, e.g. Gujarat (required)

Optional:
  --rera-id       RERA registration ID (recommended)
  --builder       Builder/developer name
  --state         Indian state (default: Gujarat)

Example:
  npm run analyze -- \\
    --rera-id "PR/GJ/SURAT/SURAT CITY/SUDA/RAA05003/R-1050" \\
    --address "Vesu, Surat" \\
    --builder "ABC Developers" \\
    --type residential_flat \\
    --budget 7500000 \\
    --state Gujarat
`);
    process.exit(1);
  }

  const required = ["address", "type", "budget", "state"];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Error: --${key} is required`);
      process.exit(1);
    }
  }

  const address = args["address"]!;
  const reraId = args["rera-id"];
  const builderName = args["builder"];
  const propertyType = args["type"]!;
  const budget = parseInt(args["budget"]!, 10);
  const state = args["state"]!;

  if (isNaN(budget)) {
    console.error("Error: --budget must be a number (INR amount)");
    process.exit(1);
  }

  console.log(`
+--------------------------------------------------------------+
|  Real Estate Transaction Agent                                |
|  Address: ${address.slice(0, 48).padEnd(48)}|
${reraId ? `|  RERA ID: ${reraId.slice(0, 48).padEnd(48)}|` : `|  RERA ID: not provided${" ".repeat(36)}|`}
${builderName ? `|  Builder: ${builderName.slice(0, 48).padEnd(48)}|` : `|  Builder: not provided${" ".repeat(36)}|`}
|  Type: ${propertyType.slice(0, 51).padEnd(51)}|
|  Budget: Rs ${budget.toLocaleString("en-IN").slice(0, 45).padEnd(45)}|
|  State: ${state.slice(0, 50).padEnd(50)}|
+--------------------------------------------------------------+
`);

  console.log("Running property due diligence...\n");

  try {
    const result = await analyzeProperty({
      reraId,
      address,
      builderName,
      propertyType,
      budget,
      state,
      onProgress: formatProgress,
    });

    console.log("\n" + "=".repeat(60));
    console.log(result);
  } catch (error) {
    console.error("Error during analysis:", error);
    process.exit(1);
  }
}

main();
