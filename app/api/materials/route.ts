import { z } from "zod";
import { ApiError, embedTexts, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";
import type { NextRequest } from "next/server";

const chunkSchema = z.object({
  content: z.string().min(1).max(10_000),
  topic: z.string().optional(),
  section: z.string().optional(),
  page: z.number().int().positive().optional(),
});
const materialSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["pdf", "txt"]),
  size: z.number().int().nonnegative(),
  text: z.string().min(1).max(5_000_000),
  chunks: z.array(chunkSchema).min(1).max(2000),
});

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) return Response.json({ materials: null, mode: "demo" });
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client
      .from("documents")
      .select("id,name,document_type,file_size,extracted_text,created_at,status,document_chunks(id,chunk_content,topic,section_title,page_number,chunk_index)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(`Could not load study materials: ${error.message}`, 502);

    return Response.json({
      mode: "cloud",
      materials: data.map((document) => ({
        id: document.id,
        name: document.name,
        type: document.document_type,
        size: document.file_size ?? 0,
        text: document.extracted_text ?? "",
        uploadDate: document.created_at,
        status: document.status,
        chunks: document.document_chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.chunk_content,
          topic: chunk.topic ?? "General",
          source: document.name,
          ...(chunk.page_number ? { page: chunk.page_number } : {}),
          ...(chunk.section_title ? { section: chunk.section_title } : {}),
        })),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) {
      throw new ApiError("Supabase is not configured; use local demo storage.", 501);
    }
    const parsed = materialSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError("Invalid material payload: provide extracted text and valid chunks.", 400);
    const material = parsed.data;
    const sizeLimit = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10) * 1024 * 1024;
    if (material.size > sizeLimit) throw new ApiError(`File exceeds the ${process.env.MAX_UPLOAD_SIZE_MB ?? 10} MB upload limit.`, 413);

    const { client, user } = await getUserSupabase(request);
    const vectors = await embedTexts(material.chunks.map((chunk) => chunk.content));
    const { data: document, error: documentError } = await client
      .from("documents")
      .insert({
        user_id: user.id,
        name: material.name,
        document_type: material.type,
        file_size: material.size,
        extracted_text: material.text,
        status: "processed",
      })
      .select("id")
      .single();
    if (documentError || !document) throw new ApiError(`Could not save uploaded material: ${documentError?.message ?? "Missing document id."}`, 502);

    for (let offset = 0; offset < material.chunks.length; offset += 100) {
      const { error: chunksError } = await client.from("document_chunks").insert(
        material.chunks.slice(offset, offset + 100).map((chunk, batchIndex) => ({
          user_id: user.id,
          document_id: document.id,
          chunk_content: chunk.content,
          topic: chunk.topic ?? null,
          section_title: chunk.section ?? null,
          page_number: chunk.page ?? null,
          chunk_index: offset + batchIndex,
          embedding: vectors[offset + batchIndex],
        })),
      );
      if (chunksError) {
        const { error: cleanupError } = await client.from("documents").delete().eq("id", document.id).eq("user_id", user.id);
        if (cleanupError) console.error("Could not remove incomplete document upload:", cleanupError.message);
        throw new ApiError(`Could not save embedded document chunks: ${chunksError.message}`, 502);
      }
    }
    return Response.json({ id: document.id, status: "processed" }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Supabase is not configured.", 501);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client.from("documents").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw new ApiError(`Could not delete material: ${error.message}`, 502);
    if (!data) throw new ApiError("Study material was not found for this account.", 404);
    return Response.json({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
