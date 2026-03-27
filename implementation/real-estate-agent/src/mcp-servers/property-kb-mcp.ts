// property-kb-mcp: Property knowledge base tools
// Provides jantri rates, stamp duty calculation, red flag checks, and document checklists
// for Gujarat property transactions.

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { lookupJantriRate, SURAT_JANTRI_RATES } from "../knowledge-base/jantri-rates.js";
import { calculateStampDuty } from "../knowledge-base/stamp-duty.js";
import { calculateTotalCost, formatCostBreakdown } from "../knowledge-base/total-cost.js";
import { getRegistrationGuide } from "../knowledge-base/registration-guide.js";
import { getPostPurchaseChecklist } from "../knowledge-base/post-purchase.js";
import { getConstraintsForPhase, formatConstraintsDisclaimer } from "../knowledge-base/negative-constraints.js";
import { runCriticReview, formatCriticReview } from "../knowledge-base/critic.js";
import type { PropertyType, RedFlag, PurchasePhase, VerificationEntry, VerificationStatus } from "../types/index.js";

// Red flag patterns for property verification
const RED_FLAG_PATTERNS: RedFlag[] = [
  {
    id: "rf_rera_not_registered",
    category: "RERA",
    pattern: "Project not registered with RERA",
    severity: "critical",
    description:
      "Under RERA Act 2016, all projects with plot area > 500 sqm or > 8 units must be registered. Unregistered projects are illegal to sell.",
    action: "Do NOT proceed. Ask the builder for RERA registration number. If unavailable, walk away.",
  },
  {
    id: "rf_rera_expired",
    category: "RERA",
    pattern: "RERA registration has expired",
    severity: "critical",
    description:
      "Expired RERA registration means the builder has not renewed. This indicates potential project stalling or abandonment.",
    action: "Verify with GujRERA portal. If expired, ask builder for renewal proof. Do not pay any amount until renewed.",
  },
  {
    id: "rf_builder_complaints",
    category: "Builder",
    pattern: "Multiple complaints against builder on RERA portal",
    severity: "high",
    description:
      "Multiple buyer complaints on the RERA portal indicate delivery issues, quality problems, or disputes.",
    action: "Review each complaint on the GujRERA portal. Speak to existing buyers. Negotiate stronger contractual protections.",
  },
  {
    id: "rf_seller_name_mismatch",
    category: "Title",
    pattern: "Seller name does not match property records",
    severity: "critical",
    description:
      "If the person selling the property is not the registered owner, this could indicate fraud or unauthorized sale.",
    action: "Verify seller identity against property card (7/12 extract). Check for Power of Attorney if different person.",
  },
  {
    id: "rf_agricultural_land",
    category: "Land Use",
    pattern: "Property is on agricultural land without NA (Non-Agricultural) conversion",
    severity: "critical",
    description:
      "In Gujarat, agricultural land cannot be used for residential/commercial purposes without NA permission from the Collector's office.",
    action: "Verify NA order. Check with Mamlatdar office. Without NA, the construction is illegal.",
  },
  {
    id: "rf_active_litigation",
    category: "Legal",
    pattern: "Active court case or litigation on the property",
    severity: "critical",
    description:
      "Properties under litigation have disputed ownership. Purchase could be challenged in court.",
    action: "Get a legal search done. Check Ecourts portal for pending cases. Do NOT proceed until litigation is resolved.",
  },
  {
    id: "rf_encumbrance",
    category: "Title",
    pattern: "Property has existing mortgage or encumbrance",
    severity: "high",
    description:
      "Existing mortgage means the bank has a lien on the property. The seller must clear the mortgage before transfer.",
    action: "Get encumbrance certificate from Sub-Registrar office. Verify no outstanding loans.",
  },
  {
    id: "rf_no_oc",
    category: "Approvals",
    pattern: "No Occupancy Certificate (OC) for completed building",
    severity: "high",
    description:
      "Without OC, the building may not comply with approved plans. Utility connections may be temporary. Resale will be difficult.",
    action: "Ask builder for OC. If under construction, check for Commencement Certificate (CC).",
  },
  {
    id: "rf_no_cc",
    category: "Approvals",
    pattern: "No Commencement Certificate (CC) for under-construction building",
    severity: "high",
    description:
      "Without CC from the municipal corporation, construction has not been officially permitted.",
    action: "Verify CC with SMC (Surat Municipal Corporation). Do not invest in unauthorized construction.",
  },
  {
    id: "rf_price_below_jantri",
    category: "Financial",
    pattern: "Transaction value significantly below jantri rate",
    severity: "high",
    description:
      "If the declared value is below jantri rate, stamp duty will still be calculated on jantri value. Also indicates potential undervaluation for tax evasion.",
    action: "Calculate stamp duty on the higher of market value and jantri rate. Ensure agreement reflects true consideration.",
  },
  {
    id: "rf_cash_component",
    category: "Financial",
    pattern: "Builder or seller demands cash component (black money)",
    severity: "critical",
    description:
      "Cash component is illegal under Income Tax Act and Benami Transaction Act. You lose legal recourse for the cash portion.",
    action: "Refuse cash component. Insist on 100% white transaction via banking channels. Report to authorities if pressured.",
  },
  {
    id: "rf_no_title_chain",
    category: "Title",
    pattern: "Incomplete or broken chain of title documents",
    severity: "high",
    description:
      "A clear chain of title from the original owner to the current seller is essential. Gaps indicate potential disputes.",
    action: "Get a title search report from a lawyer. Verify all previous sale deeds, mutation entries, and inheritance documents.",
  },
];

const getJantriRateTool = tool(
  "get_jantri_rate",
  "Look up the government jantri (ready reckoner) rate for a Surat zone. Returns rate range per sqft for residential/commercial.",
  {
    zone: z
      .string()
      .describe(
        "Zone identifier (e.g. 'zone_1') or area name (e.g. 'Athwa', 'Adajan', 'Vesu')"
      ),
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
  },
  async ({ zone, property_type }) => {
    const result = lookupJantriRate(zone, property_type as PropertyType);

    if (!result) {
      // Return all available zones to help the agent
      const availableZones = SURAT_JANTRI_RATES.map(
        (r) => `${r.zone} (${r.area})`
      ).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Zone '${zone}' not found. Available zones: ${availableZones}`,
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
            zone,
            area: result.area,
            property_type,
            rate_min: result.rate.min,
            rate_max: result.rate.max,
            unit: result.unit,
            rate_description: `Rs ${result.rate.min.toLocaleString("en-IN")} - Rs ${result.rate.max.toLocaleString("en-IN")} per ${result.unit}`,
            note: "Jantri rates are government-prescribed minimum values. Actual market rates may be higher. Stamp duty is calculated on the higher of jantri and transaction value.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const calculateStampDutyTool = tool(
  "calculate_stamp_duty",
  "Calculate Gujarat stamp duty and registration fees for a property transaction. Includes female buyer discount if applicable.",
  {
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
    property_value: z.number().describe("Property value / transaction amount in INR"),
    buyer_gender: z
      .enum(["male", "female"])
      .optional()
      .describe("Buyer gender — female first-time buyers get registration fee discount in Gujarat"),
  },
  async ({ property_type, property_value, buyer_gender }) => {
    const result = calculateStampDuty(
      property_type as PropertyType,
      property_value,
      buyer_gender ?? "male"
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            state: result.state,
            property_type,
            property_value: `Rs ${property_value.toLocaleString("en-IN")}`,
            total_duty: `Rs ${result.dutyAmount.toLocaleString("en-IN")}`,
            duty_breakdown: result.dutyType,
            e_stamping_available: result.eStampingAvailable,
            registration_required: result.registrationRequired,
            penalty_info: result.penaltyInfo,
            buyer_gender: buyer_gender ?? "male",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const checkRedFlagsTool = tool(
  "check_red_flags",
  "Check property attributes against known red flag patterns. Pass in the current verification findings and get back applicable red flags with severity and recommended actions.",
  {
    rera_registered: z.boolean().describe("Is the project RERA registered?"),
    rera_expired: z.boolean().optional().describe("Has the RERA registration expired?"),
    builder_complaints: z.number().optional().describe("Number of complaints against builder on RERA portal"),
    seller_name_mismatch: z.boolean().optional().describe("Does seller name mismatch property records?"),
    agricultural_land: z.boolean().optional().describe("Is the property on agricultural land without NA conversion?"),
    active_litigation: z.boolean().optional().describe("Are there active court cases on the property?"),
    has_encumbrance: z.boolean().optional().describe("Does the property have existing mortgage/encumbrance?"),
    has_oc: z.boolean().optional().describe("Does the building have an Occupancy Certificate? (for completed buildings)"),
    has_cc: z.boolean().optional().describe("Does the building have a Commencement Certificate? (for under-construction)"),
    price_below_jantri: z.boolean().optional().describe("Is the transaction value below jantri rate?"),
    cash_component_demanded: z.boolean().optional().describe("Has the builder/seller demanded cash component?"),
    title_chain_complete: z.boolean().optional().describe("Is the chain of title documents complete?"),
  },
  async (params) => {
    const triggered: RedFlag[] = [];

    if (!params.rera_registered) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_rera_not_registered")!);
    }
    if (params.rera_expired) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_rera_expired")!);
    }
    if (params.builder_complaints && params.builder_complaints >= 3) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_builder_complaints")!);
    }
    if (params.seller_name_mismatch) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_seller_name_mismatch")!);
    }
    if (params.agricultural_land) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_agricultural_land")!);
    }
    if (params.active_litigation) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_active_litigation")!);
    }
    if (params.has_encumbrance) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_encumbrance")!);
    }
    if (params.has_oc === false) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_no_oc")!);
    }
    if (params.has_cc === false) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_no_cc")!);
    }
    if (params.price_below_jantri) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_price_below_jantri")!);
    }
    if (params.cash_component_demanded) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_cash_component")!);
    }
    if (params.title_chain_complete === false) {
      triggered.push(RED_FLAG_PATTERNS.find((r) => r.id === "rf_no_title_chain")!);
    }

    const criticalCount = triggered.filter((r) => r.severity === "critical").length;
    const highCount = triggered.filter((r) => r.severity === "high").length;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            total_red_flags: triggered.length,
            critical_count: criticalCount,
            high_count: highCount,
            overall_risk: criticalCount > 0 ? "CRITICAL" : highCount > 0 ? "HIGH" : triggered.length > 0 ? "MEDIUM" : "LOW",
            red_flags: triggered.map((r) => ({
              id: r.id,
              category: r.category,
              severity: r.severity,
              description: r.description,
              action: r.action,
            })),
            recommendation:
              criticalCount > 0
                ? "STOP — Critical red flags detected. Do NOT proceed with this purchase without resolving these issues."
                : highCount > 0
                  ? "CAUTION — High-risk issues found. Get professional verification before proceeding."
                  : triggered.length > 0
                    ? "REVIEW — Some concerns found. Verify before finalizing."
                    : "CLEAR — No red flags detected based on available information.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// Document checklists by property type
const DOCUMENT_CHECKLISTS: Record<string, string[]> = {
  residential_flat: [
    "Sale Agreement / Agreement to Sell",
    "Title Deed (from builder to buyer)",
    "RERA Registration Certificate",
    "Approved Building Plan",
    "Commencement Certificate (CC)",
    "Occupancy Certificate (OC) — for ready possession",
    "No Objection Certificate (NOC) from Society (if resale)",
    "Encumbrance Certificate (last 30 years)",
    "Property Tax Receipts (up to date)",
    "Society Registration Certificate and Bye-laws",
    "Builder-Buyer Agreement (RERA-compliant format)",
    "Allotment Letter",
    "Possession Letter",
    "Share Certificate / Conveyance Deed",
    "Stamp Duty Payment Receipt",
    "Registration Receipt from Sub-Registrar",
    "Khata Certificate / Property Card",
    "Approved Layout Plan",
    "Electricity and Water Connection NOC",
    "GST Invoice (if under-construction)",
  ],
  commercial_office: [
    "Sale Agreement / Lease Agreement",
    "Title Deed",
    "RERA Registration Certificate (if applicable)",
    "Approved Building Plan (commercial use approved)",
    "Commencement Certificate (CC)",
    "Occupancy Certificate (OC)",
    "Fire NOC",
    "Environmental Clearance (if applicable)",
    "Encumbrance Certificate (last 30 years)",
    "Property Tax Receipts (commercial rate)",
    "Stamp Duty Payment Receipt",
    "Registration Receipt",
    "Change of Land Use Certificate (if converted)",
    "Shop and Establishment License eligibility",
  ],
  plot: [
    "Sale Deed",
    "7/12 Extract (Saat-Baara Utara)",
    "8A Extract (Aath-A Utara / Village Form 8A)",
    "NA (Non-Agricultural) Order from Collector",
    "Approved Layout Plan / Town Planning Scheme",
    "Encumbrance Certificate (last 30 years)",
    "Title Search Report (minimum 30 years)",
    "Mutation Entry in Revenue Records",
    "Property Tax Receipts",
    "Survey Map / Measurement Map",
    "Development Permission (if applicable)",
    "No Litigation Certificate",
    "Stamp Duty Payment Receipt",
    "Registration Receipt",
  ],
  row_house: [
    "Sale Agreement",
    "Title Deed",
    "RERA Registration Certificate",
    "Approved Building Plan",
    "Commencement Certificate (CC)",
    "Occupancy Certificate (OC)",
    "7/12 Extract (for the land)",
    "NA Order (if applicable)",
    "Encumbrance Certificate (last 30 years)",
    "Property Tax Receipts",
    "Society / Association Formation Documents",
    "Stamp Duty Payment Receipt",
    "Registration Receipt",
    "Common Area Agreement",
    "Electricity and Water Connection NOC",
  ],
  villa: [
    "Sale Agreement",
    "Title Deed",
    "RERA Registration Certificate",
    "Approved Building Plan",
    "Commencement Certificate (CC)",
    "Occupancy Certificate (OC)",
    "7/12 Extract (for the land)",
    "NA Order (if applicable)",
    "Encumbrance Certificate (last 30 years)",
    "Property Tax Receipts",
    "Compound Wall Boundary Agreement",
    "Stamp Duty Payment Receipt",
    "Registration Receipt",
    "Common Area / Amenity Agreement",
    "Electricity and Water Connection NOC",
    "Borewell Permission (if applicable)",
  ],
};

const getRequiredDocumentsTool = tool(
  "get_required_documents",
  "Get the document checklist for a given property type in Gujarat. Lists all documents the buyer should collect and verify.",
  {
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
  },
  async ({ property_type }) => {
    const documents = DOCUMENT_CHECKLISTS[property_type] ?? [];

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            property_type,
            total_documents: documents.length,
            documents: documents.map((doc, i) => ({
              serial: i + 1,
              document: doc,
            })),
            note: "This is a standard checklist. Additional documents may be required depending on specific property circumstances. Always consult a property lawyer for completeness.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const calculateTotalCostTool = tool(
  "calculate_total_cost",
  "Calculate the TRUE total cost of a property purchase in Gujarat, including all hidden costs. Shows: bank vs cash split, stamp duty (on declared value only), registration fee, GST, maintenance deposit, corpus fund, parking, advocate fees, broker commission, utility deposits. Also calculates legal risks of cash component and future capital gains tax impact of under-declaration. This is the most important tool for a buyer — it shows what you ACTUALLY pay vs the listed price.",
  {
    total_price: z.number().describe("Total agreed price with builder/seller (bank + cash combined) in INR"),
    declared_value: z.number().describe("Declared/registered value (bank payment only — what appears on paper) in INR. If no cash component, same as total_price."),
    carpet_area_sqft: z.number().describe("Carpet area in square feet"),
    property_type: z.enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"]).describe("Property type"),
    buyer_gender: z.enum(["male", "female"]).describe("Buyer gender (female first-time buyers get registration fee discount in Gujarat)"),
    is_first_property: z.boolean().describe("Is this the buyer's first property?"),
    is_under_construction: z.boolean().describe("Is the property under construction? (affects GST applicability)"),
    maintenance_deposit_per_sqft: z.number().optional().describe("Maintenance deposit rate in ₹/sqft (if known)"),
    monthly_maintenance: z.number().optional().describe("Monthly maintenance amount in ₹ (if known)"),
    maintenance_months: z.number().optional().describe("Months of advance maintenance required (typically 12-24)"),
    corpus_fund: z.number().optional().describe("One-time corpus/sinking fund amount in ₹"),
    parking_charges: z.number().optional().describe("Parking charges in ₹ (if separate from price)"),
    parking_type: z.enum(["covered", "open", "stilt", "none"]).optional().describe("Parking type (for default estimate if charges not provided)"),
    advocate_fees: z.number().optional().describe("Lawyer/advocate fees in ₹"),
    broker_commission: z.number().optional().describe("Broker commission in ₹ (if applicable)"),
    utility_deposits: z.number().optional().describe("Electricity/water connection deposits in ₹"),
  },
  async (input) => {
    const breakdown = calculateTotalCost({
      propertyType: input.property_type,
      totalPrice: input.total_price,
      declaredValue: input.declared_value,
      carpetAreaSqft: input.carpet_area_sqft,
      buyerGender: input.buyer_gender,
      isFirstProperty: input.is_first_property,
      isUnderConstruction: input.is_under_construction,
      maintenanceDepositPerSqft: input.maintenance_deposit_per_sqft,
      monthlyMaintenance: input.monthly_maintenance,
      maintenanceMonths: input.maintenance_months,
      corpusFund: input.corpus_fund,
      parkingCharges: input.parking_charges,
      parkingType: input.parking_type,
      advocateFees: input.advocate_fees,
      brokerCommission: input.broker_commission,
      utilityDeposits: input.utility_deposits,
    });

    const formattedReport = formatCostBreakdown(breakdown);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ...breakdown,
            formatted_report: formattedReport,
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getRegistrationGuideTool = tool(
  "get_registration_guide",
  "Get step-by-step Gujarat property registration guide including e-stamping, Sub-Registrar appointment, biometric verification, document preparation, witness requirements, and post-registration collection. Tailored to property type.",
  {
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
    city: z
      .string()
      .optional()
      .describe("City name (default: Surat)"),
  },
  async ({ property_type, city }) => {
    const guide = getRegistrationGuide(property_type as PropertyType, city ?? "Surat");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            property_type,
            city: guide.city,
            state: guide.state,
            total_steps: guide.totalSteps,
            estimated_total_time: guide.estimatedTotalTime,
            steps: guide.steps.map((s) => ({
              step: s.step,
              title: s.title,
              description: s.description,
              location: s.location,
              documents_needed: s.documentsNeeded,
              estimated_time: s.estimatedTime,
              fees: s.fees ?? null,
              tips: s.tips,
            })),
            witness_requirements: {
              count: guide.witnessRequirements.count,
              id_required: guide.witnessRequirements.idRequired,
              notes: guide.witnessRequirements.notes,
            },
            biometric_requirements: {
              required: guide.biometricRequirements.required,
              who: guide.biometricRequirements.who,
              notes: guide.biometricRequirements.notes,
            },
            note: "This guide is specific to Gujarat property registration. The process may vary slightly by Sub-Registrar office. Always confirm requirements with your advocate.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getPostPurchaseChecklistTool = tool(
  "get_post_purchase_checklist",
  "Get the complete post-purchase formalities checklist for Gujarat. Includes property mutation (8A update), tax transfer, society registration, utility connections, home loan verification, insurance, and document storage. Tasks are ordered by priority (mandatory first).",
  {
    property_type: z
      .enum(["residential_flat", "commercial_office", "plot", "row_house", "villa"])
      .describe("Property type"),
  },
  async ({ property_type }) => {
    const tasks = getPostPurchaseChecklist(property_type as PropertyType);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            property_type,
            total_tasks: tasks.length,
            mandatory_count: tasks.filter((t) => t.mandatory).length,
            tasks: tasks.map((t, i) => ({
              serial: i + 1,
              id: t.id,
              task: t.task,
              description: t.description,
              where: t.where,
              when: t.when,
              documents_needed: t.documentsNeeded,
              estimated_time: t.estimatedTime,
              mandatory: t.mandatory,
              category: t.category,
            })),
            note: "Complete mandatory tasks first. Timelines are from the date of property registration. For Surat-specific offices, use the addresses and contacts provided.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getVerificationLimitationsTool = tool(
  "get_verification_limitations",
  "Get a list of what this agent CANNOT verify or find. This is a safety disclaimer that should be included in every due diligence report and dossier. A 'Clear' status means no issues were found in available data — it does NOT mean the property is risk-free. Filtered by purchase phase.",
  {
    phase: z
      .enum(["due_diligence", "document_review", "financial_analysis", "registration", "post_purchase"])
      .optional()
      .describe("Filter by purchase phase (omit for all constraints)"),
  },
  async ({ phase }) => {
    const constraints = getConstraintsForPhase(phase as PurchasePhase | undefined);
    const disclaimer = formatConstraintsDisclaimer(phase as PurchasePhase | undefined);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            phase: phase ?? "all",
            total_limitations: constraints.length,
            critical_count: constraints.filter((c) => c.severity === "critical").length,
            limitations: constraints.map((c) => ({
              id: c.id,
              limitation: c.limitation,
              severity: c.severity,
              reason: c.reason,
              buyer_action: c.whatBuyerShouldDo,
            })),
            formatted_disclaimer: disclaimer,
            note: "ALWAYS include this disclaimer in reports. A 'Clear' result without this disclaimer may give buyers false confidence.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const reviewReportTool = tool(
  "review_report",
  "Critic / Reflection tool — acts as a 'Senior Property Lawyer' reviewing the due diligence report BEFORE presenting to the buyer. Checks for: cross-portal consistency, coverage gaps, hallucinated claims, risk rating accuracy, financial completeness, and missing disclaimers. Returns a structured review with APPROVED/REVISE verdict, quality scores, and specific issues to fix. ALWAYS call this before presenting a final summary or dossier to the buyer.",
  {
    report_content: z
      .string()
      .describe("The full text of the due diligence report or summary you are about to present to the buyer"),
    verifications: z
      .array(
        z.object({
          id: z.string(),
          purchaseId: z.string(),
          timestamp: z.string(),
          portal: z.string(),
          action: z.string(),
          query: z.string(),
          result: z.string(),
          status: z.enum(["verified", "unverified", "failed", "partial", "not_checked"]),
          screenshotPath: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .describe("Array of verification entries from get_verification_log — pass the full log here"),
    phase: z
      .enum(["due_diligence", "document_review", "financial_analysis", "registration", "post_purchase"])
      .describe("Current purchase phase"),
  },
  async ({ report_content, verifications, phase }) => {
    const typedVerifications: VerificationEntry[] = verifications.map((v) => ({
      ...v,
      status: v.status as VerificationStatus,
    }));

    const review = runCriticReview(report_content, typedVerifications, phase as PurchasePhase);
    const formatted = formatCriticReview(review);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            verdict: review.verdict,
            overall_quality: review.overallQuality,
            coverage_score: review.coverageScore,
            consistency_score: review.consistencyScore,
            completeness_score: review.completenessScore,
            total_issues: review.totalIssues,
            critical_issues: review.criticalIssues,
            major_issues: review.majorIssues,
            minor_issues: review.minorIssues,
            issues: review.issues,
            formatted_review: formatted,
            instructions: review.verdict === "REVISE"
              ? "REVISE the report to address the issues listed above, then call review_report again. Max 2 revision rounds."
              : "Report is APPROVED. Present it to the buyer with confidence.",
          }),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

export const propertyKbMcp = createSdkMcpServer({
  name: "property-kb-mcp",
  tools: [
    getJantriRateTool,
    calculateStampDutyTool,
    checkRedFlagsTool,
    getRequiredDocumentsTool,
    calculateTotalCostTool,
    getRegistrationGuideTool,
    getPostPurchaseChecklistTool,
    getVerificationLimitationsTool,
    reviewReportTool,
  ],
});
