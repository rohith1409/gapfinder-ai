import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  course: z.string().trim().max(160),
  examDate: z.union([z.literal(""), z.string().date()]),
  availableDays: z.number().int().min(1).max(365),
  studyHoursPerDay: z.number().min(0.25).max(24),
});

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud profiles are not configured.", 503);
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client
      .from("profiles")
      .select("id,full_name,email,course,exam_date,available_days,study_hours_per_day")
      .eq("id", user.id)
      .single();
    if (error || !data) throw new ApiError(`Could not load student profile: ${error?.message ?? "Profile not found."}`, 502);
    return Response.json({
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      course: data.course ?? "",
      examDate: data.exam_date ?? "",
      availableDays: data.available_days,
      studyHoursPerDay: Number(data.study_hours_per_day),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Cloud profiles are not configured.", 503);
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Provide a valid name, course, exam date, and study schedule.", 400);
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        course: parsed.data.course || null,
        exam_date: parsed.data.examDate || null,
        available_days: parsed.data.availableDays,
        study_hours_per_day: parsed.data.studyHoursPerDay,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id,full_name,email,course,exam_date,available_days,study_hours_per_day")
      .single();
    if (error || !data) throw new ApiError(`Could not save student profile: ${error?.message ?? "Profile not found."}`, 502);
    return Response.json({
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      course: data.course ?? "",
      examDate: data.exam_date ?? "",
      availableDays: data.available_days,
      studyHoursPerDay: Number(data.study_hours_per_day),
    });
  } catch (error) {
    return jsonError(error);
  }
}
