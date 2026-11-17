import { z } from "zod";
import { ApiError, embedTexts, getUserSupabase, isCloudBackendConfigured, jsonError } from "@/lib/server/backend";
import type { NextRequest } from "next/server";
import { extractAndChunkDocument } from "@/lib/server/documents";

const materialSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["pdf", "txt"]),
  storagePath: z.string().min(1).max(600),
});

export async function GET(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) return Response.json({ materials: null, mode: "demo" });
    const { client, user } = await getUserSupabase(request);
    const { data, error } = await client
      .from("documents")
      .select("id,name,document_type,file_size,created_at,status,document_chunks(count)")
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
        text: "",
        uploadDate: document.created_at,
        status: document.status,
        chunks: [],
        chunkCount: document.document_chunks[0]?.count ?? 0,
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
    if (!parsed.success) throw new ApiError("Invalid material payload.", 400);
    const material = parsed.data;
    const { client, user } = await getUserSupabase(request);
    const allowedPath = new RegExp(`^${user.id}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,255}$`, "i");
    if (!allowedPath.test(material.storagePath)) throw new ApiError("Invalid private document storage path.", 400);

    const { data: file, error: downloadError } = await client.storage.from("study-materials").download(material.storagePath);
    if (downloadError || !file) throw new ApiError(`Could not read uploaded document: ${downloadError?.message ?? "No file returned."}`, 502);
    const sizeLimit = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10) * 1024 * 1024;
    if (file.size > sizeLimit) throw new ApiError(`File exceeds the ${process.env.MAX_UPLOAD_SIZE_MB ?? 10} MB upload limit.`, 413);

    const { text, chunks } = await extractAndChunkDocument(material.name, material.type, file);
    const vectors = await embedTexts(chunks.map((chunk) => chunk.content));
    const { data: document, error: documentError } = await client
      .from("documents")
      .insert({
        user_id: user.id,
        name: material.name,
        document_type: material.type,
        storage_path: material.storagePath,
        file_size: file.size,
        extracted_text: text,
        status: "processed",
      })
      .select("id")
      .single();
    if (documentError || !document) throw new ApiError(`Could not save uploaded material: ${documentError?.message ?? "Missing document id."}`, 502);

    for (let offset = 0; offset < chunks.length; offset += 100) {
      const { error: chunksError } = await client.from("document_chunks").insert(
        chunks.slice(offset, offset + 100).map((chunk, batchIndex) => ({
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
    return Response.json({ id: document.id, status: "processed", chunkCount: chunks.length }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isCloudBackendConfigured()) throw new ApiError("Supabase is not configured.", 501);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const { client, user } = await getUserSupabase(request);
    const { data: document, error: lookupError } = await client.from("documents")
      .select("id,storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (lookupError) throw new ApiError(`Could not find material for deletion: ${lookupError.message}`, 502);
    if (!document) throw new ApiError("Study material was not found for this account.", 404);
    const { error } = await client.from("documents").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw new ApiError(`Could not delete material: ${error.message}`, 502);
    if (document.storage_path) {
      const { error: storageError } = await client.storage.from("study-materials").remove([document.storage_path]);
      if (storageError) throw new ApiError(`The material was removed from the index but its stored file could not be deleted: ${storageError.message}`, 502);
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
