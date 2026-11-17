"use client";

import { useEffect, useState } from "react";
import { BarChart3, BookOpen, PencilLine, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { defaultMaterials } from "@/lib/logic";
import type { RevisionTask, TopicPerformance } from "@/lib/types";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";

type Attempt = { id: string; title: string; score: number; createdAt: string };
type DashboardData = {
  totalMaterials: number;
  totalQuizzes: number;
  overall: number | null;
  weakTopics: number;
  mediumTopics: number;
  strongTopics: number;
  totalTopics: number;
  revisionCompleted: number;
  revisionTotal: number;
  latestTopics: Array<Pick<TopicPerformance, "topic" | "score" | "status" | "diagnosis" | "recommendedAction">>;
  recentAttempts: Attempt[];
  trend: Array<{ name: string; score: number }>;
  upcomingTasks: Array<{ id: string; day: number; topic: string; detail: string }>;
};

export default function DashboardPage() {
  const [cloudData, setCloudData] = useState<DashboardData | null>(null);
  const materials = useLocalStorageValue("materials", defaultMaterials);
  const attempts = useLocalStorageValue<Attempt[]>("attempt-history", []);
  const topics = useLocalStorageValue<TopicPerformance[]>("latest-gap-report", []);
  const tasks = useLocalStorageValue<RevisionTask[]>("revision-plan", []);
  const localData: DashboardData = {
    totalMaterials: materials.length,
    totalQuizzes: attempts.length,
    overall: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : null,
    weakTopics: topics.filter((topic) => topic.status === "Weak").length,
    mediumTopics: topics.filter((topic) => topic.status === "Medium").length,
    strongTopics: topics.filter((topic) => topic.status === "Strong").length,
    totalTopics: topics.length,
    revisionCompleted: tasks.filter((task) => task.completed).length,
    revisionTotal: tasks.length,
    latestTopics: topics,
    recentAttempts: attempts.slice(0, 10),
    trend: attempts.slice(0, 10).reverse().map((attempt, index) => ({ name: `Attempt ${index + 1}`, score: attempt.score })),
    upcomingTasks: tasks.filter((task) => !task.completed).slice(0, 5).map((task) => ({
      id: task.id, day: task.day, topic: task.topic, detail: task.subtopic || task.activity,
    })),
  };
  const data = isSupabaseConfigured() ? cloudData ?? {
    totalMaterials: 0,
    totalQuizzes: 0,
    overall: null,
    weakTopics: 0,
    mediumTopics: 0,
    strongTopics: 0,
    totalTopics: 0,
    revisionCompleted: 0,
    revisionTotal: 0,
    latestTopics: [],
    recentAttempts: [],
    trend: [],
    upcomingTasks: [],
  } : localData;
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<DashboardData>("/api/dashboard")
      .then(setCloudData)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load dashboard data."));
  }, []);

  return (
    <AppShell title="Dashboard">
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Study materials", value: data.totalMaterials, icon: BookOpen, className: "bg-indigo-100 text-indigo-700" },
          { label: "Quizzes completed", value: data.totalQuizzes, icon: PencilLine, className: "bg-sky-100 text-sky-700" },
          { label: "Overall performance", value: data.overall === null ? "—" : `${data.overall}%`, icon: TrendingUp, className: "bg-emerald-100 text-emerald-700" },
        ].map(({ label, value, icon: Icon, className }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{label}</span>
              <div className={`rounded-xl p-2 ${className}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Topics identified", value: data.totalTopics },
          { label: "Weak topics", value: data.weakTopics },
          { label: "Medium topics", value: data.mediumTopics },
          { label: "Strong topics", value: data.strongTopics },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">{label}</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-4">
          <div className="flex items-center justify-between text-sm font-medium text-slate-600">
            <span>Current revision plan completion</span>
            <span>{data.revisionCompleted}/{data.revisionTotal} tasks</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${data.revisionTotal ? Math.round(data.revisionCompleted / data.revisionTotal * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Progress trend</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500"><BarChart3 size={16} /> Study progress</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            {!data.trend.length && <div className="mt-2 text-center text-sm text-slate-500">Complete a quiz to see your progress trend.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Quick insights</h2>
          <div className="mt-5 space-y-4">
            {data.latestTopics.length ? (
              <>
                {data.latestTopics.filter((topic) => topic.status === "Strong").slice(0, 1).map((topic) => (
                  <div key={topic.topic} className="rounded-xl bg-emerald-50 p-4">
                    <div className="text-sm text-emerald-700">Strong topic</div>
                    <div className="mt-2 font-semibold">{topic.topic}</div>
                  </div>
                ))}
                {data.latestTopics.filter((topic) => topic.status === "Weak").sort((a, b) => a.score - b.score).slice(0, 1).map((topic) => (
                  <div key={topic.topic} className="rounded-xl bg-amber-50 p-4">
                    <div className="text-sm text-amber-700">Needs attention</div>
                    <div className="mt-2 font-semibold">{topic.topic}</div>
                  </div>
                ))}
              </>
            ) : <p className="text-sm text-slate-500">Topic insights will appear after your first quiz.</p>}
            {data.upcomingTasks.slice(0, 1).map((task) => (
              <div key={task.id} className="rounded-xl bg-indigo-50 p-4">
                <div className="text-sm text-indigo-700">Next revision</div>
                <div className="mt-2 font-semibold">{task.topic}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Recent quiz attempts</h2>
          <div className="mt-4 space-y-3">
            {data.recentAttempts.length ? data.recentAttempts.slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="font-medium">{entry.title}</div>
                  <div className="text-sm text-slate-500">{new Date(entry.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="rounded-full bg-indigo-100 px-2.5 py-1 text-sm font-semibold text-indigo-700">{entry.score}%</div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No quizzes yet. Generate a diagnostic quiz to start seeing progress.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Upcoming revision tasks</h2>
          <div className="mt-4 space-y-3">
            {data.upcomingTasks.length ? (
              data.upcomingTasks.slice(0, 3).map((task) => (
                <div key={task.topic} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div className="font-medium">{task.topic}</div>
                    <div className="text-sm text-slate-500">Day {task.day} · {task.detail}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Your revision schedule will show here.</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
