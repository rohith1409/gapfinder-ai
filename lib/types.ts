export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionType = "multiple-choice" | "true-false" | "short-answer";
export type TopicStatus = "Weak" | "Medium" | "Strong";

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  course: string;
  examDate?: string;
  availableDays: number;
  studyHoursPerDay: number;
  university?: string;
}

export interface SourceCitation {
  source: string;
  documentId?: string;
  chunkId?: string;
  page?: number;
  section?: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: QuestionType;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  citations: SourceCitation[];
  keywords?: string[];
  sourceChunkIds?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  createdAt: string;
  studentId: string;
  questions: QuizQuestion[];
}

export interface StudentAnswer {
  questionId: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
}

export interface TopicPerformance {
  topic: string;
  score: number;
  status: TopicStatus;
  correct: number;
  incorrect: number;
  attempts: number;
  difficultyBreakdown: Record<string, number>;
  subtopics: Array<{
    name: string;
    score: number;
    status: TopicStatus;
  }>;
  diagnosis: string;
  recommendedAction: string;
  importance?: number;
  previousScore?: number;
  improvement?: number;
}

export interface MaterialChunk {
  id: string;
  content: string;
  source: string;
  page?: number;
  section?: string;
  topic: string;
}

export interface StudyMaterial {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  status: "processed" | "pending";
  size: number;
  text: string;
  chunks: MaterialChunk[];
  chunkCount?: number;
}

export interface RevisionTask {
  id: string;
  day: number;
  topic: string;
  subtopic: string;
  duration: number;
  priority: "High" | "Medium" | "Low";
  activity: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: SourceCitation[];
}
