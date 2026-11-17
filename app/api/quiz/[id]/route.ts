import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";
import type { Quiz } from "@/lib/types";
import { toQuizPreview } from "@/lib/quiz-preview";

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud quizzes are not configured.", 503);
    const id = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
    if (!z.string().uuid().safeParse(id).success) throw new ApiError("Invalid quiz id.", 400);
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client
      .from("quizzes")
      .select("id,title,created_at,questions")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new ApiError(`Could not load quiz: ${error.message}`, 502);
    if (!data) throw new ApiError("Quiz was not found for this account.", 404);
    const quiz: Quiz = {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      studentId: user.id,
      questions: data.questions as Quiz["questions"],
    };
    return Response.json({ quiz: toQuizPreview(quiz) });
  } catch (error) {
    return jsonError(error);
  }
}
