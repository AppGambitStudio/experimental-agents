import { useState, useEffect, useRef } from "react";
import type { ChatMessage, ToolCallEvent } from "../types";
import MessageBubble from "./MessageBubble";
import ToolProgress from "./ToolProgress";
import QuickActions from "./QuickActions";

interface ChatProps {
  messages: ChatMessage[];
  activeTools: ToolCallEvent[];
  isProcessing: boolean;
  onSendMessage: (content: string) => void;
}

export default function Chat({ messages, activeTools, isProcessing, onSendMessage }: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTools, isProcessing]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <ToolProgress tools={activeTools} />
        {isProcessing && activeTools.length === 0 && (
          <div className="flex items-center gap-2 my-3 px-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-gray-400">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <QuickActions onAction={(cmd) => onSendMessage(cmd)} />

      {/* Input bar */}
      <div className="flex items-center gap-2 px-2 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this contract..."
          disabled={isProcessing}
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className="rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
