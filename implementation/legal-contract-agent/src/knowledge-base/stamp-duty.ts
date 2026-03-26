// Gujarat stamp duty rates for prototype
// In production, this would be in PostgreSQL with all 30 states

import type { StampDutyEntry } from "../types/index.js";

export const STAMP_DUTY_MATRIX: StampDutyEntry[] = [
  // Gujarat — common document types
  {
    state: "Gujarat",
    documentType: "Service Agreement",
    dutyType: "percentage",
    dutyRatePercentage: 0.5,
    maxCap: 25000,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  {
    state: "Gujarat",
    documentType: "NDA",
    dutyType: "fixed",
    dutyAmountFixed: 100,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  {
    state: "Gujarat",
    documentType: "Employment Agreement",
    dutyType: "fixed",
    dutyAmountFixed: 300,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  {
    state: "Gujarat",
    documentType: "MSA",
    dutyType: "percentage",
    dutyRatePercentage: 0.5,
    maxCap: 25000,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  {
    state: "Gujarat",
    documentType: "Lease Agreement",
    dutyType: "percentage",
    dutyRatePercentage: 1.0,
    eStampingAvailable: true,
    registrationRequired: true,
    registrationCondition: "If lease period exceeds 12 months",
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  // Maharashtra — common document types
  {
    state: "Maharashtra",
    documentType: "Service Agreement",
    dutyType: "percentage",
    dutyRatePercentage: 0.1,
    maxCap: 2500000,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  {
    state: "Maharashtra",
    documentType: "NDA",
    dutyType: "fixed",
    dutyAmountFixed: 500,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  // Delhi
  {
    state: "Delhi",
    documentType: "Service Agreement",
    dutyType: "percentage",
    dutyRatePercentage: 0.5,
    maxCap: 50000,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  {
    state: "Delhi",
    documentType: "NDA",
    dutyType: "fixed",
    dutyAmountFixed: 100,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
  // Karnataka
  {
    state: "Karnataka",
    documentType: "Service Agreement",
    dutyType: "percentage",
    dutyRatePercentage: 0.5,
    maxCap: 25000,
    eStampingAvailable: true,
    registrationRequired: false,
    penaltyForDeficiency: "2% per month of deficiency, max 4× duty amount",
  },
];

export function lookupStampDuty(
  state: string,
  documentType: string,
  contractValue?: number
): { dutyAmount: number; entry: StampDutyEntry | null } {
  const entry = STAMP_DUTY_MATRIX.find(
    (e) =>
      e.state.toLowerCase() === state.toLowerCase() &&
      e.documentType.toLowerCase() === documentType.toLowerCase()
  );

  if (!entry) {
    return { dutyAmount: 0, entry: null };
  }

  let dutyAmount: number;
  if (entry.dutyType === "fixed") {
    dutyAmount = entry.dutyAmountFixed ?? 0;
  } else {
    dutyAmount = ((contractValue ?? 0) * (entry.dutyRatePercentage ?? 0)) / 100;
    if (entry.maxCap && dutyAmount > entry.maxCap) {
      dutyAmount = entry.maxCap;
    }
  }

  return { dutyAmount, entry };
}
