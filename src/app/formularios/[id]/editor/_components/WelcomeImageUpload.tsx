"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface WelcomeImageUploadProps {
  formId: string;
  imageUrl?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export function WelcomeImageUpload({
  formId,
  imageUrl,
  onUpload,
  onRemove,
}: WelcomeImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);

    const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
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
      // 1. Obter signed URL
      const res = await fetch(`/api/formularios/${formId}/imagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_arquivo: file.name, mime_type: file.type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar URL de upload");

      // 2. Upload direto para Supabase Storage
      const uploadRes = await fetch(json.signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Falha no upload do arquivo");

      onUpload(json.public_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setIsUploading(false);
    }
  }, [formId, onUpload]);

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
            alt="Imagem de boas-vindas"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
            Imagem carregada
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[10px] hover:underline mt-0.5"
            style={{ color: "#66aed6" }}
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
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
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
          border: `1.5px dashed ${isDragging ? "#66aed6" : "rgba(255,255,255,0.12)"}`,
          background: isDragging ? "rgba(102,174,214,0.06)" : "rgba(255,255,255,0.02)",
        }}
        aria-label="Área para upload de imagem ou logo"
      >
        {isUploading ? (
          <>
            <Loader2 size={20} className="animate-spin" style={{ color: "#66aed6" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Enviando...</span>
          </>
        ) : (
          <>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(102,174,214,0.12)" }}
            >
              {isDragging ? (
                <Upload size={16} style={{ color: "#66aed6" }} />
              ) : (
                <ImageIcon size={16} style={{ color: "#66aed6" }} />
              )}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Clique ou arraste uma imagem
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                PNG, JPG, WebP, SVG — máx. 5 MB
              </p>
            </div>
          </>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
      {error && (
        <p className="text-[10px]" style={{ color: "#ef4444" }}>{error}</p>
      )}
    </div>
  );
}
