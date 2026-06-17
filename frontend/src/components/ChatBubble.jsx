import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Trash2, Bot, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
import { supportAPI } from "../services/api";

const QUICK_REPLIES = [
  { label: "🔗 Setup Job Connectors", text: "How to setup Job connectors" },
  { label: "🤖 Setup AI Connectors", text: "How to setup AI connectors" },
  { label: "🧩 Install Chrome Extension", text: "How do I install the browser extension?" },
  { label: "📊 Knowledge Graph & Gaps", text: "What is the Knowledge Graph and how do I resolve gaps?" },
  { label: "🎟️ Free Trial Code", text: "What is the Free Trial promo code?" },
];

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chat_history");
    return saved ? JSON.parse(saved) : [
      {
        role: "assistant",
        content: "Hi! I am your AI Support Assistant. 🚀 How can I help you automate your job search and applications today? Ask me about setting up connectors, resolving profile gaps, or installing the extension!"
      }
    ];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    if (!textToSend) {
      setInput("");
    }

    const newUserMessage = { role: "user", content: text };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Map history to format required by API (ignoring system welcome message)
      const chatHistory = messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await supportAPI.chat(text, chatHistory);
      setMessages(prev => [...prev, { role: "assistant", content: response.response }]);
    } catch (error) {
      console.error("Chat failed:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an issue connecting to the AI helper. Please make sure the backend server is running and try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      const reset = [
        {
          role: "assistant",
          content: "Chat history cleared. How can I help you now?"
        }
      ];
      setMessages(reset);
      localStorage.removeItem("chat_history");
    }
  };

  return (
    <>
      {/* Floating Action Button (Launcher) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group border border-indigo-400/20"
        title="AI Support Assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-300 rotate-90" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
        )}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[380px] h-[520px] bg-slate-950/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800/80 flex flex-col overflow-hidden animate-slide-up transition-all duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600/30 p-2 rounded-xl border border-indigo-500/30 text-indigo-400">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 flex items-center gap-1.5 text-sm sm:text-base">
                  JobApply Assistant
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                </h3>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  AI Agent Online
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800/50 transition-all"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800/50 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages & Chips Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col custom-scrollbar">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 max-w-[85%] ${
                  msg.role === "user" ? "self-end flex-row-reverse" : "self-start"
                }`}
              >
                {msg.role !== "user" && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-indigo-400" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-md font-medium"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Quick Replies chips */}
            <div className="pt-2 space-y-2">
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1 pl-1">
                <HelpCircle className="w-3 h-3" /> Quick Questions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    disabled={isLoading}
                    onClick={() => handleSend(reply.text)}
                    className="text-[11px] bg-slate-900/60 hover:bg-indigo-950/40 text-slate-300 hover:text-indigo-300 border border-slate-800 hover:border-indigo-800/60 py-1.5 px-3 rounded-full transition-all duration-200 text-left flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {reply.label}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-2 self-start max-w-[85%]">
                <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-300"></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Form Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a support question..."
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Slide-Up CSS Styling */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </>
  );
}
