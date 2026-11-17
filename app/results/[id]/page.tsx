"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildGapReport } from "@/lib/logic";
import type { Quiz, StudentAnswer, TopicPerformance } from "@/lib/types";
import { useLocalStorageValue } from "@/lib/use-storage";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";

export default function ResultsPage() {
  return (
    <Suspense fallback={<AppShell title="Results and gap analysis"><p className="text-sm text-slate-500">Loading results…</p></AppShell>}>
      <ResultsPageContent />
    </Suspense>
  );
}

function ResultsPageContent() {
  const { id: quizId } = useParams<{ id: string }>();
  const quiz = useLocalStorageValue<Quiz | null>("latest-quiz", null);
  const answers = useLocalStorageValue<StudentAnswer[]>("latest-answers", []);
  const storedReport = useLocalStorageValue<TopicPerformance[]>("latest-gap-report", []);
  const [cloudReport, setCloudReport] = useState<TopicPerformance[] | null>(null);
  const [cloudAnswers, setCloudAnswers] = useState<StudentAnswer[] | null>(null);
  const [cloudQuiz, setCloudQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<{ gapReport: TopicPerformance[]; responses: StudentAnswer[]; quiz: Quiz }>(`/api/results/${encodeURIComponent(quizId)}`)
      .then(({ gapReport, responses, quiz }) => {
        setCloudReport(gapReport);
        setCloudAnswers(responses);
        setCloudQuiz(quiz);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load saved quiz results."))
      .finally(() => setLoading(false));
  }, [quizId]);
  const demoReport = useMemo(() => storedReport.length
    ? storedReport
    : buildGapReport(quiz ?? { id: "demo", title: "Diagnostic Quiz", createdAt: "2026-11-17T00:00:00.000Z", studentId: "demo", questions: [] }, answers),
  [storedReport, quiz, answers]);
  const gapReport = isSupabaseConfigured() ? cloudReport ?? [] : demoReport;
  const answerFeedback = isSupabaseConfigured() ? cloudAnswers ?? [] : answers;
  const resultQuiz = isSupabaseConfigured() ? cloudQuiz : quiz;

  return (
    <AppShell title="Results and gap analysis">
      {loading && <p role="status" className="mb-4 text-sm text-slate-500">Loading saved results…</p>}
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {!loading && !error && !gapReport.length && <p className="mb-4 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No saved result is available for this quiz yet.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {gapReport.map((topic) => (
          <div key={topic.topic} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{topic.topic}</h3>
              <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${
                topic.status === "Weak" ? "bg-red-100 text-red-700" : topic.status === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}>{topic.status}</span>
            </div>
            <div className="mt-4 text-3xl font-bold">{topic.score}%</div>
            {topic.improvement !== undefined && (
              <p className={`mt-1 text-sm font-medium ${topic.improvement >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {topic.improvement >= 0 ? "+" : ""}{topic.improvement} percentage points since your previous attempt
              </p>
            )}
            <p className="mt-3 text-sm text-slate-600">{topic.diagnosis}</p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{topic.recommendedAction}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Detailed diagnosis</h2>
        <div className="mt-4 space-y-4">
          {gapReport.map((topic) => (
            <div key={`${topic.topic}-details`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{topic.topic}</div>
                <div className="text-sm text-slate-500">{topic.correct}/{topic.attempts} correct</div>
              </div>
              <div className="mt-2 text-sm text-slate-600">{topic.diagnosis}</div>
              <div className="mt-3 text-sm font-medium text-indigo-700">Recommended action: {topic.recommendedAction}</div>
            </div>
          ))}
        </div>
      </div>

      {answerFeedback.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Answer feedback</h2>
          <div className="mt-4 space-y-4">
            {answerFeedback.map((answer) => {
              const question = resultQuiz?.questions.find((item) => item.id === answer.questionId);
              return (
                <div key={answer.questionId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold">{question?.text ?? "Quiz question"}</h3>
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-sm font-semibold text-indigo-700">{answer.score}%</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Your answer: {answer.answer || "No answer provided"}</p>
                  <p className="mt-2 text-sm text-slate-600">Expected answer: {answer.correctAnswer}</p>
                  <p className="mt-2 text-sm text-slate-700">{answer.feedback}</p>
                  {question?.citations.length ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Sources: {question.citations.map((citation) => `${citation.source}${citation.page ? ` (p.${citation.page})` : ""}${citation.section ? ` — ${citation.section}` : ""}`).join("; ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-end gap-3">
        <Link href="/revision-plan" className="rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700">View revision plan</Link>
        <Link href="/quiz" className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white">Retake quiz</Link>
      </div>
    </AppShell>
  );
}
