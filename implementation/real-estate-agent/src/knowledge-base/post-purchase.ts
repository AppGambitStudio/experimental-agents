// Gujarat post-purchase formalities checklist
// Source: Gujarat property transaction requirements, Surat Municipal Corporation, DGVCL, Adani Gas

import type { PostPurchaseTask, PropertyType } from "../types/index.js";

export const POST_PURCHASE_TASKS: PostPurchaseTask[] = [
  {
    id: "post_001",
    task: "Collect Registered Sale Deed",
    description:
      "Collect the original registered sale deed from the Sub-Registrar office. This is your primary proof of ownership. Verify all details — names, survey number, consideration amount, registration number.",
    where: "Sub-Registrar office",
    when: "Within 1-2 weeks of registration",
    documentsNeeded: ["Registration receipt", "ID proof (Aadhaar)"],
    estimatedTime: "30-60 minutes",
    mandatory: true,
    category: "legal",
  },
  {
    id: "post_002",
    task: "Property Mutation (8A Record Update)",
    description:
      "Apply for mutation (naam ferfar) at the Mamlatdar / Talati office to update the 7/12 and 8A revenue records with your name as the new owner. This is CRITICAL — without mutation, the government records still show the previous owner.",
    where: "Mamlatdar office / Talati office / e-Dhara center",
    when: "Within 3 months of registration",
    documentsNeeded: [
      "Registered sale deed (original + copy)",
      "7/12 extract (current)",
      "8A extract (current)",
      "Mutation application form (Form No. 6A)",
      "PAN card copy",
      "Aadhaar card copy",
      "Passport-size photos (2)",
      "Previous owner's NOC (if available)",
    ],
    estimatedTime: "1-3 months (processing time)",
    mandatory: true,
    category: "legal",
  },
  {
    id: "post_003",
    task: "Update Property Tax Records",
    description:
      "Apply at the municipal corporation to transfer the property tax record to your name. Clear any outstanding dues first. For Surat, visit the SMC (Surat Municipal Corporation) zone office.",
    where: "Municipal Corporation zone office (SMC for Surat)",
    when: "Within 1 month of registration",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Previous property tax receipt",
      "ID proof (Aadhaar + PAN)",
      "Transfer application form",
      "NOC from previous owner (if available)",
    ],
    estimatedTime: "1-2 visits, 1-2 weeks processing",
    mandatory: true,
    category: "municipal",
  },
  {
    id: "post_004",
    task: "Society / Association Registration",
    description:
      "Register as a member of the housing society or apartment association. Obtain the share certificate. Transfer the society membership from the previous owner (resale) or get new membership (new construction).",
    where: "Housing society office / Builder's office",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Allotment letter",
      "Builder NOC / previous owner NOC",
      "Society membership application form",
      "Passport-size photos (2)",
      "Share transfer form (for resale)",
    ],
    estimatedTime: "1-2 weeks",
    mandatory: true,
    category: "legal",
  },
  {
    id: "post_005",
    task: "Electricity Connection Transfer",
    description:
      "Transfer the electricity connection to your name at DGVCL (Dakshin Gujarat Vij Company Ltd) for Surat. If new construction, apply for a new connection. Carry the old meter number and consumer number.",
    where: "DGVCL office (Surat) or online at dgvcl.com",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Society NOC / builder NOC",
      "Previous electricity bill (for transfer)",
      "ID proof (Aadhaar + PAN)",
      "Application form",
      "Security deposit (₹1,000-5,000 depending on load)",
    ],
    estimatedTime: "1-2 weeks",
    mandatory: true,
    category: "utility",
  },
  {
    id: "post_006",
    task: "Water Connection Transfer",
    description:
      "Transfer the water connection at the municipal corporation (SMC for Surat). For new buildings, the society usually handles the bulk connection, but individual meter transfer is still needed.",
    where: "Municipal Corporation water department (SMC for Surat)",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Society NOC",
      "Previous water bill (if transfer)",
      "Application form",
      "ID proof",
    ],
    estimatedTime: "1-2 weeks",
    mandatory: true,
    category: "utility",
  },
  {
    id: "post_007",
    task: "Gas Connection Transfer",
    description:
      "Transfer or apply for a new piped gas connection. For Surat, the provider is Adani Gas (now ATGL — Adani Total Gas Ltd). If the society has piped gas infrastructure, apply for an individual connection.",
    where: "Adani Gas / ATGL office or online at adanigas.com",
    when: "At possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Society NOC",
      "ID proof (Aadhaar)",
      "Application form",
      "Security deposit (₹3,000-6,000)",
    ],
    estimatedTime: "1-3 weeks",
    mandatory: false,
    category: "utility",
  },
  {
    id: "post_008",
    task: "Home Loan EMI Start Verification",
    description:
      "Verify that the home loan EMI has started correctly after disbursement. Check the amortization schedule, EMI amount, interest rate, and ensure the loan account reflects the correct property details.",
    where: "Bank (home loan branch)",
    when: "After loan disbursement",
    documentsNeeded: [
      "Loan account details",
      "Amortization schedule",
      "Disbursement letter",
      "Registered sale deed (bank's copy)",
    ],
    estimatedTime: "1-2 hours at bank",
    mandatory: true,
    category: "financial",
  },
  {
    id: "post_009",
    task: "Home Insurance",
    description:
      "Get home insurance covering the structure (not land value) against fire, natural disasters, and other perils. Many banks require this as a condition of the home loan. Compare premiums across insurers.",
    where: "Insurance company / online",
    when: "Within 1 month of possession",
    documentsNeeded: [
      "Registered sale deed (copy)",
      "Property valuation report",
      "Home loan details (if linking to loan)",
      "ID proof",
    ],
    estimatedTime: "1-2 days",
    mandatory: false,
    category: "financial",
  },
  {
    id: "post_010",
    task: "Update Address on Aadhaar and PAN",
    description:
      "Update your residential address on Aadhaar (UIDAI) and PAN card (Income Tax) to the new property address. You'll need an address proof from the new property — the electricity bill or a society letter works.",
    where: "UIDAI (online or Aadhaar center) + Income Tax portal",
    when: "Within 3 months of possession",
    documentsNeeded: [
      "New address proof (electricity bill / society letter / registered deed)",
      "Current Aadhaar card",
      "PAN card",
    ],
    estimatedTime: "1-2 hours (online)",
    mandatory: false,
    category: "personal",
  },
  {
    id: "post_011",
    task: "Property in Income Tax Declaration",
    description:
      "Declare the property in your next Income Tax Return (ITR). If you have a home loan, claim deductions under Section 24(b) for interest (up to ₹2 lakh) and Section 80C for principal (up to ₹1.5 lakh). If this is your second property, rental income must be declared.",
    where: "Income Tax portal (incometax.gov.in)",
    when: "Next tax filing season (July)",
    documentsNeeded: [
      "Registered sale deed",
      "Home loan interest certificate (from bank)",
      "Home loan principal repayment certificate",
      "Property tax receipt",
    ],
    estimatedTime: "Part of regular ITR filing",
    mandatory: true,
    category: "financial",
  },
  {
    id: "post_012",
    task: "Store Originals in Bank Locker",
    description:
      "Store all original documents in a bank safe deposit locker: registered sale deed, original agreement, all NOCs, e-stamp certificate, title deed chain, 7/12 and 8A extracts. Keep certified copies at home for day-to-day use.",
    where: "Bank (safe deposit locker)",
    when: "Immediately after collecting all documents",
    documentsNeeded: [
      "All original property documents",
      "Bank locker key / access",
    ],
    estimatedTime: "30 minutes",
    mandatory: true,
    category: "personal",
  },
];

// Tasks applicable to plots (no society, no utility transfers)
const PLOT_EXCLUDED_TASKS = new Set([
  "post_004", // society registration
  "post_005", // electricity transfer
  "post_006", // water transfer
  "post_007", // gas transfer
]);

/**
 * Get the post-purchase checklist for a given property type.
 * Mandatory tasks are sorted first.
 *
 * @param type - Property type
 * @returns Sorted array of PostPurchaseTask items
 */
export function getPostPurchaseChecklist(type: PropertyType): PostPurchaseTask[] {
  let tasks = POST_PURCHASE_TASKS;

  if (type === "plot") {
    tasks = tasks.filter((t) => !PLOT_EXCLUDED_TASKS.has(t.id));
  }

  // Sort: mandatory first, then by original order
  return [...tasks].sort((a, b) => {
    if (a.mandatory && !b.mandatory) return -1;
    if (!a.mandatory && b.mandatory) return 1;
    return 0;
  });
}
