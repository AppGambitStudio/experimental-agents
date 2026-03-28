// Reflection / Critic Agent — "Senior Contract Lawyer" review
// Reviews contract analysis reports for consistency, completeness, and accuracy
// before presenting to the user. Implements the Generate-Critique-Refine pattern.

import type {
  ClauseAnalysis,
  ContractType,
  ClauseCategory,
} from "../types/index.js";

// --- Types ---

export type CriticVerdict = "APPROVED" | "REVISE";
export type IssueSeverity = "critical" | "major" | "minor";

export type IssueCategory =
  | "coverage_gap"
  | "completeness_gap"
  | "hallucination"
  | "risk_rating_mismatch"
  | "missing_disclaimer"
  | "internal_contradiction";

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
  coverageScore: number; // 0-100, percentage of required clause categories analyzed
  completenessScore: number; // 0-100, required report sections present
  overallQuality: number; // 0-100, weighted average
  summary: string; // Human-readable summary for the agent
}

// --- Required Categories and Sections ---

const REQUIRED_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "indemnity",
  "ip_assignment",
  "termination",
  "governing_law",
  "data_protection",
  "confidentiality",
  "payment",
  "liability",
];

const REQUIRED_REPORT_SECTIONS = [
  "risk_score",
  "executive_summary",
  "clause_analysis",
  "stamp_duty",
  "missing_clauses",
  "negotiation_playbook",
  "disclaimer",
] as const;

type ReportSection = (typeof REQUIRED_REPORT_SECTIONS)[number];

/**
 * Section keywords used to detect presence of each required section in report text.
 */
const SECTION_KEYWORDS: Record<ReportSection, string[]> = {
  risk_score: ["risk score", "risk grade", "overall risk", "risk rating"],
  executive_summary: [
    "executive summary",
    "summary",
    "overview",
    "at a glance",
  ],
  clause_analysis: [
    "clause analysis",
    "clause-by-clause",
    "clause review",
    "flagged clauses",
    "identified clauses",
  ],
  stamp_duty: ["stamp duty", "e-stamp", "stamp paper"],
  missing_clauses: [
    "missing clause",
    "absent clause",
    "clauses not found",
    "recommended additions",
  ],
  negotiation_playbook: [
    "negotiation",
    "playbook",
    "talking point",
    "counter-proposal",
  ],
  disclaimer: [
    "disclaimer",
    "limitation",
    "cannot verify",
    "not a substitute",
    "consult a qualified",
  ],
};

// --- Known Laws in KB ---

/**
 * Laws and statutes that exist in the knowledge base. The critic uses this
 * list to detect potential hallucinations — references to laws NOT in this
 * list are flagged for manual verification.
 */
const KNOWN_LAWS: string[] = [
  "Indian Contract Act 1872",
  "Indian Contract Act, 1872",
  "Section 27",
  "Section 73",
  "Section 74",
  "Section 14",
  "Section 23",
  "Indian Copyright Act 1957",
  "Indian Copyright Act, 1957",
  "Section 17",
  "Section 57",
  "Code of Civil Procedure 1908",
  "Section 44A",
  "Arbitration and Conciliation Act 1996",
  "Arbitration & Conciliation Act 1996",
  "Arbitration Act 1996",
  "Digital Personal Data Protection Act 2023",
  "DPDPA 2023",
  "DPDPA",
  "IT Act 2000",
  "Information Technology Act 2000",
  "Section 43A",
  "SPDI Rules 2011",
  "FEMA 1999",
  "Foreign Exchange Management Act 1999",
  "Labour Codes 2020",
  "Code on Wages 2019",
  "Industrial Relations Code 2020",
  "Social Security Code 2020",
  "OSH Code 2020",
  "GST Act",
  "CGST Act 2017",
  "IGST Act 2017",
  "Companies Act 2013",
  "Section 188",
  "Section 177",
  "Section 189",
  "Niranjan Shankar Golikari v Century Spinning",
  "Superintendence Co. v Krishan Murgai",
  "Voestalpine Schienen GmbH v DMRC",
];

// --- Core Review Functions ---

/**
 * Check whether all required clause categories were analyzed.
 * Returns a score (0-100) and issues for missing categories.
 */
export function reviewCoverage(
  clauseAnalyses: ClauseAnalysis[],
  contractType: ContractType
): { score: number; issues: CriticIssue[] } {
  const issues: CriticIssue[] = [];
  const analyzedCategories = new Set(clauseAnalyses.map((c) => c.category));

  // Determine which categories are required for this contract type
  const required = getRequiredCategories(contractType);
  const covered: string[] = [];
  const notCovered: string[] = [];

  for (const category of required) {
    if (analyzedCategories.has(category)) {
      covered.push(category);
    } else {
      // Check if it was flagged as a missing clause
      const flaggedMissing = clauseAnalyses.some(
        (c) =>
          c.isMissingClause &&
          (c.category === category ||
            c.clauseTitle
              .toLowerCase()
              .includes(category.replace(/_/g, " ")))
      );
      if (flaggedMissing) {
        covered.push(category); // counted as covered — it was identified as missing
      } else {
        notCovered.push(category);
      }
    }
  }

  const score =
    required.length > 0
      ? Math.round((covered.length / required.length) * 100)
      : 100;

  if (notCovered.length > 0) {
    issues.push({
      id: "cov_missing_categories",
      category: "coverage_gap",
      severity: notCovered.length >= 3 ? "critical" : "major",
      finding: `${notCovered.length} of ${required.length} required clause categories were not analyzed: ${notCovered.join(", ")}`,
      evidence: `Analyzed: ${covered.join(", ") || "none"}. Missing: ${notCovered.join(", ")}`,
      suggestedFix:
        "Analyze the missing categories. If they are absent from the contract, explicitly flag them as missing clauses with risk assessment.",
    });
  }

  return { score, issues };
}

/**
 * Check whether the report includes all required sections.
 */
export function reviewCompleteness(reportContent: string): {
  score: number;
  issues: CriticIssue[];
} {
  const issues: CriticIssue[] = [];
  const content = reportContent.toLowerCase();
  const found: ReportSection[] = [];
  const missing: ReportSection[] = [];

  for (const section of REQUIRED_REPORT_SECTIONS) {
    const keywords = SECTION_KEYWORDS[section];
    const isPresent = keywords.some((kw) => content.includes(kw));
    if (isPresent) {
      found.push(section);
    } else {
      missing.push(section);
    }
  }

  if (missing.length > 0) {
    const hasDisclaimerGap = missing.includes("disclaimer");
    const hasRiskScoreGap = missing.includes("risk_score");
    const isCritical = hasDisclaimerGap || hasRiskScoreGap;

    issues.push({
      id: "comp_missing_sections",
      category: hasDisclaimerGap ? "missing_disclaimer" : "completeness_gap",
      severity: isCritical ? "critical" : "major",
      finding: `Report is missing ${missing.length} required section(s): ${missing.join(", ")}`,
      evidence: `Found: ${found.join(", ")}. Missing: ${missing.join(", ")}`,
      suggestedFix: `Add the missing sections.${hasDisclaimerGap ? " CRITICAL: The limitations disclaimer is MANDATORY in every report." : ""}${hasRiskScoreGap ? " CRITICAL: Every report MUST include an overall risk score." : ""}`,
    });
  }

  const score =
    REQUIRED_REPORT_SECTIONS.length > 0
      ? Math.round((found.length / REQUIRED_REPORT_SECTIONS.length) * 100)
      : 100;

  return { score, issues };
}

/**
 * Detect potential hallucinations — law references not in the KB,
 * or clause numbers that don't appear in the analysis.
 */
export function reviewForHallucinations(
  reportContent: string,
  clauseAnalyses: ClauseAnalysis[]
): { issues: CriticIssue[] } {
  const issues: CriticIssue[] = [];

  // 1. Check for law/statute references not in our KB
  const lawPatterns = [
    // Match "Section X of Some Act YYYY" patterns
    /(?:Section|S\.|Sec\.)\s+\d+[A-Z]?\s+(?:of\s+(?:the\s+)?)?([A-Z][A-Za-z\s,&]+(?:Act|Code|Rules)\s*(?:,?\s*\d{4})?)/g,
    // Match "Some Act YYYY" standalone
    /([A-Z][A-Za-z\s]+(?:Act|Code|Rules|Regulations)\s*(?:,?\s*)?\d{4})/g,
    // Match case law references "X v Y" or "X vs Y"
    /([A-Z][A-Za-z\s]+\s+v[s.]?\s+[A-Z][A-Za-z\s]+)/g,
  ];

  const referencedLaws = new Set<string>();
  for (const pattern of lawPatterns) {
    const matches = reportContent.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        referencedLaws.add(match[1].trim());
      }
    }
  }

  const unknownLaws: string[] = [];
  for (const law of referencedLaws) {
    const isKnown = KNOWN_LAWS.some(
      (known) =>
        law.toLowerCase().includes(known.toLowerCase()) ||
        known.toLowerCase().includes(law.toLowerCase())
    );
    if (!isKnown) {
      unknownLaws.push(law);
    }
  }

  if (unknownLaws.length > 0) {
    issues.push({
      id: "hall_unknown_laws",
      category: "hallucination",
      severity: unknownLaws.length >= 3 ? "critical" : "major",
      finding: `Report references ${unknownLaws.length} law(s) not present in the knowledge base: ${unknownLaws.slice(0, 5).join("; ")}${unknownLaws.length > 5 ? ` (and ${unknownLaws.length - 5} more)` : ""}`,
      evidence:
        "Known KB laws include: Indian Contract Act, Copyright Act, DPDPA, IT Act, FEMA, Labour Codes, GST Act, Companies Act, Arbitration Act. The referenced laws may be valid but are not in our verified KB.",
      suggestedFix:
        'Verify each unknown law reference independently. If the law is valid, consider adding it to the knowledge base. If it cannot be verified, remove the reference or mark it as "unverified citation".',
    });
  }

  // 2. Check for clause number references that don't match the analysis
  const clauseNumberPattern =
    /(?:Clause|Section|Article)\s+(\d+(?:\.\d+)*)/gi;
  const reportClauseNumbers = new Set<string>();
  const clauseMatches = reportContent.matchAll(clauseNumberPattern);
  for (const match of clauseMatches) {
    if (match[1]) {
      reportClauseNumbers.add(match[1]);
    }
  }

  const analyzedClauseNumbers = new Set(
    clauseAnalyses.map((c) => c.clauseNumber).filter(Boolean)
  );

  const phantomClauses: string[] = [];
  for (const clauseNum of reportClauseNumbers) {
    // Skip common legal section references (e.g., "Section 27" of a statute)
    if (isStatuteSection(reportContent, clauseNum)) continue;

    if (!analyzedClauseNumbers.has(clauseNum)) {
      phantomClauses.push(clauseNum);
    }
  }

  if (phantomClauses.length > 0) {
    issues.push({
      id: "hall_phantom_clauses",
      category: "hallucination",
      severity: phantomClauses.length >= 3 ? "critical" : "major",
      finding: `Report references ${phantomClauses.length} clause number(s) not found in the clause analysis: ${phantomClauses.join(", ")}`,
      evidence: `Analyzed clause numbers: ${Array.from(analyzedClauseNumbers).join(", ") || "none"}. Phantom references: ${phantomClauses.join(", ")}`,
      suggestedFix:
        "Verify each clause number against the original document. Remove references to non-existent clauses. If the clause exists in the document but was not analyzed, add it to the analysis.",
    });
  }

  return { issues };
}

/**
 * Check whether the overall risk score is consistent with clause-level findings.
 */
export function reviewRiskRating(
  reportContent: string,
  clauseAnalyses: ClauseAnalysis[]
): { issues: CriticIssue[] } {
  const issues: CriticIssue[] = [];

  // Extract risk score from report
  const scoreMatch = reportContent.match(
    /(?:risk score|overall risk)[:\s]*(\d+)/i
  );
  const gradeMatch = reportContent.match(
    /(?:risk grade|risk level|risk rating)[:\s]*(low|medium|high|critical)/i
  );

  const reportScore = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
  const reportGrade = gradeMatch ? gradeMatch[1].toLowerCase() : null;

  // Count clause-level findings
  const criticalCount = clauseAnalyses.filter(
    (c) => c.riskLevel === "critical"
  ).length;
  const highCount = clauseAnalyses.filter(
    (c) => c.riskLevel === "high"
  ).length;
  const mediumCount = clauseAnalyses.filter(
    (c) => c.riskLevel === "medium"
  ).length;

  // Determine what the risk grade should roughly be
  let expectedMinGrade: string;
  if (criticalCount >= 2) {
    expectedMinGrade = "critical";
  } else if (criticalCount >= 1 || highCount >= 3) {
    expectedMinGrade = "high";
  } else if (highCount >= 1 || mediumCount >= 3) {
    expectedMinGrade = "medium";
  } else {
    expectedMinGrade = "low";
  }

  const gradeOrder: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  // Check grade mismatch
  if (reportGrade && gradeOrder[reportGrade] < gradeOrder[expectedMinGrade]) {
    issues.push({
      id: "risk_grade_too_low",
      category: "risk_rating_mismatch",
      severity: "critical",
      finding: `Overall risk grade "${reportGrade}" is inconsistent with clause findings. Expected at least "${expectedMinGrade}" based on ${criticalCount} critical, ${highCount} high, and ${mediumCount} medium findings.`,
      evidence: `Clause breakdown: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium risk clauses. A "${reportGrade}" rating understates the actual risk.`,
      suggestedFix: `Raise the overall risk grade to at least "${expectedMinGrade}". The risk grade must reflect the worst-case clause findings, not the average.`,
    });
  }

  // Check score mismatch (score goes UP with more issues — higher = riskier)
  if (reportScore !== null) {
    const expectedMinScore = Math.min(
      100,
      criticalCount * 30 + highCount * 15 + mediumCount * 5
    );

    if (reportScore < expectedMinScore - 10) {
      issues.push({
        id: "risk_score_too_low",
        category: "risk_rating_mismatch",
        severity: "major",
        finding: `Risk score ${reportScore} appears low given ${criticalCount} critical and ${highCount} high risk clauses. Expected at least ~${expectedMinScore}.`,
        evidence: `Score calculation basis: ${criticalCount} critical (x30), ${highCount} high (x15), ${mediumCount} medium (x5) = ~${expectedMinScore} expected minimum.`,
        suggestedFix:
          "Recalculate the risk score to properly weight critical and high-risk findings. Critical issues should have the highest weight.",
      });
    }
  }

  // Check for contradiction: "Low Risk" text alongside critical clauses
  const content = reportContent.toLowerCase();
  if (
    criticalCount > 0 &&
    (content.includes("low risk") ||
      content.includes("minimal risk") ||
      content.includes("safe to sign"))
  ) {
    issues.push({
      id: "risk_contradiction",
      category: "internal_contradiction",
      severity: "critical",
      finding: `Report uses reassuring language ("low risk" / "minimal risk" / "safe to sign") despite ${criticalCount} critical clause(s)`,
      evidence:
        "A contract with critical-risk clauses should NEVER be described as low risk. This creates a dangerous false sense of security.",
      suggestedFix:
        "Remove reassuring language. Replace with an explicit warning about critical issues that require resolution before signing.",
    });
  }

  return { issues };
}

/**
 * Check whether the limitations disclaimer is present and adequate.
 */
export function reviewDisclaimer(reportContent: string): {
  issues: CriticIssue[];
} {
  const issues: CriticIssue[] = [];
  const content = reportContent.toLowerCase();

  const hasDisclaimer =
    content.includes("disclaimer") || content.includes("limitation");

  const hasNotSubstitute =
    content.includes("not a substitute") ||
    content.includes("not legal advice") ||
    content.includes("consult a qualified") ||
    content.includes("consult an advocate");

  const hasCannotVerify =
    content.includes("cannot verify") || content.includes("cannot assess");

  if (!hasDisclaimer) {
    issues.push({
      id: "disc_missing",
      category: "missing_disclaimer",
      severity: "critical",
      finding: "Report does not contain a limitations disclaimer section",
      evidence:
        "Every contract analysis report MUST include a disclaimer stating that the analysis is AI-generated and not a substitute for professional legal advice.",
      suggestedFix:
        "Add the standard limitations disclaimer using formatLimitationsDisclaimer() from negative-constraints.ts. This is a mandatory safety requirement.",
    });
  } else {
    if (!hasNotSubstitute) {
      issues.push({
        id: "disc_no_legal_advice_warning",
        category: "missing_disclaimer",
        severity: "major",
        finding:
          'Disclaimer does not explicitly state that the analysis is "not a substitute for legal advice"',
        evidence:
          "The disclaimer section exists but lacks the core legal advice warning.",
        suggestedFix:
          'Add: "This analysis is NOT a substitute for professional legal advice. Always consult a qualified advocate before signing."',
      });
    }
    if (!hasCannotVerify) {
      issues.push({
        id: "disc_no_limitations",
        category: "missing_disclaimer",
        severity: "major",
        finding:
          "Disclaimer does not list specific limitations (what the agent cannot verify)",
        evidence:
          "Users must be informed about blind spots such as signature verification, entity existence, and industry-specific compliance.",
        suggestedFix:
          "Include key limitations from negative-constraints.ts: cannot verify signatures, cannot verify entity existence, cannot check industry-specific regulations.",
      });
    }
  }

  return { issues };
}

// --- Main Review Function ---

/**
 * Run a complete critic review on the contract analysis report.
 * Returns a structured review with verdict, scores, and issues.
 */
export function runCriticReview(
  reportContent: string,
  clauseAnalyses: ClauseAnalysis[],
  contractType: ContractType
): CriticReview {
  const coverageResult = reviewCoverage(clauseAnalyses, contractType);
  const completenessResult = reviewCompleteness(reportContent);
  const hallucinationResult = reviewForHallucinations(
    reportContent,
    clauseAnalyses
  );
  const riskRatingResult = reviewRiskRating(reportContent, clauseAnalyses);
  const disclaimerResult = reviewDisclaimer(reportContent);

  // Collect all issues
  const allIssues: CriticIssue[] = [
    ...coverageResult.issues,
    ...completenessResult.issues,
    ...hallucinationResult.issues,
    ...riskRatingResult.issues,
    ...disclaimerResult.issues,
  ];

  const criticalCount = allIssues.filter(
    (i) => i.severity === "critical"
  ).length;
  const majorCount = allIssues.filter((i) => i.severity === "major").length;
  const minorCount = allIssues.filter((i) => i.severity === "minor").length;

  // Weighted quality score: coverage 40%, completeness 60%
  const overallQuality = Math.round(
    coverageResult.score * 0.4 + completenessResult.score * 0.6
  );

  // Verdict: REVISE if any critical issues or quality below 60
  const verdict: CriticVerdict =
    criticalCount > 0 || overallQuality < 60 ? "REVISE" : "APPROVED";

  const summary = generateSummary(
    verdict,
    coverageResult.score,
    completenessResult.score,
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
    completenessScore: completenessResult.score,
    overallQuality,
    summary,
  };
}

/**
 * Format the critic review for inclusion in the agent's response.
 */
export function formatCriticReview(review: CriticReview): string {
  const lines: string[] = [];

  lines.push(`## Critic Review -- ${review.verdict}`);
  lines.push("");
  lines.push(`**Quality Score:** ${review.overallQuality}/100`);
  lines.push(
    `- Coverage: ${review.coverageScore}/100 | Completeness: ${review.completenessScore}/100`
  );
  lines.push("");

  if (review.issues.length === 0) {
    lines.push("No issues found. Report is ready to present to the user.");
    return lines.join("\n");
  }

  lines.push(
    `**Issues Found:** ${review.totalIssues} (${review.criticalIssues} critical, ${review.majorIssues} major, ${review.minorIssues} minor)`
  );
  lines.push("");

  // Group by severity
  for (const severity of ["critical", "major", "minor"] as const) {
    const sevIssues = review.issues.filter((i) => i.severity === severity);
    if (sevIssues.length === 0) continue;

    const label =
      severity === "critical"
        ? "CRITICAL"
        : severity === "major"
          ? "MAJOR"
          : "MINOR";
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

/**
 * Determine which clause categories are required for a given contract type.
 * Some categories are universal; others depend on the contract type.
 */
function getRequiredCategories(
  contractType: ContractType
): ClauseCategory[] {
  // Base categories required for all contracts
  const base: ClauseCategory[] = [
    "termination",
    "governing_law",
    "confidentiality",
    "liability",
  ];

  switch (contractType) {
    case "msa":
    case "service_agreement":
    case "sow":
      return [
        ...base,
        "indemnity",
        "ip_assignment",
        "data_protection",
        "payment",
      ];
    case "nda":
      return ["confidentiality", "termination", "governing_law"];
    case "employment":
    case "freelancer":
      return [...base, "ip_assignment", "payment", "data_protection"];
    case "lease":
      return [...base, "payment"];
    case "dpa":
      return [
        "data_protection",
        "confidentiality",
        "termination",
        "governing_law",
        "liability",
      ];
    case "shareholder":
      return [...base, "indemnity", "payment"];
    default:
      return REQUIRED_CLAUSE_CATEGORIES;
  }
}

/**
 * Heuristic to check if a "Section X" reference in the report refers to a
 * statute section rather than a contract clause. If the number appears near
 * a known law name, it is a statute reference.
 */
function isStatuteSection(
  reportContent: string,
  clauseNum: string
): boolean {
  const escapedNum = clauseNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const statutePattern = new RegExp(
    `(?:Section|S\\.)\\s+${escapedNum}\\s+(?:of\\s+)?(?:the\\s+)?(?:Indian|IT|Copyright|Contract|Companies|Arbitration|FEMA|GST|DPDPA|CPC)`,
    "i"
  );
  return statutePattern.test(reportContent);
}

function generateSummary(
  verdict: CriticVerdict,
  coverageScore: number,
  completenessScore: number,
  issues: CriticIssue[],
  overallQuality: number
): string {
  const parts: string[] = [];

  if (verdict === "APPROVED") {
    parts.push(
      `Report APPROVED (quality: ${overallQuality}/100). Coverage: ${coverageScore}/100, Completeness: ${completenessScore}/100.`
    );
    if (issues.length > 0) {
      parts.push(
        `${issues.length} minor issue(s) noted but none block presentation to user.`
      );
    }
  } else {
    const criticalCount = issues.filter(
      (i) => i.severity === "critical"
    ).length;
    parts.push(
      `Report requires REVISION (quality: ${overallQuality}/100). ${criticalCount} critical issue(s) must be addressed before presenting to user.`
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
      parts.push(
        `  - [${issue.severity.toUpperCase()}] ${issue.finding}`
      );
    }
  }

  return parts.join("\n");
}
