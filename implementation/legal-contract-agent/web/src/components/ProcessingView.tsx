import type { ChunkProgress, Finding, ToolCallEvent, ChatMessage } from "../types";
import FindingCard from "./FindingCard";

interface ProcessingViewProps {
  chunkProgress: ChunkProgress | null;
  findings: Finding[];
  activeTools: ToolCallEvent[];
  messages: ChatMessage[];
}

export default function ProcessingView({ chunkProgress, findings, activeTools, messages }: ProcessingViewProps) {
  const percentage = chunkProgress
    ? Math.round((chunkProgress.current / chunkProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-4 py-4">
      {/* Main progress card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {chunkProgress ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Analyzing contract...</p>
              <p className="text-sm font-medium text-indigo-600">{percentage}%</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Current chunk label */}
            <div className="flex items-center gap-2 mb-4">
              {chunkProgress.status === "analyzing" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
              ) : (
                <span className="text-green-500 text-sm">&#10003;</span>
              )}
              <span className="text-sm text-gray-600">
                Chunk {chunkProgress.current} of {chunkProgress.total}: <strong>{chunkProgress.label}</strong>
              </span>
            </div>

            {/* Chunk status list */}
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: chunkProgress.total }, (_, i) => {
                const idx = i + 1;
                const isDone = idx < chunkProgress.current || (idx === chunkProgress.current && chunkProgress.status === "done");
                const isCurrent = idx === chunkProgress.current && chunkProgress.status === "analyzing";
                const isPending = idx > chunkProgress.current;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                      isDone
                        ? "bg-green-50 text-green-700"
                        : isCurrent
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    {isDone && <span>&#10003;</span>}
                    {isCurrent && <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />}
                    {isPending && <span>&#9675;</span>}
                    <span>Chunk {idx}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 mb-3" />
            <p className="text-sm text-gray-600 font-medium">Starting analysis...</p>
            <p className="text-xs text-gray-400 mt-1">Extracting document structure and preparing chunks</p>
          </div>
        )}
      </div>

      {/* Tool activity */}
      {activeTools.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Current activity</p>
          <div className="space-y-1.5">
            {activeTools.map((t, i) => (
              <div key={`${t.tool}-${i}`} className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                <span className="text-xs text-gray-600">{t.display}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip while processing */}
      {chunkProgress && chunkProgress.current < chunkProgress.total && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
          <p className="text-xs text-indigo-600">
            Extracting risks from each section silently. You'll see the full analysis once all chunks are reviewed.
          </p>
        </div>
      )}

      {/* Findings (only shown after all chunks done) */}
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
    </div>
  );
}
