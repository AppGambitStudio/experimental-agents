import type { ChunkProgress, Finding, ToolCallEvent, ChatMessage } from "../types";

interface ProcessingViewProps {
  chunkProgress: ChunkProgress | null;
  findings: Finding[];
  activeTools: ToolCallEvent[];
  messages: ChatMessage[];
}

export default function ProcessingView({ chunkProgress: _cp, findings: _f, activeTools: _at, messages: _m }: ProcessingViewProps) {
  return <div>ProcessingView placeholder</div>;
}
