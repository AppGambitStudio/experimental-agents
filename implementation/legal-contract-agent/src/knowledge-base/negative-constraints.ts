// Negative constraints — what the agent CANNOT verify about contracts
// These limitations MUST be disclosed to the user in every report.
// Transparency about blind spots is a safety requirement.

// --- Types ---

export interface ContractLimitation {
  id: string;
  limitation: string;
  severity: "critical" | "high" | "medium";
  reason: string;
  whatUserShouldDo: string;
  applicablePhase: string;
}

// --- Data ---

export const CONTRACT_LIMITATIONS: ContractLimitation[] = [
  {
    id: "LIM-001",
    limitation: "Cannot verify if signatures are genuine",
    severity: "critical",
    reason:
      "The agent processes document text only. It has no access to signature verification databases, handwriting analysis, or digital certificate validation (DSC/Aadhaar eSign). A forged signature renders the entire contract void.",
    whatUserShouldDo:
      "Verify signatory identity independently. For high-value contracts, insist on Aadhaar eSign or DSC-based digital signatures. For physical signatures, verify in person or through a notary.",
    applicablePhase: "execution",
  },
  {
    id: "LIM-002",
    limitation:
      "Cannot verify if the entity legally exists or is authorized to contract",
    severity: "critical",
    reason:
      "The agent does not have access to MCA (Ministry of Corporate Affairs) portal, ROC filings, or DPIIT registration databases. A contract with a non-existent or struck-off entity is void ab initio.",
    whatUserShouldDo:
      "Check MCA portal (mca.gov.in) for company status. Verify CIN/LLPIN is active. For partnerships, check Registrar of Firms. For foreign entities, verify registration in their home jurisdiction. Confirm the signatory has board authority (check board resolution).",
    applicablePhase: "pre-signing",
  },
  {
    id: "LIM-003",
    limitation:
      "Cannot verify prior undisclosed amendments or side letters",
    severity: "critical",
    reason:
      "The agent only analyzes the document provided. There may be prior amendments, side letters, addenda, or oral modifications that materially alter the contract terms. Indian law recognizes oral modifications in some cases.",
    whatUserShouldDo:
      "Request a representations and warranties clause confirming the document is the entire agreement. Ask counterparty to disclose all prior amendments. Include a strong integration/entire agreement clause.",
    applicablePhase: "review",
  },
  {
    id: "LIM-004",
    limitation:
      "Cannot assess commercial reasonableness of pricing",
    severity: "high",
    reason:
      "The agent has no access to market rate databases, industry benchmarks, or comparable transaction data. It cannot determine if the pricing is above or below market, or if there are hidden costs in the fee structure.",
    whatUserShouldDo:
      "Benchmark pricing against at least 2-3 comparable market quotes. For IT services, check NASSCOM rate cards. For real estate, check circle rates and recent transactions. Consult a CA for transfer pricing implications in cross-border contracts.",
    applicablePhase: "review",
  },
  {
    id: "LIM-005",
    limitation:
      "Cannot verify compliance with industry-specific regulations (healthcare, banking, insurance, telecom, etc.)",
    severity: "high",
    reason:
      "The agent's knowledge base covers general Indian contract law and common regulations (DPDPA, FEMA, IT Act, Labour Codes, GST, Companies Act, Arbitration Act). It does not cover sector-specific regulations such as RBI guidelines for NBFC/banking, IRDAI for insurance, TRAI for telecom, SEBI for securities, or FSSAI for food.",
    whatUserShouldDo:
      "For regulated industries, engage a sector-specific legal counsel. Key regulators to check: RBI (banking/fintech), SEBI (securities/investment), IRDAI (insurance), TRAI (telecom), Drug Controller (pharma), FSSAI (food), AERB (nuclear), DGCA (aviation).",
    applicablePhase: "review",
  },
  {
    id: "LIM-006",
    limitation:
      "Cannot check if similar clauses were enforced or struck down in unpublished judgments",
    severity: "high",
    reason:
      "The agent's legal references are based on published Supreme Court and High Court judgments and statutes. Many trial court and arbitral tribunal decisions are unpublished. A clause that appears enforceable based on published law may have been struck down in an unpublished ruling.",
    whatUserShouldDo:
      "For critical clauses (non-compete, indemnity caps, liquidated damages), consult a practicing advocate who tracks recent tribunal/district court decisions in the relevant jurisdiction. Check SCC Online and Manupatra for recent developments.",
    applicablePhase: "review",
  },
  {
    id: "LIM-007",
    limitation:
      "Cannot verify if the contract conflicts with other existing agreements of the parties",
    severity: "high",
    reason:
      "The agent reviews only the document provided. The parties may have existing MSAs, NDAs, exclusive arrangements, non-compete obligations, or prior commitments that conflict with this contract. A conflicting obligation can make performance impossible or create breach of the prior agreement.",
    whatUserShouldDo:
      "Before signing, review your existing agreements for conflicts. Specifically check: (1) exclusivity clauses in other contracts, (2) non-compete/non-solicitation obligations, (3) IP assignment obligations, (4) confidentiality obligations that may prevent performing this contract. Include a representations clause that neither party is in breach of existing obligations.",
    applicablePhase: "pre-signing",
  },
  {
    id: "LIM-008",
    limitation:
      "Cannot assess jurisdiction-specific nuances beyond the 4 supported states (Gujarat, Maharashtra, Delhi, Karnataka)",
    severity: "medium",
    reason:
      "Stamp duty rates, registration requirements, and local procedural rules vary by state. The agent's knowledge base covers Gujarat, Maharashtra, Delhi, and Karnataka only. Other states may have different stamp duty schedules, rent control laws, or local compliance requirements.",
    whatUserShouldDo:
      "If the contract's governing jurisdiction is outside the 4 supported states, consult a local advocate for: (1) correct stamp duty rates from the state's Stamp Act schedule, (2) registration requirements under the Registration Act as applied in that state, (3) any state-specific labour or commercial laws that override central legislation.",
    applicablePhase: "review",
  },
  {
    id: "LIM-009",
    limitation:
      "Cannot verify stamp duty payments or e-stamp certificate validity",
    severity: "medium",
    reason:
      "The agent can calculate the stamp duty amount based on its knowledge base, but it cannot verify whether the stamp duty was actually paid, whether the e-stamp certificate is genuine, or whether the stamp paper was purchased before the contract date (as required). SHCIL (Stock Holding Corporation) verification requires portal access.",
    whatUserShouldDo:
      "Verify e-stamp certificates on the SHCIL portal (shcilestamp.com) using the certificate number. For physical stamp paper, check the vendor's license. Ensure stamp paper date is on or before the contract execution date. In case of deficiency, pay the deficit plus penalty before presenting the document in court.",
    applicablePhase: "execution",
  },
  {
    id: "LIM-010",
    limitation:
      "Cannot assess enforceability of clauses in foreign jurisdictions",
    severity: "medium",
    reason:
      "The agent's knowledge base covers Indian law only. If the contract involves foreign counterparties or foreign governing law, the agent cannot assess whether specific clauses are enforceable under that foreign jurisdiction's laws. For example, non-compete clauses that are void in India may be enforceable in the US.",
    whatUserShouldDo:
      "For contracts with foreign governing law or foreign counterparties, engage local counsel in the relevant jurisdiction. Key considerations: (1) enforceability of Indian arbitral awards in the foreign jurisdiction (check New York Convention membership), (2) foreign judgment enforceability in India under Section 44A CPC, (3) tax treaty implications for cross-border payments.",
    applicablePhase: "review",
  },
];

// --- Functions ---

/**
 * Returns contract limitations, optionally filtered by the analysis phase.
 * If no phase is provided, returns all limitations.
 */
export function getContractLimitations(
  phase?: string
): ContractLimitation[] {
  if (!phase) {
    return CONTRACT_LIMITATIONS;
  }
  return CONTRACT_LIMITATIONS.filter(
    (l) => l.applicablePhase === phase
  );
}

/**
 * Formats the limitations into a disclaimer block suitable for inclusion
 * in a contract analysis report. This disclaimer is MANDATORY in every report.
 */
export function formatLimitationsDisclaimer(phase?: string): string {
  const limitations = getContractLimitations(phase);
  const lines: string[] = [];

  lines.push("---");
  lines.push("");
  lines.push("## Limitations and Disclaimer");
  lines.push("");
  lines.push(
    "**This analysis is generated by an AI agent and is NOT a substitute for professional legal advice.** The following limitations apply:"
  );
  lines.push("");

  // Group by severity
  for (const severity of ["critical", "high", "medium"] as const) {
    const sevLimitations = limitations.filter((l) => l.severity === severity);
    if (sevLimitations.length === 0) continue;

    const label =
      severity === "critical"
        ? "Critical Limitations"
        : severity === "high"
          ? "Important Limitations"
          : "Other Limitations";

    lines.push(`### ${label}`);
    lines.push("");

    for (const lim of sevLimitations) {
      lines.push(`**${lim.limitation}**`);
      lines.push(`${lim.reason}`);
      lines.push(`*Action required:* ${lim.whatUserShouldDo}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(
    "*Always consult a qualified advocate before signing, modifying, or relying on any contract.*"
  );

  return lines.join("\n");
}
