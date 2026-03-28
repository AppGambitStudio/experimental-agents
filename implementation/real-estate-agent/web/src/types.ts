export interface WizardData {
  address: string;
  state: string;
  city: string;
  propertyType: string;
  budget: number;
  builderName: string;
  reraId: string;
  primaryConcern: string;
}

export type AppPhase = "wizard" | "loading" | "chat";

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
}

export interface ToolCallEvent {
  tool: string;
  display: string;
  status: "running" | "done";
}

export type SSEEventType =
  | "tool_call"
  | "text"
  | "done"
  | "error"
  | "history"
  | "session_id"
  | "ping";
