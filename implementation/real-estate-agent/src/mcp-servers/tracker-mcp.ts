// tracker-mcp: Purchase tracking and verification log
// In production, this would use PostgreSQL. For prototype, uses in-memory store
// with JSON file persistence for verification logs.

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { randomUUID } from "crypto";
import { writeFile, mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import type { Purchase, VerificationEntry, PurchasePhase } from "../types/index.js";

// In-memory store for prototype
const purchases = new Map<string, Purchase>();

const createPurchaseTool = tool(
  "create_purchase",
  "Register a new property purchase for tracking. Returns a purchase ID. If a purchase with the same RERA ID already exists, returns the existing one.",
  {
    address: z.string().describe("Property address"),
    rera_id: z.string().optional().describe("RERA registration ID, if known"),
    builder_name: z.string().optional().describe("Builder/developer name"),
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
    budget: z.number().describe("Budget or expected price in INR"),
    state: z.string().describe("Indian state, e.g. Gujarat"),
  },
  async ({ address, rera_id, builder_name, property_type, budget, state }) => {
    // Check if a purchase with the same RERA ID already exists
    if (rera_id) {
      for (const purchase of purchases.values()) {
        if (purchase.reraId === rera_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  purchase_id: purchase.id,
                  status: "existing",
                  phase: purchase.phase,
                  address: purchase.address,
                }),
              },
            ],
          };
        }
      }
    }

    const id = randomUUID().slice(0, 8);
    const purchase: Purchase = {
      id,
      address,
      reraId: rera_id,
      builderName: builder_name,
      propertyType: property_type,
      budget,
      state,
      phase: "due_diligence",
      createdAt: new Date().toISOString(),
      verifications: [],
    };
    purchases.set(id, purchase);

    // Ensure output directory exists
    const outputDir = resolve("output", id);
    try {
      await mkdir(outputDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            purchase_id: id,
            status: "created",
            phase: purchase.phase,
            address: purchase.address,
            rera_id: purchase.reraId ?? null,
            builder_name: purchase.builderName ?? null,
            property_type: purchase.propertyType,
            budget: purchase.budget,
            state: purchase.state,
          }),
        },
      ],
    };
  }
);

const logVerificationTool = tool(
  "log_verification",
  "Append a verification entry to a purchase's log. APPEND-ONLY — entries are never deleted. Also persists to output/{purchase_id}/verification-log.json.",
  {
    purchase_id: z.string().describe("Purchase ID from create_purchase"),
    portal: z.string().describe("Portal or source name, e.g. 'GujRERA', 'IGR Gujarat', 'DILR'"),
    action: z.string().describe("Action performed, e.g. 'search_project', 'verify_title'"),
    query: z.string().describe("Search query or parameters used"),
    result: z.string().describe("Result summary from the portal"),
    status: z
      .enum(["verified", "unverified", "failed", "partial", "not_checked"])
      .describe("Verification status"),
    screenshot_path: z.string().optional().describe("Path to screenshot, if captured"),
    notes: z.string().optional().describe("Additional notes or observations"),
  },
  async ({ purchase_id, portal, action, query, result, status, screenshot_path, notes }) => {
    const purchase = purchases.get(purchase_id);
    if (!purchase) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Purchase '${purchase_id}' not found. Available: ${[...purchases.keys()].join(", ") || "none"}. Use create_purchase first.`,
            }),
          },
        ],
      };
    }

    const entry: VerificationEntry = {
      id: randomUUID().slice(0, 8),
      purchaseId: purchase_id,
      timestamp: new Date().toISOString(),
      portal,
      action,
      query,
      result,
      status,
      screenshotPath: screenshot_path,
      notes,
    };

    // Append to in-memory store (never delete)
    purchase.verifications.push(entry);

    // Persist to JSON file
    const outputDir = resolve("output", purchase_id);
    const logPath = resolve(outputDir, "verification-log.json");
    try {
      await mkdir(outputDir, { recursive: true });

      // Read existing log if present, append new entry
      let existingLog: VerificationEntry[] = [];
      try {
        const existing = await readFile(logPath, "utf-8");
        existingLog = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }
      existingLog.push(entry);
      await writeFile(logPath, JSON.stringify(existingLog, null, 2), "utf-8");
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              logged_in_memory: true,
              saved_to_file: false,
              error: `Could not save to file: ${err instanceof Error ? err.message : String(err)}`,
              entry_id: entry.id,
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
            success: true,
            entry_id: entry.id,
            purchase_id,
            portal,
            action,
            status,
            total_verifications: purchase.verifications.length,
            saved_to_file: true,
            file_path: logPath,
          }),
        },
      ],
    };
  }
);

const getVerificationLogTool = tool(
  "get_verification_log",
  "Get all verification entries for a purchase, in chronological order.",
  {
    purchase_id: z.string().describe("Purchase ID"),
  },
  async ({ purchase_id }) => {
    const purchase = purchases.get(purchase_id);
    if (!purchase) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Purchase '${purchase_id}' not found. Available: ${[...purchases.keys()].join(", ") || "none"}`,
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
            purchase_id,
            address: purchase.address,
            phase: purchase.phase,
            total_entries: purchase.verifications.length,
            entries: purchase.verifications.map((v) => ({
              id: v.id,
              timestamp: v.timestamp,
              portal: v.portal,
              action: v.action,
              query: v.query,
              result: v.result,
              status: v.status,
              notes: v.notes ?? null,
            })),
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const updatePhaseTool = tool(
  "update_phase",
  "Update the current phase of a property purchase. Phases progress: due_diligence -> document_review -> financial_analysis -> registration -> post_purchase.",
  {
    purchase_id: z.string().describe("Purchase ID"),
    phase: z
      .enum(["due_diligence", "document_review", "financial_analysis", "registration", "post_purchase"])
      .describe("New phase"),
  },
  async ({ purchase_id, phase }) => {
    const purchase = purchases.get(purchase_id);
    if (!purchase) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Purchase '${purchase_id}' not found. Available: ${[...purchases.keys()].join(", ") || "none"}`,
            }),
          },
        ],
      };
    }

    const previousPhase = purchase.phase;
    purchase.phase = phase as PurchasePhase;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            purchase_id,
            previous_phase: previousPhase,
            current_phase: purchase.phase,
            address: purchase.address,
          }),
        },
      ],
    };
  }
);

const getPurchaseSummaryTool = tool(
  "get_purchase_summary",
  "Get purchase details including verification count and current phase.",
  {
    purchase_id: z.string().describe("Purchase ID"),
  },
  async ({ purchase_id }) => {
    const purchase = purchases.get(purchase_id);
    if (!purchase) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Purchase '${purchase_id}' not found. Available: ${[...purchases.keys()].join(", ") || "none"}`,
            }),
          },
        ],
      };
    }

    const statusCounts = purchase.verifications.reduce(
      (acc, v) => {
        acc[v.status] = (acc[v.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            purchase_id,
            address: purchase.address,
            rera_id: purchase.reraId ?? null,
            builder_name: purchase.builderName ?? null,
            property_type: purchase.propertyType,
            budget: purchase.budget,
            state: purchase.state,
            phase: purchase.phase,
            created_at: purchase.createdAt,
            total_verifications: purchase.verifications.length,
            verification_status_counts: statusCounts,
            portals_checked: [...new Set(purchase.verifications.map((v) => v.portal))],
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

export const trackerMcp = createSdkMcpServer({
  name: "tracker-mcp",
  tools: [
    createPurchaseTool,
    logVerificationTool,
    getVerificationLogTool,
    updatePhaseTool,
    getPurchaseSummaryTool,
  ],
});
