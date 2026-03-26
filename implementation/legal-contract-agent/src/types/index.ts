// Core types for the Legal/Contract Intelligence Agent

export interface ContractMetadata {
  title: string;
  counterparty: string;
  contractType: ContractType;
  ourRole: string;
  state: string;
  effectiveDate?: string;
  parties: Party[];
}

export interface Party {
  name: string;
  role: "customer" | "developer" | "vendor" | "client" | "employer" | "employee" | "landlord" | "tenant" | "other";
  jurisdiction?: string;
  entityType?: string;
}

export type ContractType =
  | "msa"
  | "nda"
  | "employment"
  | "freelancer"
  | "lease"
  | "shareholder"
  | "dpa"
  | "sow"
  | "service_agreement"
  | "other";

export type RiskLevel = "critical" | "high" | "medium" | "low" | "ok";

export interface ClauseAnalysis {
  clauseNumber: string;
  clauseTitle: string;
  category: ClauseCategory;
  originalText: string;
  riskLevel: RiskLevel;
  riskExplanation: string;
  riskExplanationBusiness: string;
  applicableLaws: string[];
  suggestedAlternative?: string;
  negotiationPoint?: string;
  isMissingClause: boolean;
}

export type ClauseCategory =
  | "indemnity"
  | "non_compete"
  | "termination"
  | "ip_assignment"
  | "confidentiality"
  | "liability"
  | "governing_law"
  | "arbitration"
  | "data_protection"
  | "payment"
  | "warranty"
  | "force_majeure"
  | "auto_renewal"
  | "stamp_duty"
  | "missing_clause"
  | "other";

export interface ContractAnalysisResult {
  metadata: ContractMetadata;
  overallRiskScore: number;
  riskGrade: string;
  totalClausesIdentified: number;
  clausesFlagged: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  missingClausesCount: number;
  clauses: ClauseAnalysis[];
  stampDuty?: StampDutyResult;
  executiveSummary: string;
  negotiationPlaybook?: string;
}

export interface StampDutyResult {
  state: string;
  documentType: string;
  contractValue?: number;
  dutyAmount: number;
  dutyType: "fixed" | "percentage";
  eStampingAvailable: boolean;
  registrationRequired: boolean;
  penaltyInfo: string;
}

export interface ClausePattern {
  id: string;
  patternName: string;
  category: ClauseCategory;
  riskLevel: RiskLevel;
  riskDescription: string;
  riskDescriptionBusiness: string;
  applicableLaws: string[];
  exampleRiskyText: string;
  suggestedAlternative: string;
  negotiationTalkingPoint: string;
}

export interface StampDutyEntry {
  state: string;
  documentType: string;
  dutyType: "fixed" | "percentage";
  dutyAmountFixed?: number;
  dutyRatePercentage?: number;
  maxCap?: number;
  eStampingAvailable: boolean;
  registrationRequired: boolean;
  registrationCondition?: string;
  penaltyForDeficiency: string;
}
