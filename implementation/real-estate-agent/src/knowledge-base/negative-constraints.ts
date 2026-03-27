// Negative Constraints — what the agent CANNOT verify or find
// This is a SAFETY feature. Without these disclaimers, buyers may
// over-rely on the agent's "Clear" or "Low Risk" status.

import type { PurchasePhase } from "../types/index.js";

export interface NegativeConstraint {
  id: string;
  limitation: string;
  reason: string;
  whatBuyerShouldDo: string;
  phase: PurchasePhase;
  severity: "critical" | "important" | "informational";
}

export const NEGATIVE_CONSTRAINTS: NegativeConstraint[] = [
  // --- Due Diligence blind spots ---
  {
    id: "nc_001",
    limitation: "Cannot verify oral agreements or unregistered Satakhats (informal sale agreements)",
    reason:
      "In Gujarat, informal sale agreements (Satakhats) between parties are common, especially in rural or semi-urban areas. These are not registered with any government portal and leave no digital trail. The agent only accesses registered documents via GARVI.",
    whatBuyerShouldDo:
      "Ask the seller directly if any prior oral agreement, Satakhat, or informal commitment exists with another party. Have your lawyer include a warranty clause in the agreement stating the seller has no prior commitments.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_002",
    limitation: "Cannot perform physical site inspection or verify actual construction quality",
    reason:
      "The agent operates entirely through digital portals and data analysis. It cannot visit the property, inspect construction quality, check for structural defects, verify amenities, or confirm that the physical property matches the approved plan.",
    whatBuyerShouldDo:
      "Always conduct a personal site visit (preferably with a civil engineer). Check construction quality, water seepage, structural integrity, ventilation, and compare the actual layout with the approved building plan.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_003",
    limitation: "Cannot detect hidden encumbrances or bank liens not yet reflected in records",
    reason:
      "There is a lag between when a bank creates a lien/mortgage and when it appears in Sub-Registrar or revenue records. A property could have a fresh loan against it that hasn't been registered yet. AnyRoR and EC records may be weeks to months behind.",
    whatBuyerShouldDo:
      "Obtain a fresh Encumbrance Certificate (EC) directly from the Sub-Registrar office (not online) for the last 30 years. Ask the seller for a bank NOC and verify directly with their bank.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_004",
    limitation: "Cannot verify the identity of the actual seller or detect impersonation",
    reason:
      "The agent verifies names against government records but cannot confirm that the person you are dealing with is actually the person named in the records. Identity fraud (someone posing as the property owner) is a known risk.",
    whatBuyerShouldDo:
      "Verify the seller's identity in person with original ID documents (Aadhaar, PAN, passport). Biometric verification at the Sub-Registrar office provides an additional layer, but meeting the seller in person before the agreement is essential.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_005",
    limitation: "Cannot access records older than what government portals show (typically 10-15 years)",
    reason:
      "AnyRoR, eCourts, and GARVI have limited historical data. Older land records, disputes, and transactions may only exist in physical registers at the Talati or Sub-Registrar office. A property with a 30-year dispute history may show only the last 10 years online.",
    whatBuyerShouldDo:
      "Engage a property lawyer to conduct a manual title search at the Sub-Registrar office going back at least 30 years. This is the single most important step that the agent cannot replace.",
    phase: "due_diligence",
    severity: "critical",
  },
  {
    id: "nc_006",
    limitation: "Cannot detect benami (proxy ownership) transactions",
    reason:
      "Benami transactions — where property is held in a name other than the true owner — are illegal under the Benami Transactions Act but still occur. The agent sees only the name on record, not whether that person is the true beneficial owner.",
    whatBuyerShouldDo:
      "If the property has changed hands unusually frequently or involves complex ownership structures, have your lawyer investigate the chain of ownership for benami indicators.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_007",
    limitation: "Cannot verify accuracy of eCourts data or detect unreported disputes",
    reason:
      "eCourts data may have a lag of weeks to months. Not all courts have digitized older records. Cases filed in tribunals, consumer forums, or arbitration may not appear. Cases under appeal may not show updated status.",
    whatBuyerShouldDo:
      "Treat eCourts results as indicative, not exhaustive. Engage a lawyer to do a physical search at the relevant district court, High Court, consumer forum, and any tribunals.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_008",
    limitation: "Cannot verify actual possession status of the property",
    reason:
      "Government records show legal ownership, not who is physically in possession. A property could be legally owned by one person but occupied by tenants, squatters, or a previous owner who refuses to vacate.",
    whatBuyerShouldDo:
      "Visit the property to confirm it is vacant or that the current occupant acknowledges the sale. For resale, get a written confirmation from the current occupant. For new construction, verify with the society.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_009",
    limitation: "Cannot verify environmental or zoning compliance beyond what portals show",
    reason:
      "The agent cannot check if the property is in a flood zone, coastal regulation zone (CRZ), near high-tension power lines, or affected by upcoming government acquisition (TP scheme road widening, metro alignment, etc.).",
    whatBuyerShouldDo:
      "Check the Town Planning (TP) scheme for the area. Visit the local development authority (SUDA for Surat) to confirm the property is not affected by any reservation, road widening, or government acquisition.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_010",
    limitation: "Cannot read or analyze Gujarati-language documents in scanned/image format",
    reason:
      "Many Gujarat government records, older title deeds, and revenue documents are in Gujarati. Scanned documents or images cannot be reliably extracted. The agent works best with structured digital data from portals.",
    whatBuyerShouldDo:
      "Have a bilingual property lawyer review all Gujarati-language documents. Do not rely on machine translations for legal documents — nuances in Gujarati legal terms can change the meaning significantly.",
    phase: "document_review",
    severity: "important",
  },
  {
    id: "nc_011",
    limitation: "Cannot guarantee portal data is current or accurate",
    reason:
      "Government portal data can be outdated, incomplete, or contain data entry errors. RERA quarterly updates may be delayed. AnyRoR mutations can take months to reflect. SMC tax records may not show recent payments.",
    whatBuyerShouldDo:
      "Use the agent's findings as a starting point, not the final word. For any critical finding (ownership, litigation, encumbrance), verify with a physical visit to the relevant office.",
    phase: "due_diligence",
    severity: "important",
  },
  {
    id: "nc_012",
    limitation: "Cannot verify builder's financial health or project viability beyond GSTN/RERA data",
    reason:
      "The agent checks GSTN registration and RERA compliance but cannot access the builder's balance sheet, bank statements, project-specific RERA escrow account balance, or order book. A builder could be RERA-compliant but financially distressed.",
    whatBuyerShouldDo:
      "Research the builder independently — check MCA (Ministry of Corporate Affairs) for company financials, talk to existing buyers in the builder's other projects, check if the builder has delayed possession elsewhere.",
    phase: "due_diligence",
    severity: "informational",
  },
  {
    id: "nc_013",
    limitation: "Cannot verify authenticity of documents provided by the seller/builder",
    reason:
      "The agent cross-references portal data with what you provide, but cannot verify that a physical document (title deed, NOC, EC) shown to you is genuine and not forged. Document forgery is a known risk in Indian real estate.",
    whatBuyerShouldDo:
      "Verify all critical documents at the issuing office. For Encumbrance Certificates, verify at the Sub-Registrar office. For 7/12 extracts, verify at the Talati office. For RERA certificates, verify on the GujRERA portal (the agent does this).",
    phase: "document_review",
    severity: "important",
  },
  {
    id: "nc_014",
    limitation: "Cannot track registration process or Sub-Registrar office delays",
    reason:
      "The registration process is manual and happens at the Sub-Registrar office. The agent provides a step-by-step guide but cannot track your appointment status, document processing, or alert you to delays.",
    whatBuyerShouldDo:
      "Follow up with the Sub-Registrar office directly if there are delays. Carry your advocate's contact number on registration day. Most delays are due to missing documents — the agent's checklist helps prevent this.",
    phase: "registration",
    severity: "informational",
  },
];

/**
 * Get negative constraints filtered by purchase phase.
 * If no phase specified, returns all constraints.
 */
export function getConstraintsForPhase(phase?: PurchasePhase): NegativeConstraint[] {
  if (!phase) return NEGATIVE_CONSTRAINTS;
  return NEGATIVE_CONSTRAINTS.filter((c) => c.phase === phase);
}

/**
 * Format a disclaimer section listing what the agent cannot verify.
 * This should be included in every due diligence report and dossier.
 */
export function formatConstraintsDisclaimer(phase?: PurchasePhase): string {
  const constraints = getConstraintsForPhase(phase);
  const critical = constraints.filter((c) => c.severity === "critical");
  const important = constraints.filter((c) => c.severity === "important");
  const informational = constraints.filter((c) => c.severity === "informational");

  let output = `\n## What This Agent CANNOT Verify\n\n`;
  output += `This agent verifies property data across government portals, but has blind spots. `;
  output += `A "Clear" or "Low Risk" status means no issues were found in the data available — `;
  output += `it does NOT mean the property is free from all risks.\n\n`;

  if (critical.length > 0) {
    output += `### Critical Blind Spots (must be independently verified)\n\n`;
    for (const c of critical) {
      output += `- **${c.limitation}**\n  ${c.reason}\n  *What you should do:* ${c.whatBuyerShouldDo}\n\n`;
    }
  }

  if (important.length > 0) {
    output += `### Important Limitations\n\n`;
    for (const c of important) {
      output += `- **${c.limitation}**\n  *What you should do:* ${c.whatBuyerShouldDo}\n\n`;
    }
  }

  if (informational.length > 0) {
    output += `### Additional Notes\n\n`;
    for (const c of informational) {
      output += `- ${c.limitation} — ${c.whatBuyerShouldDo}\n\n`;
    }
  }

  output += `---\n*Always engage a property lawyer and conduct a physical site visit before finalizing any property purchase.*\n`;

  return output;
}
