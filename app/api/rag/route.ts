import { z } from "zod";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, callGroq, embedTexts, getUserSupabase, isCloudBackendConfigured, jsonError, requireEmbeddingConfig } from "@/lib/server/backend";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(2000),
  documentIds: z.array(z.string().uuid()).max(100).optional(),
  topic: z.string().trim().min(1).max(200).optional(),
  materials: z.array(z.object({
    name: z.string(),
    chunks: z.array(z.object({
      id: z.string().optional(),
      content: z.string(),
      source: z.string(),
      page: z.number().optional(),
      section: z.string().optional(),
      topic: z.string().optional(),
    })),
  })).optional(),
});

type RetrievedChunk = {
  id: string;
  documentId?: string;
  content: string;
  source: string;
  page?: number;
  section?: string;
  topic?: string;
  similarity: number;
};

const answerSchema = z.object({
  answer: z.string().trim().min(1),
  citationIds: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Provide a question with at least three characters.", 400);
    const payload = parsed.data;
    let evidence: RetrievedChunk[] = [];
    let client: SupabaseClient | undefined;
    let userId: string | undefined;

    if (isCloudBackendConfigured()) {
      requireEmbeddingConfig();
      const auth = await getUserSupabase(request);
      client = auth.client;
      userId = auth.user.id;
      const [embedding] = await embedTexts([payload.question]);
      const { data, error } = await client.rpc("match_document_chunks", {
        query_embedding: embedding,
        match_threshold: 0.25,
        match_count: 8,
        p_document_ids: payload.documentIds?.length ? payload.documentIds : null,
        p_topic: payload.topic ?? null,
      });
      if (error) throw new ApiError(`Semantic search failed: ${error.message}`, 502);
      evidence = (data ?? []).map((chunk: {
        id: string; document_id: string; document_name: string; chunk_content: string;
        page_number: number | null; section_title: string | null; topic: string | null; similarity: number;
      }) => ({
        id: chunk.id,
        documentId: chunk.document_id,
        content: chunk.chunk_content,
        source: chunk.document_name,
        ...(chunk.page_number ? { page: chunk.page_number } : {}),
        ...(chunk.section_title ? { section: chunk.section_title } : {}),
        ...(chunk.topic ? { topic: chunk.topic } : {}),
        similarity: chunk.similarity,
      }));
    } else {
      const stopWords = new Set(["what", "when", "where", "which", "who", "why", "how", "does", "do", "did", "is", "are", "was", "were", "the", "and", "for", "from", "with", "this", "that", "into", "about", "important", "explain", "describe"]);
      const tokens = payload.question.toLowerCase().split(/\W+/).filter((token) => token.length > 2 && !stopWords.has(token));
      evidence = (payload.materials ?? []).flatMap((material) => material.chunks.map((chunk) => ({
        id: chunk.id ?? `${chunk.source}:${chunk.page ?? ""}:${chunk.content.slice(0, 40)}`,
        content: chunk.content,
        source: chunk.source,
        ...(chunk.page ? { page: chunk.page } : {}),
        ...(chunk.section ? { section: chunk.section } : {}),
        ...(chunk.topic ? { topic: chunk.topic } : {}),
        similarity: tokens.length
          ? tokens.filter((token) => chunk.content.toLowerCase().includes(token)).length / tokens.length
          : 0,
      })))
        .filter((chunk) => chunk.similarity >= 0.25)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8);
    }

    if (!evidence.length) {
      const result = {
        answer: "I couldn't find sufficient evidence in your uploaded study materials to answer that question.",
        citations: [],
        insufficientContext: true,
      };
      if (client && userId) {
        const { error } = await client.from("chat_history").insert({ user_id: userId, question: payload.question, answer: result.answer, citations: [] });
        if (error) throw new ApiError(`Could not save assistant conversation: ${error.message}`, 502);
      }
      return Response.json(result);
    }

    const citations = evidence.map(({ id, documentId, source, page, section }) => ({
      chunkId: id,
      ...(documentId ? { documentId } : {}),
      source,
      ...(page ? { page } : {}),
      ...(section ? { section } : {}),
    }));

    if (!process.env.GROQ_API_KEY) {
      if (client) throw new ApiError("AI explanations require GROQ_API_KEY. Retrieved source text is available, but no explanation was generated.", 503);
      const result = {
        answer: `Relevant excerpt from your study material: ${evidence[0].content}`,
        citations: [citations[0]],
        insufficientContext: false,
      };
      return Response.json(result);
    }

    const generatedResult = answerSchema.safeParse(await callGroq<unknown>(
      "Answer using only supplied evidence. If it is insufficient, say so and return no citation ids. Return JSON with answer and citationIds. Only cite supplied chunk ids.",
      `Question: ${payload.question}\nEvidence chunks:\n${JSON.stringify(evidence.slice(0, 5).map(({ id, content, source, page, section }) => ({ id, content, source, page, section })))}`,
    ));
    if (!generatedResult.success) throw new ApiError("The AI returned an invalid answer or citation list.", 502);
    const generated = generatedResult.data;
    const validIds = new Set(evidence.map((chunk) => chunk.id));
    const citedIds = [...new Set(generated.citationIds.filter((id) => validIds.has(id)))];
    if (/could(?:n['’]t| not) find|insufficient (?:information|evidence|context)/i.test(generated.answer)) {
      const result = { answer: generated.answer.trim(), citations: [], insufficientContext: true };
      if (client && userId) {
        const { error } = await client.from("chat_history").insert({ user_id: userId, question: payload.question, answer: result.answer, citations: [] });
        if (error) throw new ApiError(`Could not save assistant conversation: ${error.message}`, 502);
      }
      return Response.json(result);
    }
    if (!citedIds.length) throw new ApiError("The AI answer did not cite any retrieved source evidence.", 502);
    const result = {
      answer: generated.answer.trim(),
      citations: citations.filter((citation) => citedIds.includes(citation.chunkId)),
      insufficientContext: false,
    };
    if (client && userId) {
      const { error } = await client.from("chat_history").insert({ user_id: userId, question: payload.question, answer: result.answer, citations: result.citations });
      if (error) throw new ApiError(`Could not save assistant conversation: ${error.message}`, 502);
    }
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
