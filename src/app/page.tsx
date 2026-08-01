"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileSearch,
  FileText,
  Layers,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";

interface Citation {
  id: string;
  content: string;
  documentTitle: string;
  sourceUrl?: string | null;
  score?: number | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

const STARTER_QUESTIONS = [
  "What are the main takeaways?",
  "Summarize this document in five bullets.",
  "Which facts are most important?",
];

export default function Home() {
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [indexedDocument, setIndexedDocument] = useState<{ name: string; id: string } | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isSourceInspectorOpen, setIsSourceInspectorOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConversationId(`session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  useEffect(() => {
    return () => {
      if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
    };
  }, [documentPreviewUrl]);

  const ingestFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadStatus({ type: "error", text: "Please choose a PDF document." });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    const previewUrl = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ingest", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ingestion pipeline rejected this file.");

      setIndexedDocument({ name: file.name, id: data.documentId });
      setDocumentPreviewUrl(previewUrl);
      setUploadStatus({ type: "success", text: "Indexed and ready to query." });
    } catch (error: unknown) {
      URL.revokeObjectURL(previewUrl);
      setUploadStatus({
        type: "error",
        text: error instanceof Error ? error.message : "We could not process this document.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void ingestFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  };

  const sendMessage = async (event?: React.FormEvent, promptOverride?: string) => {
    event?.preventDefault();
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || isGenerating) return;

    setInput("");
    const updatedMessages: Message[] = [...messages, { role: "user", content: prompt }];
    setMessages(updatedMessages);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The answer service is unavailable.");

      setMessages([...updatedMessages, { role: "assistant", content: data.answer, citations: data.citations || [] }]);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to retrieve a response.";
      setMessages([...updatedMessages, { role: "assistant", content: `I hit a routing error: ${text}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSession = () => {
    setConversationId(`session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
    setMessages([]);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090f] text-slate-100 selection:bg-violet-500/40">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-violet-600/15 blur-[130px]" />
        <div className="absolute -right-36 top-1/3 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-[290px] shrink-0 border-r border-white/[0.07] bg-[#0b0e17]/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-white">VerbaMind</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300">Document intelligence</p>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            <button className="flex w-full items-center gap-3 rounded-xl bg-violet-500/15 px-3 py-2.5 text-sm font-medium text-violet-200 ring-1 ring-inset ring-violet-400/20">
              <Sparkles className="h-4 w-4" /> Ask your knowledge base
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100">
              <Upload className="h-4 w-4" /> Add a document
            </button>
          </div>

          <div className="mt-9">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">System status</p>
            <div className="mt-3 space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
              <StatusRow icon={<Database />} label="Vector index" value="Ready" />
              <StatusRow icon={<Search />} label="Retrieval" value="Hybrid RRF" />
              <StatusRow icon={<ShieldCheck />} label="Grounding" value="Required" />
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-cyan-400/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-cyan-300" /> Evidence-first answers</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Every answer is paired with the context retrieved from your own documents.</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400"><BrainCircuit className="h-4 w-4" /></div>
              <span className="font-semibold">VerbaMind</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-white">Knowledge workspace</p>
              <p className="mt-0.5 text-xs text-slate-500">Grounded conversations over your private documents</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-300">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              System operational
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex min-h-0 flex-col border-r border-white/[0.07]">
              <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">
                {messages.length === 0 ? (
                  <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center sm:py-16">
                    <div className="relative mb-7">
                      <div className="absolute inset-0 rounded-3xl bg-violet-500/35 blur-2xl" />
                      <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-white/15 bg-white/[0.08] shadow-2xl shadow-violet-950/50"><Sparkles className="h-9 w-9 text-violet-200" /></div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-400/[0.07] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.17em] text-violet-300"><Activity className="h-3.5 w-3.5" /> Hybrid retrieval online</div>
                    <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Ask better questions.<br /><span className="bg-gradient-to-r from-violet-300 to-cyan-200 bg-clip-text text-transparent">Trust every answer.</span></h1>
                    <p className="mt-5 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Upload a PDF, then have a grounded conversation with its contents. VerbaMind surfaces the exact source context behind each response.</p>

                    <div className="mt-9 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                      {STARTER_QUESTIONS.map((question) => (
                        <button key={question} onClick={() => void sendMessage(undefined, question)} className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400/35 hover:bg-violet-400/[0.07]">
                          <ArrowUpRight className="mb-6 h-4 w-4 text-slate-500 transition group-hover:text-violet-300" />
                          <span className="text-xs leading-5 text-slate-300">{question}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-6">
                    {messages.map((message, index) => (
                      <article key={`${message.role}-${index}`} className={`flex gap-3 sm:gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" && <Avatar icon={<Bot className="h-4 w-4" />} tone="assistant" />}
                        <div className={`max-w-[88%] rounded-2xl border px-4 py-3.5 sm:max-w-[78%] sm:px-5 ${message.role === "user" ? "border-violet-400/20 bg-violet-500/[0.12] text-violet-50" : "border-white/[0.08] bg-white/[0.04] text-slate-200"}`}>
                          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                          {message.citations && message.citations.length > 0 && (
                            <div className="mt-4 border-t border-white/[0.08] pt-3">
                              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300"><FileSearch className="h-3.5 w-3.5" /> Evidence used</p>
                              <div className="space-y-2">
                                {message.citations.map((citation, citationIndex) => (
                                  <button key={citation.id || citationIndex} onClick={() => { setActiveCitation(citation); setIsSourceInspectorOpen(true); }} className="w-full rounded-xl border border-white/[0.07] bg-black/20 p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.04]">
                                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-200"><FileText className="h-3.5 w-3.5" /> Source {citationIndex + 1} · {citation.documentTitle}</p>
                                    <p className="max-h-16 overflow-hidden text-xs leading-5 text-slate-400">{citation.content}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {message.role === "user" && <Avatar icon={<User className="h-4 w-4" />} tone="user" />}
                      </article>
                    ))}
                    {isGenerating && <div className="flex items-center gap-3"><Avatar icon={<Bot className="h-4 w-4" />} tone="assistant" /><div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" /></div></div>}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 px-5 pb-5 sm:px-8 sm:pb-7">
                <form onSubmit={(event) => void sendMessage(event)} className="mx-auto max-w-4xl rounded-2xl border border-white/[0.1] bg-[#101522]/90 p-2 shadow-2xl shadow-black/30 ring-1 ring-white/[0.025] backdrop-blur-xl focus-within:border-violet-400/35">
                  <div className="flex items-end gap-2">
                    <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={indexedDocument ? `Ask about ${indexedDocument.name}...` : "Ask a question about your knowledge base..."} rows={1} className="max-h-32 min-h-[46px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 text-white outline-none placeholder:text-slate-500" disabled={isGenerating} />
                    <button type="submit" disabled={!input.trim() || isGenerating} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-950/50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"><Send className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center justify-between px-3 pb-1 pt-1 text-[10px] text-slate-500"><span>Enter to send · Shift + Enter for a new line</span><span className="hidden sm:inline">Grounded answers with source evidence</span></div>
                </form>
              </div>
            </section>

            <aside className="hidden overflow-y-auto bg-[#090c14]/60 p-5 xl:block">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">Knowledge base</p><span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-slate-400">{indexedDocument ? "01" : "00"} DOCS</span></div>
              <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`mt-4 cursor-pointer rounded-2xl border border-dashed p-5 text-center transition ${isDragging ? "border-violet-300 bg-violet-500/15" : "border-white/[0.13] bg-white/[0.025] hover:border-violet-400/45 hover:bg-violet-400/[0.05]"}`}>
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{isUploading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</div>
                <p className="mt-3 text-sm font-medium text-slate-200">{isUploading ? "Building your index" : "Drop a PDF here"}</p>
                <p className="mt-1 text-xs text-slate-500">or click to browse · 10 MB max</p>
              </div>

              {uploadStatus && <div className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs ${uploadStatus.type === "success" ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300" : "border-rose-400/15 bg-rose-400/[0.07] text-rose-300"}`}><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{uploadStatus.text}</div>}

              {indexedDocument ? <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-400/10 text-rose-300"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{indexedDocument.name}</p><p className="mt-1 text-[11px] text-emerald-400">Indexed · ready for retrieval</p></div><button onClick={() => { setIndexedDocument(null); setDocumentPreviewUrl(null); setUploadStatus(null); }} className="text-slate-600 transition hover:text-slate-300"><X className="h-4 w-4" /></button></div><button onClick={() => setIsSourceInspectorOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"><FileSearch className="h-3.5 w-3.5" /> Preview document</button></div> : <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"><Layers className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-2 text-xs text-slate-500">Your indexed documents will appear here.</p></div>}

              <div className="mt-7"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">Retrieval telemetry</p><div className="mt-3 grid grid-cols-2 gap-2"><Metric value="RRF" label="Fusion" /><Metric value="1.2×" label="Dense weight" /><Metric value="1536" label="Vector dims" /><Metric value="70%" label="Similarity gate" /></div></div>

              <button onClick={resetSession} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-2.5 text-xs font-medium text-slate-400 transition hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-slate-200"><RefreshCw className="h-3.5 w-3.5" /> Start a new conversation</button>
              <p className="mt-3 truncate text-center font-mono text-[9px] text-slate-600">{conversationId || "Initializing session..."}</p>
            </aside>
          </div>
        </section>
      </div>

      {isSourceInspectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03050a]/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Source inspector">
          <div className="flex h-[min(820px,calc(100vh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0c101b] shadow-2xl shadow-black/70">
            <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6"><div><p className="flex items-center gap-2 text-sm font-semibold text-white"><FileSearch className="h-4 w-4 text-cyan-300" /> Source inspector</p><p className="mt-1 text-xs text-slate-500">Inspect the evidence behind this response</p></div><button onClick={() => setIsSourceInspectorOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.07] hover:text-white"><X className="h-4 w-4" /></button></header>
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-h-[350px] bg-[#070a11] p-3 sm:p-4">
                {documentPreviewUrl ? <iframe title="Uploaded document preview" src={documentPreviewUrl} className="h-full min-h-[350px] w-full rounded-xl border border-white/[0.08] bg-white" /> : <div className="grid h-full min-h-[350px] place-items-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-8 text-center"><FileText className="h-9 w-9 text-slate-600" /><p className="mt-4 text-sm font-medium text-slate-300">No local preview available</p><p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">Upload a PDF in this session to preview it here. Retrieved evidence remains visible on the right.</p></div>}
              </div>
              <aside className="overflow-y-auto border-t border-white/[0.08] p-5 lg:border-l lg:border-t-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Retrieved evidence</p>{activeCitation ? <><div className="mt-4 flex items-center gap-2 text-sm font-semibold text-white"><FileText className="h-4 w-4 text-violet-300" />{activeCitation.documentTitle}</div><p className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-sm leading-6 text-slate-300">{activeCitation.content}</p><div className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Used to ground the answer</div></> : <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-sm font-medium text-slate-200">Document preview</p><p className="mt-2 text-xs leading-5 text-slate-500">Ask a question, then select an evidence card in the answer to inspect the exact passage used.</p></div>}</aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Avatar({ icon, tone }: { icon: React.ReactNode; tone: "assistant" | "user" }) {
  return <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${tone === "assistant" ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300" : "border-violet-400/20 bg-violet-400/10 text-violet-200"}`}>{icon}</div>;
}

function StatusRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-2.5 text-xs"><span className="text-slate-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span><span className="flex-1 text-slate-400">{label}</span><span className="font-medium text-emerald-300">{value}</span></div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-sm font-semibold text-white">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</p></div>;
}
