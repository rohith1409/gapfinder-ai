"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { generateRevisionPlan, loadFromStorage } from "@/lib/logic";
import type { RevisionTask, StudentProfile, TopicPerformance } from "@/lib/types";

export default function RevisionPlanPage() {
  const [tasks] = useState<RevisionTask[]>(() => {
    const profile = loadFromStorage<StudentProfile>("profile", { id: "demo", fullName: "Aarav Sharma", email: "aarav@demo.com", course: "Class 12 Science", availableDays: 5, studyHoursPerDay: 2 });
    const report = loadFromStorage<TopicPerformance[]>("latest-gap-report", [
      { topic: "Algebra", score: 40, status: "Weak", correct: 2, incorrect: 3, attempts: 5, difficultyBreakdown: {}, subtopics: [{ name: "Quadratic equations", score: 38, status: "Weak" }], diagnosis: "Needs practice with factoring and solving multiple-step equations.", recommendedAction: "Solve 10 factorization questions." },
      { topic: "Biology", score: 60, status: "Medium", correct: 3, incorrect: 2, attempts: 5, difficultyBreakdown: {}, subtopics: [{ name: "Cell division", score: 55, status: "Medium" }], diagnosis: "Partially understood but not fully consistent.", recommendedAction: "Review the chromosome reduction process." },
    ]);
    return generateRevisionPlan(profile, report);
  });

  return (
    <AppShell title="Revision plan">
      <div className="space-y-4">
        {tasks.map((task) => (
          <div key={task.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Day {task.day}</div>
              <div className="mt-2 text-xl font-semibold">{task.topic}</div>
              <div className="text-sm text-slate-500">{task.subtopic} · {task.duration} mins</div>
            </div>
            <div className="text-right">
              <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${task.priority === "High" ? "bg-red-100 text-red-700" : task.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{task.priority}</div>
              <div className="mt-2 text-sm text-slate-600">{task.activity}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
