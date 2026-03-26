// Hardcoded clause patterns for the prototype
// In production, these would be in PostgreSQL + pgvector

import type { ClausePattern } from "../types/index.js";

export const CLAUSE_PATTERNS: ClausePattern[] = [
  {
    id: "PAT-001",
    patternName: "Post-termination non-compete (any duration)",
    category: "non_compete",
    riskLevel: "critical",
    riskDescription:
      "Post-termination non-compete clause is VOID under Section 27 of the Indian Contract Act, 1872. Indian courts have consistently held that restraint of trade clauses surviving termination are unenforceable.",
    riskDescriptionBusiness:
      "After this contract ends, you would be blocked from doing similar work for anyone else. This clause is void under Indian law — you don't have to agree to it.",
    applicableLaws: [
      "Indian Contract Act 1872, Section 27",
      "Niranjan Shankar Golikari v Century Spinning (SC, 1967)",
      "Superintendence Co. v Krishan Murgai (SC, 1981)",
    ],
    exampleRiskyText:
      "shall not engage in any competing business for a period of .* months after termination",
    suggestedAlternative:
      "Remove entirely. If counterparty insists, replace with narrow non-solicitation: 'Developer shall not directly solicit Client's employees or specific named accounts for a period of 12 months following termination.'",
    negotiationTalkingPoint:
      "This clause is void under Indian law (Section 27, Indian Contract Act). As a services company, we cannot agree to restrictions that prevent us from serving other clients. We're happy to agree to non-solicitation of your specific employees and named accounts instead.",
  },
  {
    id: "PAT-002",
    patternName: "Unlimited indemnity without cap",
    category: "indemnity",
    riskLevel: "critical",
    riskDescription:
      "Indemnification without any aggregate liability cap exposes the Developer to unlimited financial risk. Indian courts disfavor unlimited, one-sided indemnity.",
    riskDescriptionBusiness:
      "If something goes wrong, you could be liable for unlimited damages — even if your contract is worth just a few lakhs. This is commercially unreasonable.",
    applicableLaws: [
      "Voestalpine Schienen GmbH v DMRC (Delhi HC)",
      "Indian Contract Act 1872, Section 73-74 (reasonable compensation)",
    ],
    exampleRiskyText:
      "shall indemnify.*from any and all.*losses.*without limitation",
    suggestedAlternative:
      "Add aggregate liability cap: 'Developer's total aggregate liability under this Agreement shall not exceed the total fees paid by Client to Developer in the 12 months preceding the claim.'",
    negotiationTalkingPoint:
      "We're comfortable with indemnification but need a reasonable cap. Industry standard is 1× annual contract value. We propose limiting aggregate liability to fees paid in the preceding 12 months.",
  },
  {
    id: "PAT-003",
    patternName: "Foreign governing law for India-India or India-party contract",
    category: "governing_law",
    riskLevel: "high",
    riskDescription:
      "Foreign governing law (e.g., US state law) creates impractical dispute resolution for an Indian entity. Enforcing a foreign judgment in India requires separate proceedings.",
    riskDescriptionBusiness:
      "If there's a dispute, you'd need to hire foreign lawyers and litigate abroad. This could cost ₹50L+ before the case even starts. Push for Indian law with arbitration.",
    applicableLaws: [
      "Code of Civil Procedure 1908, Section 44A",
      "Arbitration & Conciliation Act 1996",
    ],
    exampleRiskyText:
      "governed by.*laws of.*(Delaware|New York|California|England|Singapore|Pennsylvania)",
    suggestedAlternative:
      "This Agreement shall be governed by the laws of India. Any disputes shall be resolved by arbitration under the rules of the Mumbai Centre for International Arbitration (MCIA), seated in Mumbai.",
    negotiationTalkingPoint:
      "Foreign jurisdiction creates a practical impossibility — our entire team is in India. We propose neutral arbitration (MCIA Mumbai or SIAC Singapore) which is faster, cheaper, and enforceable in both countries under the New York Convention.",
  },
  {
    id: "PAT-004",
    patternName: "One-sided termination rights",
    category: "termination",
    riskLevel: "high",
    riskDescription:
      "Customer can terminate for convenience but Developer cannot. This creates an imbalanced relationship where Developer is locked in with no exit.",
    riskDescriptionBusiness:
      "They can walk away anytime, but you can't. If the project becomes unprofitable or the relationship sours, you have no exit option.",
    applicableLaws: ["Indian Contract Act 1872, Section 14 (free consent)"],
    exampleRiskyText:
      "Customer may terminate.*without cause.*Developer may (only )?terminate.*for cause",
    suggestedAlternative:
      "Either party may terminate this Agreement for convenience by providing 90 days' prior written notice to the other party.",
    negotiationTalkingPoint:
      "Termination rights should be mutual. Both parties should have equal exit rights with a reasonable notice period. We propose 90 days for both sides.",
  },
  {
    id: "PAT-005",
    patternName: "Overly broad IP assignment",
    category: "ip_assignment",
    riskLevel: "high",
    riskDescription:
      "IP assignment covering 'ideas, concepts, processes, and methodologies' goes far beyond deliverables. Could capture Developer's pre-existing tools, frameworks, and internal methodologies.",
    riskDescriptionBusiness:
      "This clause could mean your internal tools, coding practices, and frameworks become the client's property. Even your general knowledge and skills could be claimed.",
    applicableLaws: [
      "Indian Copyright Act 1957, Section 17 (first owner of copyright)",
      "Indian Copyright Act 1957, Section 57 (moral rights — inalienable)",
    ],
    exampleRiskyText:
      "all.*work product.*including.*ideas.*concepts.*processes.*methodologies.*shall (vest|belong).*with (Customer|Client)",
    suggestedAlternative:
      "IP assignment should be limited to deliverables specifically created under this Agreement. Pre-existing IP, tools, frameworks, and general knowledge remain with Developer. Add a Background Technology schedule listing Developer's pre-existing IP.",
    negotiationTalkingPoint:
      "We're happy to assign IP for deliverables created specifically for you. But 'ideas, concepts, and methodologies' is too broad — it could capture our pre-existing frameworks that we use across clients. Let's carve out Background Technology explicitly.",
  },
  {
    id: "PAT-006",
    patternName: "Auto-renewal without notice period",
    category: "auto_renewal",
    riskLevel: "medium",
    riskDescription:
      "Contract auto-renews without specifying a notice period for non-renewal. Party could be locked into perpetual renewals.",
    riskDescriptionBusiness:
      "The contract keeps renewing automatically. If you forget to cancel at the right time, you're locked in for another term.",
    applicableLaws: ["Indian Contract Act 1872, Section 23 (lawful object)"],
    exampleRiskyText:
      "shall automatically renew.*(without|no).*(notice|notification)",
    suggestedAlternative:
      "This Agreement shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal at least 90 days prior to the expiration of the then-current term.",
    negotiationTalkingPoint:
      "Auto-renewal should include a clear notice period for non-renewal. Industry standard is 90 days. Without it, either party could be inadvertently locked in.",
  },
  {
    id: "PAT-007",
    patternName: "No data protection clause in agreement handling personal data",
    category: "data_protection",
    riskLevel: "critical",
    riskDescription:
      "Agreement involves processing personal data but contains no data protection clause. DPDPA 2023 requires contracts to address data processing, consent, retention, breach notification, and cross-border transfers.",
    riskDescriptionBusiness:
      "If you're handling any personal data (names, emails, health records), Indian law now requires a data protection clause. Without it, both parties are exposed to regulatory penalties.",
    applicableLaws: [
      "Digital Personal Data Protection Act 2023 (DPDPA)",
      "IT Act 2000, Section 43A + SPDI Rules 2011",
    ],
    exampleRiskyText: "",
    suggestedAlternative:
      "Add a Data Processing Addendum (DPA) covering: purpose limitation, processing instructions, sub-processor obligations, breach notification (72 hours), data deletion on termination, and audit rights.",
    negotiationTalkingPoint:
      "We need a data protection addendum — it's a mutual compliance obligation under DPDPA 2023. This protects both of us. We can draft a standard DPA.",
  },
  {
    id: "PAT-008",
    patternName: "Moral rights waiver",
    category: "ip_assignment",
    riskLevel: "medium",
    riskDescription:
      "Clause requires Developer to waive moral rights. Under Indian Copyright Act, Section 57, moral rights are inalienable and cannot be waived.",
    riskDescriptionBusiness:
      "They're asking you to give up moral rights (right to be credited, right to object to modifications). Under Indian law, these rights cannot be waived — this clause is unenforceable.",
    applicableLaws: [
      "Indian Copyright Act 1957, Section 57 (author's special rights — inalienable)",
    ],
    exampleRiskyText: "waive.*moral rights|droit moral",
    suggestedAlternative:
      "Remove the moral rights waiver clause. It is unenforceable under Indian law (Section 57, Indian Copyright Act) and including it signals unfamiliarity with Indian IP law.",
    negotiationTalkingPoint:
      "Moral rights are inalienable under Indian law (Section 57, Copyright Act). This clause is unenforceable regardless of whether it's in the contract. We suggest removing it to keep the agreement clean.",
  },
  {
    id: "PAT-009",
    patternName: "No limitation of liability cap",
    category: "liability",
    riskLevel: "high",
    riskDescription:
      "Agreement excludes consequential damages but has no cap on direct damages. Combined with unlimited indemnity, total financial exposure is uncapped.",
    riskDescriptionBusiness:
      "There's no limit on how much you could be asked to pay if something goes wrong. Even if your contract is worth ₹10L, you could theoretically be liable for ₹10Cr.",
    applicableLaws: [
      "Indian Contract Act 1872, Section 73 (compensation for breach)",
      "Indian Contract Act 1872, Section 74 (penalty stipulation)",
    ],
    exampleRiskyText:
      "IN NO EVENT.*LIABLE.*CONSEQUENTIAL.*(?!aggregate|cap|not exceed|maximum)",
    suggestedAlternative:
      "Add: 'IN NO EVENT SHALL EITHER PARTY'S AGGREGATE LIABILITY UNDER THIS AGREEMENT EXCEED THE TOTAL FEES PAID TO DEVELOPER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.'",
    negotiationTalkingPoint:
      "We need an aggregate liability cap. Industry standard for services contracts is 12 months of fees. Uncapped liability is not insurable and not commercially reasonable.",
  },
  {
    id: "PAT-010",
    patternName: "Excessively long term without exit",
    category: "termination",
    riskLevel: "medium",
    riskDescription:
      "Contract term exceeds 3 years without a mutual termination for convenience clause or rate revision mechanism. Market conditions change significantly over long periods.",
    riskDescriptionBusiness:
      "You're locked into this for a very long time with no way to renegotiate rates or exit. If costs go up or the relationship deteriorates, you're stuck.",
    applicableLaws: [
      "Indian Contract Act 1872, Section 23 (lawful consideration)",
    ],
    exampleRiskyText: "term.*(?:five|six|seven|eight|nine|ten|\\d{1,2}).*years",
    suggestedAlternative:
      "Reduce to 2-3 year initial term with automatic renewal and mutual termination for convenience. Add an annual rate review mechanism.",
    negotiationTalkingPoint:
      "Long-term commitments should include periodic rate reviews and mutual exit rights. We propose a 2-year initial term with annual renewals, and an annual rate review mechanism tied to inflation.",
  },
];
