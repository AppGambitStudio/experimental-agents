// Purchase Dossier — Compiles all verification results into a structured report
// Reads verification logs and generates a markdown summary document

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ensureOutputDir } from "./portals/base-portal.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DossierEntry {
  timestamp: string;
  portal: string;
  action: string;
  result: "verified" | "failed" | "partial" | "unavailable";
  data: Record<string, unknown>;
  screenshotPaths: string[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Generate a dossier summary from the verification log for a purchase.
 *
 * Reads output/{purchaseId}/verification-log.json, compiles findings,
 * generates a markdown summary, and saves it to output/{purchaseId}/dossier-summary.md.
 *
 * Returns the markdown content.
 */
export async function generateDossierSummary(
  purchaseId: string,
  verificationLog: DossierEntry[]
): Promise<string> {
  const outputDir = resolve("output", purchaseId);
  const logPath = resolve(outputDir, "verification-log.json");

  // Use provided log or read from file
  let entries = verificationLog;
  if ((!entries || entries.length === 0) && existsSync(logPath)) {
    try {
      const raw = readFileSync(logPath, "utf-8");
      entries = JSON.parse(raw) as DossierEntry[];
    } catch {
      entries = [];
    }
  }

  const now = new Date().toISOString();
  const portalsChecked = [...new Set(entries.map((e) => e.portal))];
  const allScreenshots = entries.flatMap((e) => e.screenshotPaths);

  // --- Build summary sections ---

  const header = buildHeader(purchaseId, now, portalsChecked, entries);
  const matrix = buildCrossPortalMatrix(entries);
  const portalFindings = buildPortalFindings(entries);
  const evidence = buildEvidenceInventory(allScreenshots, entries);
  const overallStatus = computeOverallStatus(entries);
  const redFlags = detectRedFlags(entries);

  const markdown = [
    header,
    "",
    "---",
    "",
    matrix,
    "",
    "---",
    "",
    portalFindings,
    "",
    "---",
    "",
    evidence,
    "",
    "---",
    "",
    overallStatus,
    "",
    "---",
    "",
    redFlags,
    "",
    "---",
    "",
    "*This dossier is AI-assisted and does not substitute for professional due diligence by a property lawyer and chartered surveyor.*",
  ].join("\n");

  // Save to file
  ensureOutputDir(purchaseId, "");
  const dossierPath = resolve(outputDir, "dossier-summary.md");
  writeFileSync(dossierPath, markdown, "utf-8");

  // Also save the verification log if it doesn't exist
  if (!existsSync(logPath) && entries.length > 0) {
    writeFileSync(logPath, JSON.stringify(entries, null, 2), "utf-8");
  }

  return markdown;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildHeader(
  purchaseId: string,
  date: string,
  portals: string[],
  entries: DossierEntry[]
): string {
  const propertyData = entries.find((e) => e.portal === "gujrera")?.data ?? {};
  const projectName = (propertyData.projectName as string) ?? "Unknown Project";
  const address = (propertyData.projectAddress as string) ?? (propertyData.address as string) ?? "Not available";

  return [
    `# Property Purchase Dossier`,
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Purchase ID** | \`${purchaseId}\` |`,
    `| **Date Generated** | ${date} |`,
    `| **Project Name** | ${projectName} |`,
    `| **Address** | ${address} |`,
    `| **Portals Checked** | ${portals.join(", ") || "None"} |`,
    `| **Total Verifications** | ${entries.length} |`,
  ].join("\n");
}

function buildCrossPortalMatrix(entries: DossierEntry[]): string {
  const lines: string[] = [
    "## Cross-Portal Verification Matrix",
    "",
    "Checks whether key details (seller/promoter name, property address, survey number) are consistent across portals.",
    "",
  ];

  // Extract names from each portal
  const namesByPortal: Record<string, string[]> = {};
  for (const entry of entries) {
    const data = entry.data ?? {};
    const names: string[] = [];
    for (const key of ["promoterName", "owner_name", "party_name", "sellerName", "builderName"]) {
      if (typeof data[key] === "string" && (data[key] as string).length > 0) {
        names.push(data[key] as string);
      }
    }
    if (names.length > 0) {
      namesByPortal[entry.portal] = names;
    }
  }

  const portalNames = Object.keys(namesByPortal);
  if (portalNames.length < 2) {
    lines.push("*Insufficient cross-portal data for comparison. Only checked: " + (portalNames.join(", ") || "none") + "*");
  } else {
    lines.push("| Portal | Names Found | Consistent? |");
    lines.push("|--------|-------------|-------------|");

    const allNames = Object.values(namesByPortal).flat().map((n) => n.toLowerCase().trim());
    const firstNameNorm = allNames[0] ?? "";

    for (const [portal, names] of Object.entries(namesByPortal)) {
      const consistent = names.some(
        (n) =>
          n.toLowerCase().trim() === firstNameNorm ||
          firstNameNorm.includes(n.toLowerCase().trim()) ||
          n.toLowerCase().trim().includes(firstNameNorm)
      );
      lines.push(
        `| ${portal} | ${names.join(", ")} | ${consistent ? "Yes" : "**MISMATCH**"} |`
      );
    }
  }

  return lines.join("\n");
}

function buildPortalFindings(entries: DossierEntry[]): string {
  const lines: string[] = ["## Per-Portal Findings", ""];

  const portalGroups: Record<string, DossierEntry[]> = {};
  for (const entry of entries) {
    if (!portalGroups[entry.portal]) portalGroups[entry.portal] = [];
    portalGroups[entry.portal]!.push(entry);
  }

  const portalDisplayNames: Record<string, string> = {
    gujrera: "Gujarat RERA Portal",
    ecourts: "eCourts (Litigation Check)",
    anyror: "AnyRoR (Land Records)",
    garvi: "GARVI (Document Registration / Jantri)",
    "smc-tax": "SMC Property Tax",
    gstn: "GST Network (Builder Verification)",
  };

  for (const [portal, portalEntries] of Object.entries(portalGroups)) {
    const displayName = portalDisplayNames[portal] ?? portal;
    const verified = portalEntries.filter((e) => e.result === "verified").length;
    const failed = portalEntries.filter((e) => e.result === "failed").length;
    const partial = portalEntries.filter((e) => e.result === "partial").length;
    const unavailable = portalEntries.filter((e) => e.result === "unavailable").length;

    lines.push(`### ${displayName}`);
    lines.push("");
    lines.push(`- **Checks performed:** ${portalEntries.length}`);
    lines.push(`- **Verified:** ${verified} | **Failed:** ${failed} | **Partial:** ${partial} | **Unavailable:** ${unavailable}`);
    lines.push("");

    for (const entry of portalEntries) {
      const icon =
        entry.result === "verified" ? "[PASS]" :
        entry.result === "failed" ? "[FAIL]" :
        entry.result === "partial" ? "[PARTIAL]" :
        "[N/A]";
      lines.push(`- ${icon} **${entry.action}** (${entry.timestamp})`);

      // Add key data points
      const data = entry.data ?? {};
      const relevantKeys = Object.keys(data).filter(
        (k) => !["rawText", "pageText", "screenshots"].includes(k) && data[k] != null
      );
      if (relevantKeys.length > 0) {
        for (const key of relevantKeys.slice(0, 8)) {
          const value = data[key];
          const display = typeof value === "object" ? JSON.stringify(value) : String(value);
          if (display.length < 200) {
            lines.push(`  - ${key}: ${display}`);
          }
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildEvidenceInventory(
  allScreenshots: string[],
  entries: DossierEntry[]
): string {
  const lines: string[] = ["## Evidence Inventory", ""];

  if (allScreenshots.length === 0) {
    lines.push("*No screenshots captured during this verification session.*");
    return lines.join("\n");
  }

  lines.push(`Total screenshots: **${allScreenshots.length}**`);
  lines.push("");
  lines.push("| # | Portal | Action | Timestamp | Screenshot Path |");
  lines.push("|---|--------|--------|-----------|-----------------|");

  let idx = 1;
  for (const entry of entries) {
    for (const path of entry.screenshotPaths) {
      lines.push(
        `| ${idx} | ${entry.portal} | ${entry.action} | ${entry.timestamp} | \`${path}\` |`
      );
      idx++;
    }
  }

  return lines.join("\n");
}

function computeOverallStatus(entries: DossierEntry[]): string {
  const lines: string[] = ["## Overall Verification Status", ""];

  if (entries.length === 0) {
    lines.push("**Status: INCOMPLETE** — No verifications were performed.");
    return lines.join("\n");
  }

  const verified = entries.filter((e) => e.result === "verified").length;
  const failed = entries.filter((e) => e.result === "failed").length;
  const unavailable = entries.filter((e) => e.result === "unavailable").length;
  const total = entries.length;

  let status: string;
  let recommendation: string;

  if (failed > 0) {
    status = "STOP";
    recommendation =
      "One or more verifications FAILED. Do NOT proceed with this purchase until the failed checks are resolved. Consult a property lawyer immediately.";
  } else if (unavailable > total / 2) {
    status = "CAUTION";
    recommendation =
      "More than half of the portal checks were unavailable. Verification is incomplete. Retry when portals are available or verify manually.";
  } else if (verified === total) {
    status = "CLEAR";
    recommendation =
      "All verifications passed. Proceed with standard due diligence steps (lawyer review, site visit, document collection).";
  } else {
    status = "REVIEW";
    recommendation =
      "Some verifications returned partial or unavailable results. Review the specific findings above and consider manual verification for incomplete checks.";
  }

  lines.push(`**Status: ${status}**`);
  lines.push("");
  lines.push(`**Recommendation:** ${recommendation}`);
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Verified | ${verified} / ${total} |`);
  lines.push(`| Failed | ${failed} / ${total} |`);
  lines.push(`| Unavailable | ${unavailable} / ${total} |`);

  return lines.join("\n");
}

function detectRedFlags(entries: DossierEntry[]): string {
  const lines: string[] = ["## Red Flags Detected", ""];
  const flags: string[] = [];

  for (const entry of entries) {
    const data = entry.data ?? {};

    // Failed verification is always a red flag
    if (entry.result === "failed") {
      flags.push(
        `**[CRITICAL]** ${entry.portal} — ${entry.action}: Verification failed. This could indicate fraudulent or invalid information.`
      );
    }

    // RERA-specific flags
    if (entry.portal === "gujrera") {
      if (data.found === false) {
        flags.push(
          "**[CRITICAL]** Project NOT found on Gujarat RERA portal. The project may be unregistered — this is illegal for projects with >500 sqm or >8 units."
        );
      }
      if (data.quarterlyDefaulted && data.quarterlyDefaulted !== "No" && data.quarterlyDefaulted !== "0") {
        flags.push(
          "**[HIGH]** Builder has defaulted on quarterly compliance reporting to RERA. This suggests poor project governance."
        );
      }
    }

    // eCourts flags
    if (entry.portal === "ecourts") {
      if (data.captcha_required) {
        flags.push(
          "**[MEDIUM]** eCourts verification incomplete due to CAPTCHA. Litigation status could not be verified automatically."
        );
      }
      if (typeof data.caseCount === "number" && data.caseCount > 0) {
        flags.push(
          `**[HIGH]** ${data.caseCount} court case(s) found involving the party. Review case details for property-related disputes.`
        );
      }
    }

    // AnyRoR flags
    if (entry.portal === "anyror" && data.portal_unavailable) {
      flags.push(
        "**[MEDIUM]** AnyRoR land record verification incomplete — portal unavailable. Land ownership could not be independently verified."
      );
    }

    // SMC tax flags
    if (entry.portal === "smc-tax") {
      const text = String(data.rawText ?? "").toLowerCase();
      if (text.includes("outstanding") || text.includes("due") || text.includes("unpaid")) {
        flags.push(
          "**[HIGH]** Property tax appears to have outstanding dues. Unpaid property tax can block registration and create legal complications."
        );
      }
    }

    // GSTN flags
    if (entry.portal === "gstn") {
      const text = String(data.rawText ?? "").toLowerCase();
      if (text.includes("cancelled") || text.includes("suspended") || text.includes("inactive")) {
        flags.push(
          "**[CRITICAL]** Builder's GST registration appears cancelled/suspended. This is a major red flag — the builder may not be a legitimate business."
        );
      }
    }

    // Cross-portal name mismatch (detected via data)
    if (data.nameMismatch === true) {
      flags.push(
        "**[HIGH]** Name mismatch detected across portals. The seller/promoter name differs between government records. Verify identity carefully."
      );
    }
  }

  if (flags.length === 0) {
    lines.push("*No red flags detected based on available verification data.*");
  } else {
    for (const flag of flags) {
      lines.push(`- ${flag}`);
    }
  }

  return lines.join("\n");
}
