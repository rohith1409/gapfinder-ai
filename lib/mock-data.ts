import type { StudentProfile, StudyMaterial, QuizQuestion, RevisionTask } from "@/lib/types";

export const defaultProfile: StudentProfile = {
  id: "demo-student",
  fullName: "Aarav Sharma",
  email: "aarav@demo.com",
  course: "Class 12 Science",
  examDate: "2026-12-15",
  availableDays: 5,
  studyHoursPerDay: 2,
  university: "GapFinder Academy",
};

export const defaultTopics = [
  { name: "Algebra", subtopics: ["Quadratic equations", "Factorization", "Functions"], importance: 92 },
  { name: "Calculus", subtopics: ["Derivatives", "Limits", "Rate of change"], importance: 88 },
  { name: "Biology", subtopics: ["Genetics", "Cell division", "Human physiology"], importance: 81 },
  { name: "Physics", subtopics: ["Motion", "Waves", "Electricity"], importance: 74 },
  { name: "Chemistry", subtopics: ["Stoichiometry", "Organic reactions", "Acids and bases"], importance: 69 },
];

export const defaultMaterials: StudyMaterial[] = [
  {
    id: "mat-1",
    name: "Algebra syllabus.pdf",
    type: "syllabus",
    uploadDate: "2026-11-15",
    status: "processed",
    size: 1240000,
    text: `Algebra syllabus: Quadratic equations and factorization. Revision should focus on solving equations with multiple methods. Students should practice factoring, completing the square, and using the quadratic formula. Functions and relationships appear frequently in exam papers. Important subtopics include domain, range, and graph interpretation.`,
    chunks: [
      {
        id: "chunk-1",
        content: "Quadratic equations and factorization are central algebra topics. Students should solve equations by factoring, completing the square, and the quadratic formula.",
        source: "Algebra syllabus.pdf",
        page: 1,
        section: "Unit 1",
        topic: "Algebra",
      },
      {
        id: "chunk-2",
        content: "Functions and graphs are important. Students should interpret domain, range, and relationship between x and y values.",
        source: "Algebra syllabus.pdf",
        page: 2,
        section: "Graphs",
        topic: "Algebra",
      },
    ],
  },
  {
    id: "mat-2",
    name: "Biology notes.txt",
    type: "notes",
    uploadDate: "2026-11-16",
    status: "processed",
    size: 460000,
    text: `Biology notes: Genetics and cell division are important. Mendelian inheritance, dominant and recessive traits, and meiosis explain sample exam questions. Human physiology includes digestion and circulation.`,
    chunks: [
      {
        id: "chunk-3",
        content: "Genetics includes Mendelian inheritance, dominant and recessive traits, and mutation patterns in offspring.",
        source: "Biology notes.txt",
        page: 4,
        section: "Genetics",
        topic: "Biology",
      },
      {
        id: "chunk-4",
        content: "Meiosis produces four haploid cells and is essential for sexual reproduction. Check chromosome number reduction.",
        source: "Biology notes.txt",
        page: 5,
        section: "Cell division",
        topic: "Biology",
      },
    ],
  },
];

export const sampleQuestions: QuizQuestion[] = [
  {
    id: "q1",
    text: "Solve the quadratic equation x² - 5x + 6 = 0.",
    type: "multiple-choice",
    topic: "Algebra",
    subtopic: "Quadratic equations",
    difficulty: "Easy",
    options: ["x = 2 or 3", "x = 1 or 6", "x = -2 or -3", "x = 5 or 6"],
    correctAnswer: "x = 2 or 3",
    explanation: "The equation factors as (x - 2)(x - 3) = 0, so x = 2 or 3.",
    citations: [{ source: "Algebra syllabus.pdf", page: 1, section: "Unit 1" }],
    keywords: ["factorization", "quadratic", "roots"],
  },
  {
    id: "q2",
    text: "True or false: In meiosis, chromosome number is halved in the final cells.",
    type: "true-false",
    topic: "Biology",
    subtopic: "Cell division",
    difficulty: "Medium",
    correctAnswer: "True",
    explanation: "Meiosis reduces the diploid number to haploid cells, preparing for sexual reproduction.",
    citations: [{ source: "Biology notes.txt", page: 5, section: "Cell division" }],
    keywords: ["meiosis", "haploid", "chromosome number"],
  },
  {
    id: "q3",
    text: "Explain the difference between a dominant and recessive trait in Mendelian genetics.",
    type: "short-answer",
    topic: "Biology",
    subtopic: "Genetics",
    difficulty: "Hard",
    correctAnswer: "A dominant trait appears in the offspring when at least one dominant allele is present, while a recessive trait appears only when both alleles are recessive.",
    explanation: "Dominant traits mask the effect of recessive alleles in heterozygous organisms.",
    citations: [{ source: "Biology notes.txt", page: 4, section: "Genetics" }],
    keywords: ["dominant", "recessive", "allele", "trait"],
  },
  {
    id: "q4",
    text: "Which function has a domain of all real numbers and a range of y ≥ 0?",
    type: "multiple-choice",
    topic: "Algebra",
    subtopic: "Functions",
    difficulty: "Medium",
    options: ["y = x²", "y = x + 2", "y = 1/x", "y = √x"],
    correctAnswer: "y = x²",
    explanation: "The parabola y = x² has a non-negative output for all real x values.",
    citations: [{ source: "Algebra syllabus.pdf", page: 2, section: "Graphs" }],
    keywords: ["domain", "range", "parabola"],
  },
];

export const sampleRevisionTasks: RevisionTask[] = [
  { id: "r1", day: 1, topic: "Algebra", subtopic: "Quadratic equations", duration: 45, priority: "High", activity: "Solve 10 factorization questions and review the method of completing the square.", completed: false },
  { id: "r2", day: 2, topic: "Biology", subtopic: "Cell division", duration: 35, priority: "High", activity: "Compare mitosis and meiosis with a labeled diagram and 5 recall questions.", completed: false },
  { id: "r3", day: 3, topic: "Algebra", subtopic: "Functions", duration: 30, priority: "Medium", activity: "Interpret domain and range from graph examples and define one-to-one relationships.", completed: false },
  { id: "r4", day: 4, topic: "Biology", subtopic: "Genetics", duration: 40, priority: "Medium", activity: "Practice Punnett square examples for dominant and recessive traits.", completed: false },
  { id: "r5", day: 5, topic: "Physics", subtopic: "Motion", duration: 25, priority: "Low", activity: "Review velocity-time graph interpretation and basic formula recall.", completed: false },
];
