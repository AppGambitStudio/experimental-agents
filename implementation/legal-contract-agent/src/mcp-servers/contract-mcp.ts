// contract-mcp: Contract repository and analysis storage
// In production, this would use PostgreSQL. For prototype, uses in-memory store.

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { randomUUID } from "crypto";

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
  documentText: string;
  documentPath: string;
  uploadedAt: string;
  analysis?: unknown;
}

const contracts = new Map<string, StoredContract>();

const createContractTool = tool(
  "create_contract",
  "Register a new contract for review. Returns a contract ID for tracking.",
  {
    title: z.string().describe("Contract title, e.g. 'Acme Corp MSA 2026'"),
    counterparty: z.string().describe("Name of the other party"),
    contract_type: z.string().describe("Type: msa, nda, employment, freelancer, lease, etc."),
    our_role: z.string().describe("Our role: vendor, client, employer, tenant, etc."),
  },
  async ({ title, counterparty, contract_type, our_role }) => {
    const id = randomUUID().slice(0, 8);
    const contract: StoredContract = {
      id,
      title,
      counterparty,
      contractType: contract_type,
      ourRole: our_role,
      status: "under_review",
      createdAt: new Date().toISOString(),
      versions: [],
    };
    contracts.set(id, contract);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ contract_id: id, status: "created", title }),
        },
      ],
    };
  }
);

const addVersionTool = tool(
  "add_version",
  "Add a new version of a contract (e.g., after negotiation round). Returns version ID and number.",
  {
    contract_id: z.string().describe("Contract ID from create_contract"),
    document_text: z.string().describe("Full extracted text of this version"),
    document_path: z.string().describe("File path to original document"),
    label: z.string().describe("Version label: 'Received from counterparty', 'Post round 1 negotiation', etc."),
  },
  async ({ contract_id, document_text, document_path, label }) => {
    const contract = contracts.get(contract_id);
    if (!contract) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Contract not found" }) },
        ],
      };
    }

    const versionNumber = contract.versions.length + 1;
    const version: StoredVersion = {
      id: randomUUID().slice(0, 8),
      versionNumber,
      label,
      documentText: document_text,
      documentPath: document_path,
      uploadedAt: new Date().toISOString(),
    };
    contract.versions.push(version);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
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
  "Store the analysis results for a specific contract version.",
  {
    contract_id: z.string().describe("Contract ID"),
    version_number: z.number().describe("Version number to store analysis for"),
    analysis: z.string().describe("JSON string of the full analysis result"),
  },
  async ({ contract_id, version_number, analysis }) => {
    const contract = contracts.get(contract_id);
    if (!contract) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Contract not found" }) },
        ],
      };
    }

    const version = contract.versions.find(
      (v) => v.versionNumber === version_number
    );
    if (!version) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: `Version ${version_number} not found` }) },
        ],
      };
    }

    version.analysis = JSON.parse(analysis);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            stored: true,
            contract_id,
            version_number,
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
    version_number: z.number().describe("Version number to retrieve"),
  },
  async ({ contract_id, version_number }) => {
    const contract = contracts.get(contract_id);
    if (!contract) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Contract not found" }) },
        ],
      };
    }

    const version = contract.versions.find(
      (v) => v.versionNumber === version_number
    );
    if (!version) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: `Version ${version_number} not found` }) },
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
          { type: "text" as const, text: JSON.stringify({ error: "Contract not found" }) },
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
