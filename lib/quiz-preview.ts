import type { Quiz } from "@/lib/types";

export function toQuizPreview(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      ...question,
      correctAnswer: "",
      explanation: "",
      keywords: undefined,
      sourceChunkIds: undefined,
    })),
  };
}
