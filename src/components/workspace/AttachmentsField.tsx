"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, X, Download } from "lucide-react";

// Compartilhado entre TaskDetailPanel e ObjectiveDetailPanel — a única parte
// acoplada ao domínio (a rota de assinatura de upload) vem via prop
// `signEndpoint`, montada pelo componente pai.
export interface AttachmentLike {
  id:        string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  public_url: string;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB, mesmo limite usado em WelcomeImageUpload.tsx

interface AttachmentsFieldProps {
  signEndpoint: string;
  attachments:  AttachmentLike[];
  onRegister:   (payload: { file_name: string; mime_type: string; file_size: number; storage_path: string; public_url: string }) => void;
  onDelete:     (attachmentId: string) => void;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsField({ signEndpoint, attachments, onRegister, onDelete }: AttachmentsFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5 MB.");
      return;
    }
    setIsUploading(true);
    try {
      const signRes = await fetch(signEndpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ file_name: file.name, mime_type: file.type }),
      });
      const signJson = await signRes.json() as { signed_url?: string; public_url?: string; storage_path?: string; error?: string };
      if (!signRes.ok || !signJson.signed_url) throw new Error(signJson.error ?? "Erro ao gerar URL de upload");

      const uploadRes = await fetch(signJson.signed_url, {
        method:  "PUT",
        headers: { "Content-Type": file.type },
        body:    file,
      });
      if (!uploadRes.ok) throw new Error("Falha no upload do arquivo");

      onRegister({
        file_name:    file.name,
        mime_type:    file.type,
        file_size:    file.size,
        storage_path: signJson.storage_path!,
        public_url:   signJson.public_url!,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((att) => (
        <div key={att.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]">
          <Paperclip size={13} style={{ color: "var(--muted-foreground)" }} />
          <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm" style={{ color: "var(--text-title)" }}>
            {att.file_name}
          </a>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{fmtSize(att.file_size)}</span>
          <a href={att.public_url} download target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted-foreground)" }}>
            <Download size={13} />
          </a>
          <button onClick={() => onDelete(att.id)} className="opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--muted-foreground)" }}>
            <X size={13} />
          </button>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="flex items-center gap-1.5 self-start text-xs font-medium disabled:opacity-50"
        style={{ color: "var(--primary)" }}
      >
        <Paperclip size={13} />
        {isUploading ? "Enviando..." : "Anexar arquivo"}
      </button>
    </div>
  );
}
