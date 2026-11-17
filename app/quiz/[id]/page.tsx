"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildGapReport, evaluateQuestion, getDemoQuizHistory, saveToStorage } from "@/lib/logic";
import type { Quiz } from "@/lib/types";

export default function QuizAttemptPage() {
  const router = useRouter();
  const [quizId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  });
  const [quiz] = useState<Quiz | null>(() => {
    const stored = getDemoQuizHistory();
    if (typeof window === "undefined") return null;
    const candidate = stored.find((item) => item.id === quizId) ?? JSON.parse(window.localStorage.getItem("gapfinder:current-quiz") ?? "null");
    return candidate ?? null;
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submit = () => {
    if (!quiz) return;

    const responses = quiz.questions.map((question) => evaluateQuestion(question, answers[question.id] ?? ""));
    const gapReport = buildGapReport(quiz, responses);
    saveToStorage("latest-gap-report", gapReport);
    saveToStorage("latest-answers", responses);
    saveToStorage("latest-quiz", quiz);
    router.push(`/results/${quiz.id}`);
  };

  return (
    <AppShell title="Take quiz">
      {quiz ? (
        <div className="space-y-6">
          {quiz.questions.map((question, index) => (
            <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Q{index + 1} · {question.topic}</div>
              <h3 className="text-lg font-semibold">{question.text}</h3>
              <div className="mt-4 space-y-3">
                {question.type === "multiple-choice" && question.options ? question.options.map((option) => (
                  <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />
                    <span>{option}</span>
                  </label>
                )) : null}

                {question.type === "true-false" ? (
                  <div className="flex gap-3">
                    {['True', 'False'].map((option) => (
                      <label key={option} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                        <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : null}

                {question.type === "short-answer" ? (
                  <textarea value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-indigo-400" placeholder="Type your answer here" />
                ) : null}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={submit} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500">Submit answers</button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">No active quiz found. Generate one from the quiz page.</div>
      )}
    </AppShell>
  );
}
