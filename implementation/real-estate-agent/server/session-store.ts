export interface SessionState {
  id: string;
  sdkSessionId?: string;
  address: string;
  state: string;
  city: string;
  propertyType: string;
  budget: number;
  builderName?: string;
  reraId?: string;
  primaryConcern: string;
  messages: Array<{
    role: "user" | "agent" | "system";
    content: string;
    timestamp: string;
  }>;
  createdAt: string;
  status: "created" | "active" | "error";
}

const sessions = new Map<string, SessionState>();
let counter = 0;

export function createSession(
  data: Omit<SessionState, "id" | "messages" | "createdAt" | "status">
): SessionState {
  const id = `sess_${Date.now()}_${++counter}`;
  const session: SessionState = {
    ...data,
    id,
    messages: [],
    createdAt: new Date().toISOString(),
    status: "created",
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function updateSession(
  id: string,
  update: Partial<SessionState>
): void {
  const session = sessions.get(id);
  if (!session) return;
  Object.assign(session, update);
}

export function addMessage(
  id: string,
  role: "user" | "agent" | "system",
  content: string
): void {
  const session = sessions.get(id);
  if (!session) return;
  session.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
}
