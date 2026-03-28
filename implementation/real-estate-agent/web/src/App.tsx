import { useState, useCallback, useRef, useEffect } from "react";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("re_sessionId");
    const savedData = localStorage.getItem("re_wizardData");
    if (savedId && savedData) {
      try {
        const data = JSON.parse(savedData) as WizardData;
        setSessionId(savedId);
        setWizardData(data);
        setPhase("chat");
        connectSSE(savedId);
      } catch {
        localStorage.removeItem("re_sessionId");
        localStorage.removeItem("re_wizardData");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSSE = useCallback((id: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/sessions/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("session_id", () => {
      // SDK session ID is stored server-side
    });

    es.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      setIsProcessing(true);
      setActiveTools((prev) => [
        ...prev,
        { tool: data.tool, display: data.toolLabel ?? data.display ?? data.tool, status: "running" },
      ]);
    });

    es.addEventListener("text", (e) => {
      const data = JSON.parse(e.data);
      setActiveTools([]);
      setIsProcessing(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: data.text ?? data.content ?? "",
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
      setIsProcessing(false);
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Error: ${data.message ?? data.error ?? "Unknown error"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      setActiveTools([]);
      setIsProcessing(false);
    });

    es.addEventListener("ping", () => {
      // keep-alive
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
        setPhase("chat");
        setIsProcessing(true);

        // Persist to localStorage
        localStorage.setItem("re_sessionId", id);
        localStorage.setItem("re_wizardData", JSON.stringify(data));

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
      setIsProcessing(true);

      try {
        const res = await fetch(`/api/sessions/${sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });

        if (!res.ok) throw new Error("Failed to send message");
      } catch (err) {
        setIsProcessing(false);
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

  const handleNewSession = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    localStorage.removeItem("re_sessionId");
    localStorage.removeItem("re_wizardData");
    setPhase("wizard");
    setWizardData(null);
    setSessionId(null);
    setMessages([]);
    setActiveTools([]);
    setIsProcessing(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Property Verification Copilot
            </h1>
            <p className="text-sm text-gray-500">
              Gujarat Real Estate Due Diligence
            </p>
          </div>
          {phase === "chat" && (
            <button
              onClick={handleNewSession}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              New Session
            </button>
          )}
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
              isProcessing={isProcessing}
              onSendMessage={handleSendMessage}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
