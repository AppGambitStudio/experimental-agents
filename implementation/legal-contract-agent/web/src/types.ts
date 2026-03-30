export type AppPhase = "upload" | "details" | "processing" | "chat";

export interface UploadResult {
  fileId: string;
  fileName: string;
  pageCount: number;
  wordCount: number;
  clauses: string[];
  chunks: number;
  isSinglePass: boolean;
  estimatedTimeSeconds: number;
}

export interface ContractDetails {
  fileId: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  state: string;
  contractValue?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
}

export interface Finding {
  severity: "critical" | "high" | "medium" | "low";
  clause: string;
  title: string;
  summary: string;
}

export interface ChunkProgress {
  current: number;
  total: number;
  label: string;
  status: "pending" | "analyzing" | "done";
}

export interface RiskSummary {
  score: number;
  grade: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ToolCallEvent {
  tool: string;
  display: string;
  status: "running" | "done";
}
