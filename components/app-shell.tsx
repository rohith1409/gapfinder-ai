"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpenText, GraduationCap, LayoutDashboard, LogOut, MessageSquareText, PencilLine, Settings, Sparkles, UploadCloud } from "lucide-react";
import { defaultProfile } from "@/lib/logic";
import { apiFetch, getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";
import type { StudentProfile } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materials", label: "Materials", icon: UploadCloud },
  { href: "/topics", label: "Topics", icon: BookOpenText },
  { href: "/quiz", label: "Quiz", icon: PencilLine },
  { href: "/revision-plan", label: "Revision", icon: Sparkles },
  { href: "/explain", label: "Explain", icon: MessageSquareText },
  { href: "/progress", label: "Progress", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const demoProfile = useLocalStorageValue<StudentProfile | null>("profile", defaultProfile);
  const [cloudProfile, setCloudProfile] = useState<StudentProfile | null>(null);
  const profile = isSupabaseConfigured() ? cloudProfile : demoProfile;
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<StudentProfile>("/api/profile")
      .then(setCloudProfile)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load your profile."));
  }, []);

  const handleLogout = async () => {
    setError("");
    if (isSupabaseConfigured()) {
      const { error: authError } = await getSupabaseBrowserClient().auth.signOut();
      if (authError) {
        setError(`Could not sign out: ${authError.message}`);
        return;
      }
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("gapfinder:profile");
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">G</div>
            <div>
              <div className="text-lg font-semibold">GapFinder AI</div>
              <div className="text-xs text-slate-500">Study gap intelligence</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:block ${isSupabaseConfigured() ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {isSupabaseConfigured() ? "Cloud account" : "Demo mode · local only"}
            </div>
            <div className="hidden rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 sm:block">
              {profile?.fullName ?? "Student"}
            </div>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
        {error && <p role="alert" className="mx-auto max-w-7xl px-4 pb-3 text-sm text-red-600 sm:px-6">{error}</p>}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">Student workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
