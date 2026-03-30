import { useState, useCallback, useRef, useEffect } from "react";
import type {
  AppPhase,
  UploadResult,
  ContractDetails,
  ChatMessage,
  Finding,
  ChunkProgress,
  RiskSummary,
  ToolCallEvent,
} from "./types";
import FileUpload from "./components/FileUpload";
import ContractDetailsForm from "./components/ContractDetails";
import ProcessingView from "./components/ProcessingView";
import SessionHeader from "./components/SessionHeader";
import RiskSummaryCard from "./components/RiskSummary";
import Chat from "./components/Chat";

function App() {
  const [phase, setPhase] = useState<AppPhase>("upload");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [contractDetails, setContractDetails] = useState<ContractDetails | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [activeTools, setActiveTools] = useState<ToolCallEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentMsgIdRef = useRef<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("lc_sessionId");
    const savedUpload = localStorage.getItem("lc_uploadResult");
    const savedDetails = localStorage.getItem("lc_contractDetails");
    if (savedId && savedUpload && savedDetails) {
      try {
        const upload = JSON.parse(savedUpload) as UploadResult;
        const details = JSON.parse(savedDetails) as ContractDetails;
        setSessionId(savedId);
        setUploadResult(upload);
        setContractDetails(details);
        setPhase("chat");
        connectSSE(savedId);
      } catch {
        localStorage.removeItem("lc_sessionId");
        localStorage.removeItem("lc_uploadResult");
        localStorage.removeItem("lc_contractDetails");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSSE = useCallback((id: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/sessions/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("structure", (e) => {
      const data = JSON.parse(e.data);
      // Structure event contains initial document analysis info
      if (data.clauses) {
        setUploadResult((prev) =>
          prev ? { ...prev, clauses: data.clauses } : prev
        );
      }
    });

    es.addEventListener("chunk_progress", (e) => {
      const data = JSON.parse(e.data);
      setChunkProgress({
        current: data.current,
        total: data.total,
        label: data.label ?? `Chunk ${data.current}/${data.total}`,
        status: data.status ?? "analyzing",
      });
    });

    es.addEventListener("finding", (e) => {
      const data = JSON.parse(e.data);
      setFindings((prev) => [
        ...prev,
        {
          severity: data.severity,
          clause: data.clause,
          title: data.title,
          summary: data.summary,
        },
      ]);
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
      const newText = data.text ?? data.content ?? "";
      if (!newText) return;
      setActiveTools([]);

      const msgId = currentMsgIdRef.current;
      if (msgId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, content: m.content + newText } : m
          )
        );
      } else {
        const newId = crypto.randomUUID();
        currentMsgIdRef.current = newId;
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            role: "agent" as const,
            content: newText,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });

    es.addEventListener("risk_summary", (e) => {
      const data = JSON.parse(e.data);
      setRiskSummary({
        score: data.score,
        grade: data.grade,
        critical: data.critical,
        high: data.high,
        medium: data.medium,
        low: data.low,
      });
    });

    es.addEventListener("done", () => {
      setActiveTools([]);
      setIsProcessing(false);
      setChunkProgress(null);
      currentMsgIdRef.current = null;
      // Move to chat phase once initial processing is done
      setPhase((prev) => (prev === "processing" ? "chat" : prev));
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

    es.addEventListener("ping", () => {
      // keep-alive
    });

    return es;
  }, []);

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setUploadResult(result);
    setPhase("details");
  }, []);

  const handleDetailsSubmit = useCallback(
    async (details: ContractDetails) => {
      setContractDetails(details);
      setPhase("processing");
      setIsProcessing(true);

      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(details),
        });

        if (!res.ok) throw new Error("Failed to create session");

        const { sessionId: id } = await res.json();
        setSessionId(id);

        // Persist to localStorage
        localStorage.setItem("lc_sessionId", id);
        localStorage.setItem("lc_uploadResult", JSON.stringify(uploadResult));
        localStorage.setItem("lc_contractDetails", JSON.stringify(details));

        connectSSE(id);
      } catch (err) {
        setPhase("details");
        setIsProcessing(false);
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
    [connectSSE, uploadResult],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) return;

      currentMsgIdRef.current = null;
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
    localStorage.removeItem("lc_sessionId");
    localStorage.removeItem("lc_uploadResult");
    localStorage.removeItem("lc_contractDetails");
    setPhase("upload");
    setUploadResult(null);
    setContractDetails(null);
    setSessionId(null);
    setMessages([]);
    setFindings([]);
    setChunkProgress(null);
    setRiskSummary(null);
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
              Contract Review Copilot
            </h1>
            <p className="text-sm text-gray-500">
              Indian Law Risk Analysis
            </p>
          </div>
          {(phase === "chat" || phase === "processing") && (
            <button
              onClick={handleNewSession}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              New Analysis
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {phase === "upload" && (
          <FileUpload onUploadComplete={handleUploadComplete} />
        )}

        {phase === "details" && uploadResult && (
          <ContractDetailsForm
            uploadResult={uploadResult}
            onSubmit={handleDetailsSubmit}
          />
        )}

        {phase === "processing" && (
          <ProcessingView
            chunkProgress={chunkProgress}
            findings={findings}
            activeTools={activeTools}
            messages={messages}
          />
        )}

        {phase === "chat" && contractDetails && (
          <>
            <SessionHeader
              fileName={uploadResult?.fileName ?? ""}
              pageCount={uploadResult?.pageCount ?? 0}
              counterparty={contractDetails.counterparty}
              contractType={contractDetails.contractType}
              ourRole={contractDetails.ourRole}
            />
            {riskSummary && <RiskSummaryCard summary={riskSummary} />}
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
