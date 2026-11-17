"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getDemoMaterials } from "@/lib/logic";
import type { ChatMessage, StudyMaterial } from "@/lib/types";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";

export default function ExplainPage() {
  const [question, setQuestion] = useState("What is meiosis and why is it important?");
  const [materials] = useState<StudyMaterial[]>(() => isSupabaseConfigured() ? [] : getDemoMaterials());
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(isSupabaseConfigured());
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([
    { id: "intro", role: "assistant", text: "Ask me about a topic covered in your uploaded study materials." },
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<{ messages: ChatMessage[] }>("/api/rag")
      .then(({ messages }) => setHistory(messages.length ? messages : [
        { id: "intro", role: "assistant", text: "Ask me about a topic covered in your uploaded study materials." },
      ]))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load assistant history."))
      .finally(() => setLoadingHistory(false));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const answer = isSupabaseConfigured()
        ? await apiFetch<{ answer: string; citations: ChatMessage["citations"] }>("/api/rag", {
          method: "POST",
          body: JSON.stringify({
            question,
            history: history.filter((message) => message.id !== "intro").slice(-8).map(({ role, text }) => ({ role, text })),
          }),
        })
        : await apiFetch<{ answer: string; citations: ChatMessage["citations"] }>("/api/rag", {
          method: "POST",
          body: JSON.stringify({ question, materials }),
        });
      setHistory((current) => [
        ...current,
        { id: `user-${crypto.randomUUID()}`, role: "user", text: question },
        { id: `assistant-${crypto.randomUUID()}`, role: "assistant", text: answer.answer, citations: answer.citations },
      ]);
      setQuestion("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant could not answer this question.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Explain this topic">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Ask about your uploaded material</label>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-indigo-400" />
          <button type="submit" disabled={loading || loadingHistory || !question.trim()} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Searching materials…" : loadingHistory ? "Loading conversation…" : "Ask assistant"}</button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="mt-6 space-y-4">
          {history.map((message) => (
            <div key={message.id} className={`rounded-xl p-4 ${message.role === "assistant" ? "bg-indigo-50 text-slate-800" : "bg-slate-100 text-slate-800"}`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{message.role === "assistant" ? "AI assistant" : "You"}</div>
              <p>{message.text}</p>
              {message.citations?.length ? (
                <div className="mt-3 text-xs text-slate-600">
                  Sources: {message.citations.map((citation) => `${citation.source}${citation.page ? ` (p.${citation.page})` : ""}${citation.section ? ` — ${citation.section}` : ""}`).join(", ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
