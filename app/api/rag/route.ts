import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  question: z.string().min(3),
  materials: z.array(
    z.object({
      name: z.string(),
      text: z.string(),
      chunks: z.array(
        z.object({
          content: z.string(),
          source: z.string(),
          page: z.number().optional(),
          section: z.string().optional(),
          topic: z.string().optional(),
        }),
      ),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const payload = bodySchema.parse(await request.json());
    const normalizedQuestion = payload.question.toLowerCase();
    const topMatches = payload.materials.flatMap((material) =>
      material.chunks
        .filter((chunk) => {
          const haystack = `${chunk.content} ${chunk.topic ?? ""} ${chunk.section ?? ""}`.toLowerCase();
          const tokens = normalizedQuestion.split(/\s+/).filter((word) => word.length > 2);
          return tokens.some((token) => haystack.includes(token)) || haystack.includes(normalizedQuestion);
        })
        .map((chunk) => ({
          content: chunk.content,
          source: chunk.source,
          page: chunk.page ?? 1,
          section: chunk.section ?? "Relevant section",
          topic: chunk.topic ?? material.name,
        })),
    );

    if (!topMatches.length) {
      return NextResponse.json({
        answer: "I couldn't find sufficient information about this topic in your uploaded study materials.",
        citations: [],
      });
    }

    const answer = topMatches[0].content;
    const citations = topMatches.slice(0, 3).map((match) => ({
      source: match.source,
      page: match.page,
      section: match.section,
    }));

    if (process.env.GROQ_API_KEY) {
      try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Answer ONLY using the provided material context and include citations. If context is insufficient, say so." },
              { role: "user", content: `Question: ${payload.question}\n\nContext: ${JSON.stringify(topMatches.slice(0, 4))}` },
            ],
            temperature: 0.2,
          }),
        });

        if (groqResponse.ok) {
          const data = await groqResponse.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            return NextResponse.json({ answer: text, citations });
          }
        }
      } catch {
        // fall back to grounded retrieval result when Groq is unavailable
      }
    }

    return NextResponse.json({
      answer: `Using the uploaded material, the key point is: ${answer}`,
      citations,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request or missing context. Please provide a proper question and study materials." },
      { status: 400 },
    );
  }
}
