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
  signEndpoint?: string;
  attachments:  AttachmentLike[];
  onRegister:   (payload: AttachmentRegistrationPayload) => void | Promise<unknown>;
  onDelete:     (attachmentId: string) => void;
  pendingFiles?: File[];
  onStageFiles?: (files: File[]) => void;
  onRemovePending?: (index: number) => void;
  readOnly?:    boolean;
}

export interface AttachmentRegistrationPayload {
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadAttachmentFile(
  file: File,
  signEndpoint: string,
  onRegister: (payload: AttachmentRegistrationPayload) => void | Promise<unknown>,
) {
  const signRes = await fetch(signEndpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ file_name: file.name, mime_type: file.type || "application/octet-stream" }),
  });
  const signJson = await signRes.json() as { signed_url?: string; public_url?: string; storage_path?: string; error?: string };
  if (!signRes.ok || !signJson.signed_url) throw new Error(signJson.error ?? "Erro ao gerar URL de upload");

  const uploadRes = await fetch(signJson.signed_url, {
    method:  "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body:    file,
  });
  if (!uploadRes.ok) throw new Error("Falha no upload do arquivo");

  const registerResult = await onRegister({
    file_name:    file.name,
    mime_type:    file.type || "application/octet-stream",
    file_size:    file.size,
    storage_path: signJson.storage_path!,
    public_url:   signJson.public_url!,
  });
  if (registerResult && typeof registerResult === "object" && "error" in registerResult && registerResult.error) {
    throw new Error(String(registerResult.error));
  }
}

export function AttachmentsField({
  signEndpoint,
  attachments,
  onRegister,
  onDelete,
  pendingFiles = [],
  onStageFiles,
  onRemovePending,
  readOnly = false,
}: AttachmentsFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList) {
    const selectedFiles = Array.from(fileList);
    const validFiles = selectedFiles.filter((file) => {
      if (file.size <= MAX_SIZE) return true;
      toast.error(`${file.name}: arquivo muito grande. Máximo 5 MB.`);
      return false;
    });
    if (validFiles.length === 0) return;
    if (onStageFiles) {
      onStageFiles(validFiles);
      return;
    }
    if (!signEndpoint) {
      toast.error("Não foi possível preparar os anexos.");
      return;
    }

    setIsUploading(true);
    let uploaded = 0;
    try {
      for (let index = 0; index < validFiles.length; index += 1) {
        const file = validFiles[index];
        setUploadProgress({ current: index + 1, total: validFiles.length });
        try {
          await uploadAttachmentFile(file, signEndpoint, onRegister);
          uploaded += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro no upload";
          toast.error(`${file.name}: ${message}`);
        }
      }

      if (validFiles.length > 1 && uploaded > 0) {
        toast.success(`${uploaded} de ${validFiles.length} arquivos anexados.`);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((att) => (
        <div key={att.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--hover)]">
          <Paperclip size={13} style={{ color: "var(--muted-foreground)" }} />
          <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm" style={{ color: "var(--text-title)" }}>
            {att.file_name}
          </a>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{fmtSize(att.file_size)}</span>
          <a href={att.public_url} download target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted-foreground)" }}>
            <Download size={13} />
          </a>
          {!readOnly && (
            <button onClick={() => onDelete(att.id)} className="opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--muted-foreground)" }}>
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      {pendingFiles.map((file, index) => (
        <div key={`${file.name}-${file.lastModified}-${index}`} className="group flex items-center gap-2 rounded-lg px-1 py-1">
          <Paperclip size={13} style={{ color: "var(--muted-foreground)" }} />
          <span className="flex-1 truncate text-sm" style={{ color: "var(--text-title)" }}>{file.name}</span>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{fmtSize(file.size)}</span>
          {!readOnly && onRemovePending && (
            <button onClick={() => onRemovePending(index)} style={{ color: "var(--muted-foreground)" }} aria-label={`Remover ${file.name}`}>
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) void handleFiles(files);
          e.target.value = "";
        }}
      />}
      {!readOnly && <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="flex items-center gap-1.5 self-start text-xs font-medium disabled:opacity-50"
        style={{ color: "var(--primary)" }}
      >
        <Paperclip size={13} />
        {onStageFiles
          ? pendingFiles.length > 0 ? "Adicionar mais arquivos" : "Selecionar arquivos"
          : isUploading && uploadProgress
          ? `Enviando ${uploadProgress.current} de ${uploadProgress.total}...`
          : "Anexar arquivos"}
      </button>}
    </div>
  );
}
