import type { NextRequest } from "next/server";
import { ApiError, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud dashboard is not configured.", 503);
    const { client, user } = await getUserSupabase(request);
    const [
      { count: materialCount, error: materialError },
      { data: attempts, count: attemptCount, error: attemptError },
      { data: allAttemptScores, error: scoresError },
      { data: topicRows, error: topicError },
      { data: latestPlans, error: planError },
      { count: identifiedTopicCount, error: identifiedTopicsError },
    ] = await Promise.all([
      client.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      client.from("quiz_attempts").select("id,score,created_at,quizzes(title)", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      client.from("quiz_attempts").select("score").eq("user_id", user.id),
      client.from("topic_performance").select("quiz_attempt_id,topic,score,status,diagnosis,recommended_action,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      client.from("revision_plans").select("id").eq("user_id", user.id).order("generated_at", { ascending: false }).limit(1),
      client.from("topics").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    if (materialError) throw new ApiError(`Could not load material statistics: ${materialError.message}`, 502);
    if (attemptError) throw new ApiError(`Could not load quiz history: ${attemptError.message}`, 502);
    if (scoresError) throw new ApiError(`Could not load overall performance: ${scoresError.message}`, 502);
    if (topicError) throw new ApiError(`Could not load topic analysis: ${topicError.message}`, 502);
    if (planError) throw new ApiError(`Could not load revision plans: ${planError.message}`, 502);
    if (identifiedTopicsError) throw new ApiError(`Could not load identified topic count: ${identifiedTopicsError.message}`, 502);
    const { data: taskRows, error: taskError } = latestPlans?.[0]
      ? await client.from("revision_tasks")
        .select("id,plan_id,day,topic,subtopic,activity,completed")
        .eq("user_id", user.id)
        .eq("plan_id", latestPlans[0].id)
        .order("day")
      : { data: [], error: null };
    if (taskError) throw new ApiError(`Could not load revision tasks: ${taskError.message}`, 502);

    const newestTopicDate = topicRows?.[0]?.created_at;
    const latestTopics = newestTopicDate
      ? (topicRows ?? []).filter((topic) => topic.created_at === newestTopicDate)
      : [];
    const recentAttempts = (attempts ?? []).map((attempt) => {
      const quiz = attempt.quizzes as unknown as { title: string } | null;
      return {
        id: attempt.id,
        title: quiz?.title ?? "Diagnostic quiz",
        score: Number(attempt.score),
        createdAt: attempt.created_at,
      };
    });
    const trend = recentAttempts.slice().reverse().map((attempt, index) => ({
      name: `Attempt ${index + 1}`,
      score: attempt.score,
    }));

    return Response.json({
      totalMaterials: materialCount ?? 0,
      totalQuizzes: attemptCount ?? 0,
      overall: allAttemptScores?.length
        ? Math.round(allAttemptScores.reduce((total, attempt) => total + Number(attempt.score), 0) / allAttemptScores.length)
        : null,
      weakTopics: latestTopics.filter((topic) => topic.status === "Weak").length,
      mediumTopics: latestTopics.filter((topic) => topic.status === "Medium").length,
      strongTopics: latestTopics.filter((topic) => topic.status === "Strong").length,
      totalTopics: identifiedTopicCount ?? latestTopics.length,
      revisionCompleted: (taskRows ?? []).filter((task) => task.completed).length,
      revisionTotal: taskRows?.length ?? 0,
      latestTopics: latestTopics.map((topic) => ({
        topic: topic.topic,
        score: Number(topic.score),
        status: topic.status,
        diagnosis: topic.diagnosis,
        recommendedAction: topic.recommended_action,
      })),
      topicHistory: (topicRows ?? []).filter((topic) => topic.quiz_attempt_id !== null).map((topic) => ({
        attemptId: topic.quiz_attempt_id,
        topic: topic.topic,
        score: Number(topic.score),
        createdAt: topic.created_at,
      })),
      recentAttempts,
      trend,
      upcomingTasks: (taskRows ?? []).filter((task) => !task.completed).map((task) => ({
        id: task.id,
        day: task.day,
        topic: task.topic,
        detail: task.subtopic || task.activity,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
