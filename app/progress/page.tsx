"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";

const performanceData = [
  { topic: "Algebra", attempt1: 40, attempt2: 60, attempt3: 80 },
  { topic: "Biology", attempt1: 58, attempt2: 67, attempt3: 72 },
  { topic: "Physics", attempt1: 72, attempt2: 78, attempt3: 85 },
];

export default function ProgressPage() {
  const [showAll, setShowAll] = useState(true);

  return (
    <AppShell title="Progress dashboard">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Topic-wise improvement</h2>
          <button onClick={() => setShowAll((current) => !current)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
            {showAll ? "Collapse" : "Expand"}
          </button>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="topic" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="attempt1" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attempt2" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attempt3" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}
