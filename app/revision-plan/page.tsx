"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { defaultProfile, generateRevisionPlan, saveToStorage } from "@/lib/logic";
import type { RevisionTask, TopicPerformance } from "@/lib/types";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";

const demoReport: TopicPerformance[] = [
  { topic: "Algebra", score: 40, status: "Weak", correct: 2, incorrect: 3, attempts: 5, difficultyBreakdown: {}, subtopics: [{ name: "Quadratic equations", score: 38, status: "Weak" }], diagnosis: "Needs practice with factoring and solving multiple-step equations.", recommendedAction: "Solve 10 factorization questions." },
  { topic: "Biology", score: 60, status: "Medium", correct: 3, incorrect: 2, attempts: 5, difficultyBreakdown: {}, subtopics: [{ name: "Cell division", score: 55, status: "Medium" }], diagnosis: "Partially understood but not fully consistent.", recommendedAction: "Review the chromosome reduction process." },
];

export default function RevisionPlanPage() {
  const [cloudTasks, setCloudTasks] = useState<RevisionTask[]>([]);
  const [error, setError] = useState("");
  const savedTasks = useLocalStorageValue<RevisionTask[]>("revision-plan", []);
  const profile = useLocalStorageValue("profile", defaultProfile);
  const report = useLocalStorageValue<TopicPerformance[]>("latest-gap-report", demoReport);
  const demoTasks = savedTasks.length ? savedTasks : generateRevisionPlan(profile, report);
  const tasks = isSupabaseConfigured() ? cloudTasks : demoTasks;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<{ tasks: RevisionTask[] }>("/api/revision-plan")
      .then(({ tasks: cloudTasks }) => {
        setCloudTasks(cloudTasks);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load revision plan."));
  }, []);

  const toggleTask = async (task: RevisionTask) => {
    setError("");
    try {
      if (isSupabaseConfigured()) {
        await apiFetch("/api/revision-plan", {
          method: "PATCH",
          body: JSON.stringify({ taskId: task.id, completed: !task.completed }),
        });
      }
      const updated = tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item);
      if (isSupabaseConfigured()) setCloudTasks(updated);
      else saveToStorage("revision-plan", updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update revision task.");
    }
  };

  return (
    <AppShell title="Revision plan">
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {!tasks.length && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Complete a quiz to create your adaptive revision plan.</p>}
        {tasks.map((task) => (
          <div key={task.id} className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between ${task.completed ? "border-emerald-200 opacity-70" : "border-slate-200"}`}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Day {task.day}</div>
              <div className={`mt-2 text-xl font-semibold ${task.completed ? "line-through" : ""}`}>{task.topic}</div>
              <div className="text-sm text-slate-500">{task.subtopic} · {task.duration} mins</div>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${task.priority === "High" ? "bg-red-100 text-red-700" : task.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{task.priority}</div>
              <div className="mt-2 text-sm text-slate-600">{task.activity}</div>
              <button type="button" onClick={() => toggleTask(task)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {task.completed ? "Mark incomplete" : "Mark complete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
