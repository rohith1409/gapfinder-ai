"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { chunkText, defaultMaterials, extractTextFromFile, saveToStorage } from "@/lib/logic";
import type { StudyMaterial } from "@/lib/types";
import { apiFetch, getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/browser-api";
import { useLocalStorageValue } from "@/lib/use-storage";

export default function MaterialsPage() {
  const [cloudMaterials, setCloudMaterials] = useState<StudyMaterial[]>([]);
  const demoMaterials = useLocalStorageValue("materials", defaultMaterials);
  const materials = isSupabaseConfigured() ? cloudMaterials : demoMaterials;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    apiFetch<{ materials: StudyMaterial[] | null }>("/api/materials")
      .then((response) => {
        if (response.materials) setCloudMaterials(response.materials);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load cloud materials."));
  }, []);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setError("");
    const processed: StudyMaterial[] = [];
    try {
      for (const file of files) {
        const maxUploadMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB) || 10;
        if (file.size > maxUploadMb * 1024 * 1024) {
          throw new Error(`${file.name} exceeds the ${maxUploadMb} MB upload limit.`);
        }
        if (!/\.(pdf|txt)$/i.test(file.name)) throw new Error(`${file.name} is not a supported PDF or TXT file.`);
        const type = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt";
        const material: StudyMaterial = {
          id: crypto.randomUUID(),
          name: file.name,
          type,
          uploadDate: new Date().toISOString(),
          status: "pending",
          size: file.size,
          text: "",
          chunks: [],
        };
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseBrowserClient();
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;
          if (!userData.user) throw new Error("Sign in before uploading study materials.");
          const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
          const storagePath = `${userData.user.id}/${crypto.randomUUID()}/${safeName}`;
          const { error: uploadError } = await supabase.storage.from("study-materials").upload(storagePath, file, {
            contentType: type === "pdf" ? "application/pdf" : "text/plain",
            upsert: false,
          });
          if (uploadError) throw uploadError;

          try {
            const saved = await apiFetch<{ id: string; chunkCount: number }>("/api/materials", {
              method: "POST",
              body: JSON.stringify({ name: file.name, type, storagePath }),
            });
            material.id = saved.id;
            material.status = "processed";
            material.chunkCount = saved.chunkCount;
          } catch (cause) {
            const { error: cleanupError } = await supabase.storage.from("study-materials").remove([storagePath]);
            if (cleanupError) console.error("Could not remove failed document upload:", cleanupError.message);
            throw cause;
          }
        } else {
          const text = await extractTextFromFile(file);
          const chunks = chunkText(text, file.name.replace(/\.[^/.]+$/, ""), file.name);
          if (!chunks.length) throw new Error(`No readable text was extracted from ${file.name}.`);
          if (chunks.length > 2000) throw new Error(`${file.name} produced more than 2,000 chunks. Split the document before uploading.`);
          material.status = "processed";
          material.text = text;
          material.chunks = chunks;
          material.chunkCount = chunks.length;
        }
        processed.push(material);
      }

      const updated = [...materials, ...processed];
      if (isSupabaseConfigured()) setCloudMaterials(updated);
      else saveToStorage("materials", updated);
    } catch (cause) {
      if (processed.length) {
        const updated = [...materials, ...processed];
        if (isSupabaseConfigured()) setCloudMaterials(updated);
        else saveToStorage("materials", updated);
      }
      setError(cause instanceof Error ? cause.message : "Could not process the selected files.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteMaterial = async (id: string) => {
    setError("");
    try {
      if (isSupabaseConfigured()) await apiFetch("/api/materials", { method: "DELETE", body: JSON.stringify({ id }) });
      const next = materials.filter((material) => material.id !== id);
      if (isSupabaseConfigured()) setCloudMaterials(next);
      else saveToStorage("materials", next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the material.");
    }
  };

  return (
    <AppShell title="Study materials">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <UploadCloud size={28} />
        </div>
        <h2 className="text-2xl font-semibold">Upload syllabus, notes, and past papers</h2>
        <p className="mt-2 text-slate-500">PDF and TXT supported. Large files are chunked and indexed for retrieval.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <label className="mt-6 inline-flex cursor-pointer items-center rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500">
          {uploading ? "Processing..." : "Choose files"}
          <input type="file" accept=".pdf,.txt" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
        </label>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {materials.map((material) => (
          <div key={material.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                <FileText size={14} />
                {material.type.toUpperCase()}
              </div>
              <button onClick={() => deleteMaterial(material.id)} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{material.name}</h3>
            <p className="mt-2 text-sm text-slate-500">{new Date(material.uploadDate).toLocaleDateString()} · {Math.round(material.size / 1024)} KB</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">{material.status}</span>
              <span className="text-slate-500">{material.chunkCount ?? material.chunks.length} chunks</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
