import type { ChatMessage, ToolCallEvent } from "../types";

interface ChatProps {
  messages: ChatMessage[];
  activeTools: ToolCallEvent[];
  isProcessing: boolean;
  onSendMessage: (content: string) => void;
}

export default function Chat({ messages: _m, activeTools: _at, isProcessing: _ip, onSendMessage: _osm }: ChatProps) {
  return <div>Chat placeholder</div>;
}
