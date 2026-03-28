// Indian regulatory compliance rules for contracts
// Maps regulations to contract types and conditions that trigger them

import type { ContractType } from "../types/index.js";

// --- Types ---

export interface RegulatoryRequirement {
  id: string;
  regulation: string;
  shortName: string;
  applicableWhen: string;
  requiredClauses: string[];
  penaltyForNonCompliance: string;
  effectiveDate: string;
}

// --- Data ---

export const REGULATORY_REQUIREMENTS: RegulatoryRequirement[] = [
  {
    id: "REG-001",
    regulation: "Digital Personal Data Protection Act, 2023 (DPDPA)",
    shortName: "DPDPA 2023",
    applicableWhen:
      "Contract involves processing of personal data of Indian data principals (collection, storage, use, sharing, or deletion of personal data)",
    requiredClauses: [
      "Purpose limitation — data processed only for stated purpose",
      "Consent mechanism — how data principal consent is obtained and recorded",
      "Data principal rights — right to access, correct, erase, and grievance redressal",
      "Data retention and deletion — timeline for data deletion after purpose is fulfilled",
      "Breach notification — obligation to notify Data Protection Board within 72 hours",
      "Cross-border transfer restrictions — allowed only to notified countries",
      "Sub-processor obligations — data fiduciary remains liable for processors",
      "Children's data — explicit parental consent for processing data of minors (<18)",
    ],
    penaltyForNonCompliance:
      "Up to Rs 250 crore per instance. Data Protection Board can also issue blocking orders.",
    effectiveDate: "2023-08-11",
  },
  {
    id: "REG-002",
    regulation:
      "Information Technology Act, 2000 — Section 43A read with Sensitive Personal Data or Information (SPDI) Rules, 2011",
    shortName: "IT Act S.43A + SPDI Rules",
    applicableWhen:
      "Contract involves handling sensitive personal data: passwords, financial information, health data, biometrics, sexual orientation, or medical records",
    requiredClauses: [
      "Privacy policy — published and accessible privacy policy",
      "Consent before collection — written consent via letter, fax, or email before collecting SPDI",
      "Purpose disclosure — clear statement of purpose for collecting SPDI",
      "Reasonable security practices — ISO 27001 or equivalent security standards",
      "Grievance officer — designated grievance officer with contact details",
      "Data transfer restrictions — SPDI transfer only to entities with same level of protection",
      "Opt-out right — right to withdraw consent at any time",
    ],
    penaltyForNonCompliance:
      "Compensation to affected person (no upper cap specified in Section 43A). Body corporate liable for negligence in implementing reasonable security practices.",
    effectiveDate: "2011-04-11",
  },
  {
    id: "REG-003",
    regulation:
      "Foreign Exchange Management Act, 1999 (FEMA) and RBI Master Directions",
    shortName: "FEMA 1999",
    applicableWhen:
      "Contract involves cross-border payments, foreign entity as counterparty, foreign direct investment, or external commercial borrowings",
    requiredClauses: [
      "Payment currency and conversion — specify currency, conversion rate mechanism",
      "RBI compliance — confirmation that transaction is FEMA-compliant",
      "Authorized dealer bank — payments routed through AD Category-I bank",
      "Purpose code — RBI purpose code for foreign remittance",
      "Transfer pricing documentation — arm's length pricing for related party cross-border transactions",
      "Withholding tax — TDS obligations under Section 195 of Income Tax Act for payments to non-residents",
      "Permanent establishment risk — clause to prevent inadvertent PE creation in India",
    ],
    penaltyForNonCompliance:
      "Up to 3x the amount involved in contravention. Adjudicating authority can also impose penalty of up to Rs 2 lakh and Rs 5,000 per day for continuing contravention.",
    effectiveDate: "1999-06-01",
  },
  {
    id: "REG-004",
    regulation:
      "Code on Wages 2019, Industrial Relations Code 2020, Social Security Code 2020, OSH Code 2020 (collectively, Labour Codes 2020)",
    shortName: "Labour Codes 2020",
    applicableWhen:
      "Contract is of employment or freelancer/consultant type, or involves manpower supply, staffing, or gig/platform work",
    requiredClauses: [
      "Employment classification — clear distinction between employee, contractor, and gig worker",
      "Wage definition — wages must comply with Code on Wages definition (basic + DA > 50% of total)",
      "Working hours and overtime — compliance with OSH Code limits (8 hours/day, 48 hours/week)",
      "Social security contributions — PF, ESI, and gratuity obligations clearly stated",
      "Termination notice — minimum notice periods per Industrial Relations Code",
      "Non-discrimination — equal remuneration for equal work regardless of gender",
      "Grievance redressal — internal grievance mechanism with timeline for resolution",
      "Fixed-term employment terms — if fixed-term, same benefits as permanent employees for same work",
    ],
    penaltyForNonCompliance:
      "Varies by Code: up to Rs 3 lakh fine and/or 3 months imprisonment for wage violations. Repeat offences: up to Rs 1 lakh and/or 1 year imprisonment.",
    effectiveDate: "2020-09-28",
  },
  {
    id: "REG-005",
    regulation:
      "Central Goods and Services Tax Act, 2017 (GST Act) and Integrated GST Act, 2017",
    shortName: "GST Act",
    applicableWhen:
      "Contract involves supply of services with aggregate turnover exceeding Rs 20 lakh (Rs 10 lakh for special category states)",
    requiredClauses: [
      "GST registration number — valid GSTIN of both parties",
      "HSN/SAC code — correct service accounting code for the services",
      "GST rate and amount — applicable GST rate (typically 18% for IT/consulting services)",
      "Invoice requirements — GST-compliant invoice format and timeline",
      "Input tax credit — mechanism to ensure ITC eligibility for recipient",
      "Reverse charge mechanism — if applicable, specify RCM obligations",
      "Place of supply — determine place of supply for IGST vs CGST/SGST applicability",
      "Export of services — if cross-border, zero-rated supply conditions (LUT/bond or refund route)",
    ],
    penaltyForNonCompliance:
      "100% of tax due or Rs 10,000, whichever is higher. Interest at 18% p.a. on unpaid tax. Fake invoices: imprisonment up to 5 years for tax evasion above Rs 5 crore.",
    effectiveDate: "2017-07-01",
  },
  {
    id: "REG-006",
    regulation:
      "Companies Act, 2013 — Section 188 (Related Party Transactions)",
    shortName: "Companies Act S.188",
    applicableWhen:
      "Contract is a related party transaction — between company and its directors, KMPs, relatives, or entities in which directors are interested",
    requiredClauses: [
      "Arm's length pricing — transaction at fair market value with justification",
      "Board resolution — prior approval of Board of Directors (ordinary resolution in general meeting if threshold exceeded)",
      "Audit committee approval — prior approval of audit committee under Section 177",
      "Disclosure in Board report — full disclosure of RPT in annual Board report",
      "Register of contracts — entry in register maintained under Section 189",
      "Abstention from voting — interested director must not participate in Board vote",
    ],
    penaltyForNonCompliance:
      "Contract voidable at the option of the Board. Director/KMP: imprisonment up to 1 year and/or fine Rs 25,000 to Rs 5 lakh. Company fine: minimum Rs 25,000, maximum Rs 5 lakh.",
    effectiveDate: "2013-08-29",
  },
  {
    id: "REG-007",
    regulation: "Arbitration and Conciliation Act, 1996 (as amended 2015, 2019, 2021)",
    shortName: "Arbitration Act 1996",
    applicableWhen:
      "Contract contains an arbitration clause or dispute resolution mechanism referencing arbitration",
    requiredClauses: [
      "Written arbitration agreement — must be in writing per Section 7",
      "Seat of arbitration — explicitly state juridical seat (determines curial law)",
      "Number of arbitrators — odd number; default is sole arbitrator unless agreed otherwise",
      "Appointment mechanism — procedure for appointing arbitrators; fallback to Section 11 (court appointment)",
      "Institutional vs ad hoc — specify if institutional (MCIA, SIAC, ICC) or ad hoc",
      "Language of arbitration — specify language of proceedings",
      "Governing law of arbitration agreement — may differ from governing law of contract",
      "Time limit for award — 12 months from completion of pleadings (extendable by 6 months by consent)",
      "Interim relief — whether parties can approach courts for interim measures under Section 9",
    ],
    penaltyForNonCompliance:
      "Defective arbitration clause may be treated as pathological — court may refuse to refer parties to arbitration. Award may be set aside under Section 34 if procedure was not in accordance with agreement.",
    effectiveDate: "1996-01-25",
  },
];

// --- Functions ---

/**
 * Returns regulatory requirements applicable to this contract based on its
 * characteristics. The function checks contract type, data handling flags,
 * cross-border status, and contract value to determine which regulations apply.
 */
export function getApplicableRegulations(
  contractType: ContractType,
  hasPersonalData: boolean,
  hasCrossBorder: boolean,
  contractValue?: number
): RegulatoryRequirement[] {
  const applicable: RegulatoryRequirement[] = [];

  // DPDPA 2023 — any contract involving personal data
  if (hasPersonalData) {
    const dpdpa = REGULATORY_REQUIREMENTS.find((r) => r.id === "REG-001");
    if (dpdpa) applicable.push(dpdpa);
  }

  // IT Act S.43A + SPDI Rules — personal data contracts (especially sensitive data)
  if (hasPersonalData) {
    const itAct = REGULATORY_REQUIREMENTS.find((r) => r.id === "REG-002");
    if (itAct) applicable.push(itAct);
  }

  // FEMA — cross-border payments or foreign entity
  if (hasCrossBorder) {
    const fema = REGULATORY_REQUIREMENTS.find((r) => r.id === "REG-003");
    if (fema) applicable.push(fema);
  }

  // Labour Codes — employment or freelancer contracts
  const employmentTypes: ContractType[] = ["employment", "freelancer"];
  if (employmentTypes.includes(contractType)) {
    const labour = REGULATORY_REQUIREMENTS.find((r) => r.id === "REG-004");
    if (labour) applicable.push(labour);
  }

  // GST Act — service contracts above threshold
  const serviceTypes: ContractType[] = [
    "msa",
    "sow",
    "service_agreement",
    "freelancer",
  ];
  if (serviceTypes.includes(contractType)) {
    const gst = REGULATORY_REQUIREMENTS.find((r) => r.id === "REG-005");
    if (gst) applicable.push(gst);
  }

  // Companies Act S.188 — related party transactions
  // This is flagged based on contract type "other" with high value, but since
  // we cannot detect RPT from contract type alone, we include it for all
  // contracts above Rs 1 crore as a reminder to check
  if (contractValue && contractValue >= 10000000) {
    const companiesAct = REGULATORY_REQUIREMENTS.find(
      (r) => r.id === "REG-006"
    );
    if (companiesAct) applicable.push(companiesAct);
  }

  // Arbitration Act — always applicable as a recommendation if contract
  // has or should have a dispute resolution clause
  const arbitration = REGULATORY_REQUIREMENTS.find((r) => r.id === "REG-007");
  if (arbitration) applicable.push(arbitration);

  return applicable;
}

/**
 * Format applicable regulations into a human-readable compliance checklist.
 */
export function formatComplianceChecklist(
  regulations: RegulatoryRequirement[]
): string {
  if (regulations.length === 0) {
    return "No specific regulatory requirements identified for this contract type.";
  }

  const lines: string[] = [];
  lines.push(`## Regulatory Compliance Checklist (${regulations.length} regulations)`);
  lines.push("");

  for (const reg of regulations) {
    lines.push(`### ${reg.shortName}`);
    lines.push(`**Regulation:** ${reg.regulation}`);
    lines.push(`**Applies because:** ${reg.applicableWhen}`);
    lines.push(`**Penalty:** ${reg.penaltyForNonCompliance}`);
    lines.push("");
    lines.push("**Required clauses:**");
    for (const clause of reg.requiredClauses) {
      lines.push(`- [ ] ${clause}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
