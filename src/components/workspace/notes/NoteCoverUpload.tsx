"use client";

import { useCallback, useRef, useState } from "react";
import { X, Loader2, ImagePlus } from "lucide-react";

interface NoteCoverUploadProps {
  noteId:   string;
  coverUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

export function NoteCoverUpload({ noteId, coverUrl, onUpload, onRemove }: NoteCoverUploadProps) {
  const [isDragging,  setIsDragging]  = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato não suportado. Use PNG, JPG, WebP, SVG ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const res  = await fetch(`/api/workspace/notes/${noteId}/imagens`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nome_arquivo: file.name, mime_type: file.type }),
      });
      const json = await res.json() as { signed_url?: string; public_url?: string; error?: string };
      if (!res.ok || !json.signed_url) throw new Error(json.error ?? "Erro ao gerar URL de upload");

      const uploadRes = await fetch(json.signed_url, {
        method:  "PUT",
        headers: { "Content-Type": file.type },
        body:    file,
      });
      if (!uploadRes.ok) throw new Error("Falha no upload do arquivo");

      onUpload(json.public_url!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setIsUploading(false);
    }
  }, [noteId, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void upload(file);
  }, [upload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  }, [upload]);

  if (coverUrl) {
    return (
      <div className="group relative h-40 w-full overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="Capa da nota" className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "rgba(0,0,0,0.45)" }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            Trocar capa
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5"
            style={{ background: "rgba(255,255,255,0.12)" }}
            aria-label="Remover capa"
          >
            <X size={14} color="#fff" />
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        disabled={isUploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs transition-all"
        style={{
          border:     `1.5px dashed ${isDragging ? "var(--primary)" : "var(--border)"}`,
          background: isDragging ? "rgba(74,143,212,0.06)" : "var(--hover)",
          color:      "var(--muted-foreground)",
        }}
      >
        {isUploading ? (
          <><Loader2 size={14} className="animate-spin" /> Enviando...</>
        ) : (
          <><ImagePlus size={14} /> Adicionar capa</>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {error && <p className="text-[10px]" style={{ color: "#e05c5c" }}>{error}</p>}
    </div>
  );
}
