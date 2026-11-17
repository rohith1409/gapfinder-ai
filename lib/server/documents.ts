import { join } from "node:path";
import { ApiError } from "@/lib/server/backend";
import { chunkText } from "@/lib/logic";

export async function extractAndChunkDocument(name: string, type: "pdf" | "txt", blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text: string;

  if (type === "txt") {
    text = new TextDecoder("utf-8").decode(bytes);
  } else {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
      throw new ApiError("The uploaded file is not a valid PDF.", 400);
    }

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const standardFontDataUrl = `${join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts").replace(/\\/g, "/")}/`;
      const loadingTask = pdfjs.getDocument({ data: bytes, standardFontDataUrl });
      try {
        const pdf = await loadingTask.promise;
        const pages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const rows = new Map<number, Array<{ x: number; text: string }>>();

          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const x = item.transform[4] ?? 0;
            const y = Math.round((item.transform[5] ?? 0) * 2) / 2;
            const row = rows.get(y) ?? [];
            row.push({ x, text: item.str });
            rows.set(y, row);
          }

          pages.push([...rows.entries()]
            .sort(([a], [b]) => b - a)
            .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").trim())
            .filter(Boolean)
            .join("\n"));
          page.cleanup();
        }

        text = pages.join("\f");
      } finally {
        await loadingTask.destroy();
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const detail = error instanceof Error ? error.message : "Unknown parser error.";
      throw new ApiError(`The PDF could not be read: ${detail}. Upload a valid, text-based PDF.`, 422);
    }
  }

  if (!text.trim()) {
    throw new ApiError(`No readable text was extracted from ${name}. Scanned PDF OCR is not supported.`, 422);
  }
  if (text.length > 5_000_000) {
    throw new ApiError("The extracted document text exceeds the 5 MB processing limit.", 413);
  }

  const topic = name.replace(/\.[^/.]+$/, "") || "General";
  const chunks = chunkText(text, topic, name);
  if (!chunks.length) throw new ApiError(`No readable text was extracted from ${name}.`, 422);
  if (chunks.length > 2_000) {
    throw new ApiError("The document produced more than 2,000 chunks. Split the document before uploading.", 413);
  }

  return { text, chunks };
}
