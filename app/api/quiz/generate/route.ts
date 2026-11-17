import { z } from "zod";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, callGroq, embedTexts, getUserSupabase, isCloudBackendConfigured, jsonError, requireEmbeddingConfig } from "@/lib/server/backend";
import { defaultTopics } from "@/lib/mock-data";
import type { Quiz, QuizQuestion, SourceCitation } from "@/lib/types";

const requestSchema = z.object({
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  count: z.number().int().min(1).max(20).default(8),
  documentIds: z.array(z.string().uuid()).max(100).optional(),
  materials: z.array(z.object({
    name: z.string(),
    chunks: z.array(z.object({
      id: z.string(),
      content: z.string(),
      source: z.string(),
      page: z.number().optional(),
      section: z.string().optional(),
      topic: z.string().optional(),
    })),
  })).optional(),
});

const generatedSchema = z.object({
  questions: z.array(z.object({
    text: z.string().min(5),
    type: z.enum(["multiple-choice", "true-false", "short-answer"]),
    topic: z.string().min(1),
    subtopic: z.string().min(1),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().min(1),
    explanation: z.string().min(1),
    keywords: z.array(z.string()).optional(),
    sourceChunkIds: z.array(z.string()).min(1).max(3),
  })).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Invalid quiz generation request.", 400);
    if (!process.env.GROQ_API_KEY) throw new ApiError("AI quiz generation requires GROQ_API_KEY.", 503);

    let client: SupabaseClient | undefined;
    let userId = "demo-student";
    let chunks: Array<{ id: string; documentId?: string; content: string; source: string; page?: number; section?: string; topic?: string }> = [];
    if (isCloudBackendConfigured()) {
      requireEmbeddingConfig();
      const auth = await getUserSupabase(request);
      client = auth.client;
      userId = auth.user.id;
      const [embedding] = await embedTexts(["Create a balanced diagnostic quiz covering the concepts and learning objectives in my uploaded study materials."]);
      const { data, error } = await client.rpc("match_document_chunks", {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: Math.min(20, parsed.data.count * 3),
        p_document_ids: parsed.data.documentIds?.length ? parsed.data.documentIds : null,
        p_topic: null,
      });
      if (error) throw new ApiError(`Could not retrieve quiz source material: ${error.message}`, 502);
      chunks = (data ?? []).map((chunk: {
        id: string; document_id: string; document_name: string; chunk_content: string;
        page_number: number | null; section_title: string | null; topic: string | null;
      }) => ({
        id: chunk.id,
        documentId: chunk.document_id,
        content: chunk.chunk_content,
        source: chunk.document_name,
        ...(chunk.page_number ? { page: chunk.page_number } : {}),
        ...(chunk.section_title ? { section: chunk.section_title } : {}),
        ...(chunk.topic ? { topic: chunk.topic } : {}),
      }));
    } else {
      chunks = (parsed.data.materials ?? []).flatMap((material) => material.chunks);
    }
    if (!chunks.length) throw new ApiError("Upload study material with extractable text before generating a grounded quiz.", 422);

    const generated = generatedSchema.safeParse(await callGroq<unknown>(
      "Create assessment questions only from the provided source chunks. Every question must cite one or more exact chunk ids from the context. Do not introduce outside facts. Return JSON: {questions:[{text,type,topic,subtopic,difficulty,options,correctAnswer,explanation,keywords,sourceChunkIds}]}",
      `Difficulty: ${parsed.data.difficulty}\nNumber of questions: ${parsed.data.count}\nSource chunks:\n${JSON.stringify(chunks.slice(0, 40))}`,
    ));
    if (!generated.success) throw new ApiError("The AI generated questions in an invalid format. Please retry.", 502);

    const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    const questions: QuizQuestion[] = generated.data.questions
      .filter((question) => question.difficulty === parsed.data.difficulty && question.sourceChunkIds.every((id) => byId.has(id)))
      .slice(0, parsed.data.count)
      .map((question, index) => {
        if (question.type === "multiple-choice" && (question.options?.length ?? 0) < 2) {
          throw new ApiError("The AI generated a multiple-choice question without enough options.", 502);
        }
        if (question.type === "multiple-choice" && !question.options?.some((option) => option.toLowerCase() === question.correctAnswer.toLowerCase())) {
          throw new ApiError("The AI generated a multiple-choice answer that is not one of its options.", 502);
        }
        if (question.type === "true-false" && !["true", "false"].includes(question.correctAnswer.toLowerCase())) {
          throw new ApiError("The AI generated an invalid true-or-false answer.", 502);
        }
        const sources = question.sourceChunkIds.map((id) => byId.get(id)!);
        const citations: SourceCitation[] = sources.map((source) => ({
          chunkId: source.id,
          ...(source.documentId ? { documentId: source.documentId } : {}),
          source: source.source,
          ...(source.page ? { page: source.page } : {}),
          ...(source.section ? { section: source.section } : {}),
        }));
        return {
          id: `question-${index + 1}`,
          text: question.text,
          type: question.type,
          topic: question.topic,
          subtopic: question.subtopic,
          difficulty: question.difficulty,
          ...(question.options ? { options: question.options } : {}),
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          keywords: question.keywords,
          sourceChunkIds: question.sourceChunkIds,
          citations,
        };
      });
    if (!questions.length) throw new ApiError("The AI did not create questions with valid source citations.", 502);
    if (questions.length !== parsed.data.count) throw new ApiError("The AI returned fewer grounded questions than requested. Please retry.", 502);

    const quiz: Quiz = {
      id: crypto.randomUUID(),
      title: `AI Diagnostic Quiz | ${parsed.data.difficulty} | ${questions.length} questions`,
      createdAt: new Date().toISOString(),
      studentId: userId,
      questions,
    };
    if (client) {
      const { error } = await client.from("quizzes").insert({
        id: quiz.id,
        user_id: userId,
        title: quiz.title,
        difficulty: parsed.data.difficulty,
        questions,
      });
      if (error) throw new ApiError(`Could not save generated quiz: ${error.message}`, 502);
    }

    const importance = Object.fromEntries(defaultTopics.map((topic) => [topic.name, topic.importance]));
    return Response.json({ quiz, mode: client ? "cloud" : "demo", importance }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
