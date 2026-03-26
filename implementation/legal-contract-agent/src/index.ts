// Legal/Contract Intelligence Agent
// Re-exports for programmatic usage

export { analyzeContract } from "./agent.js";
export type {
  AnalyzeContractOptions,
  ProgressEvent,
} from "./agent.js";
export type {
  ContractAnalysisResult,
  ClauseAnalysis,
  ContractMetadata,
  StampDutyResult,
  RiskLevel,
  ContractType,
  ClauseCategory,
} from "./types/index.js";
