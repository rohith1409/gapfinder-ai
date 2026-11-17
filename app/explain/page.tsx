"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getDemoMaterials, getStudyAssistantAnswer } from "@/lib/logic";
import type { ChatMessage, StudyMaterial } from "@/lib/types";

export default function ExplainPage() {
  const [question, setQuestion] = useState("What is meiosis and why is it important?");
  const [materials] = useState<StudyMaterial[]>(() => getDemoMaterials());
  const [history, setHistory] = useState<ChatMessage[]>([
    { id: "intro", role: "assistant", text: "Ask me about a topic covered in your uploaded study materials." },
  ]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const answer = getStudyAssistantAnswer(question, materials);
    setHistory((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: question },
      { id: `assistant-${Date.now()}`, role: "assistant", text: answer.answer, citations: answer.citations },
    ]);
  };

  return (
    <AppShell title="Explain this topic">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Ask about your uploaded material</label>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-indigo-400" />
          <button type="submit" className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white">Ask assistant</button>
        </form>

        <div className="mt-6 space-y-4">
          {history.map((message) => (
            <div key={message.id} className={`rounded-xl p-4 ${message.role === "assistant" ? "bg-indigo-50 text-slate-800" : "bg-slate-100 text-slate-800"}`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{message.role === "assistant" ? "AI assistant" : "You"}</div>
              <p>{message.text}</p>
              {message.citations?.length ? (
                <div className="mt-3 text-xs text-slate-600">
                  Sources: {message.citations.map((citation) => `${citation.source} (p.${citation.page})`).join(", ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
