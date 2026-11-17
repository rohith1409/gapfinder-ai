"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { defaultProfile, saveToStorage } from "@/lib/logic";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/browser-api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "Aarav Sharma", email: "aarav@demo.com", password: "demo-password" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error: authError } = await getSupabaseBrowserClient().auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { full_name: form.fullName.trim() } },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm the account, then log in.");
          return;
        }
        if (!data.user) throw new Error("Supabase did not return the created user.");
      } else {
        saveToStorage("profile", { ...defaultProfile, ...form });
      }
      router.push("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white">G</div>
          <h1 className="text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">Start your personalized gap diagnosis journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">{loading ? "Creating account…" : "Sign up"}</button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-semibold text-indigo-600">Login</Link>
        </div>
      </div>
    </div>
  );
}
