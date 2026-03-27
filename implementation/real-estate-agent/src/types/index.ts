// Real Estate Transaction Agent - Shared Types
// Gujarat-specific property transaction types

export type PropertyType =
  | "residential_flat"
  | "commercial_office"
  | "plot"
  | "row_house"
  | "villa";

export type PurchasePhase =
  | "due_diligence"
  | "document_review"
  | "financial_analysis"
  | "registration"
  | "post_purchase";

export type RiskLevel = "critical" | "high" | "medium" | "low" | "ok";

export type VerificationStatus =
  | "verified"
  | "unverified"
  | "failed"
  | "partial"
  | "not_checked";

export interface ReraProject {
  reraId: string;
  projectName: string;
  builderName: string;
  builderAddress: string;
  projectAddress: string;
  projectType: PropertyType;
  registrationDate: string;
  expiryDate: string;
  completionDate: string;
  projectStatus: string;
  totalUnits: number;
  bookedUnits: number;
  carpetAreaRange: { min: number; max: number; unit: string };
  complaints: number;
  approvedBy: string;
}

export interface ReraProjectDetail extends ReraProject {
  phases: Array<{
    phaseName: string;
    startDate: string;
    endDate: string;
    status: string;
    units: number;
  }>;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
  };
  documents: Array<{
    name: string;
    type: string;
    uploadDate: string;
    verified: boolean;
  }>;
  approvedPlan: {
    planNumber: string;
    approvalDate: string;
    authority: string;
    floors: number;
    totalBuiltUpArea: number;
  };
  lastUpdated: string;
}

export interface VerificationEntry {
  id: string;
  purchaseId: string;
  timestamp: string;
  portal: string;
  action: string;
  query: string;
  result: string;
  status: VerificationStatus;
  screenshotPath?: string;
  snapshotData?: Record<string, unknown>;
  notes?: string;
}

export interface Purchase {
  id: string;
  address: string;
  reraId?: string;
  builderName?: string;
  propertyType: PropertyType;
  budget: number;
  state: string;
  phase: PurchasePhase;
  createdAt: string;
  verifications: VerificationEntry[];
}

export interface RedFlag {
  id: string;
  category: string;
  pattern: string;
  severity: RiskLevel;
  description: string;
  action: string;
}

export interface StampDutyResult {
  state: string;
  documentType: string;
  contractValue: number;
  dutyAmount: number;
  dutyType: string;
  eStampingAvailable: boolean;
  registrationRequired: boolean;
  penaltyInfo?: string;
}

export interface JantriRate {
  zone: string;
  area: string;
  residentialRate: { min: number; max: number };
  commercialRate: { min: number; max: number };
  unit: string;
}
