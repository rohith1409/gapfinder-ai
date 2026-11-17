"use client";

import { useEffect, useState } from "react";
import { BookOpenText, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buildTopicMap, getDemoMaterials } from "@/lib/logic";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";

type DisplayTopic = {
  name: string;
  importance: number;
  status?: string;
  score?: number;
  diagnosis?: string;
  recommendedAction?: string;
  subtopics?: string[];
  relatedDocuments?: string[];
  questions?: number;
};

export default function TopicsPage() {
  const [cloudTopics, setCloudTopics] = useState<DisplayTopic[]>([]);
  const [error, setError] = useState("");
  const [demoTopics] = useState<DisplayTopic[]>(() => buildTopicMap(getDemoMaterials()));
  const topics = isSupabaseConfigured() ? cloudTopics : demoTopics;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<{ topics: typeof cloudTopics }>("/api/topics")
      .then(({ topics }) => setCloudTopics(topics))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load identified topics."));
  }, []);

  return (
    <AppShell title="Topic map">
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {!topics.length && !error && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Generate a quiz from your uploaded materials to identify topics.</p>}
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
              <div className={`rounded-full px-3 py-1 text-sm font-semibold ${topic.status === "Weak" ? "bg-red-100 text-red-700" : topic.status === "Strong" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {topic.status ?? "Not assessed"}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Subtopics</div>
                {!topic.subtopics ? (
                  <p className="mt-2 text-sm text-slate-600">{topic.diagnosis ?? "Not assessed yet."}</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {topic.subtopics.map((subtopic) => (
                      <li key={subtopic} className="flex items-center gap-2"><ChevronRight size={14} className="text-indigo-500" />{subtopic}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Related chapters</div>
                <div className="mt-2 text-sm text-slate-700">{topic.relatedDocuments?.join(", ") || "Imported study resources"}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">{topic.questions ? "Question load" : "Latest performance"}</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{topic.questions ? Math.ceil(topic.questions) : topic.score !== undefined ? `${topic.score}%` : "—"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
