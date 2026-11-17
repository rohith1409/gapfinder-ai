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
  window.dispatchEvent(new Event("gapfinder:storage"));
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
  if (score < 50) return "Weak";
  if (score < 80) return "Medium";
  return "Strong";
}

export function extractTextFromFile(file: File): Promise<string> {
  return file.name.toLowerCase().endsWith(".txt") ? file.text() : file.name.toLowerCase().endsWith(".pdf") ? extractPdfText(file) : file.text();
}

async function extractPdfText(file: File): Promise<string> {
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

  const extracted = pages.join("\f");
  if (!extracted.trim()) throw new Error(`No selectable text was found in ${file.name}. Scanned PDF OCR is not supported.`);
  return extracted;
}

export function chunkText(text: string, topic = "General", source = "Imported document"): MaterialChunk[] {
  const pages = text.split("\f");
  const chunks: MaterialChunk[] = [];
  let chunkIndex = 0;
  const maxChunkLength = 800;
  const overlapLength = 120;

  pages.forEach((pageText, pageIndex) => {
    const lines = pageText.split(/\r?\n/);
    let section = "";
    let buffer = "";

    const flush = (overlap = false) => {
      const content = buffer.trim();
      if (!content) return;
      chunkIndex += 1;
      chunks.push({
        id: `chunk-${topic.toLowerCase().replace(/\s+/g, "-")}-${chunkIndex}`,
        content,
        source,
        ...(pages.length > 1 || source.toLowerCase().endsWith(".pdf") ? { page: pageIndex + 1 } : {}),
        ...(section ? { section } : {}),
        topic,
      });
      if (overlap) {
        const suffix = content.slice(-overlapLength);
        const firstWord = suffix.indexOf(" ");
        buffer = firstWord >= 0 ? suffix.slice(firstWord + 1) : suffix;
      } else {
        buffer = "";
      }
    };

    const addSentence = (sentence: string) => {
      const words = sentence.split(/\s+/);
      let segment = "";
      for (const word of words) {
        if (word.length > maxChunkLength) {
          if (segment) {
            addSegment(segment);
            segment = "";
          }
          for (let offset = 0; offset < word.length; offset += maxChunkLength) {
            addSegment(word.slice(offset, offset + maxChunkLength));
          }
          continue;
        }
        const candidate = segment ? `${segment} ${word}` : word;
        if (candidate.length > maxChunkLength) {
          addSegment(segment);
          segment = word;
        } else {
          segment = candidate;
        }
      }
      if (segment) addSegment(segment);
    };

    const addSegment = (segment: string) => {
      const candidate = buffer ? `${buffer} ${segment}` : segment;
      if (candidate.length > maxChunkLength) {
        flush(true);
        const overlapped = buffer ? `${buffer} ${segment}` : segment;
        buffer = overlapped.length <= maxChunkLength ? overlapped : segment;
      } else {
        buffer = candidate;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flush();
        continue;
      }
      if (line.length < 100 && !/[.!?]$/.test(line)) {
        flush();
        section = line.replace(/^#{1,6}\s*/, "");
        continue;
      }
      const sentences = line.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        addSentence(sentence);
      }
    }
    flush();
  });

  if (!chunks.length && text.trim()) {
    chunks.push({
      id: `chunk-${topic.toLowerCase().replace(/\s+/g, "-")}-1`,
      content: text.trim(),
      source,
      topic,
    });
  }
  return chunks;
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

  const keywords = question.keywords ?? question.correctAnswer.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  const matched = keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
  const score = keywords.length ? Math.round((matched / keywords.length) * 100) : 0;
  const isCorrect = score >= 70 && normalized.length > 12;

  return {
    questionId: question.id,
    answer,
    score: isCorrect ? score : Math.min(score, 69),
    isCorrect,
    feedback: isCorrect ? `Your answer covers the key concepts. ${question.explanation}` : `Your answer missed one or more key concepts. Expected answer: ${question.correctAnswer}`,
    correctAnswer: question.correctAnswer,
  };
}

export function buildGapReport(quiz: Quiz, responses: StudentAnswer[]): TopicPerformance[] {
  const checkpoint = new Map<string, { scores: number[]; correct: number; difficultyBreakdown: Record<string, number>; subtopics: Map<string, number[]>; missed: string[] }>();

  for (const question of quiz.questions) {
    const response = responses.find((item) => item.questionId === question.id);
    const topic = checkpoint.get(question.topic) ?? {
      scores: [],
      correct: 0,
      difficultyBreakdown: {},
      subtopics: new Map<string, number[]>(),
      missed: [],
    };

    topic.difficultyBreakdown[question.difficulty] = (topic.difficultyBreakdown[question.difficulty] ?? 0) + 1;
    const sub = topic.subtopics.get(question.subtopic) ?? [];
    const responseScore = response?.score ?? 0;
    sub.push(responseScore);
    topic.subtopics.set(question.subtopic, sub);
    topic.scores.push(responseScore);
    if (response && response.score >= 70) {
      topic.correct += 1;
    } else {
      topic.missed.push(question.subtopic || question.text);
    }
    checkpoint.set(question.topic, topic);
  }

  return Array.from(checkpoint.entries()).map(([topicName, stats]) => {
    const score = stats.scores.length ? Math.round(stats.scores.reduce((sum, value) => sum + value, 0) / stats.scores.length) : 0;
    const status = classifyScore(score);
    const subtopics = Array.from(stats.subtopics.entries()).map(([name, values]) => {
      const subScore = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
      return { name, score: subScore, status: classifyScore(subScore) };
    });

    const diagnosis =
      status === "Weak"
        ? `${topicName} needs reinforcement. Review ${[...new Set(stats.missed)].join(", ") || "the missed questions"} based on this attempt.`
        : status === "Medium"
          ? `${topicName} is partly understood. Focus next on ${[...new Set(stats.missed)].join(", ") || "the questions with partial credit"}.`
          : `${topicName} is currently a strength, scoring ${score}% across ${stats.scores.length} questions in this attempt.`;

    const recommendedAction =
      status === "Weak"
        ? `Review ${[...new Set(stats.missed)].join(", ") || topicName.toLowerCase()} and complete five targeted practice questions.`
        : status === "Medium"
          ? `Complete a focused drill on ${[...new Set(stats.missed)].join(", ") || topicName.toLowerCase()}.`
          : `Maintain this strength with one timed consolidation set for ${topicName.toLowerCase()}.`;

    return {
      topic: topicName,
      score,
      status,
      correct: stats.correct,
      incorrect: stats.scores.length - stats.correct,
      attempts: stats.scores.length,
      difficultyBreakdown: stats.difficultyBreakdown,
      subtopics,
      diagnosis,
      recommendedAction,
      importance: defaultTopics.find((topic) => topic.name === topicName)?.importance ?? 50,
    };
  });
}

export function generateRevisionPlan(profile: StudentProfile, gapReport: TopicPerformance[], previousTasks: RevisionTask[] = [], currentDate?: Date): RevisionTask[] {
  const sorted = [...gapReport].sort((a, b) => {
    const priority = (topic: TopicPerformance) => ((topic.importance ?? 50) / 100) * (1 - topic.score / 100);
    return priority(b) - priority(a);
  });

  const tasks: RevisionTask[] = [];
  const examTime = profile.examDate ? Date.parse(`${profile.examDate}T00:00:00Z`) : Number.NaN;
  const todayTime = currentDate ? Date.parse(`${currentDate.toISOString().slice(0, 10)}T00:00:00Z`) : Number.NaN;
  const daysUntilExam = Number.isFinite(examTime) && Number.isFinite(todayTime)
    ? Math.max(1, Math.ceil((examTime - todayTime) / 86_400_000))
    : 5;
  const taskCount = Math.min(5, Math.max(1, profile.availableDays), daysUntilExam, sorted.length);
  const taskDuration = taskCount
    ? Math.max(15, Math.floor((profile.studyHoursPerDay * 60) / taskCount))
    : 30;
  sorted.slice(0, taskCount).forEach((topic, index) => {
    const weakest = [...topic.subtopics].sort((a, b) => a.score - b.score)[0];
    const subtopic = weakest?.name ?? "Foundational review";
    const existing = previousTasks.find((task) => task.topic === topic.topic && task.subtopic === subtopic);
    tasks.push({
      id: existing?.id ?? `task-${index + 1}`,
      day: index + 1,
      topic: topic.topic,
      subtopic,
      duration: taskDuration,
      priority: topic.status === "Weak" ? "High" : topic.status === "Medium" ? "Medium" : "Low",
      activity: topic.recommendedAction,
      completed: existing?.completed ?? false,
    });
  });

  return tasks;
}

export function getStudyAssistantAnswer(question: string, materials: StudyMaterial[]): { answer: string; citations: { source: string; page?: number; section?: string }[] } {
  const normalized = question.toLowerCase();
  const matchingChunks = materials.flatMap((material) =>
    material.chunks
      .filter((chunk) => {
        const haystack = `${chunk.content} ${chunk.topic} ${chunk.section}`.toLowerCase();
        return haystack.includes(normalized) || normalized.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word));
      })
      .map((chunk) => ({
        id: chunk.id,
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

  const tokens = normalized.split(/\W+/).filter((word) => word.length > 2);
  const ranked = matchingChunks
    .map((chunk) => ({
      ...chunk,
      score: tokens.reduce((score, token) => score + (chunk.content.toLowerCase().includes(token) ? 1 : 0), 0),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    return { answer: "I couldn't find sufficient information about this topic in your uploaded study materials.", citations: [] };
  }
  const top = ranked.slice(0, 2);
  return {
    answer: `Using the uploaded material, the key point is: ${top[0].content} This is supported by the relevant sections in ${top[0].source}.`,
    citations: top.map(({ source, page, section }) => ({ source, ...(page ? { page } : {}), ...(section ? { section } : {}) })),
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
