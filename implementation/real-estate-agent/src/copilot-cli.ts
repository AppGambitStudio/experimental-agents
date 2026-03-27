#!/usr/bin/env tsx
// Interactive Copilot CLI — conversational property verification
// Usage: npm run copilot -- --address <addr> --type <type> --budget <amount> --state <state>

import "dotenv/config";
import { startCopilot } from "./copilot.js";

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
Real Estate Transaction Copilot — Interactive Mode

Usage:
  npm run copilot -- --address <addr> --type <type> --budget <amount> --state <state> [options]

Required:
  --address       Property address (required)
  --type          Property type: residential_flat, commercial_office, plot, row_house, villa (required)
  --budget        Budget or expected price in INR (required)
  --state         Indian state, e.g. Gujarat (required)

Optional:
  --rera-id       RERA registration ID (recommended)
  --builder       Builder/developer name

Commands during session:
  summary         Get concise summary of all findings
  red-flags       Run full red flag check
  documents       Show document checklist with verification status
  quit            End the session

Example:
  npm run copilot -- \\
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

  const budget = parseInt(args["budget"]!, 10);
  if (isNaN(budget)) {
    console.error("Error: --budget must be a number (INR amount)");
    process.exit(1);
  }

  await startCopilot({
    reraId: args["rera-id"],
    address: args["address"]!,
    builderName: args["builder"],
    propertyType: args["type"]!,
    budget,
    state: args["state"]!,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
