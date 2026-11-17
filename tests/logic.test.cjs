/* eslint @typescript-eslint/no-require-imports: "off" -- The test bootstrap compiles the existing TypeScript without another runner dependency. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { test } = require("node:test");
const Module = require("node:module");
const path = require("node:path");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  const mappedRequest = request.startsWith("@/")
    ? path.resolve(__dirname, "..", request.slice(2))
    : request;
  return originalResolveFilename.call(this, mappedRequest, parent, isMain, options);
};

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const {
  buildGapReport,
  chunkText,
  classifyScore,
  generateRevisionPlan,
} = require("../lib/logic.ts");
const { extractAndChunkDocument } = require("../lib/server/documents.ts");
const { toQuizPreview } = require("../lib/quiz-preview.ts");

function createTextPdf(lines) {
  const textStream = `BT /F1 18 Tf 50 700 Td (${lines[0]}) Tj 0 -30 Td (${lines[1]}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(textStream)} >>\nstream\n${textStream}\nendstream`,
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(source, "binary");
}

test("classifies exact score thresholds consistently", () => {
  assert.equal(classifyScore(49), "Weak");
  assert.equal(classifyScore(50), "Medium");
  assert.equal(classifyScore(79), "Medium");
  assert.equal(classifyScore(80), "Strong");
});

test("quiz previews never expose expected answers or evaluation rubrics", () => {
  const preview = toQuizPreview({
    id: "quiz",
    title: "Quiz",
    createdAt: "2026-01-01",
    studentId: "student",
    questions: [{
      id: "q1",
      text: "Question?",
      type: "short-answer",
      topic: "Biology",
      subtopic: "Cells",
      difficulty: "Easy",
      correctAnswer: "The private expected answer",
      explanation: "The private grading rubric",
      keywords: ["secret"],
      sourceChunkIds: ["chunk-id"],
      citations: [{ source: "notes.txt", chunkId: "chunk-id" }],
    }],
  });

  assert.equal(preview.questions[0].correctAnswer, "");
  assert.equal(preview.questions[0].explanation, "");
  assert.equal(preview.questions[0].keywords, undefined);
  assert.equal(preview.questions[0].sourceChunkIds, undefined);
  assert.equal(preview.questions[0].citations[0].source, "notes.txt");
});

test("chunks preserve headings, page citations, size limits, and overlap", () => {
  const body = Array.from({ length: 60 }, (_, index) =>
    `Concept ${index} explains how connected cells transmit signals across the nervous system.`,
  ).join(" ");
  const chunks = chunkText(`Neural signaling\n${body}\fCell response\n${body}`, "Biology", "notes.pdf");

  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.content.length <= 800));
  assert.equal(chunks[0].section, "Neural signaling");
  assert.equal(chunks[0].page, 1);
  assert.ok(chunks.some((chunk) => chunk.page === 2 && chunk.section === "Cell response"));
  const overlap = chunks[0].content.split(/\s+/).slice(-5).join(" ");
  assert.ok(chunks[1].content.includes(overlap));
});

test("server document ingestion extracts text and source metadata from TXT and PDF", async () => {
  const txt = await extractAndChunkDocument("biology.txt", "txt", new Blob(["Cell division\nMeiosis halves the chromosome count."]));
  assert.match(txt.text, /Meiosis halves/);
  assert.equal(txt.chunks[0].section, "Cell division");
  assert.equal(txt.chunks[0].page, undefined);

  const pdf = await extractAndChunkDocument(
    "biology.pdf",
    "pdf",
    new Blob([createTextPdf(["Cell division", "Meiosis halves the chromosome count."])], { type: "application/pdf" }),
  );
  assert.match(pdf.text, /Meiosis halves the chromosome count/);
  assert.equal(pdf.chunks[0].section, "Cell division");
  assert.equal(pdf.chunks[0].page, 1);
});

test("gap analysis uses answer scores to classify and name missed concepts", () => {
  const quiz = {
    id: "q",
    title: "Test",
    createdAt: "2026-01-01",
    studentId: "student",
    questions: [
      { id: "q1", text: "Question one", type: "short-answer", topic: "Biology", subtopic: "Meiosis", difficulty: "Easy" },
      { id: "q2", text: "Question two", type: "short-answer", topic: "Biology", subtopic: "Mitosis", difficulty: "Medium" },
      { id: "q3", text: "Question three", type: "short-answer", topic: "Algebra", subtopic: "Factoring", difficulty: "Easy" },
    ],
  };
  const report = buildGapReport(quiz, [
    { questionId: "q1", score: 40 },
    { questionId: "q2", score: 60 },
    { questionId: "q3", score: 100 },
  ]);

  assert.equal(report.find((topic) => topic.topic === "Biology").score, 50);
  assert.equal(report.find((topic) => topic.topic === "Biology").status, "Medium");
  assert.match(report.find((topic) => topic.topic === "Biology").diagnosis, /Meiosis, Mitosis/);
  assert.equal(report.find((topic) => topic.topic === "Algebra").status, "Strong");
});

test("revision plan prioritizes weighted weak topics and respects schedule limits", () => {
  const profile = {
    id: "student",
    fullName: "Student",
    email: "student@example.test",
    course: "",
    examDate: "2026-11-19",
    availableDays: 5,
    studyHoursPerDay: 2,
  };
  const report = [
    { topic: "Low-weight weak", score: 20, status: "Weak", importance: 20, recommendedAction: "Review basics", subtopics: [{ name: "Basics", score: 20 }] },
    { topic: "High-weight weak", score: 40, status: "Weak", importance: 100, recommendedAction: "Practice", subtopics: [{ name: "Practice", score: 40 }] },
    { topic: "Strong", score: 95, status: "Strong", importance: 100, recommendedAction: "Maintain", subtopics: [{ name: "Review", score: 95 }] },
  ];
  const completed = [{
    id: "old-task",
    day: 1,
    topic: "High-weight weak",
    subtopic: "Practice",
    duration: 30,
    priority: "High",
    activity: "Practice",
    completed: true,
  }];
  const plan = generateRevisionPlan(profile, report, completed, new Date("2026-11-17T00:00:00Z"));

  assert.equal(plan.length, 2);
  assert.equal(plan[0].topic, "High-weight weak");
  assert.equal(plan[0].completed, true);
  assert.equal(plan[0].duration, 60);
});
