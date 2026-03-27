// Reflection / Critic Agent — "Senior Property Lawyer" review
// Reviews due diligence findings for consistency, completeness, and accuracy
// before presenting to the buyer. Implements the Generate-Critique-Refine pattern.

import type {
  VerificationEntry,
  VerificationStatus,
  RiskLevel,
  PurchasePhase,
} from "../types/index.js";

// --- Types ---

export type CriticVerdict = "APPROVED" | "REVISE";

export type IssueCategory =
  | "cross_portal_inconsistency"
  | "coverage_gap"
  | "unsupported_claim"
  | "risk_rating_mismatch"
  | "financial_incomplete"
  | "missing_disclaimer"
  | "stale_data"
  | "logical_contradiction";

export type IssueSeverity = "critical" | "major" | "minor";

export interface CriticIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  finding: string;
  evidence: string;
  suggestedFix: string;
}

export interface CriticReview {
  verdict: CriticVerdict;
  reviewedAt: string;
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  issues: CriticIssue[];
  coverageScore: number; // 0-100, percentage of portals successfully checked
  consistencyScore: number; // 0-100, cross-portal name/data match rate
  completenessScore: number; // 0-100, required sections present
  overallQuality: number; // 0-100, weighted average
  summary: string; // Human-readable summary for the agent
}

// --- Portal Coverage ---

const REQUIRED_PORTALS = [
  "GujRERA",
  "eCourts",
  "AnyRoR",
  "GARVI",
  "SMC",
  "GSTN",
] as const;

const REQUIRED_REPORT_SECTIONS = [
  "property_overview",
  "rera_verification",
  "litigation_check",
  "land_records",
  "financial_analysis",
  "risk_rating",
  "disclaimer",
] as const;

// --- Core Review Functions ---

/**
 * Analyze portal coverage — what was checked vs what should have been checked
 */
export function reviewCoverage(
  verifications: VerificationEntry[]
): {
  score: number;
  checked: string[];
  notChecked: string[];
  failed: string[];
  issues: CriticIssue[];
} {
  const checked: string[] = [];
  const notChecked: string[] = [];
  const failed: string[] = [];
  const issues: CriticIssue[] = [];

  for (const portal of REQUIRED_PORTALS) {
    const entries = verifications.filter(
      (v) => v.portal.toLowerCase() === portal.toLowerCase()
    );

    if (entries.length === 0) {
      notChecked.push(portal);
    } else {
      const latestStatus = entries[entries.length - 1].status;
      if (latestStatus === "verified" || latestStatus === "partial") {
        checked.push(portal);
      } else if (latestStatus === "failed" || latestStatus === "not_checked") {
        failed.push(portal);
      } else {
        notChecked.push(portal);
      }
    }
  }

  const score = Math.round((checked.length / REQUIRED_PORTALS.length) * 100);

  // Generate issues for gaps
  if (notChecked.length > 0) {
    issues.push({
      id: `cov_not_checked`,
      category: "coverage_gap",
      severity: notChecked.length >= 3 ? "critical" : "major",
      finding: `${notChecked.length} of ${REQUIRED_PORTALS.length} portals were not checked: ${notChecked.join(", ")}`,
      evidence: `Required portals: ${REQUIRED_PORTALS.join(", ")}. Checked: ${checked.join(", ") || "none"}`,
      suggestedFix: `Run verification on missing portals: ${notChecked.join(", ")}. If portals are unavailable, explicitly state this in the report with the reason.`,
    });
  }

  if (failed.length > 0) {
    issues.push({
      id: `cov_failed`,
      category: "coverage_gap",
      severity: "major",
      finding: `${failed.length} portal check(s) failed: ${failed.join(", ")}`,
      evidence: `Failed portals should be noted in the report with reason (CAPTCHA, timeout, portal down).`,
      suggestedFix: `Include each failed portal in the report with the failure reason. Ensure the risk rating accounts for these gaps — do NOT rate "CLEAR" with failed checks.`,
    });
  }

  return { score, checked, notChecked, failed, issues };
}

/**
 * Check cross-portal consistency — do names and details match across sources?
 */
export function reviewConsistency(
  verifications: VerificationEntry[]
): {
  score: number;
  issues: CriticIssue[];
} {
  const issues: CriticIssue[] = [];
  const namesByPortal: Record<string, string[]> = {};

  // Extract names mentioned in each portal's results
  for (const v of verifications) {
    if (v.status !== "verified" && v.status !== "partial") continue;
    const result = v.result.toLowerCase();

    // Extract names from results (simplified — in production, use NER)
    const portal = v.portal;
    if (!namesByPortal[portal]) namesByPortal[portal] = [];

    // Look for common name patterns in result text
    const namePatterns = [
      /(?:builder|promoter|developer|owner|seller)[\s:]+([A-Z][a-z]+ (?:[A-Z][a-z]+ ?)+)/gi,
      /(?:name|proprietor|firm)[\s:]+([A-Z][a-z]+ (?:[A-Z][a-z]+ ?)+)/gi,
    ];

    for (const pattern of namePatterns) {
      const matches = v.result.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          namesByPortal[portal].push(match[1].trim());
        }
      }
    }
  }

  // Check for name mismatches across portals
  const portalNames = Object.entries(namesByPortal);
  if (portalNames.length >= 2) {
    const allNames = new Set<string>();
    for (const [, names] of portalNames) {
      for (const name of names) {
        allNames.add(name.toLowerCase());
      }
    }

    // If we found names in multiple portals, check for inconsistencies
    if (allNames.size > 1) {
      // Check if names across portals are substantially different
      const nameList = Array.from(allNames);
      const potentialMismatches: string[] = [];

      for (let i = 0; i < nameList.length; i++) {
        for (let j = i + 1; j < nameList.length; j++) {
          const similarity = calculateNameSimilarity(nameList[i], nameList[j]);
          if (similarity < 0.6 && similarity > 0.1) {
            potentialMismatches.push(`"${nameList[i]}" vs "${nameList[j]}"`);
          }
        }
      }

      if (potentialMismatches.length > 0) {
        issues.push({
          id: "cons_name_mismatch",
          category: "cross_portal_inconsistency",
          severity: "critical",
          finding: `Name mismatch detected across portals: ${potentialMismatches.join("; ")}`,
          evidence: `Portals with names: ${portalNames.map(([p, n]) => `${p}: [${n.join(", ")}]`).join(" | ")}`,
          suggestedFix: `Cross-verify the entity names. Name mismatches can indicate: (1) different entities, (2) spelling variations, or (3) title vs individual name differences. Flag this to the buyer with both names.`,
        });
      }
    }
  }

  // Check for date inconsistencies
  const dates: Record<string, string[]> = {};
  for (const v of verifications) {
    if (v.status !== "verified") continue;
    const dateMatches = v.result.match(/\d{2}[\/-]\d{2}[\/-]\d{4}/g);
    if (dateMatches) {
      if (!dates[v.portal]) dates[v.portal] = [];
      dates[v.portal].push(...dateMatches);
    }
  }

  // Score: 100 if no issues, reduce by severity
  const score = Math.max(
    0,
    100 -
      issues.filter((i) => i.severity === "critical").length * 40 -
      issues.filter((i) => i.severity === "major").length * 20 -
      issues.filter((i) => i.severity === "minor").length * 5
  );

  return { score, issues };
}

/**
 * Review report completeness — are all required sections present?
 */
export function reviewCompleteness(
  reportContent: string,
  phase: PurchasePhase,
  verifications: VerificationEntry[]
): {
  score: number;
  issues: CriticIssue[];
} {
  const issues: CriticIssue[] = [];
  const content = reportContent.toLowerCase();
  const sectionsFound: string[] = [];
  const sectionsMissing: string[] = [];

  const sectionKeywords: Record<string, string[]> = {
    property_overview: ["property", "address", "type", "builder"],
    rera_verification: ["rera", "registration", "gujrera"],
    litigation_check: ["ecourt", "litigation", "dispute", "case"],
    land_records: ["anyror", "land record", "7/12", "ownership"],
    financial_analysis: ["stamp duty", "total cost", "jantri", "budget"],
    risk_rating: ["risk", "clear", "caution", "review", "stop"],
    disclaimer: [
      "disclaimer",
      "cannot verify",
      "limitation",
      "not a substitute",
    ],
  };

  for (const section of REQUIRED_REPORT_SECTIONS) {
    const keywords = sectionKeywords[section];
    const found = keywords.some((kw) => content.includes(kw));
    if (found) {
      sectionsFound.push(section);
    } else {
      sectionsMissing.push(section);
    }
  }

  if (sectionsMissing.length > 0) {
    const isCritical = sectionsMissing.includes("disclaimer") || sectionsMissing.includes("risk_rating");
    issues.push({
      id: `comp_missing_sections`,
      category: "missing_disclaimer",
      severity: isCritical ? "critical" : "major",
      finding: `Report is missing ${sectionsMissing.length} required section(s): ${sectionsMissing.join(", ")}`,
      evidence: `Found: ${sectionsFound.join(", ")}. Missing: ${sectionsMissing.join(", ")}`,
      suggestedFix: `Add the missing sections. ${sectionsMissing.includes("disclaimer") ? "CRITICAL: The disclaimer/limitations section is MANDATORY." : ""} ${sectionsMissing.includes("risk_rating") ? "CRITICAL: Every report MUST include an overall risk rating." : ""}`,
    });
  }

  // Check for unsupported claims — risk rating without sufficient evidence
  const hasRiskRating = content.includes("clear") || content.includes("low risk");
  const verifiedCount = verifications.filter((v) => v.status === "verified").length;
  const totalChecks = verifications.length;

  if (hasRiskRating && verifiedCount < 3) {
    issues.push({
      id: "comp_insufficient_evidence",
      category: "risk_rating_mismatch",
      severity: "critical",
      finding: `Report gives a positive risk rating but only ${verifiedCount} of ${totalChecks} verifications succeeded`,
      evidence: `Minimum 3 verified portal checks recommended before any positive risk assessment. Current: ${verifiedCount} verified.`,
      suggestedFix: `Either complete more verifications or change the risk rating to "REVIEW" or "INCOMPLETE" with an explanation of what couldn't be checked.`,
    });
  }

  // Check for financial completeness
  if (phase === "financial_analysis" || phase === "registration") {
    const hasStampDuty = content.includes("stamp duty");
    const hasRegistration = content.includes("registration");
    const hasTotalCost = content.includes("total cost") || content.includes("total outflow");

    if (!hasStampDuty || !hasTotalCost) {
      issues.push({
        id: "comp_financial_gap",
        category: "financial_incomplete",
        severity: "major",
        finding: `Financial analysis incomplete: ${!hasStampDuty ? "stamp duty not calculated" : ""} ${!hasTotalCost ? "total cost breakdown missing" : ""}`.trim(),
        evidence: `Phase "${phase}" requires complete financial analysis including stamp duty, registration fees, and total cost breakdown.`,
        suggestedFix: `Use calculate_stamp_duty and calculate_total_cost tools to provide complete financial picture.`,
      });
    }
  }

  const score = Math.round(
    (sectionsFound.length / REQUIRED_REPORT_SECTIONS.length) * 100
  );

  return { score, issues };
}

/**
 * Detect potential hallucinations — claims without tool call evidence
 */
export function reviewForHallucinations(
  reportContent: string,
  verifications: VerificationEntry[]
): {
  issues: CriticIssue[];
} {
  const issues: CriticIssue[] = [];
  const content = reportContent.toLowerCase();

  // Patterns that suggest specific data claims
  const dataClaimPatterns = [
    { pattern: /rera\s+(?:id|number|registration)[\s:]+([A-Z0-9\-\/]+)/gi, portal: "GujRERA", type: "RERA ID" },
    { pattern: /(\d+)\s+complaints?\s+(?:filed|found|registered)/gi, portal: "GujRERA", type: "complaint count" },
    { pattern: /survey\s+(?:no|number)[\s.:]+(\d+)/gi, portal: "AnyRoR", type: "survey number" },
    { pattern: /case\s+(?:no|number)[\s.:]+([A-Z0-9\/\-]+)/gi, portal: "eCourts", type: "case number" },
    { pattern: /gstin[\s:]+([A-Z0-9]+)/gi, portal: "GSTN", type: "GSTIN" },
  ];

  const checkedPortals = new Set(
    verifications
      .filter((v) => v.status === "verified" || v.status === "partial")
      .map((v) => v.portal.toLowerCase())
  );

  for (const { pattern, portal, type } of dataClaimPatterns) {
    const matches = reportContent.matchAll(pattern);
    for (const match of matches) {
      if (!checkedPortals.has(portal.toLowerCase())) {
        issues.push({
          id: `hall_${type.replace(/\s/g, "_")}_${portal}`,
          category: "unsupported_claim",
          severity: "critical",
          finding: `Report claims ${type} "${match[1]}" but ${portal} was never successfully checked`,
          evidence: `Checked portals: ${Array.from(checkedPortals).join(", ") || "none"}. ${portal} status: not verified.`,
          suggestedFix: `Remove this claim or mark it as "unverified". If the data came from another source, cite that source explicitly.`,
        });
      }
    }
  }

  // Check for overly confident negative findings on unchecked portals
  const negativePatterns = [
    { text: "no litigation found", portal: "eCourts" },
    { text: "no disputes found", portal: "eCourts" },
    { text: "no cases found", portal: "eCourts" },
    { text: "no encumbrance", portal: "AnyRoR" },
    { text: "clear title", portal: "AnyRoR" },
    { text: "tax payments are current", portal: "SMC" },
    { text: "tax is up to date", portal: "SMC" },
  ];

  for (const { text, portal } of negativePatterns) {
    if (content.includes(text) && !checkedPortals.has(portal.toLowerCase())) {
      issues.push({
        id: `hall_false_negative_${portal}`,
        category: "unsupported_claim",
        severity: "critical",
        finding: `Report states "${text}" but ${portal} was not successfully verified`,
        evidence: `This is a dangerous hallucination — claiming absence of issues without checking the relevant portal.`,
        suggestedFix: `Replace with: "Could not verify — ${portal} was not accessible. Manual verification recommended."`,
      });
    }
  }

  return { issues };
}

// --- Main Review Function ---

/**
 * Run a complete critic review on the due diligence report.
 * Returns a structured review with verdict, scores, and issues.
 */
export function runCriticReview(
  reportContent: string,
  verifications: VerificationEntry[],
  phase: PurchasePhase
): CriticReview {
  const coverageResult = reviewCoverage(verifications);
  const consistencyResult = reviewConsistency(verifications);
  const completenessResult = reviewCompleteness(reportContent, phase, verifications);
  const hallucinationResult = reviewForHallucinations(reportContent, verifications);

  // Collect all issues
  const allIssues: CriticIssue[] = [
    ...coverageResult.issues,
    ...consistencyResult.issues,
    ...completenessResult.issues,
    ...hallucinationResult.issues,
  ];

  const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
  const majorCount = allIssues.filter((i) => i.severity === "major").length;
  const minorCount = allIssues.filter((i) => i.severity === "minor").length;

  // Weighted quality score
  const overallQuality = Math.round(
    coverageResult.score * 0.3 +
      consistencyResult.score * 0.3 +
      completenessResult.score * 0.4
  );

  // Verdict: REVISE if any critical issues or quality below 60
  const verdict: CriticVerdict =
    criticalCount > 0 || overallQuality < 60 ? "REVISE" : "APPROVED";

  // Generate human-readable summary
  const summary = generateSummary(
    verdict,
    coverageResult,
    consistencyResult,
    completenessResult,
    allIssues,
    overallQuality
  );

  return {
    verdict,
    reviewedAt: new Date().toISOString(),
    totalIssues: allIssues.length,
    criticalIssues: criticalCount,
    majorIssues: majorCount,
    minorIssues: minorCount,
    issues: allIssues,
    coverageScore: coverageResult.score,
    consistencyScore: consistencyResult.score,
    completenessScore: completenessResult.score,
    overallQuality,
    summary,
  };
}

/**
 * Format the critic review for the agent to use in its response
 */
export function formatCriticReview(review: CriticReview): string {
  const lines: string[] = [];

  lines.push(`## Critic Review — ${review.verdict}`);
  lines.push("");
  lines.push(`**Quality Score:** ${review.overallQuality}/100`);
  lines.push(
    `- Coverage: ${review.coverageScore}/100 | Consistency: ${review.consistencyScore}/100 | Completeness: ${review.completenessScore}/100`
  );
  lines.push("");

  if (review.issues.length === 0) {
    lines.push("No issues found. Report is ready to present to the buyer.");
    return lines.join("\n");
  }

  lines.push(`**Issues Found:** ${review.totalIssues} (${review.criticalIssues} critical, ${review.majorIssues} major, ${review.minorIssues} minor)`);
  lines.push("");

  // Group by severity
  for (const severity of ["critical", "major", "minor"] as const) {
    const sevIssues = review.issues.filter((i) => i.severity === severity);
    if (sevIssues.length === 0) continue;

    const label = severity === "critical" ? "CRITICAL" : severity === "major" ? "MAJOR" : "MINOR";
    lines.push(`### ${label} Issues`);
    lines.push("");

    for (const issue of sevIssues) {
      lines.push(`- **${issue.finding}**`);
      lines.push(`  - Evidence: ${issue.evidence}`);
      lines.push(`  - Fix: ${issue.suggestedFix}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(review.summary);

  return lines.join("\n");
}

// --- Helpers ---

function calculateNameSimilarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/));
  const bWords = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

function generateSummary(
  verdict: CriticVerdict,
  coverage: { score: number; checked: string[]; notChecked: string[]; failed: string[] },
  consistency: { score: number },
  completeness: { score: number },
  issues: CriticIssue[],
  overallQuality: number
): string {
  const parts: string[] = [];

  if (verdict === "APPROVED") {
    parts.push(
      `Report APPROVED (quality: ${overallQuality}/100). ${coverage.checked.length}/${REQUIRED_PORTALS.length} portals verified.`
    );
    if (issues.length > 0) {
      parts.push(
        `${issues.length} minor issue(s) noted but none block presentation to buyer.`
      );
    }
  } else {
    parts.push(
      `Report requires REVISION (quality: ${overallQuality}/100). ${issues.filter((i) => i.severity === "critical").length} critical issue(s) must be addressed before presenting to buyer.`
    );

    // Top 3 issues
    const topIssues = issues
      .sort((a, b) => {
        const order = { critical: 0, major: 1, minor: 2 };
        return order[a.severity] - order[b.severity];
      })
      .slice(0, 3);

    parts.push("Top issues to fix:");
    for (const issue of topIssues) {
      parts.push(`  - [${issue.severity.toUpperCase()}] ${issue.finding}`);
    }
  }

  if (coverage.notChecked.length > 0) {
    parts.push(`Unchecked portals: ${coverage.notChecked.join(", ")}`);
  }

  return parts.join("\n");
}
