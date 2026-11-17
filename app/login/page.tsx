"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { defaultProfile, saveToStorage } from "@/lib/logic";

const demoEmail = "aarav@demo.com";
const demoPassword = "demo-password";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim().toLowerCase() !== demoEmail || password !== demoPassword) {
      setError("Use the demo email and password shown below.");
      return;
    }

    saveToStorage("profile", defaultProfile);
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white">G</div>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Log in to continue your learning journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500">Log in</button>
        </form>

        <p className="mt-5 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
          Demo credentials: <strong>{demoEmail}</strong> / <strong>{demoPassword}</strong>
        </p>
        <div className="mt-6 text-center text-sm text-slate-500">
          New here? <Link href="/signup" className="font-semibold text-indigo-600">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
