"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { FormStatus } from "@/types";
import { SaveIndicator } from "./SaveIndicator";

interface EditorToolbarProps {
  formName: string;
  formStatus: FormStatus;
  formSlug: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
  onChangeName: (name: string) => void;
  onPublish: () => void;
}

const STATUS_STYLE: Record<FormStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Rascunho",   bg: "rgba(255,255,255,0.08)", color: "color-mix(in srgb, var(--text-title) 50%, transparent)" },
  published: { label: "Publicado",  bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  archived:  { label: "Arquivado",  bg: "rgba(255,255,255,0.06)", color: "color-mix(in srgb, var(--text-title) 30%, transparent)" },
  disabled:  { label: "Desativado", bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
};

export function EditorToolbar({
  formName,
  formStatus,
  formSlug,
  isDirty,
  isSaving,
  onBack,
  onSave,
  onChangeName,
  onPublish,
}: EditorToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(formName);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { setNameVal(formName); }, [formName]);

  const isPublished = formStatus === "published" && !!formSlug;
  const publicPath  = formSlug ? `/form/${formSlug}` : null;

  const copyLink = () => {
    if (!publicPath) return;
    const fullUrl = `${window.location.origin}${publicPath}`;
    navigator.clipboard.writeText(fullUrl).then(() => toast.success("Link copiado"));
  };

  const openForm = () => {
    if (!publicPath) return;
    window.open(publicPath, "_blank", "noopener,noreferrer");
  };

  const commitName = () => {
    setEditing(false);
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== formName) {
      onChangeName(trimmed);
    } else {
      setNameVal(formName);
    }
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const st = STATUS_STYLE[formStatus];

  return (
    <div
      className="flex items-center gap-3 px-4 h-12 flex-shrink-0"
      style={{
        borderBottom: "1px solid var(--glass-border)",
        background: "var(--hover)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
      }}
      role="toolbar"
      aria-label="Barra do editor"
    >
      {/* Voltar */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70 flex-shrink-0"
        style={{ color: "var(--muted-foreground)" }}
        aria-label="Voltar para lista de formulários"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Formulários</span>
      </button>

      {/* Divisor */}
      <div className="w-px h-4 flex-shrink-0" style={{ background: "var(--glass-bg-soft)" }} aria-hidden="true" />

      {/* Nome editável */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            className="flex-1 min-w-0 text-sm font-medium bg-transparent outline-none px-2 py-1 rounded-lg border"
            style={{
              color: "var(--text-title)",
              borderColor: "var(--primary)",
              background: "var(--glass-bg-soft)",
              maxWidth: 320,
            }}
            value={nameVal}
            aria-label="Nome do formulário"
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === "Enter")  commitName();
              if (e.key === "Escape") { setEditing(false); setNameVal(formName); }
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium truncate max-w-[240px] hover:underline decoration-dotted underline-offset-2 transition-all"
            style={{ color: "var(--text-title)" }}
            aria-label={`Nome do formulário: ${formName || "Sem título"}. Clique para editar.`}
          >
            {formName || "Sem título"}
          </button>
        )}

        {/* Badge de status */}
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline-block"
          style={{ background: st.bg, color: st.color }}
          aria-label={`Status: ${st.label}`}
        >
          {st.label}
        </span>
      </div>

      {/* Indicador de salvamento */}
      <div className="flex-shrink-0">
        <SaveIndicator isDirty={isDirty} isSaving={isSaving} onSave={onSave} />
      </div>

      {/* Copiar link / abrir página — só quando publicado */}
      {isPublished && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={copyLink}
            title="Copiar link público"
            aria-label="Copiar link público do formulário"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-[var(--hover)] active:scale-95"
            style={{ border: "1px solid var(--glass-border)", color: "var(--muted-foreground)" }}
          >
            <Link2 size={14} aria-hidden="true" />
          </button>
          <button
            onClick={openForm}
            title="Abrir formulário em nova guia"
            aria-label="Abrir formulário publicado em nova guia"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-[var(--hover)] active:scale-95"
            style={{ border: "1px solid var(--glass-border)", color: "var(--muted-foreground)" }}
          >
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Publicar */}
      {formStatus !== "published" && (
        <button
          onClick={onPublish}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)", border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)" }}
          aria-label="Publicar formulário"
        >
          <Send size={12} aria-hidden="true" />
          <span className="hidden sm:inline">Publicar</span>
        </button>
      )}
    </div>
  );
}
