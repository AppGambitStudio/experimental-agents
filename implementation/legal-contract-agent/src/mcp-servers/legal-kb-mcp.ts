// legal-kb-mcp: Indian law knowledge base tools
// In production, these would query PostgreSQL + pgvector
// For prototype, uses hardcoded patterns from knowledge-base/

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { CLAUSE_PATTERNS } from "../knowledge-base/clause-patterns.js";
import { lookupStampDuty, STAMP_DUTY_MATRIX } from "../knowledge-base/stamp-duty.js";
import { getApplicableRegulations, formatComplianceChecklist } from "../knowledge-base/regulatory-compliance.js";
import { getContractLimitations, formatLimitationsDisclaimer } from "../knowledge-base/negative-constraints.js";
import { runCriticReview, formatCriticReview } from "../knowledge-base/critic.js";
import type { ClauseAnalysis, ContractType, RiskLevel, ClauseCategory } from "../types/index.js";

const searchClausePatternsTool = tool(
  "search_clause_patterns",
  "Search the Indian law clause pattern database for known risky patterns that match the given clause text. Returns matching patterns with risk level, applicable laws, suggested alternatives, and negotiation talking points.",
  {
    clause_text: z.string().describe("The clause text to check against known risk patterns"),
    contract_type: z.string().describe("Type of contract: msa, nda, employment, freelancer, lease, etc."),
  },
  async ({ clause_text, contract_type }) => {
    const clauseLower = clause_text.toLowerCase();

    // Match against known patterns using keyword matching
    // In production, this would be vector similarity search via pgvector
    const matches = CLAUSE_PATTERNS.filter((pattern) => {
      const keywords = getPatternKeywords(pattern);
      const matchScore = keywords.filter((kw) => clauseLower.includes(kw)).length;
      return matchScore >= 2; // At least 2 keyword matches
    });

    // Sort by risk level priority
    const riskOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    matches.sort(
      (a, b) => (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4)
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            patterns_found: matches.length,
            matches: matches.map((m) => ({
              pattern_id: m.id,
              pattern_name: m.patternName,
              risk_level: m.riskLevel,
              risk_description: m.riskDescription,
              risk_description_business: m.riskDescriptionBusiness,
              applicable_laws: m.applicableLaws,
              suggested_alternative: m.suggestedAlternative,
              negotiation_talking_point: m.negotiationTalkingPoint,
            })),
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getRequiredClausesTool = tool(
  "get_required_clauses",
  "Get the list of clauses that SHOULD exist in a contract of the given type. Used to detect missing clauses.",
  {
    contract_type: z.string().describe("Type of contract: msa, nda, employment, etc."),
  },
  async ({ contract_type }) => {
    // Required clauses by contract type
    const requiredByType: Record<string, string[]> = {
      msa: [
        "Governing law / jurisdiction",
        "Limitation of liability / liability cap",
        "Indemnification (mutual)",
        "Confidentiality / NDA",
        "Termination for convenience (mutual)",
        "IP ownership / assignment",
        "Data protection (if handling personal data)",
        "Force majeure",
        "Dispute resolution / arbitration",
        "Payment terms and late payment interest",
      ],
      nda: [
        "Definition of confidential information",
        "Exclusions from confidentiality",
        "Term and survival period",
        "Return/destruction of information",
        "Permitted disclosures (legal compulsion)",
        "Governing law",
      ],
      employment: [
        "Role and responsibilities",
        "Compensation and benefits",
        "Notice period (mutual)",
        "Confidentiality obligations",
        "IP assignment (limited to work scope)",
        "Non-solicitation (reasonable)",
        "Termination conditions",
        "Governing law",
        "Background verification consent",
        "Data protection / privacy notice",
      ],
      freelancer: [
        "Scope of work",
        "Payment terms and milestones",
        "IP assignment",
        "Confidentiality",
        "Independent contractor status",
        "Termination with notice",
        "Liability limitation",
        "Data protection (if applicable)",
      ],
      service_agreement: [
        "Scope of services",
        "Payment terms",
        "Service levels / SLA",
        "Liability limitation",
        "Indemnification",
        "Termination",
        "Confidentiality",
        "Governing law",
        "Data protection (if handling personal data)",
      ],
    };

    const required = requiredByType[contract_type.toLowerCase()] ?? requiredByType["msa"]!;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            contract_type,
            required_clauses: required,
            note: "If any of these clauses are missing from the contract, flag them as missing.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getStampDutyTool = tool(
  "get_stamp_duty",
  "Calculate stamp duty for a given state, document type, and contract value. Returns the duty amount, e-stamping availability, and registration requirements.",
  {
    state: z.string().describe("Indian state: Gujarat, Maharashtra, Delhi, Karnataka, etc."),
    document_type: z.string().describe("Document type: Service Agreement, NDA, Employment Agreement, MSA, Lease Agreement"),
    contract_value: z.number().optional().describe("Contract value in INR (for percentage-based duty)"),
  },
  async ({ state, document_type, contract_value }) => {
    const { dutyAmount, entry } = lookupStampDuty(
      state,
      document_type,
      contract_value
    );

    if (!entry) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              found: false,
              message: `No stamp duty data for ${state} / ${document_type}. Check with a local lawyer.`,
              available_states: [...new Set(STAMP_DUTY_MATRIX.map((e) => e.state))],
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
            found: true,
            state: entry.state,
            document_type: entry.documentType,
            duty_amount_inr: dutyAmount,
            duty_type: entry.dutyType,
            rate: entry.dutyType === "percentage"
              ? `${entry.dutyRatePercentage}% of contract value`
              : `₹${entry.dutyAmountFixed} fixed`,
            max_cap: entry.maxCap ? `₹${entry.maxCap.toLocaleString("en-IN")}` : "No cap",
            e_stamping_available: entry.eStampingAvailable,
            registration_required: entry.registrationRequired,
            registration_condition: entry.registrationCondition ?? "N/A",
            penalty_for_deficiency: entry.penaltyForDeficiency,
            warning: dutyAmount === 0 && entry.dutyType === "percentage"
              ? "Contract value not provided — stamp duty cannot be calculated. Please provide the contract value."
              : undefined,
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const checkEnforceabilityTool = tool(
  "check_enforceability",
  "Check if a specific clause type is enforceable under Indian law. Returns enforceability assessment with relevant law references.",
  {
    clause_type: z.string().describe("Type of clause: non_compete, indemnity, penalty, arbitration, etc."),
    clause_text: z.string().describe("The actual clause text to check"),
  },
  async ({ clause_type, clause_text }) => {
    // Hardcoded enforceability rules for key clause types
    const rules: Record<
      string,
      { enforceable: boolean; confidence: string; reason: string; law: string }
    > = {
      non_compete: {
        enforceable: false,
        confidence: "high",
        reason:
          "Post-termination non-compete clauses are VOID under Indian law. Section 27 of the Indian Contract Act declares any agreement in restraint of trade void. Exception: during employment or upon sale of goodwill.",
        law: "Indian Contract Act 1872, Section 27",
      },
      moral_rights_waiver: {
        enforceable: false,
        confidence: "high",
        reason:
          "Moral rights under Indian Copyright Act are inalienable. Section 57 grants authors special rights (attribution, integrity) that cannot be waived by contract.",
        law: "Indian Copyright Act 1957, Section 57",
      },
      penalty_clause: {
        enforceable: false,
        confidence: "medium",
        reason:
          "Indian law does not enforce penalty clauses. Section 74 limits recovery to 'reasonable compensation' regardless of the penalty amount stipulated. Courts will assess actual loss.",
        law: "Indian Contract Act 1872, Section 74",
      },
      non_solicitation: {
        enforceable: true,
        confidence: "medium",
        reason:
          "Narrowly drafted non-solicitation clauses (specific clients/employees, reasonable duration) MAY be enforceable. Courts assess on case-by-case basis. 12 months is generally considered reasonable.",
        law: "Indian Contract Act 1872, Section 27 (exception by judicial interpretation)",
      },
      arbitration: {
        enforceable: true,
        confidence: "high",
        reason:
          "Arbitration clauses are enforceable under the Arbitration & Conciliation Act 1996. Ensure the clause specifies: (1) seat of arbitration, (2) number of arbitrators, (3) language. Seat determines which court has supervisory jurisdiction.",
        law: "Arbitration & Conciliation Act 1996, Section 7",
      },
    };

    const rule = rules[clause_type.toLowerCase()];

    if (rule) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              clause_type,
              enforceable: rule.enforceable,
              confidence: rule.confidence,
              reason: rule.reason,
              relevant_law: rule.law,
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
            clause_type,
            enforceable: "unknown",
            confidence: "low",
            reason: `No specific enforceability data for clause type '${clause_type}'. Recommend legal review.`,
            relevant_law: "Consult a qualified Indian lawyer",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// Helper: extract keywords from a pattern for matching
function getPatternKeywords(pattern: typeof CLAUSE_PATTERNS[number]): string[] {
  const keywordMap: Record<string, string[]> = {
    "PAT-001": ["non-compete", "competing", "restraint", "not engage", "24 months", "after termination"],
    "PAT-002": ["indemnify", "hold harmless", "any and all", "losses", "without limitation", "unlimited"],
    "PAT-003": ["governed by", "laws of", "delaware", "new york", "california", "pennsylvania", "england"],
    "PAT-004": ["terminate", "without cause", "for convenience", "unilateral"],
    "PAT-005": ["work product", "ideas", "concepts", "methodologies", "processes", "vest", "all right"],
    "PAT-006": ["auto-renew", "automatically renew", "renewal"],
    "PAT-007": ["data protection", "personal data", "privacy", "dpdpa"],
    "PAT-008": ["moral rights", "droit moral", "waive"],
    "PAT-009": ["no event", "liable", "consequential", "limitation of liability"],
    "PAT-010": ["term", "years", "ten", "five", "long-term"],
  };
  return keywordMap[pattern.id] ?? [];
}

const getApplicableRegulationsTool = tool(
  "get_applicable_regulations",
  "Check which Indian regulations apply to this contract — DPDPA 2023, FEMA, Labor Codes, GST, Companies Act, Arbitration Act. Returns required clauses and penalties for non-compliance.",
  {
    contract_type: z.string().describe("Contract type: msa, nda, employment, freelancer, lease, etc."),
    has_personal_data: z.boolean().describe("Does the contract involve processing personal data?"),
    has_cross_border: z.boolean().describe("Does the contract involve cross-border payments or a foreign entity?"),
    contract_value: z.number().optional().describe("Contract value in INR (for threshold-based regulations)"),
  },
  async ({ contract_type, has_personal_data, has_cross_border, contract_value }) => {
    const regulations = getApplicableRegulations(
      contract_type as ContractType,
      has_personal_data,
      has_cross_border,
      contract_value
    );
    const checklist = formatComplianceChecklist(regulations);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            total_applicable: regulations.length,
            regulations: regulations.map((r) => ({
              id: r.id,
              regulation: r.regulation,
              short_name: r.shortName,
              applicable_when: r.applicableWhen,
              required_clauses: r.requiredClauses,
              penalty: r.penaltyForNonCompliance,
            })),
            formatted_checklist: checklist,
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getContractLimitationsTool = tool(
  "get_contract_limitations",
  "Get a list of what this agent CANNOT verify about contracts. MANDATORY disclaimer that must be included in every analysis report. Covers signature verification, entity existence, undisclosed amendments, commercial reasonableness.",
  {
    phase: z.string().optional().describe("Filter by analysis phase (omit for all limitations)"),
  },
  async ({ phase }) => {
    const limitations = getContractLimitations(phase);
    const disclaimer = formatLimitationsDisclaimer(phase);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            phase: phase ?? "all",
            total_limitations: limitations.length,
            critical_count: limitations.filter((l) => l.severity === "critical").length,
            limitations: limitations.map((l) => ({
              id: l.id,
              limitation: l.limitation,
              severity: l.severity,
              reason: l.reason,
              user_action: l.whatUserShouldDo,
            })),
            formatted_disclaimer: disclaimer,
            note: "ALWAYS include this disclaimer in analysis reports.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const reviewReportTool = tool(
  "review_report",
  "Critic / Reflection tool — reviews the contract analysis report BEFORE presenting to the user. Checks for coverage gaps, missing disclaimers, hallucinated law citations, risk rating inconsistencies. Returns APPROVED/REVISE verdict with specific issues to fix. ALWAYS call this before presenting a final summary or dossier.",
  {
    report_content: z.string().describe("The full text of the analysis report you are about to present"),
    clause_analyses: z.array(
      z.object({
        clauseNumber: z.string(),
        clauseTitle: z.string(),
        category: z.string(),
        riskLevel: z.string(),
        riskExplanation: z.string(),
        applicableLaws: z.array(z.string()),
        isMissingClause: z.boolean(),
      })
    ).describe("Array of clause analyses from the review"),
    contract_type: z.string().describe("Contract type: msa, nda, employment, etc."),
  },
  async ({ report_content, clause_analyses, contract_type }) => {
    const typedClauses = clause_analyses.map((c) => ({
      ...c,
      category: c.category as ClauseCategory,
      riskLevel: c.riskLevel as RiskLevel,
      originalText: "",
      riskExplanationBusiness: "",
      suggestedAlternative: undefined,
      negotiationPoint: undefined,
    })) as ClauseAnalysis[];

    const review = runCriticReview(report_content, typedClauses, contract_type as ContractType);
    const formatted = formatCriticReview(review);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            verdict: review.verdict,
            overall_quality: review.overallQuality,
            coverage_score: review.coverageScore,
            completeness_score: review.completenessScore,
            total_issues: review.totalIssues,
            critical_issues: review.criticalIssues,
            issues: review.issues,
            formatted_review: formatted,
            instructions: review.verdict === "REVISE"
              ? "REVISE the report to address the issues listed above, then call review_report again. Max 2 revision rounds."
              : "Report is APPROVED. Present it to the user with confidence.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

export const legalKbMcp = createSdkMcpServer({
  name: "legal-kb-mcp",
  tools: [
    searchClausePatternsTool,
    getRequiredClausesTool,
    getStampDutyTool,
    checkEnforceabilityTool,
    getApplicableRegulationsTool,
    getContractLimitationsTool,
    reviewReportTool,
  ],
});
