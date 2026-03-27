// Gujarat stamp duty and registration fee calculation
// Source: Gujarat Stamp Act & Registration Act — current rates

import { PropertyType, StampDutyResult } from "../types/index.js";

/** Stamp duty rates by property category in Gujarat */
const STAMP_DUTY_RATES = {
  residential: 0.035, // 3.5%
  commercial: 0.049, // 4.9%
  plot_land: 0.049, // 4.9%
} as const;

/** Registration fee: 1% of property value */
const REGISTRATION_FEE_RATE = 0.01;
const REGISTRATION_FEE_MIN = 100; // INR

/** Discount for female first-time buyer on registration fee */
const FEMALE_BUYER_REGISTRATION_DISCOUNT = 10000; // INR

/** Gujarat supports e-stamping via SHCIL (Stock Holding Corporation of India) */
const E_STAMPING_AVAILABLE = true;

/** Penalty for stamp duty deficiency: 2% per month of deficient amount, max 200% */
const PENALTY_INFO =
  "Penalty for stamp duty deficiency: 2% per month on the deficient amount, " +
  "subject to a maximum of 200% of the deficient amount. " +
  "Documents with insufficient stamps may be impounded by the registrar.";

function getDutyCategory(
  type: PropertyType
): "residential" | "commercial" | "plot_land" {
  switch (type) {
    case "residential_flat":
    case "row_house":
    case "villa":
      return "residential";
    case "commercial_office":
      return "commercial";
    case "plot":
      return "plot_land";
  }
}

/**
 * Calculate stamp duty and registration fees for a Gujarat property transaction.
 *
 * @param type - Property type
 * @param contractValue - Declared transaction value in INR
 * @param buyerGender - Gender of the buyer ("male" | "female"), affects registration discount
 * @returns StampDutyResult with duty breakdown
 */
export function calculateStampDuty(
  type: PropertyType,
  contractValue: number,
  buyerGender: "male" | "female" = "male"
): StampDutyResult {
  const category = getDutyCategory(type);
  const dutyRate = STAMP_DUTY_RATES[category];
  const stampDuty = Math.round(contractValue * dutyRate);

  let registrationFee = Math.round(contractValue * REGISTRATION_FEE_RATE);
  registrationFee = Math.max(registrationFee, REGISTRATION_FEE_MIN);

  // Female first-time buyer discount on registration fee
  if (buyerGender === "female" && category === "residential") {
    registrationFee = Math.max(
      registrationFee - FEMALE_BUYER_REGISTRATION_DISCOUNT,
      REGISTRATION_FEE_MIN
    );
  }

  const totalDuty = stampDuty + registrationFee;

  const dutyTypeLabel =
    category === "residential"
      ? `Residential stamp duty @ ${(dutyRate * 100).toFixed(1)}%`
      : category === "commercial"
        ? `Commercial stamp duty @ ${(dutyRate * 100).toFixed(1)}%`
        : `Plot/Land stamp duty @ ${(dutyRate * 100).toFixed(1)}%`;

  const genderNote =
    buyerGender === "female" && category === "residential"
      ? " (includes Rs 10,000 registration fee discount for female first-time buyer)"
      : "";

  return {
    state: "Gujarat",
    documentType: `${category} property - sale deed`,
    contractValue,
    dutyAmount: totalDuty,
    dutyType: `${dutyTypeLabel} + registration @ 1%${genderNote}. Stamp duty: Rs ${stampDuty.toLocaleString("en-IN")}, Registration: Rs ${registrationFee.toLocaleString("en-IN")}`,
    eStampingAvailable: E_STAMPING_AVAILABLE,
    registrationRequired: true,
    penaltyInfo: PENALTY_INFO,
  };
}
