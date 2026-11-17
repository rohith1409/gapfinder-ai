"use client";

import { useState } from "react";
import { BookOpenText, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buildTopicMap, getDemoMaterials } from "@/lib/logic";

export default function TopicsPage() {
  const [topics] = useState(() => buildTopicMap(getDemoMaterials()));

  return (
    <AppShell title="Topic map">
      <div className="space-y-4">
        {topics.map((topic) => (
          <div key={topic.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700"><BookOpenText size={20} /></div>
                <div>
                  <h3 className="text-xl font-semibold">{topic.name}</h3>
                  <div className="mt-1 text-sm text-slate-500">Exam importance: {topic.importance}%</div>
                </div>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{topic.status}</div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Subtopics</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {topic.subtopics.map((subtopic: string) => (
                    <li key={subtopic} className="flex items-center gap-2"><ChevronRight size={14} className="text-indigo-500" />{subtopic}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Related chapters</div>
                <div className="mt-2 text-sm text-slate-700">{topic.relatedDocuments.join(", ") || "Imported study resources"}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Question load</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{Math.ceil(topic.questions)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
