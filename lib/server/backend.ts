import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function isCloudBackendConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requireEmbeddingConfig() {
  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError("Semantic search requires OPENAI_API_KEY for text embeddings.", 503);
  }
}

export async function getUserSupabase(request: NextRequest): Promise<{ client: SupabaseClient; user: User }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new ApiError("Supabase configuration is incomplete. Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", 503);
  }
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiError("Sign in to use your private study data.", 401);

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError("Your session is invalid or expired. Please sign in again.", 401);

  const email = data.user.email;
  if (!email) throw new ApiError("The authenticated account does not have an email address.", 403);
  const { error: profileError } = await client.from("profiles").upsert(
    { id: data.user.id, email, full_name: data.user.user_metadata.full_name ?? email.split("@")[0] },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) throw new ApiError(`Could not initialize your profile: ${profileError.message}`, 500);

  return { client, user: data.user };
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  requireEmbeddingConfig();
  if (!texts.length) return [];

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      dimensions: 1536,
      input: texts,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429) {
      throw new ApiError("The embedding provider is rate-limiting requests. Please retry shortly.", 503);
    }
    throw new ApiError(`Embedding provider returned ${response.status}: ${detail.slice(0, 300)}`, 502);
  }
  const payload = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
  if (!payload.data || payload.data.length !== texts.length) {
    throw new ApiError("Embedding provider returned an incomplete vector response.", 502);
  }
  return payload.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += 64) {
    const batch = await embedBatch(texts.slice(offset, offset + 64));
    if (batch.some((vector) => vector.length !== 1536 || vector.some((value) => !Number.isFinite(value)))) {
      throw new ApiError("Embedding provider returned an invalid vector.", 502);
    }
    vectors.push(...batch);
  }
  return vectors;
}

export async function callGroq<T>(system: string, prompt: string): Promise<T> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ApiError("This AI feature requires GROQ_API_KEY.", 503);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429) {
      throw new ApiError("Groq is rate-limiting requests. Please retry shortly.", 503);
    }
    throw new ApiError(`Groq returned ${response.status}: ${detail.slice(0, 300)}`, 502);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ApiError("Groq returned an empty completion.", 502);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new ApiError("Groq returned invalid structured output.", 502);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  console.error("API request failed:", error);
  return Response.json({ error: "An unexpected server error occurred." }, { status: 500 });
}
