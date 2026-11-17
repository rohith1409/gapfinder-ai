import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";
import type { Quiz, StudentAnswer, TopicPerformance } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud results are not configured.", 503);
    const quizId = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
    if (!z.string().uuid().safeParse(quizId).success) throw new ApiError("Invalid quiz id.", 400);
    const { client, user } = await getUserSupabase(request);
    const { data: attempt, error: attemptError } = await client
      .from("quiz_attempts")
      .select("id,score,answers,created_at")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (attemptError) throw new ApiError(`Could not load quiz results: ${attemptError.message}`, 502);
    if (!attempt) throw new ApiError("No completed attempt was found for this quiz.", 404);

    const [
      { data: quizRow, error: quizError },
      { data: topicRows, error: topicError },
    ] = await Promise.all([
      client.from("quizzes").select("id,title,created_at,questions").eq("id", quizId).eq("user_id", user.id).single(),
      client.from("topic_performance")
        .select("topic,score,status,correct_answers,incorrect_answers,attempts,diagnosis,recommended_action,previous_score,improvement,details")
        .eq("user_id", user.id)
        .eq("quiz_attempt_id", attempt.id),
    ]);
    if (quizError || !quizRow) throw new ApiError(`Could not load completed quiz: ${quizError?.message ?? "Quiz not found."}`, 502);
    if (topicError) throw new ApiError(`Could not load topic analysis: ${topicError.message}`, 502);

    const quiz: Quiz = {
      id: quizRow.id,
      title: quizRow.title,
      createdAt: quizRow.created_at,
      studentId: user.id,
      questions: quizRow.questions as Quiz["questions"],
    };
    const gapReport: TopicPerformance[] = (topicRows ?? []).map((row) => {
      const details = row.details as TopicPerformance | null;
      return details ?? {
        topic: row.topic,
        score: Number(row.score),
        status: row.status,
        correct: row.correct_answers,
        incorrect: row.incorrect_answers,
        attempts: row.attempts,
        difficultyBreakdown: {},
        subtopics: [],
        diagnosis: row.diagnosis ?? "",
        recommendedAction: row.recommended_action ?? "",
        ...(row.previous_score === null ? {} : { previousScore: Number(row.previous_score) }),
        ...(row.improvement === null ? {} : { improvement: Number(row.improvement) }),
      };
    });
    return Response.json({
      quiz,
      responses: attempt.answers as StudentAnswer[],
      gapReport,
      score: Number(attempt.score),
      attemptId: attempt.id,
    });
  } catch (error) {
    return jsonError(error);
  }
}
