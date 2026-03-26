// contract-mcp: Contract repository and analysis storage
// In production, this would use PostgreSQL. For prototype, uses in-memory store.
// Designed for robustness — tools handle errors gracefully, auto-create records
// when needed, and don't require the agent to manage IDs manually.

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { resolve } from "path";

// In-memory store for prototype
interface StoredContract {
  id: string;
  title: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  status: string;
  createdAt: string;
  versions: StoredVersion[];
}

interface StoredVersion {
  id: string;
  versionNumber: number;
  label: string;
  documentPath: string;
  uploadedAt: string;
  analysis?: unknown;
}

const contracts = new Map<string, StoredContract>();

// Auto-create a contract if one doesn't exist (reduces multi-step friction)
function getOrCreateContract(
  title: string,
  counterparty: string,
  contractType: string,
  ourRole: string,
): StoredContract {
  // Check if a contract with the same title already exists
  for (const contract of contracts.values()) {
    if (contract.title === title) return contract;
  }

  const id = randomUUID().slice(0, 8);
  const contract: StoredContract = {
    id,
    title,
    counterparty,
    contractType,
    ourRole,
    status: "under_review",
    createdAt: new Date().toISOString(),
    versions: [],
  };
  contracts.set(id, contract);
  return contract;
}

const createContractTool = tool(
  "create_contract",
  "Register a new contract for review. Returns a contract ID for tracking. If a contract with the same title already exists, returns the existing one.",
  {
    title: z.string().describe("Contract title, e.g. 'Acme Corp MSA 2026'"),
    counterparty: z.string().describe("Name of the other party"),
    contract_type: z.string().describe("Type: msa, nda, employment, freelancer, lease, etc."),
    our_role: z.string().describe("Our role: vendor, client, employer, tenant, etc."),
  },
  async ({ title, counterparty, contract_type, our_role }) => {
    const contract = getOrCreateContract(title, counterparty, contract_type, our_role);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            contract_id: contract.id,
            status: contract.status,
            title: contract.title,
            is_new: contracts.size === 1 && contract.versions.length === 0,
          }),
        },
      ],
    };
  }
);

const addVersionTool = tool(
  "add_version",
  "Add a new version of a contract (e.g., after negotiation round). Does NOT require the full document text — just the file path and a label.",
  {
    contract_id: z.string().describe("Contract ID from create_contract"),
    document_path: z.string().describe("File path to original document"),
    label: z.string().describe("Version label: 'Received from counterparty', 'Post round 1 negotiation', etc."),
  },
  async ({ contract_id, document_path, label }) => {
    const contract = contracts.get(contract_id);
    if (!contract) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Contract '${contract_id}' not found. Available contracts: ${[...contracts.keys()].join(", ") || "none"}. Use create_contract first.`,
            }),
          },
        ],
      };
    }

    const versionNumber = contract.versions.length + 1;
    const version: StoredVersion = {
      id: randomUUID().slice(0, 8),
      versionNumber,
      label,
      documentPath: document_path,
      uploadedAt: new Date().toISOString(),
    };
    contract.versions.push(version);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            version_id: version.id,
            version_number: versionNumber,
            contract_id,
            label,
          }),
        },
      ],
    };
  }
);

const storeAnalysisTool = tool(
  "store_analysis",
  "Store the analysis results for a contract. Accepts the analysis as a plain text summary — does not require JSON. Automatically saves to the output directory as a markdown file.",
  {
    contract_id: z.string().describe("Contract ID"),
    risk_score: z.number().describe("Overall risk score 0-100"),
    risk_grade: z.string().describe("Risk grade: A, B, C, D, or F"),
    summary: z.string().describe("The full analysis text/report to store"),
  },
  async ({ contract_id, risk_score, risk_grade, summary }) => {
    const contract = contracts.get(contract_id);

    // Even if contract not found, still save the output file
    const outputDir = resolve("output");
    try {
      await mkdir(outputDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `analysis-${contract_id}-${timestamp}.md`;
    const filepath = resolve(outputDir, filename);

    const header = `# Contract Analysis Report
**Contract ID:** ${contract_id}
**Title:** ${contract?.title ?? "Unknown"}
**Counterparty:** ${contract?.counterparty ?? "Unknown"}
**Risk Score:** ${risk_score}/100 (Grade ${risk_grade})
**Analyzed:** ${new Date().toISOString()}

---

`;

    try {
      await writeFile(filepath, header + summary, "utf-8");
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              stored_in_memory: true,
              saved_to_file: false,
              error: `Could not save to file: ${err instanceof Error ? err.message : String(err)}`,
              contract_id,
              risk_score,
              risk_grade,
            }),
          },
        ],
      };
    }

    // Also store in memory if contract exists
    if (contract && contract.versions.length > 0) {
      const latestVersion = contract.versions[contract.versions.length - 1]!;
      latestVersion.analysis = { risk_score, risk_grade, summary_length: summary.length };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            stored_in_memory: !!contract,
            saved_to_file: true,
            file_path: filepath,
            contract_id,
            risk_score,
            risk_grade,
          }),
        },
      ],
    };
  }
);

const getPreviousAnalysisTool = tool(
  "get_previous_analysis",
  "Get the analysis from a previous version of the contract, for comparison during negotiation rounds.",
  {
    contract_id: z.string().describe("Contract ID"),
    version_number: z.number().describe("Version number to retrieve (1 = first version)"),
  },
  async ({ contract_id, version_number }) => {
    const contract = contracts.get(contract_id);
    if (!contract) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Contract '${contract_id}' not found. Available: ${[...contracts.keys()].join(", ") || "none"}`,
            }),
          },
        ],
      };
    }

    const version = contract.versions.find((v) => v.versionNumber === version_number);
    if (!version) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Version ${version_number} not found. Available versions: ${contract.versions.map((v) => v.versionNumber).join(", ") || "none"}`,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            contract_id,
            version_number,
            label: version.label,
            uploaded_at: version.uploadedAt,
            has_analysis: !!version.analysis,
            analysis: version.analysis ?? null,
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getContractTimelineTool = tool(
  "get_contract_timeline",
  "Get all versions and their analysis summaries for a contract, showing the negotiation timeline.",
  {
    contract_id: z.string().describe("Contract ID"),
  },
  async ({ contract_id }) => {
    const contract = contracts.get(contract_id);
    if (!contract) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Contract '${contract_id}' not found. Available: ${[...contracts.keys()].join(", ") || "none"}`,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            contract_id,
            title: contract.title,
            counterparty: contract.counterparty,
            status: contract.status,
            total_versions: contract.versions.length,
            versions: contract.versions.map((v) => ({
              version_number: v.versionNumber,
              label: v.label,
              uploaded_at: v.uploadedAt,
              has_analysis: !!v.analysis,
            })),
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

export const contractMcp = createSdkMcpServer({
  name: "contract-mcp",
  tools: [
    createContractTool,
    addVersionTool,
    storeAnalysisTool,
    getPreviousAnalysisTool,
    getContractTimelineTool,
  ],
});
