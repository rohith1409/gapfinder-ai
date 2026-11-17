import { z } from "zod";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGapReport, classifyScore, evaluateQuestion, generateRevisionPlan } from "@/lib/logic";
import { ApiError, callGroq, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";
import type { Quiz, RevisionTask, StudentAnswer, StudentProfile, TopicPerformance } from "@/lib/types";

const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.string(),
  studentId: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    type: z.enum(["multiple-choice", "true-false", "short-answer"]),
    topic: z.string(),
    subtopic: z.string(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string(),
    explanation: z.string(),
    keywords: z.array(z.string()).optional(),
    citations: z.array(z.object({
      source: z.string(),
      chunkId: z.string().optional(),
      documentId: z.string().optional(),
      page: z.number().optional(),
      section: z.string().optional(),
    })),
    sourceChunkIds: z.array(z.string()).optional(),
  })).min(1),
});

const requestSchema = z.object({
  quiz: quizSchema.optional(),
  quizId: z.string().optional(),
  answers: z.record(z.string(), z.string()),
  materials: z.array(z.object({
    name: z.string(),
    chunks: z.array(z.object({ id: z.string(), content: z.string(), source: z.string(), page: z.number().optional(), section: z.string().optional(), topic: z.string().optional() })),
  })).optional(),
}).refine((payload) => payload.quizId || payload.quiz, "Provide the quiz to submit.");

const evaluationSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    score: z.number().finite().min(0).max(100),
    feedback: z.string(),
    correctAnswer: z.string(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Invalid quiz submission.", 400);
    const payload = parsed.data;
    let client: SupabaseClient | undefined;
    let userId = payload.quiz?.studentId ?? "demo-student";
    let quiz: Quiz;
    let profile: StudentProfile = { id: userId, fullName: "Student", email: "", course: "", availableDays: 5, studyHoursPerDay: 2 };
    let previousTasks: RevisionTask[] = [];
    let attemptId: string | undefined;

    if (isCloudBackendConfigured()) {
      const auth = await getUserSupabase(request);
      client = auth.client;
      userId = auth.user.id;
      const { data: savedQuiz, error: quizError } = await client.from("quizzes").select("id,title,difficulty,questions,created_at").eq("id", payload.quizId ?? payload.quiz?.id).eq("user_id", userId).single();
      if (quizError || !savedQuiz) throw new ApiError("Quiz was not found for this account.", 404);
      quiz = quizSchema.parse({
        id: savedQuiz.id,
        title: savedQuiz.title,
        createdAt: savedQuiz.created_at,
        studentId: userId,
        questions: savedQuiz.questions,
      });
      const { data: profileRow, error: profileError } = await client.from("profiles").select("id,full_name,email,course,exam_date,available_days,study_hours_per_day").eq("id", userId).single();
      if (profileError) throw new ApiError(`Could not load student profile: ${profileError.message}`, 502);
      profile = {
        id: profileRow.id,
        fullName: profileRow.full_name,
        email: profileRow.email,
        course: profileRow.course ?? "",
        examDate: profileRow.exam_date ?? undefined,
        availableDays: profileRow.available_days ?? 5,
        studyHoursPerDay: Number(profileRow.study_hours_per_day ?? 2),
      };
      const { data: latestTaskRows, error: latestTaskError } = await client
        .from("revision_tasks")
        .select("plan_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (latestTaskError) throw new ApiError(`Could not load the current revision plan: ${latestTaskError.message}`, 502);
      if (latestTaskRows?.length) {
        const { data: currentTasks, error: taskError } = await client
          .from("revision_tasks")
          .select("id,day,topic,subtopic,duration_minutes,priority,activity,completed")
          .eq("user_id", userId)
          .eq("plan_id", latestTaskRows[0].plan_id)
          .order("day");
        if (taskError) throw new ApiError(`Could not load existing revision tasks: ${taskError.message}`, 502);
        previousTasks = (currentTasks ?? []).map((task) => ({
          id: task.id, day: task.day, topic: task.topic, subtopic: task.subtopic ?? "",
          duration: task.duration_minutes, priority: task.priority, activity: task.activity, completed: task.completed,
        }));
      }
    } else {
      if (!payload.quiz) throw new ApiError("Provide a quiz in demo mode.", 400);
      quiz = quizSchema.parse(payload.quiz);
    }

    const sourceChunks = new Map<string, { content: string; source: string; page?: number; section?: string }>();
    if (client) {
      const chunkIds = [...new Set(quiz.questions.flatMap((question) => question.sourceChunkIds ?? question.citations.map((citation) => citation.chunkId).filter((id): id is string => Boolean(id))))];
      if (chunkIds.length) {
        const { data, error } = await client.from("document_chunks").select("id,chunk_content,page_number,section_title,documents(name)").eq("user_id", userId).in("id", chunkIds);
        if (error) throw new ApiError(`Could not load source context for evaluation: ${error.message}`, 502);
        for (const chunk of data ?? []) {
          const documents = chunk.documents as unknown as { name: string } | null;
          sourceChunks.set(chunk.id, {
            content: chunk.chunk_content,
            source: documents?.name ?? "Uploaded material",
            ...(chunk.page_number ? { page: chunk.page_number } : {}),
            ...(chunk.section_title ? { section: chunk.section_title } : {}),
          });
        }
      }
    } else {
      for (const material of payload.materials ?? []) {
        for (const chunk of material.chunks) sourceChunks.set(chunk.id, chunk);
      }
    }

    let responses: StudentAnswer[];
    const hasSourceContext = quiz.questions.every((question) =>
      (question.sourceChunkIds ?? question.citations.map((citation) => citation.chunkId).filter((id): id is string => Boolean(id)))
        .some((id) => sourceChunks.has(id)),
    );
    if (client && !hasSourceContext) {
      throw new ApiError("The quiz source context is no longer available for grounded answer evaluation.", 422);
    }
    if (client && !process.env.GROQ_API_KEY) {
      throw new ApiError("Cloud answer evaluation requires GROQ_API_KEY. No score was generated or saved.", 503);
    }

    if (process.env.GROQ_API_KEY && hasSourceContext) {
      const evalQuestions = quiz.questions.map((question) => ({
        questionId: question.id,
        question: question.text,
        type: question.type,
        expectedAnswer: question.correctAnswer,
        rubric: question.explanation,
        studentAnswer: payload.answers[question.id] ?? "",
        evidence: (question.sourceChunkIds ?? question.citations.map((citation) => citation.chunkId).filter((id): id is string => Boolean(id)))
          .map((id) => sourceChunks.get(id))
          .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk)),
      }));
      const evaluatedResult = evaluationSchema.safeParse(await callGroq<unknown>(
        "Evaluate each student's answer only against the supplied expected answer, rubric, and source evidence. Score from 0 to 100. Give partial credit for short answers when supported. Return JSON with answers array: questionId, score, feedback, correctAnswer. Do not invent evidence.",
        JSON.stringify(evalQuestions),
      ));
      if (!evaluatedResult.success || evaluatedResult.data.answers.length !== quiz.questions.length) {
        throw new ApiError("The AI returned an invalid or incomplete answer evaluation.", 502);
      }
      const byQuestionId = new Map(evaluatedResult.data.answers.map((answer) => [answer.questionId, answer]));
      if (byQuestionId.size !== quiz.questions.length || quiz.questions.some((question) => !byQuestionId.has(question.id))) {
        throw new ApiError("The AI evaluation did not match each quiz question exactly once.", 502);
      }
      responses = quiz.questions.map((question) => {
        const result = byQuestionId.get(question.id);
        if (!result) {
          throw new ApiError("The AI evaluation did not match the quiz questions.", 502);
        }
        const answer = payload.answers[question.id] ?? "";
        if (!answer.trim()) {
          return {
            questionId: question.id,
            answer,
            score: 0,
            isCorrect: false,
            feedback: "No answer was provided. Review the cited source material and try this concept again.",
            correctAnswer: question.correctAnswer,
          };
        }
        const score = Math.round(result.score);
        return {
          questionId: question.id,
          answer,
          score,
          isCorrect: score >= 70,
          feedback: result.feedback,
          correctAnswer: question.correctAnswer,
        };
      });
    } else {
      responses = quiz.questions.map((question) => {
        const result = evaluateQuestion(question, payload.answers[question.id] ?? "");
        if (question.type !== "short-answer") return result;
        const answerTokens = (payload.answers[question.id] ?? "").toLowerCase().split(/\W+/).filter((token) => token.length > 3);
        const evidence = (question.sourceChunkIds ?? []).map((id) => sourceChunks.get(id)?.content ?? "").join(" ").toLowerCase();
        const supported = answerTokens.filter((token) => evidence.includes(token)).length;
        const score = answerTokens.length ? Math.round((supported / answerTokens.length) * 100) : 0;
        return {
          ...result,
          score,
          isCorrect: score >= 70,
          feedback: score >= 70 ? "Your response is supported by the retrieved study material." : "Your response needs more detail supported by the retrieved study material.",
        };
      });
    }

    const score = responses.length ? Math.round(responses.reduce((total, response) => total + response.score, 0) / responses.length) : 0;
    const importance = Object.fromEntries((await import("@/lib/mock-data")).defaultTopics.map((topic) => [topic.name, topic.importance]));
    let gapReport: TopicPerformance[] = buildGapReport(quiz, responses).map((topic) => ({
      ...topic,
      importance: importance[topic.topic] ?? 50,
    }));
    if (client) {
      const { data: previousRows, error: previousError } = await client
        .from("topic_performance")
        .select("topic,score,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (previousError) throw new ApiError(`Could not load previous topic performance: ${previousError.message}`, 502);
      const latestByTopic = new Map<string, number>();
      for (const row of previousRows ?? []) {
        if (!latestByTopic.has(row.topic)) latestByTopic.set(row.topic, Number(row.score));
      }
      gapReport = gapReport.map((topic) => {
        const previousScore = latestByTopic.get(topic.topic);
        return previousScore === undefined
          ? topic
          : { ...topic, previousScore, improvement: topic.score - previousScore };
      });
    }
    const revisionPlan = generateRevisionPlan(profile, gapReport, previousTasks, new Date()).map((task) => ({
      ...task,
      id: crypto.randomUUID(),
    }));

    if (client) {
      const { data: attempt, error: attemptError } = await client.from("quiz_attempts").insert({
        user_id: userId,
        quiz_id: quiz.id,
        score,
        overall_status: classifyScore(score),
        answers: responses,
      }).select("id").single();
      if (attemptError || !attempt) throw new ApiError(`Could not save quiz attempt: ${attemptError?.message ?? "No attempt id returned."}`, 502);
      attemptId = attempt.id;

      const { error: answerError } = await client.from("student_answers").insert(responses.map((response) => ({
        user_id: userId,
        quiz_attempt_id: attempt.id,
        question_data: quiz.questions.find((question) => question.id === response.questionId),
        submitted_answer: response.answer,
        is_correct: response.isCorrect,
        score: response.score,
        feedback: response.feedback,
        correct_answer: response.correctAnswer,
      })));
      if (answerError) throw new ApiError(`Quiz was scored but student answers could not be saved: ${answerError.message}`, 502);

      const { error: reportError } = await client.from("topic_performance").insert(gapReport.map((topic) => ({
        user_id: userId,
        quiz_attempt_id: attempt.id,
        topic: topic.topic,
        score: topic.score,
        status: topic.status,
        correct_answers: topic.correct,
        incorrect_answers: topic.incorrect,
        attempts: topic.attempts,
        diagnosis: topic.diagnosis,
        recommended_action: topic.recommendedAction,
        previous_score: topic.previousScore ?? null,
        improvement: topic.improvement ?? null,
        details: topic,
      })));
      if (reportError) throw new ApiError(`Quiz and answers were saved but topic analysis could not be saved: ${reportError.message}`, 502);

      const { data: plan, error: planError } = await client.from("revision_plans").insert({
        user_id: userId,
        quiz_attempt_id: attempt.id,
        title: "Adaptive revision plan",
        exam_date: profile.examDate ?? null,
      }).select("id").single();
      if (planError || !plan) throw new ApiError(`Analysis was saved but revision plan could not be saved: ${planError?.message ?? "No plan id returned."}`, 502);
      const { error: tasksError } = await client.from("revision_tasks").insert(revisionPlan.map((task) => ({
        id: task.id,
        plan_id: plan.id,
        user_id: userId,
        day: task.day,
        topic: task.topic,
        subtopic: task.subtopic,
        duration_minutes: task.duration,
        priority: task.priority,
        activity: task.activity,
        completed: task.completed,
      })));
      if (tasksError) throw new ApiError(`Analysis was saved but revision tasks could not be saved: ${tasksError.message}`, 502);
    }

    return Response.json({ responses, gapReport, revisionPlan, score, attemptId, quiz });
  } catch (error) {
    return jsonError(error);
  }
}
