"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { defaultProfile, getDemoProfile, saveToStorage } from "@/lib/logic";
import { apiFetch, isSupabaseConfigured } from "@/lib/browser-api";
import type { StudentProfile } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<StudentProfile>(() => isSupabaseConfigured() ? defaultProfile : getDemoProfile());
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<StudentProfile>("/api/profile")
      .then(setProfile)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (isSupabaseConfigured()) {
        setProfile(await apiFetch<StudentProfile>("/api/profile", {
          method: "PATCH",
          body: JSON.stringify(profile),
        }));
      } else {
        saveToStorage("profile", profile);
      }
      setMessage("Profile saved successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Profile and settings">
      {loading && <p role="status" className="mb-4 text-sm text-slate-500">Loading profile…</p>}
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="mb-4 text-sm text-emerald-700">{message}</p>}
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
            <input value={profile.email} readOnly={isSupabaseConfigured()} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
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
          <button onClick={handleSave} disabled={loading || saving} className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>
        </div>
      </div>
    </AppShell>
  );
}
