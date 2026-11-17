"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";

type TopicAttempt = { attemptId: string; createdAt: string; topic: string; score: number };
type ProgressResponse = { topicHistory: TopicAttempt[] };

const colors = ["#cbd5e1", "#a5b4fc", "#4f46e5", "#0ea5e9", "#10b981"];

export default function ProgressPage() {
  const [cloudHistory, setCloudHistory] = useState<TopicAttempt[]>([]);
  const demoHistory = useLocalStorageValue<TopicAttempt[]>("topic-history", []);
  const history = isSupabaseConfigured() ? cloudHistory : demoHistory;
  const [showAll, setShowAll] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }
    apiFetch<ProgressResponse>("/api/dashboard")
      .then((response) => setCloudHistory(response.topicHistory))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load topic progress."));
  }, []);

  const chart = useMemo(() => {
    const groups = new Map<string, { createdAt: string; scores: Map<string, number> }>();
    for (const entry of [...history].reverse()) {
      const group = groups.get(entry.attemptId) ?? { createdAt: entry.createdAt, scores: new Map<string, number>() };
      group.scores.set(entry.topic, entry.score);
      groups.set(entry.attemptId, group);
    }
    const attempts = [...groups.entries()].slice(-5);
    const attemptKeys = attempts.map(([, group], index) => ({
      key: `Attempt ${index + 1}`,
      date: group.createdAt,
    }));
    const topics = [...new Set(attempts.flatMap(([, group]) => [...group.scores.keys()]))];
    const rows = topics.map((topic) => {
      const row: Record<string, string | number> = { topic };
      attempts.forEach(([attemptId], index) => {
        const score = groups.get(attemptId)?.scores.get(topic);
        if (score !== undefined) row[`Attempt ${index + 1}`] = score;
      });
      return row;
    });
    return { attemptKeys, rows };
  }, [history]);

  const visibleAttempts = showAll ? chart.attemptKeys : chart.attemptKeys.slice(-1);

  return (
    <AppShell title="Progress dashboard">
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Topic-wise improvement</h2>
            <p className="mt-1 text-sm text-slate-500">Scores from your completed quiz attempts.</p>
          </div>
          {chart.attemptKeys.length > 1 && (
            <button onClick={() => setShowAll((current) => !current)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
              {showAll ? "Latest attempt" : "Show all"}
            </button>
          )}
        </div>
        {chart.rows.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="topic" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip />
                {visibleAttempts.map((attempt) => (
                  <Bar key={attempt.key} dataKey={attempt.key} name={`${attempt.key} · ${new Date(attempt.date).toLocaleDateString()}`} fill={colors[Number(attempt.key.split(" ")[1]) - 1] ?? colors[2]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Complete a quiz to see topic scores and improvement over time.
          </div>
        )}
      </div>
    </AppShell>
  );
}
