// Total Cost Intelligence — the REAL cost of buying property in Gujarat
//
// In Gujarat, property transactions commonly involve split payments:
// - Bank transfer ("white money") — this is the declared value
// - Cash payment ("black money") — no paper trail
//
// All government fees (stamp duty, registration, GST) are calculated
// on the DECLARED value only, not the total transaction value.
//
// This module calculates the TRUE total cost including all components
// that buyers often don't account for until they're at the registrar's office.

export interface TotalCostInput {
  // Property details
  propertyType: "residential_flat" | "commercial_office" | "plot" | "row_house" | "villa";
  totalPrice: number;                    // Full agreed price (bank + cash)
  declaredValue: number;                 // Declared/registered value (bank portion only)
  carpetAreaSqft: number;               // Carpet area in sqft

  // Buyer details
  buyerGender: "male" | "female";
  isFirstProperty: boolean;
  isUnderConstruction: boolean;          // Affects GST applicability

  // Optional — agent should ask if not provided
  maintenanceDepositPerSqft?: number;    // ₹/sqft (typically ₹50-150)
  maintenanceMonths?: number;            // Months of advance maintenance (typically 12-24)
  monthlyMaintenance?: number;           // ₹/month
  corpusFund?: number;                   // One-time society contribution
  parkingCharges?: number;              // If not included in price
  parkingType?: "covered" | "open" | "stilt" | "none";
  advocateFees?: number;                // Lawyer fees (typically ₹15K-50K)
  brokerCommission?: number;            // If applicable (typically 1-2%)
  utilityDeposits?: number;             // Electricity, water, gas connection
  clubMembership?: number;              // If applicable
  floorRise?: number;                   // Additional charge per floor (if applicable)
  preferentialLocationCharge?: number;   // Corner unit, garden facing, etc.
}

export interface TotalCostBreakdown {
  // Listed price
  agreedPrice: number;
  declaredValue: number;
  cashComponent: number;
  cashPercentage: number;

  // Government fees (calculated on DECLARED value)
  stampDuty: number;
  stampDutyRate: string;
  registrationFee: number;
  registrationFeeRate: string;
  gst: number;
  gstRate: string;
  gstApplicable: boolean;

  // Builder charges
  maintenanceDeposit: number;
  corpusFund: number;
  parkingCharges: number;
  utilityDeposits: number;
  clubMembership: number;
  floorRise: number;
  plc: number;

  // Third party
  advocateFees: number;
  brokerCommission: number;

  // Totals
  totalGovernmentFees: number;
  totalBuilderCharges: number;
  totalThirdParty: number;
  grandTotal: number;
  overListedPrice: number;
  overListedPricePercent: number;

  // Risk analysis
  legalRisks: CostRisk[];
  futureTaxImpact: FutureTaxImpact;
}

export interface CostRisk {
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  impact: string;
}

export interface FutureTaxImpact {
  declaredCostBasis: number;          // What you "paid" per government records
  actualCostBasis: number;            // What you actually paid
  ifSoldAt: number;                   // Assumed sale price (1.5× in 5 years)
  capitalGainsOnDeclared: number;     // CG tax on declared basis
  capitalGainsOnActual: number;       // CG tax if actual was declared
  additionalTaxBurden: number;        // Extra tax you'll pay because of under-declaration
  note: string;
}

// Gujarat-specific rates
const STAMP_DUTY_RATES = {
  residential_flat: { male: 0.035, female: 0.035 },
  commercial_office: { male: 0.049, female: 0.049 },
  plot: { male: 0.049, female: 0.049 },
  row_house: { male: 0.035, female: 0.035 },
  villa: { male: 0.035, female: 0.035 },
};

const REGISTRATION_FEE_RATE = 0.01; // 1%
const FEMALE_REGISTRATION_DISCOUNT = 10000; // ₹10,000 discount for female first-time buyers

// GST rates (on under-construction properties, calculated on declared value minus land)
const GST_RATE_REGULAR = 0.05;     // 5% without ITC
const GST_RATE_AFFORDABLE = 0.01;  // 1% for affordable housing (< ₹45L)
const AFFORDABLE_THRESHOLD = 4500000;

// Default estimates when buyer doesn't provide specific amounts
const DEFAULTS = {
  maintenanceDepositPerSqft: 75,     // ₹75/sqft typical for Surat
  maintenanceMonths: 12,             // 12 months advance
  monthlyMaintenancePerSqft: 4,      // ₹4/sqft/month typical
  corpusFundPerSqft: 50,            // ₹50/sqft typical
  advocateFees: 25000,              // ₹25,000 typical for Surat
  utilityDeposits: 15000,           // Electricity + water connection
  parkingCovered: 300000,           // Covered parking
  parkingOpen: 100000,              // Open parking
  parkingStilt: 200000,             // Stilt parking
};

export function calculateTotalCost(input: TotalCostInput): TotalCostBreakdown {
  const cashComponent = input.totalPrice - input.declaredValue;
  const cashPercentage = (cashComponent / input.totalPrice) * 100;

  // --- Government fees (on DECLARED value) ---
  const stampDutyRate = STAMP_DUTY_RATES[input.propertyType]?.[input.buyerGender] ?? 0.035;
  const stampDuty = Math.round(input.declaredValue * stampDutyRate);

  let registrationFee = Math.round(input.declaredValue * REGISTRATION_FEE_RATE);
  if (input.buyerGender === "female" && input.isFirstProperty) {
    registrationFee = Math.max(100, registrationFee - FEMALE_REGISTRATION_DISCOUNT);
  }

  let gst = 0;
  let gstRate = "0% (ready-to-move — no GST)";
  let gstApplicable = false;
  if (input.isUnderConstruction) {
    gstApplicable = true;
    if (input.declaredValue <= AFFORDABLE_THRESHOLD) {
      gst = Math.round(input.declaredValue * GST_RATE_AFFORDABLE);
      gstRate = `1% (affordable housing, declared value ≤ ₹45L)`;
    } else {
      gst = Math.round(input.declaredValue * GST_RATE_REGULAR);
      gstRate = `5% without ITC (under-construction)`;
    }
  }

  // --- Builder charges ---
  const maintenanceDeposit = input.maintenanceDepositPerSqft
    ? input.maintenanceDepositPerSqft * input.carpetAreaSqft
    : input.monthlyMaintenance && input.maintenanceMonths
    ? input.monthlyMaintenance * input.maintenanceMonths
    : DEFAULTS.maintenanceDepositPerSqft * input.carpetAreaSqft;

  const corpusFund = input.corpusFund ?? Math.round(DEFAULTS.corpusFundPerSqft * input.carpetAreaSqft);

  let parkingCharges = input.parkingCharges ?? 0;
  if (!input.parkingCharges && input.parkingType && input.parkingType !== "none") {
    const parkingDefaults: Record<string, number> = {
      covered: DEFAULTS.parkingCovered,
      open: DEFAULTS.parkingOpen,
      stilt: DEFAULTS.parkingStilt,
    };
    parkingCharges = parkingDefaults[input.parkingType] ?? 0;
  }

  const utilityDeposits = input.utilityDeposits ?? DEFAULTS.utilityDeposits;
  const clubMembership = input.clubMembership ?? 0;
  const floorRise = input.floorRise ?? 0;
  const plc = input.preferentialLocationCharge ?? 0;

  // --- Third party ---
  const advocateFees = input.advocateFees ?? DEFAULTS.advocateFees;
  const brokerCommission = input.brokerCommission ?? 0;

  // --- Totals ---
  const totalGovernmentFees = stampDuty + registrationFee + gst;
  const totalBuilderCharges = maintenanceDeposit + corpusFund + parkingCharges + utilityDeposits + clubMembership + floorRise + plc;
  const totalThirdParty = advocateFees + brokerCommission;
  const grandTotal = input.totalPrice + totalGovernmentFees + totalBuilderCharges + totalThirdParty;
  const overListedPrice = grandTotal - input.totalPrice;
  const overListedPricePercent = (overListedPrice / input.totalPrice) * 100;

  // --- Legal risk analysis ---
  const legalRisks: CostRisk[] = [];

  if (cashPercentage > 0) {
    legalRisks.push({
      severity: cashPercentage > 50 ? "critical" : cashPercentage > 30 ? "high" : "medium",
      description: `${cashPercentage.toFixed(0)}% of transaction value is in cash (₹${formatINR(cashComponent)})`,
      impact: "Cash payments have no legal protection. If builder defaults or disputes arise, you cannot prove this payment in court. Income Tax department can also question the source of cash under Section 69.",
    });
  }

  if (input.declaredValue < input.totalPrice * 0.7) {
    legalRisks.push({
      severity: "critical",
      description: `Declared value (₹${formatINR(input.declaredValue)}) is less than 70% of actual price (₹${formatINR(input.totalPrice)})`,
      impact: "Under Section 56(2)(x) of the Income Tax Act, if declared value is significantly below stamp duty value (jantri), the difference can be deemed as income and taxed. Risk of IT department scrutiny.",
    });
  }

  if (cashPercentage > 0) {
    legalRisks.push({
      severity: "high",
      description: "No tax benefit on cash component for home loan interest/principal deductions",
      impact: `Under Section 24(b) and 80C, home loan tax benefits apply only to the loan amount. If you took a loan for ₹${formatINR(input.declaredValue)} but paid ₹${formatINR(input.totalPrice)} total, the cash portion gets no tax benefit.`,
    });
  }

  if (!gstApplicable && input.isUnderConstruction) {
    legalRisks.push({
      severity: "medium",
      description: "Under-construction property but GST not calculated — verify with builder",
      impact: "Builder may charge GST separately or include it in the price. Clarify before signing.",
    });
  }

  // --- Future capital gains tax impact ---
  const assumedSalePrice = Math.round(input.totalPrice * 1.5); // 50% appreciation in 5 years
  const capitalGainsOnDeclared = assumedSalePrice - input.declaredValue;
  const capitalGainsOnActual = assumedSalePrice - input.totalPrice;
  const ltcgRate = 0.125; // 12.5% LTCG on property (post-2024 budget)
  const additionalTaxBurden = Math.round((capitalGainsOnDeclared - capitalGainsOnActual) * ltcgRate);

  const futureTaxImpact: FutureTaxImpact = {
    declaredCostBasis: input.declaredValue,
    actualCostBasis: input.totalPrice,
    ifSoldAt: assumedSalePrice,
    capitalGainsOnDeclared: capitalGainsOnDeclared,
    capitalGainsOnActual: capitalGainsOnActual,
    additionalTaxBurden,
    note: additionalTaxBurden > 0
      ? `By declaring ₹${formatINR(input.declaredValue)} instead of ₹${formatINR(input.totalPrice)}, you will pay approximately ₹${formatINR(additionalTaxBurden)} MORE in capital gains tax when you sell (at 12.5% LTCG rate). The cash "savings" on stamp duty today (₹${formatINR(Math.round(cashComponent * stampDutyRate))}) may be offset by higher future tax.`
      : "No additional tax burden — declared value matches actual price.",
  };

  return {
    agreedPrice: input.totalPrice,
    declaredValue: input.declaredValue,
    cashComponent,
    cashPercentage,
    stampDuty,
    stampDutyRate: `${(stampDutyRate * 100).toFixed(1)}%${input.buyerGender === "female" && input.isFirstProperty ? " (female first-time buyer)" : ""}`,
    registrationFee,
    registrationFeeRate: `1%${input.buyerGender === "female" && input.isFirstProperty ? " (₹10,000 discount applied)" : ""}`,
    gst,
    gstRate,
    gstApplicable,
    maintenanceDeposit,
    corpusFund,
    parkingCharges,
    utilityDeposits,
    clubMembership,
    floorRise,
    plc,
    advocateFees,
    brokerCommission,
    totalGovernmentFees,
    totalBuilderCharges,
    totalThirdParty,
    grandTotal,
    overListedPrice,
    overListedPricePercent,
    legalRisks,
    futureTaxImpact,
  };
}

function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN");
}

// Helper to format the full breakdown as readable text (for the agent to include in reports)
export function formatCostBreakdown(breakdown: TotalCostBreakdown): string {
  const f = (n: number) => `₹${formatINR(n)}`;

  let output = `
## Total Cost Breakdown

### Transaction Structure
| Component | Amount | Notes |
|-----------|--------|-------|
| Agreed Price | ${f(breakdown.agreedPrice)} | Total amount agreed with builder/seller |
| Bank Payment (declared) | ${f(breakdown.declaredValue)} | Registered value — stamp duty/GST calculated on this |
| Cash Payment | ${f(breakdown.cashComponent)} | ${breakdown.cashPercentage.toFixed(0)}% of total — NO legal protection |

### Government Fees (calculated on declared value: ${f(breakdown.declaredValue)})
| Fee | Amount | Rate |
|-----|--------|------|
| Stamp Duty | ${f(breakdown.stampDuty)} | ${breakdown.stampDutyRate} |
| Registration Fee | ${f(breakdown.registrationFee)} | ${breakdown.registrationFeeRate} |
| GST | ${f(breakdown.gst)} | ${breakdown.gstRate} |
| **Subtotal** | **${f(breakdown.totalGovernmentFees)}** | |

### Builder/Society Charges
| Charge | Amount |
|--------|--------|
| Maintenance Deposit | ${f(breakdown.maintenanceDeposit)} |
| Corpus/Sinking Fund | ${f(breakdown.corpusFund)} |
| Parking | ${f(breakdown.parkingCharges)} |
| Utility Deposits | ${f(breakdown.utilityDeposits)} |
${breakdown.clubMembership > 0 ? `| Club Membership | ${f(breakdown.clubMembership)} |\n` : ""}${breakdown.floorRise > 0 ? `| Floor Rise | ${f(breakdown.floorRise)} |\n` : ""}${breakdown.plc > 0 ? `| Preferential Location | ${f(breakdown.plc)} |\n` : ""}| **Subtotal** | **${f(breakdown.totalBuilderCharges)}** |

### Third Party
| Fee | Amount |
|-----|--------|
| Advocate/Lawyer Fees | ${f(breakdown.advocateFees)} |
${breakdown.brokerCommission > 0 ? `| Broker Commission | ${f(breakdown.brokerCommission)} |\n` : ""}| **Subtotal** | **${f(breakdown.totalThirdParty)}** |

### Grand Total
| | Amount |
|--|--------|
| Listed/Agreed Price | ${f(breakdown.agreedPrice)} |
| + Government Fees | ${f(breakdown.totalGovernmentFees)} |
| + Builder Charges | ${f(breakdown.totalBuilderCharges)} |
| + Third Party | ${f(breakdown.totalThirdParty)} |
| **YOU ACTUALLY PAY** | **${f(breakdown.grandTotal)}** |
| Over listed price | ${f(breakdown.overListedPrice)} (+${breakdown.overListedPricePercent.toFixed(1)}%) |
`;

  if (breakdown.legalRisks.length > 0) {
    output += `\n### Legal Risks\n`;
    for (const risk of breakdown.legalRisks) {
      const icon = risk.severity === "critical" ? "⛔" : risk.severity === "high" ? "🔴" : "🟡";
      output += `${icon} **${risk.description}**\n${risk.impact}\n\n`;
    }
  }

  if (breakdown.futureTaxImpact.additionalTaxBurden > 0) {
    output += `\n### Future Capital Gains Tax Impact\n`;
    output += breakdown.futureTaxImpact.note + "\n";
  }

  return output;
}
