"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase configuration is incomplete. Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  browserClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error) throw error;
    if (!data.session?.access_token) {
      throw new Error("Sign in to your Supabase account to use cloud-backed data.");
    }
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status}).`);
  }
  if (!payload) throw new Error("The server returned an empty response.");
  return payload;
}
