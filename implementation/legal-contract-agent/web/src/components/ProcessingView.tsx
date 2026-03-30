import type { ChunkProgress, Finding, ToolCallEvent, ChatMessage } from "../types";
import FindingCard from "./FindingCard";

interface ProcessingViewProps {
  chunkProgress: ChunkProgress | null;
  findings: Finding[];
  activeTools: ToolCallEvent[];
  messages: ChatMessage[];
}

export default function ProcessingView({ chunkProgress, findings, activeTools, messages }: ProcessingViewProps) {
  const agentMessages = messages.filter((m) => m.role === "agent");

  return (
    <div className="space-y-6 py-4">
      {/* Progress bar */}
      {chunkProgress && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">{chunkProgress.label}</p>
            <p className="text-xs text-gray-500">
              {chunkProgress.current} / {chunkProgress.total}
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }}
            />
          </div>

          {/* Per-chunk indicators */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: chunkProgress.total }, (_, i) => {
              const idx = i + 1;
              let indicator: string;
              let style: string;
              if (idx < chunkProgress.current) {
                indicator = "\u2713";
                style = "bg-green-100 text-green-600";
              } else if (idx === chunkProgress.current) {
                indicator = "\u27F3";
                style = "bg-indigo-100 text-indigo-600 animate-pulse";
              } else {
                indicator = "\u25CB";
                style = "bg-gray-100 text-gray-400";
              }
              return (
                <span
                  key={idx}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${style}`}
                >
                  {indicator}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* No progress yet - show loading */}
      {!chunkProgress && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 mb-3" />
          <p className="text-sm text-gray-600 font-medium">Starting analysis...</p>
          <p className="text-xs text-gray-400 mt-1">Preparing to review your contract</p>
        </div>
      )}

      {/* Tool progress spinners */}
      {activeTools.length > 0 && (
        <div className="flex flex-col gap-2 px-1">
          {activeTools.map((t, i) => (
            <div key={`${t.tool}-${i}`} className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
              <span className="text-xs text-gray-500">{t.display}</span>
            </div>
          ))}
        </div>
      )}

      {/* Findings stream in */}
      {findings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
            Findings ({findings.length})
          </p>
          {findings.map((f, i) => (
            <FindingCard key={`${f.clause}-${i}`} finding={f} />
          ))}
        </div>
      )}

      {/* Agent messages stream below */}
      {agentMessages.length > 0 && (
        <div className="space-y-2">
          {agentMessages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
