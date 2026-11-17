"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getDemoProfile, saveToStorage } from "@/lib/logic";

export default function SettingsPage() {
  const [profile, setProfile] = useState(() => getDemoProfile());

  const handleSave = () => {
    saveToStorage("profile", profile);
    alert("Profile saved successfully.");
  };

  return (
    <AppShell title="Profile and settings">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Course</label>
            <input value={profile.course} onChange={(event) => setProfile((current) => ({ ...current, course: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exam date</label>
            <input type="date" value={profile.examDate ?? "2026-12-15"} onChange={(event) => setProfile((current) => ({ ...current, examDate: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Available days</label>
            <input type="number" value={profile.availableDays} onChange={(event) => setProfile((current) => ({ ...current, availableDays: Number(event.target.value) || 1 }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Hours per day</label>
            <input type="number" value={profile.studyHoursPerDay} onChange={(event) => setProfile((current) => ({ ...current, studyHoursPerDay: Number(event.target.value) || 1 }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500">Save profile</button>
        </div>
      </div>
    </AppShell>
  );
}
