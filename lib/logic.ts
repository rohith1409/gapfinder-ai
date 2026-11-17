import { defaultMaterials, defaultProfile, defaultTopics, sampleQuestions, sampleRevisionTasks } from "@/lib/mock-data";
import type { ChatMessage, MaterialChunk, Quiz, QuizQuestion, RevisionTask, StudentAnswer, StudentProfile, StudyMaterial, TopicPerformance } from "@/lib/types";

export { defaultProfile, defaultMaterials, defaultTopics, sampleQuestions, sampleRevisionTasks };

const STORAGE_PREFIX = "gapfinder:";

export function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(getStorageKey(key));
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(key), JSON.stringify(value));
}

export function getDemoProfile(): StudentProfile {
  return loadFromStorage("profile", defaultProfile);
}

export function getDemoMaterials(): StudyMaterial[] {
  return loadFromStorage("materials", defaultMaterials);
}

export function getDemoQuizHistory(): Quiz[] {
  return loadFromStorage("quiz-history", [] as Quiz[]);
}

export function ensureDemoData() {
  if (typeof window === "undefined") return;
  if (!window.localStorage.getItem(getStorageKey("profile"))) {
    saveToStorage("profile", defaultProfile);
  }
  if (!window.localStorage.getItem(getStorageKey("materials"))) {
    saveToStorage("materials", defaultMaterials);
  }
  if (!window.localStorage.getItem(getStorageKey("quiz-history"))) {
    saveToStorage("quiz-history", [] as Quiz[]);
  }
  if (!window.localStorage.getItem(getStorageKey("revision-tasks"))) {
    saveToStorage("revision-tasks", sampleRevisionTasks);
  }
  if (!window.localStorage.getItem(getStorageKey("chat-history"))) {
    saveToStorage("chat-history", [
      { id: "welcome", role: "assistant", text: "I can answer questions using your uploaded syllabus and notes. Ask me about a topic in your own study material." },
    ] as ChatMessage[]);
  }
}

export function classifyScore(score: number): "Weak" | "Medium" | "Strong" {
  if (score <= 40) return "Weak";
  if (score <= 75) return "Medium";
  return "Strong";
}

export function extractTextFromFile(file: File): Promise<string> {
  return file.name.toLowerCase().endsWith(".txt") ? file.text() : file.name.toLowerCase().endsWith(".pdf") ? extractPdfText(file) : file.text();
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(text);
    }

    return pages.join("\n\n");
  } catch {
    return `PDF uploaded: ${file.name}. A production implementation would extract the full text via PDF parsing; in demo mode this file has been indexed as study material for analysis.`;
  }
}

export function chunkText(text: string, topic = "General"): MaterialChunk[] {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const sentences = cleanText.split(/(?<=[.!?])\s+/);
  const chunks: MaterialChunk[] = [];

  sentences.forEach((sentence, index) => {
    if (!sentence.trim()) return;
    chunks.push({
      id: `chunk-${topic.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
      content: sentence.trim(),
      source: "Imported document",
      page: index + 1,
      section: "Imported section",
      topic,
    });
  });

  return chunks.length ? chunks : [{ id: `chunk-${topic.toLowerCase()}`, content: cleanText, source: "Imported document", page: 1, section: "Imported section", topic }];
}

export function buildTopicMap(materials: StudyMaterial[]) {
  return defaultTopics.map((topic) => ({
    ...topic,
    relatedDocuments: materials.filter((material) => material.text.toLowerCase().includes(topic.name.toLowerCase())).map((material) => material.name),
    questions: Math.max(2, Math.min(8, topic.importance / 12)),
    status: "Medium" as const,
  }));
}

export function generateQuizFromMaterials(materials: StudyMaterial[], count = 5, difficulty: "Easy" | "Medium" | "Hard" = "Medium"): Quiz {
  const quizQuestions = sampleQuestions
    .filter((question) => {
      const matchTopic = materials.some((material) => material.text.toLowerCase().includes(question.topic.toLowerCase()));
      if (!matchTopic) {
        return question.topic === "Algebra" || question.topic === "Biology";
      }
      return true;
    })
    .slice(0, Math.max(1, Math.min(count, sampleQuestions.length)))
    .map((question) => ({
      ...question,
      difficulty: question.difficulty === "Hard" && difficulty === "Easy" ? "Easy" : question.difficulty,
    }));

  const seed = `${difficulty}|${materials.length}|${materials.map((material) => material.name).join("|")}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return {
    id: `quiz-${hash}`,
    title: `Diagnostic Quiz | ${difficulty} | ${materials.length} documents`,
    createdAt: "2026-11-17T00:00:00.000Z",
    studentId: getDemoProfile().id,
    questions: quizQuestions,
  };
}

export function evaluateQuestion(question: QuizQuestion, answer: string): StudentAnswer {
  const candidate = answer.trim();
  const normalized = candidate.toLowerCase();

  if (question.type === "multiple-choice") {
    const isCorrect = normalized === question.correctAnswer.toLowerCase();
    return {
      questionId: question.id,
      answer,
      score: isCorrect ? 100 : 0,
      isCorrect,
      feedback: isCorrect ? `Correct. ${question.explanation}` : `Incorrect. ${question.explanation}`,
      correctAnswer: question.correctAnswer,
    };
  }

  if (question.type === "true-false") {
    const isCorrect = normalized === question.correctAnswer.toLowerCase();
    return {
      questionId: question.id,
      answer,
      score: isCorrect ? 100 : 0,
      isCorrect,
      feedback: isCorrect ? `Correct. ${question.explanation}` : `Incorrect. ${question.explanation}`,
      correctAnswer: question.correctAnswer,
    };
  }

  const keywords = question.keywords ?? [question.correctAnswer];
  const hasEnough = keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
  const score = hasEnough ? Math.min(100, 75 + Math.max(0, Math.min(25, (normalized.length / 100) * 20))) : 0;

  return {
    questionId: question.id,
    answer,
    score: Number(score.toFixed(0)),
    isCorrect: hasEnough && normalized.length > 12,
    feedback: hasEnough ? `Strong answer. ${question.explanation}` : `Your answer is not grounded in the uploaded material enough. ${question.explanation}`,
    correctAnswer: question.correctAnswer,
  };
}

export function buildGapReport(quiz: Quiz, responses: StudentAnswer[]): TopicPerformance[] {
  const checkpoint = new Map<string, { correct: number; total: number; difficultyBreakdown: Record<string, number>; subtopics: Map<string, number[]>; diagnosis: string; recommendedAction: string }>();

  for (const question of quiz.questions) {
    const response = responses.find((item) => item.questionId === question.id);
    const topic = checkpoint.get(question.topic) ?? {
      correct: 0,
      total: 0,
      difficultyBreakdown: {},
      subtopics: new Map<string, number[]>(),
      diagnosis: "",
      recommendedAction: "",
    };

    topic.total += 1;
    topic.difficultyBreakdown[question.difficulty] = (topic.difficultyBreakdown[question.difficulty] ?? 0) + 1;
    const sub = topic.subtopics.get(question.subtopic) ?? [];
    sub.push(response?.isCorrect ? 1 : 0);
    topic.subtopics.set(question.subtopic, sub);

    if (response) {
      topic.correct += response.isCorrect ? 1 : 0;
    }

    checkpoint.set(question.topic, topic);
  }

  return Array.from(checkpoint.entries()).map(([topicName, stats]) => {
    const score = Math.round((stats.correct / stats.total) * 100);
    const status = classifyScore(score);
    const subtopics = Array.from(stats.subtopics.entries()).map(([name, values]) => {
      const subScore = Math.round((values.filter(Boolean).length / values.length) * 100);
      return { name, score: subScore, status: classifyScore(subScore) };
    });

    const diagnosis =
      status === "Weak"
        ? `${topicName} needs reinforcement. The majority of mistakes are concentrated in problem-solving steps and recall gaps.`
        : status === "Medium"
          ? `${topicName} is partly understood. A few errors suggest partial concept mastery that can improve with focused practice.`
          : `${topicName} is a strong area. Consistent accuracy shows solid concept retention and fast recall.`;

    const recommendedAction =
      status === "Weak"
        ? `Revise ${topicName.toLowerCase()} with five mixed practice questions and a quick recap of foundational steps.`
        : status === "Medium"
          ? `Complete a short drill on ${topicName.toLowerCase()} and revisit the most error-prone subtopic.`
          : `Maintain momentum with one timed consolidation set to keep ${topicName.toLowerCase()} strong.`;

    return {
      topic: topicName,
      score,
      status,
      correct: stats.correct,
      incorrect: stats.total - stats.correct,
      attempts: stats.total,
      difficultyBreakdown: stats.difficultyBreakdown,
      subtopics,
      diagnosis,
      recommendedAction,
    };
  });
}

export function generateRevisionPlan(profile: StudentProfile, gapReport: TopicPerformance[]): RevisionTask[] {
  const sorted = [...gapReport].sort((a, b) => {
    if (a.status === "Weak" && b.status !== "Weak") return -1;
    if (a.status !== "Weak" && b.status === "Weak") return 1;
    return b.score - a.score;
  });

  const tasks: RevisionTask[] = [];
  sorted.slice(0, 5).forEach((topic, index) => {
    const subtopic = topic.subtopics[0]?.name ?? "Foundational review";
    tasks.push({
      id: `task-${index + 1}`,
      day: index + 1,
      topic: topic.topic,
      subtopic,
      duration: profile.studyHoursPerDay * 20,
      priority: topic.status === "Weak" ? "High" : topic.status === "Medium" ? "Medium" : "Low",
      activity: topic.recommendedAction,
      completed: false,
    });
  });

  return tasks;
}

export function getStudyAssistantAnswer(question: string, materials: StudyMaterial[]): { answer: string; citations: { source: string; page: number; section: string }[] } {
  const normalized = question.toLowerCase();
  const matchingChunks = materials.flatMap((material) =>
    material.chunks
      .filter((chunk) => {
        const haystack = `${chunk.content} ${chunk.topic} ${chunk.section}`.toLowerCase();
        return haystack.includes(normalized) || normalized.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word));
      })
      .map((chunk) => ({
        source: chunk.source,
        page: chunk.page,
        section: chunk.section,
        content: chunk.content,
      })),
  );

  if (!matchingChunks.length) {
    return {
      answer: "I couldn't find sufficient information about this topic in your uploaded study materials.",
      citations: [],
    };
  }

  const top = matchingChunks.slice(0, 2);
  return {
    answer: `Using the uploaded material, the key point is: ${top[0].content} This is supported by the relevant sections in ${top[0].source}.`,
    citations: top.map((item) => ({ source: item.source, page: item.page, section: item.section })),
  };
}

export function summarizeDashboard(materials: StudyMaterial[], quizHistory: Quiz[], responses: StudentAnswer[] = []) {
  const totalMaterials = materials.length;
  const totalQuizzes = quizHistory.length;
  const scores = quizHistory.flatMap((quiz) =>
    responses.filter((response) => quiz.questions.some((question) => question.id === response.questionId)).map((response) => response.score),
  );
  const overall = scores.length ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length) : 72;
  const weakTopics = Math.max(1, Math.round((100 - overall) / 18));
  const mediumTopics = 3;
  const strongTopics = 2;

  return {
    totalMaterials,
    totalQuizzes,
    overall,
    weakTopics,
    mediumTopics,
    strongTopics,
  };
}
