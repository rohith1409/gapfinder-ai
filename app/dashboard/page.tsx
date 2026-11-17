"use client";

import { useMemo, useState } from "react";
import { BarChart3, BookOpen, CircleDashed, PencilLine, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { getDemoMaterials, getDemoQuizHistory, summarizeDashboard } from "@/lib/logic";

const defaultTrend = [
  { name: "Attempt 1", score: 45 },
  { name: "Attempt 2", score: 62 },
  { name: "Attempt 3", score: 73 },
];

export default function DashboardPage() {
  const [materials] = useState<ReturnType<typeof getDemoMaterials>>(() => getDemoMaterials());
  const [quizHistory] = useState<ReturnType<typeof getDemoQuizHistory>>(() => getDemoQuizHistory());

  const summary = useMemo(() => summarizeDashboard(materials, quizHistory, []), [materials, quizHistory]);

  return (
    <AppShell title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Study materials", value: summary.totalMaterials, icon: BookOpen, className: "bg-indigo-100 text-indigo-700" },
          { label: "Quizzes completed", value: summary.totalQuizzes, icon: PencilLine, className: "bg-sky-100 text-sky-700" },
          { label: "Overall performance", value: `${summary.overall}%`, icon: TrendingUp, className: "bg-emerald-100 text-emerald-700" },
          { label: "Weak topics", value: summary.weakTopics, icon: CircleDashed, className: "bg-red-100 text-red-700" },
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

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Progress trend</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500"><BarChart3 size={16} /> Study progress</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={defaultTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Quick insights</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-sm text-emerald-700">Strong topic</div>
              <div className="mt-2 font-semibold">Physics</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="text-sm text-amber-700">Needs attention</div>
              <div className="mt-2 font-semibold">Algebra</div>
            </div>
            <div className="rounded-xl bg-indigo-50 p-4">
              <div className="text-sm text-indigo-700">Next revision</div>
              <div className="mt-2 font-semibold">Quadratic equations</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Recent quiz attempts</h2>
          <div className="mt-4 space-y-3">
            {quizHistory.length ? quizHistory.slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="font-medium">{entry.title}</div>
                  <div className="text-sm text-slate-500">{new Date(entry.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="rounded-full bg-indigo-100 px-2.5 py-1 text-sm font-semibold text-indigo-700">{Math.round(entry.questions.reduce((total, q) => total + (q.correctAnswer ? 100 : 0), 0) / entry.questions.length)}%</div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No quizzes yet. Generate a diagnostic quiz to start seeing progress.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Upcoming revision tasks</h2>
          <div className="mt-4 space-y-3">
            {materials.length ? (
              [
                { topic: "Algebra", day: 1, detail: "Factorization practice" },
                { topic: "Biology", day: 2, detail: "Genetics recall" },
                { topic: "Physics", day: 3, detail: "Motion formulas" },
              ].map((task) => (
                <div key={task.topic} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div className="font-medium">{task.topic}</div>
                    <div className="text-sm text-slate-500">Day {task.day} · {task.detail}</div>
                  </div>
                  <Users size={16} className="text-slate-400" />
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
