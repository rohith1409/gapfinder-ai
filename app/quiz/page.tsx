"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { generateQuizFromMaterials, getDemoMaterials, saveToStorage } from "@/lib/logic";
import type { Quiz } from "@/lib/types";

export default function QuizPage() {
  const [difficulty, setDifficulty] = useState("Medium");
  const [quiz, setQuiz] = useState<Quiz>(() => {
    const nextQuiz = generateQuizFromMaterials(getDemoMaterials(), 4, "Medium");
    saveToStorage("current-quiz", nextQuiz);
    return nextQuiz;
  });

  const handleDifficultyChange = (value: string) => {
    setDifficulty(value);
    const nextQuiz = generateQuizFromMaterials(getDemoMaterials(), 4, value as "Easy" | "Medium" | "Hard");
    setQuiz(nextQuiz);
    saveToStorage("current-quiz", nextQuiz);
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
            <select value={difficulty} onChange={(event) => handleDifficultyChange(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>
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
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Link href={`/quiz/${quiz.id}`} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500">
                Start quiz
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
