"use client";

import { ChangeEvent, useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { chunkText, extractTextFromFile, getDemoMaterials, saveToStorage } from "@/lib/logic";
import type { StudyMaterial } from "@/lib/types";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<StudyMaterial[]>(() => getDemoMaterials());
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setUploading(true);

    const processed = await Promise.all(
      files.map(async (file) => {
        const text = await extractTextFromFile(file);
        const chunks = chunkText(text, file.name.replace(/\.[^/.]+$/, ""));

        return {
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt",
          uploadDate: new Date().toISOString(),
          status: "processed",
          size: file.size,
          text,
          chunks,
        } satisfies StudyMaterial;
      }),
    );

    const updated = [...materials, ...processed];
    setMaterials(updated);
    saveToStorage("materials", updated);
    setUploading(false);
    event.target.value = "";
  };

  const deleteMaterial = (id: string) => {
    const next = materials.filter((material) => material.id !== id);
    setMaterials(next);
    saveToStorage("materials", next);
  };

  return (
    <AppShell title="Study materials">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <UploadCloud size={28} />
        </div>
        <h2 className="text-2xl font-semibold">Upload syllabus, notes, and past papers</h2>
        <p className="mt-2 text-slate-500">PDF and TXT supported. Large files are chunked and indexed for retrieval.</p>
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
              <span className="text-slate-500">{material.chunks.length} chunks</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
