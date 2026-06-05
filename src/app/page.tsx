// src/app/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, Send, FileText, Bot, User, RefreshCw, Layers } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ content: string; score?: number | null }>;
}

export default function Home() {
  // Generate a persistent conversational session ID for LangGraph memory tracking
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  
  // Ingestion and Chat state monitors
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize standard tracking ID on mount
    setConversationId(`session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Handle Drag-and-Drop / Form File Ingestion
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Ingestion pipeline rejected file.");

      setUploadStatus({ type: "success", text: `Indexed: "${file.name}" successfully.` });
    } catch (error: any) {
      setUploadStatus({ type: "error", text: error.message || "Failed to parse document." });
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Chat Message to Serverless Agent Loop
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessageText = input.trim();
    setInput("");
    
    // Optimistically update local message thread
    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessageText }];
    setMessages(updatedMessages);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageText,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Agent routing failed.");

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations || [],
        },
      ]);
    } catch (error: any) {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: `⚠️ Routing Error: ${error.message || "Unable to retrieve response context."}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSession = () => {
    setConversationId(`session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    setMessages([]);
    setUploadStatus(null);
  };

  return (
    <main className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* LEFT PANEL: Document Indexing Management */}
      <section className="w-1/3 border-r border-neutral-800 bg-neutral-900/40 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <Layers className="h-6 w-6 text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight">Hybrid RAG Engine</h1>
          </div>

          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Upload unstructured knowledge documentation below. Text extraction, semantic vector chunking, and full-text RRF mapping will run fully in memory.
          </p>

          {/* Upload Box Component */}
          <div className="relative group border-2 border-dashed border-neutral-800 hover:border-indigo-500/50 rounded-xl p-8 transition-all bg-neutral-900/60 flex flex-col items-center justify-center text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            {isUploading ? (
              <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
            ) : (
              <Upload className="h-10 w-10 text-neutral-500 group-hover:text-indigo-400 transition-colors mb-4" />
            )}
            <p className="text-sm font-medium text-neutral-300">
              {isUploading ? "Executing Vector Ingestion..." : "Click or drop PDF here"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">Accepts standard PDF binaries</p>
          </div>

          {/* Feedback Indicators */}
          {uploadStatus && (
            <div
              className={`mt-4 p-3 rounded-lg text-xs font-mono border ${
                uploadStatus.type === "success"
                  ? "bg-emerald-950/30 border-emerald-800 text-emerald-400"
                  : "bg-rose-950/30 border-rose-800 text-rose-400"
              }`}
            >
              {uploadStatus.text}
            </div>
          )}
        </div>

        {/* Runtime Session Controls */}
        <div className="border-t border-neutral-800 pt-4">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-2">
            <span>THREAD ID:</span>
            <span className="text-neutral-400 truncate max-w-[180px]">{conversationId}</span>
          </div>
          <button
            onClick={resetSession}
            className="w-full py-2 px-4 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-800 text-neutral-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Clear Memory State</span>
          </button>
        </div>
      </section>

      {/* RIGHT PANEL: Stateful RAG Multi-Turn Agent Loop */}
      <section className="flex-1 flex flex-col justify-between bg-neutral-950">
        {/* Chat History Core Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 max-w-md mx-auto mt-24">
              <Bot className="h-12 w-12 text-neutral-500 mb-4" />
              <h3 className="text-base font-semibold text-neutral-200">Conversational Search Ready</h3>
              <p className="text-sm text-neutral-400 mt-1">
                LangGraph memory is initialized. Submit queries using implicit pronoun tracking to evaluate conversational context resolution.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-3xl flex space-x-4 p-4 rounded-xl border ${
                  msg.role === "user"
                    ? "bg-indigo-600/10 border-indigo-500/20 text-neutral-200"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300"
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {msg.role === "user" ? (
                    <User className="h-5 w-5 text-indigo-400" />
                  ) : (
                    <Bot className="h-5 w-5 text-emerald-400" />
                  )}
                </div>
                <div className="space-y-3 overflow-hidden">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Render Verified RRF Source Document Chunks if present */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-neutral-800/60 mt-2 space-y-2">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-400 tracking-wide uppercase">
                        <FileText className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Ranked Context Blocks</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {msg.citations.map((cit, cIdx) => (
                          <div key={cIdx} className="p-2.5 bg-neutral-950/80 rounded border border-neutral-800 text-xs text-neutral-400 font-mono line-clamp-2 hover:line-clamp-none transition-all">
                            {cit.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pending Model Inference Indicator */}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="max-w-3xl flex space-x-4 p-4 rounded-xl border bg-neutral-900 border-neutral-800 text-neutral-400 items-center">
                <Bot className="h-5 w-5 text-emerald-500 animate-pulse" />
                <div className="flex space-x-1.5 items-center py-1">
                  <span className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Persistent Chat Form Inputs */}
        <div className="p-4 border-t border-neutral-900 bg-neutral-900/20">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask questions about uploaded documents..."
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-4 pr-12 text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-all"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="absolute right-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-50 text-neutral-100 disabled:opacity-30 disabled:bg-transparent disabled:text-neutral-600 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}