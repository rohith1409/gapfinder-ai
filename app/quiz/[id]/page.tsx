"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildGapReport, evaluateQuestion, generateRevisionPlan, getDemoProfile, loadFromStorage, saveToStorage } from "@/lib/logic";
import type { Quiz, RevisionTask, TopicPerformance } from "@/lib/types";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";

export default function QuizAttemptPage() {
  return (
    <Suspense fallback={<AppShell title="Take quiz"><p className="text-slate-500">Loading quiz…</p></AppShell>}>
      <QuizAttemptPageContent />
    </Suspense>
  );
}

function QuizAttemptPageContent() {
  const router = useRouter();
  const { id: quizId } = useParams<{ id: string }>();
  const history = useLocalStorageValue<Quiz[]>("quiz-history", []);
  const currentQuiz = useLocalStorageValue<Quiz | null>("current-quiz", null);
  const [cloudQuiz, setCloudQuiz] = useState<Quiz | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(isSupabaseConfigured());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const quiz = isSupabaseConfigured() ? cloudQuiz : history.find((item) => item.id === quizId) ?? currentQuiz;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<{ quiz: Quiz }>(`/api/quiz/${encodeURIComponent(quizId)}`)
      .then(({ quiz }) => setCloudQuiz(quiz))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load this quiz."))
      .finally(() => setLoadingQuiz(false));
  }, [quizId]);

  const submit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        const result = await apiFetch<{ responses: ReturnType<typeof evaluateQuestion>[]; gapReport: ReturnType<typeof buildGapReport>; attemptId: string }>(
          "/api/quiz/submit",
          { method: "POST", body: JSON.stringify({ quizId: quiz.id, answers }) },
        );
        if (!result.attemptId) throw new Error("The server did not confirm that the quiz attempt was saved.");
      } else {
        const responses = quiz.questions.map((question) => evaluateQuestion(question, answers[question.id] ?? ""));
        const previousReport = loadFromStorage<TopicPerformance[]>("latest-gap-report", []);
        const previousByTopic = new Map(previousReport.map((topic) => [topic.topic, topic.score]));
        const gapReport = buildGapReport(quiz, responses).map((topic) => {
          const previousScore = previousByTopic.get(topic.topic);
          return previousScore === undefined ? topic : { ...topic, previousScore, improvement: topic.score - previousScore };
        });
        const score = responses.length ? Math.round(responses.reduce((total, response) => total + response.score, 0) / responses.length) : 0;
        const history = loadFromStorage<Array<{ id: string; title: string; score: number; createdAt: string }>>("attempt-history", []);
        const attemptId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        saveToStorage("attempt-history", [{ id: attemptId, title: quiz.title, score, createdAt }, ...history]);
        const topicHistory = loadFromStorage<Array<{ attemptId: string; createdAt: string; topic: string; score: number }>>("topic-history", []);
        saveToStorage("topic-history", [
          ...gapReport.map((topic) => ({ attemptId, createdAt, topic: topic.topic, score: topic.score })),
          ...topicHistory,
        ]);
        const previousTasks = loadFromStorage<RevisionTask[]>("revision-plan", []);
        saveToStorage("revision-plan", generateRevisionPlan(getDemoProfile(), gapReport, previousTasks));
        saveToStorage("latest-gap-report", gapReport);
        saveToStorage("latest-answers", responses);
        saveToStorage("latest-quiz", quiz);
      }
      router.push(`/results/${quiz.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Take quiz">
      {loadingQuiz ? (
        <p role="status" className="text-sm text-slate-500">Loading your saved quiz…</p>
      ) : quiz ? (
        <div className="space-y-6">
          {quiz.questions.map((question, index) => (
            <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Q{index + 1} · {question.topic}</div>
              <h3 className="text-lg font-semibold">{question.text}</h3>
              {question.citations.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Sources: {question.citations.map((citation) => `${citation.source}${citation.page ? ` (p.${citation.page})` : ""}${citation.section ? ` — ${citation.section}` : ""}`).join("; ")}
                </p>
              )}
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

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button onClick={submit} disabled={submitting} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">{submitting ? "Scoring…" : "Submit answers"}</button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">{error || "No active quiz found. Generate one from the quiz page."}</div>
      )}
    </AppShell>
  );
}
