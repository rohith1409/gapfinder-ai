import Link from "next/link";
import { ArrowRight, BookOpenText, BrainCircuit, ChartColumn, ShieldCheck, Sparkles, Target } from "lucide-react";

const features = [
  { icon: BrainCircuit, title: "AI gap diagnosis", text: "Identify weak topics and convert them into focused revision tasks." },
  { icon: BookOpenText, title: "Document-backed RAG", text: "Grounded answers use uploaded syllabus, notes, and previous papers only." },
  { icon: ChartColumn, title: "Progress analytics", text: "Track topic mastery, performance trends, and learning improvements over time." },
  { icon: ShieldCheck, title: "Safe and structured", text: "Supabase-ready data model with secure ownership and validation rules." },
];

export function LandingPage() {
  return (
    <div className="bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">G</div>
            <div>
              <div className="text-lg font-semibold">GapFinder AI</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/login">Login</Link>
            <Link href="/signup" className="rounded-full bg-slate-900 px-4 py-2 text-white">Get started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              <Sparkles size={14} />
              Personalized learning intelligence
            </div>
            <h1 className="max-w-xl text-5xl font-black tracking-tight text-slate-900">
              Diagnose what students <span className="text-indigo-600">don&apos;t know</span> before they revise blindly.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              GapFinder AI turns uploaded notes, syllabus files, and past papers into a clear topic map, diagnostic quiz, and revision plan that targets real weaknesses.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500">
                Start free demo <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="rounded-full border border-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50">
                Demo login
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-8 text-sm text-slate-600">
              <div><span className="font-bold text-slate-900">5x</span> faster topic focusing</div>
              <div><span className="font-bold text-slate-900">RAG</span> grounded answers</div>
              <div><span className="font-bold text-slate-900">Live</span> progress tracking</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">AI diagnosis</p>
              <div className="mt-5 rounded-xl bg-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Algebra</span>
                  <span className="font-semibold text-red-500">Weak</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 w-[38%] rounded-full bg-red-500" />
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Biology</span>
                  <span className="font-semibold text-amber-500">Medium</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 w-[68%] rounded-full bg-amber-500" />
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Physics</span>
                  <span className="font-semibold text-emerald-600">Strong</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 w-[81%] rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">How it works</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">From study material to a focused revision plan</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 inline-flex rounded-xl bg-indigo-100 p-3 text-indigo-700">
                  <Icon size={22} />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <Target className="mb-4 text-indigo-400" size={28} />
                <h3 className="text-xl font-semibold">Targeted learning</h3>
                <p className="mt-3 text-slate-300">Prioritize weak topics instead of spending equal time on every subject.</p>
              </div>
              <div>
                <BookOpenText className="mb-4 text-indigo-400" size={28} />
                <h3 className="text-xl font-semibold">Grounded study help</h3>
                <p className="mt-3 text-slate-300">AI responses cite uploaded learning material and only answer from relevant context.</p>
              </div>
              <div>
                <ChartColumn className="mb-4 text-indigo-400" size={28} />
                <h3 className="text-xl font-semibold">Visible growth</h3>
                <p className="mt-3 text-slate-300">Track improvements across attempts and see whether revision strategies are working.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
