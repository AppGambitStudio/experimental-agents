import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center my-2">
        <p className="text-xs text-gray-400">{message.content}</p>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end my-3">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 text-white px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // agent
  return (
    <div className="flex justify-start my-3">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white border border-gray-200 px-4 py-2.5">
        <p className="text-xs font-medium text-indigo-600 mb-1">
          Contract Copilot
        </p>
        <div className="text-sm text-gray-800 prose prose-sm max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
