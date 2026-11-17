import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";

const updateSchema = z.object({
  taskId: z.string().uuid(),
  completed: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud revision plans are not configured.", 503);
    const { client, user } = await getUserSupabase(request);
    const { data: latestTasks, error: latestError } = await client
      .from("revision_tasks")
      .select("plan_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (latestError) throw new ApiError(`Could not load revision plan: ${latestError.message}`, 502);
    if (!latestTasks?.length) return Response.json({ tasks: [] });

    const { data, error } = await client
      .from("revision_tasks")
      .select("id,day,topic,subtopic,duration_minutes,priority,activity,completed")
      .eq("user_id", user.id)
      .eq("plan_id", latestTasks[0].plan_id)
      .order("day");
    if (error) throw new ApiError(`Could not load revision tasks: ${error.message}`, 502);
    const tasks = (data ?? []).map((task) => ({
      id: task.id,
      day: task.day,
      topic: task.topic,
      subtopic: task.subtopic ?? "",
      duration: task.duration_minutes,
      priority: task.priority,
      activity: task.activity,
      completed: task.completed,
    }));
    return Response.json({ tasks });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud revision plans are not configured.", 503);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Provide a valid revision task and completion state.", 400);
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client
      .from("revision_tasks")
      .update({ completed: parsed.data.completed })
      .eq("id", parsed.data.taskId)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error || !data) throw new ApiError(error?.code === "PGRST116" ? "Revision task was not found." : `Could not update revision task: ${error?.message ?? "No task returned."}`, error?.code === "PGRST116" ? 404 : 502);
    return Response.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
