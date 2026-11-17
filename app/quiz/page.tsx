"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { defaultMaterials, generateQuizFromMaterials, saveToStorage } from "@/lib/logic";
import type { Quiz } from "@/lib/types";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";

export default function QuizPage() {
  const [difficulty, setDifficulty] = useState("Medium");
  const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const materials = useLocalStorageValue("materials", defaultMaterials);
  const quiz = generatedQuiz ?? (isSupabaseConfigured() ? null : generateQuizFromMaterials(materials, 4, difficulty as "Easy" | "Medium" | "Hard"));

  const generateQuiz = async () => {
    setError("");
    setGenerating(true);
    try {
      let nextQuiz: Quiz;
      if (isSupabaseConfigured()) {
        const response = await apiFetch<{ quiz: Quiz }>("/api/quiz/generate", {
          method: "POST",
          body: JSON.stringify({ difficulty, count: 8 }),
        });
        nextQuiz = response.quiz;
      } else {
        nextQuiz = generateQuizFromMaterials(materials, 4, difficulty as "Easy" | "Medium" | "Hard");
      }
      setGeneratedQuiz(nextQuiz);
      if (!isSupabaseConfigured()) saveToStorage("current-quiz", nextQuiz);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the quiz.");
    } finally {
      setGenerating(false);
    }
  };

  const startQuiz = () => {
    if (quiz && !isSupabaseConfigured()) saveToStorage("current-quiz", quiz);
  };

  return (
    <AppShell title="Diagnostic quiz">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Generate a new quiz</h2>
            <p className="mt-2 text-slate-500">Questions are generated from uploaded study material and mapped to topics and subtopics.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Difficulty</label>
            <select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setGeneratedQuiz(null); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={generateQuiz} disabled={generating} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {generating ? "Generating…" : "Generate quiz"}
          </button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>

        {quiz ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Quiz title</div>
              <div className="mt-2 text-xl font-semibold">{quiz.title}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {quiz.questions.map((question) => (
                <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{question.topic}</div>
                  <div className="font-medium">{question.text}</div>
                  <div className="mt-2 text-sm text-slate-500">{question.type} · {question.difficulty}</div>
                  {question.citations.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Sources: {question.citations.map((citation) => `${citation.source}${citation.page ? ` (p.${citation.page})` : ""}${citation.section ? ` — ${citation.section}` : ""}`).join("; ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Link href={`/quiz/${quiz.id}`} onClick={startQuiz} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500">
                Start quiz
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
