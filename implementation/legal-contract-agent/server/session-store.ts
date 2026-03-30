// In-memory session store and file storage for the legal contract agent web UI.
// In production this would be backed by a database; for the prototype we use Maps.

import { randomUUID } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Finding {
  id: string;
  clauseNumber: string;
  clauseTitle: string;
  riskLevel: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  summary: string;
  details: string;
  legalBasis?: string;
  suggestedAction?: string;
}

export interface RiskSummary {
  overallScore: number; // 0-100
  critical: number;
  high: number;
  medium: number;
  low: number;
  summary: string;
}

export type SessionStatus = "created" | "analyzing" | "active" | "error";

export interface SessionState {
  id: string;
  sdkSessionId?: string;
  fileId: string;
  fileName: string;
  counterparty: string;
  contractType: string;
  ourRole: string;
  state: string; // Indian state for stamp duty
  contractValue?: number;
  pageCount: number;
  wordCount: number;
  chunkCount: number;
  messages: Message[];
  findings: Finding[];
  riskSummary?: RiskSummary;
  createdAt: string;
  status: SessionStatus;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  filePath: string;
  text: string;
  pageCount: number;
  wordCount: number;
}

// ── Stores ─────────────────────────────────────────────────────────────────

const sessions = new Map<string, SessionState>();
const files = new Map<string, UploadedFile>();

// ── Session operations ─────────────────────────────────────────────────────

export function createSession(
  init: Omit<SessionState, "id" | "messages" | "findings" | "createdAt" | "status">,
): SessionState {
  const session: SessionState = {
    id: randomUUID(),
    ...init,
    messages: [],
    findings: [],
    createdAt: new Date().toISOString(),
    status: "created",
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function updateSession(
  id: string,
  updates: Partial<Omit<SessionState, "id" | "createdAt">>,
): SessionState | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  return session;
}

export function addMessage(id: string, role: "user" | "assistant", content: string): void {
  const session = sessions.get(id);
  if (!session) return;
  session.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
}

export function addFinding(id: string, finding: Omit<Finding, "id">): void {
  const session = sessions.get(id);
  if (!session) return;
  session.findings.push({
    id: randomUUID(),
    ...finding,
  });
}

// ── File operations ────────────────────────────────────────────────────────

export function storeFile(file: Omit<UploadedFile, "id">): UploadedFile {
  const stored: UploadedFile = {
    id: randomUUID(),
    ...file,
  };
  files.set(stored.id, stored);
  return stored;
}

export function getFile(id: string): UploadedFile | undefined {
  return files.get(id);
}
