"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { buildGapReport, loadFromStorage } from "@/lib/logic";
import type { Quiz, StudentAnswer, TopicPerformance } from "@/lib/types";

export default function ResultsPage() {
  const [latestQuiz] = useState<Quiz | null>(() => loadFromStorage<Quiz | null>("latest-quiz", null));
  const [latestAnswers] = useState<StudentAnswer[]>(() => loadFromStorage<StudentAnswer[]>("latest-answers", []));
  const [gapReport] = useState<TopicPerformance[]>(() => {
    const report = loadFromStorage<TopicPerformance[]>("latest-gap-report", []);
    return report.length ? report : buildGapReport(latestQuiz ?? { id: "demo", title: "Diagnostic Quiz", createdAt: "2026-11-17T00:00:00.000Z", studentId: "demo", questions: [] }, latestAnswers);
  });

  return (
    <AppShell title="Results and gap analysis">
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

      <div className="mt-8 flex justify-end gap-3">
        <Link href="/revision-plan" className="rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700">View revision plan</Link>
        <Link href="/quiz" className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white">Retake quiz</Link>
      </div>
    </AppShell>
  );
}
