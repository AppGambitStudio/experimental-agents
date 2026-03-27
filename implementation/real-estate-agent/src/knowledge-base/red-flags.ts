// Gujarat property red flag patterns for automated risk detection
// Categories: RERA, Land Records, Legal, Financial, Builder

import { RedFlag } from "../types/index.js";

export const RED_FLAGS: RedFlag[] = [
  // --- RERA red flags ---
  {
    id: "rera_001",
    category: "rera",
    pattern: "project_not_registered",
    severity: "critical",
    description:
      "Project is not registered with Gujarat RERA. All projects with plot area > 500 sqm or > 8 units require RERA registration.",
    action:
      "Do not proceed. Advise buyer that purchasing an unregistered project is risky and the builder is in violation of RERA Act 2016.",
  },
  {
    id: "rera_002",
    category: "rera",
    pattern: "registration_expired",
    severity: "critical",
    description:
      "RERA registration has expired and no extension has been granted. Builder cannot legally sell units.",
    action:
      "Halt transaction. Verify with GujRERA portal whether extension application is pending. Do not proceed until renewed.",
  },
  {
    id: "rera_003",
    category: "rera",
    pattern: "multiple_complaints",
    severity: "high",
    description:
      "Project has 3 or more complaints filed on GujRERA portal by existing buyers.",
    action:
      "Review complaint details on GujRERA. Assess nature of complaints (delay, quality, refund). Flag to buyer with summary.",
  },
  {
    id: "rera_004",
    category: "rera",
    pattern: "completion_date_passed",
    severity: "high",
    description:
      "Declared completion date has passed but project status is not marked as completed.",
    action:
      "Check for revised completion timeline. Verify possession status of already-booked units. Buyer may be entitled to interest on delayed possession.",
  },
  {
    id: "rera_005",
    category: "rera",
    pattern: "carpet_area_mismatch",
    severity: "high",
    description:
      "Carpet area in the agreement differs from the carpet area declared in RERA registration by more than 3%.",
    action:
      "Flag discrepancy to buyer. Under RERA, buyer pays only for carpet area as declared. Builder must refund excess or buyer can withdraw.",
  },

  // --- Land records red flags ---
  {
    id: "land_001",
    category: "land_records",
    pattern: "seller_name_mismatch_7_12",
    severity: "critical",
    description:
      "Seller's name does not match the owner name in the 7/12 (Satbara) extract from Gujarat land records.",
    action:
      "Do not proceed. Verify chain of ownership. Check for unrecorded mutations or fraudulent sale.",
  },
  {
    id: "land_002",
    category: "land_records",
    pattern: "agricultural_land_no_na",
    severity: "critical",
    description:
      "Property is classified as agricultural land and NA (Non-Agricultural) conversion order has not been obtained.",
    action:
      "Cannot register as residential/commercial until NA conversion is complete. Check with Mamlatdar office for NA order status.",
  },
  {
    id: "land_003",
    category: "land_records",
    pattern: "government_trust_land",
    severity: "critical",
    description:
      "Land is classified as government land, trust land, or temple land in revenue records.",
    action:
      "Do not proceed. Such land typically cannot be sold to private parties without specific government approvals which are rarely granted.",
  },
  {
    id: "land_004",
    category: "land_records",
    pattern: "pending_mutation",
    severity: "high",
    description:
      "Mutation (naam ferfar) entry is pending in talati records. Ownership transfer not yet reflected in 7/12.",
    action:
      "Wait for mutation to complete before proceeding. Verify mutation application details and timeline with talati office.",
  },

  // --- Legal red flags ---
  {
    id: "legal_001",
    category: "legal",
    pattern: "active_litigation",
    severity: "critical",
    description:
      "Active court case or litigation exists on the property as found in encumbrance certificate or court records.",
    action:
      "Do not proceed until litigation is resolved. Obtain legal opinion on the nature and likely outcome of the case.",
  },
  {
    id: "legal_002",
    category: "legal",
    pattern: "prior_dispute_history",
    severity: "high",
    description:
      "Property has history of disputes (resolved or ongoing) visible in sub-registrar records or court database.",
    action:
      "Obtain detailed dispute history. Have a property lawyer assess whether resolved disputes could resurface. Proceed with caution.",
  },
  {
    id: "legal_003",
    category: "legal",
    pattern: "poa_sale_no_original_owner",
    severity: "critical",
    description:
      "Property is being sold via Power of Attorney (PoA) and the original owner is not available for verification or signing.",
    action:
      "High fraud risk. Insist on original owner's involvement. Verify PoA authenticity, check if it is registered and not revoked.",
  },
  {
    id: "legal_004",
    category: "legal",
    pattern: "undivided_property",
    severity: "high",
    description:
      "Property is part of an undivided estate (joint Hindu family or co-ownership) without a registered partition deed.",
    action:
      "All co-owners must consent to the sale. Obtain registered partition deed or NOC from all co-owners before proceeding.",
  },

  // --- Financial red flags ---
  {
    id: "fin_001",
    category: "financial",
    pattern: "declared_value_below_jantri",
    severity: "high",
    description:
      "Declared transaction value is significantly below the jantri (government ready reckoner) rate for the area.",
    action:
      "Registration will be done at jantri rate minimum. Flag potential tax evasion risk. Buyer may face scrutiny from Income Tax department.",
  },
  {
    id: "fin_002",
    category: "financial",
    pattern: "multiple_transactions_short_period",
    severity: "high",
    description:
      "Property has changed hands multiple times in a short period (3+ transactions in 5 years).",
    action:
      "Investigate reason for frequent transfers. Could indicate speculative trading, title issues, or money laundering. Verify each transfer.",
  },
  {
    id: "fin_003",
    category: "financial",
    pattern: "outstanding_property_tax",
    severity: "medium",
    description:
      "Property has outstanding municipal property tax dues with the local corporation (SMC for Surat).",
    action:
      "Obtain latest tax receipt. Ensure all dues are cleared before registration. Outstanding tax becomes buyer's liability post-transfer.",
  },

  // --- Builder red flags ---
  {
    id: "builder_001",
    category: "builder",
    pattern: "other_projects_delayed",
    severity: "high",
    description:
      "Builder's other projects on GujRERA show significant delays beyond declared completion dates.",
    action:
      "Assess builder's track record across all registered projects. Pattern of delays indicates systemic delivery risk.",
  },
  {
    id: "builder_002",
    category: "builder",
    pattern: "builder_rera_complaints",
    severity: "high",
    description:
      "Builder has RERA complaints across multiple projects, not just the target project.",
    action:
      "Review complaint patterns. If complaints are about quality, refund, or fraud — escalate risk level. Compile builder scorecard for buyer.",
  },
  {
    id: "builder_003",
    category: "builder",
    pattern: "no_oc_cc_completed_project",
    severity: "critical",
    description:
      "Builder has completed projects that still lack Occupancy Certificate (OC) or Completion Certificate (CC).",
    action:
      "Major risk indicator. Without OC/CC, residents face legal and utility issues. Strongly advise buyer to reconsider or negotiate safeguards.",
  },
];
