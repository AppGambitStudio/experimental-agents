import type { ToolCallEvent } from "../types";

interface ToolProgressProps {
  tools: ToolCallEvent[];
}

export default function ToolProgress({ tools }: ToolProgressProps) {
  if (tools.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 my-3 px-2">
      {tools.map((t, i) => (
        <div key={`${t.tool}-${i}`} className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
          <span className="text-xs text-gray-500">{t.display}</span>
        </div>
      ))}
    </div>
  );
}
