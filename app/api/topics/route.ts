import type { NextRequest } from "next/server";
import { ApiError, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) return Response.json({ mode: "demo", topics: null });
    const { client, user } = await getUserSupabase(request);
    const [
      { data: topics, error: topicsError },
      { data: performance, error: performanceError },
    ] = await Promise.all([
      client.from("topics").select("name,exam_importance,source_documents").eq("user_id", user.id).order("name"),
      client.from("topic_performance")
        .select("topic,score,status,diagnosis,recommended_action,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (topicsError) throw new ApiError(`Could not load identified topics: ${topicsError.message}`, 502);
    if (performanceError) throw new ApiError(`Could not load topic performance: ${performanceError.message}`, 502);
    const latest = new Map<string, (typeof performance)[number]>();
    for (const row of performance ?? []) {
      if (!latest.has(row.topic.toLowerCase())) latest.set(row.topic.toLowerCase(), row);
    }
    return Response.json({
      mode: "cloud",
      topics: (topics ?? []).map((topic) => {
        const report = latest.get(topic.name.toLowerCase());
        return {
          name: topic.name,
          importance: topic.exam_importance,
          relatedDocuments: topic.source_documents ?? [],
          ...(report ? {
            score: Number(report.score),
            status: report.status,
            diagnosis: report.diagnosis,
            recommendedAction: report.recommended_action,
          } : {}),
        };
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
