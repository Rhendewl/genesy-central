"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

async function optimizeBanner(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  try {
    const variants = [
      { maxWidth: 1200, quality: 0.78 },
      { maxWidth: 1000, quality: 0.74 },
      { maxWidth: 800, quality: 0.72 },
    ];
    const targetBytes = 180 * 1024;
    let bestBlob: Blob | null = null;

    for (const variant of variants) {
      const scale = Math.min(1, variant.maxWidth / bitmap.width);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, "image/webp", variant.quality),
      );
      if (!blob) continue;
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= targetBytes) break;
    }

    if (!bestBlob || bestBlob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "banner";
    return new File([bestBlob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

interface WelcomeImageUploadProps {
  formId: string;
  imageUrl?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  kind?: "image" | "banner";
}

export function WelcomeImageUpload({
  formId,
  imageUrl,
  onUpload,
  onRemove,
  kind = "image",
}: WelcomeImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);

    const ACCEPTED = kind === "banner"
      ? ["image/png", "image/jpeg", "image/webp"]
      : ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
    if (!ACCEPTED.includes(file.type)) {
      setError(kind === "banner"
        ? "Formato não suportado. Use PNG, JPG ou WebP."
        : "Formato não suportado. Use PNG, JPG, WebP, SVG ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fileToUpload = kind === "banner"
        ? await optimizeBanner(file).catch(() => file)
        : file;

      // 1. Obter signed URL
      const res = await fetch(`/api/formularios/${formId}/imagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_arquivo: fileToUpload.name, mime_type: fileToUpload.type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar URL de upload");

      // 2. Upload direto para Supabase Storage
      const uploadRes = await fetch(json.signed_url, {
        method: "PUT",
        headers: {
          "Content-Type": fileToUpload.type,
          "Cache-Control": "max-age=31536000",
        },
        body: fileToUpload,
      });
      if (!uploadRes.ok) throw new Error("Falha no upload do arquivo");

      onUpload(json.public_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setIsUploading(false);
    }
  }, [formId, kind, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }, [upload]);

  // ── Pré-visualização quando já tem imagem ────────────────────────────────────

  if (imageUrl) {
    return (
      <div
        className="relative flex items-center gap-3 p-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <img
            src={imageUrl}
            alt={kind === "banner" ? "Banner de boas-vindas" : "Imagem de boas-vindas"}
            className={`w-full h-full ${kind === "banner" ? "object-cover" : "object-contain"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
            {kind === "banner" ? "Banner carregado" : "Imagem carregada"}
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[10px] hover:underline mt-0.5"
            style={{ color: "#404549" }}
          >
            Trocar imagem
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          aria-label="Remover imagem"
          title="Remover"
        >
          <X size={14} style={{ color: "#ef4444" }} />
        </button>
        <input ref={inputRef} type="file" accept={kind === "banner" ? ".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg" : "image/*"} className="sr-only" onChange={handleFileChange} />
      </div>
    );
  }

  // ── Zona de drop ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        disabled={isUploading}
        className="flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl text-center transition-all"
        style={{
          border: `1.5px dashed ${isDragging ? "#404549" : "rgba(255,255,255,0.12)"}`,
          background: isDragging ? "rgba(64,69,73,0.06)" : "rgba(255,255,255,0.02)",
        }}
        aria-label={kind === "banner" ? "Área para upload do banner" : "Área para upload de imagem ou logo"}
      >
        {isUploading ? (
          <>
            <Loader2 size={20} className="animate-spin" style={{ color: "#404549" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Enviando...</span>
          </>
        ) : (
          <>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(64,69,73,0.12)" }}
            >
              {isDragging ? (
                <Upload size={16} style={{ color: "#404549" }} />
              ) : (
                <ImageIcon size={16} style={{ color: "#404549" }} />
              )}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                {kind === "banner" ? "Clique ou arraste um banner" : "Clique ou arraste uma imagem"}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {kind === "banner" ? "PNG, JPG ou WebP — máx. 5 MB" : "PNG, JPG, WebP, SVG — máx. 5 MB"}
              </p>
            </div>
          </>
        )}
      </button>
      <input ref={inputRef} type="file" accept={kind === "banner" ? ".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg" : "image/*"} className="sr-only" onChange={handleFileChange} />
      {error && (
        <p className="text-[10px]" style={{ color: "#ef4444" }}>{error}</p>
      )}
    </div>
  );
}
