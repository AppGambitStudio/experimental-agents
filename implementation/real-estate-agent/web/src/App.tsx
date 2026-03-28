import { useState, useCallback } from "react";
import type { AppPhase, WizardData, ChatMessage, ToolCallEvent } from "./types";
import Wizard from "./components/Wizard";
import SessionHeader from "./components/SessionHeader";
import Chat from "./components/Chat";

function App() {
  const [phase, setPhase] = useState<AppPhase>("wizard");
  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTools, setActiveTools] = useState<ToolCallEvent[]>([]);

  const connectSSE = useCallback((id: string) => {
    const es = new EventSource(`/api/sessions/${id}/stream`);

    es.addEventListener("session_id", (e) => {
      const data = JSON.parse(e.data);
      setSessionId(data.session_id);
    });

    es.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      setActiveTools((prev) => [
        ...prev,
        { tool: data.tool, display: data.display, status: "running" },
      ]);
    });

    es.addEventListener("text", (e) => {
      const data = JSON.parse(e.data);
      setActiveTools([]);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: data.content,
          timestamp: new Date().toISOString(),
        },
      ]);
      setPhase("chat");
    });

    es.addEventListener("history", (e) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: data.role ?? "system",
          content: data.content,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    es.addEventListener("done", () => {
      setActiveTools([]);
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Error: ${data.message ?? "Unknown error"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      setActiveTools([]);
    });

    es.addEventListener("ping", () => {
      // keep-alive, nothing to do
    });

    return es;
  }, []);

  const handleWizardSubmit = useCallback(
    async (data: WizardData) => {
      setWizardData(data);
      setPhase("loading");

      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error("Failed to create session");

        const { sessionId: id } = await res.json();
        setSessionId(id);
        connectSSE(id);
      } catch (err) {
        setPhase("wizard");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Failed to start session: ${err instanceof Error ? err.message : "Unknown error"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    [connectSSE],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) return;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        },
      ]);

      try {
        const res = await fetch(`/api/sessions/${sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });

        if (!res.ok) throw new Error("Failed to send message");
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    [sessionId],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">
            Property Verification Copilot
          </h1>
          <p className="text-sm text-gray-500">
            Gujarat Real Estate Due Diligence
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {phase === "wizard" && <Wizard onSubmit={handleWizardSubmit} />}

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4" />
            <p className="text-gray-600 font-medium">
              Starting verification...
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Setting up your property analysis session
            </p>
          </div>
        )}

        {phase === "chat" && wizardData && (
          <>
            <SessionHeader data={wizardData} />
            <Chat
              messages={messages}
              activeTools={activeTools}
              onSendMessage={handleSendMessage}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
