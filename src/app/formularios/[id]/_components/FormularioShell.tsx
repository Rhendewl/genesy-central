"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Globe, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useFormularios } from "@/hooks/useFormularios";
import type { Form, FormStatus } from "@/types";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface FormularioShellProps {
  id: string;
  children: React.ReactNode;
}

type FormMeta = Pick<Form, "name" | "status" | "slug">;

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "Visão Geral",   suffix: ""               },
  { label: "Respostas",     suffix: "/respostas"     },
  { label: "Insights",      suffix: "/insights"      },
  { label: "Configurações", suffix: "/configuracoes" },
] as const;

// ── Badge de status ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<FormStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Rascunho",   bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.50)" },
  published: { label: "Publicado",  bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  archived:  { label: "Arquivado",  bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)" },
  disabled:  { label: "Desativado", bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
};

// ── FormularioShell ────────────────────────────────────────────────────────────

export function FormularioShell({ id, children }: FormularioShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { publicarFormulario } = useFormularios();

  // Metadados leves para o cabeçalho (nome, status, slug)
  const [meta, setMeta]           = useState<FormMeta | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/formularios/${id}`)
      .then(r => r.json())
      .then(json => {
        if (mounted && json.formulario) {
          const { name, status, slug } = json.formulario as Form;
          setMeta({ name, status, slug });
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [id]);

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    const { error } = await publicarFormulario(id);
    setIsPublishing(false);
    if (error) {
      toast.error("Erro ao publicar", { description: error });
    } else {
      toast.success("Formulário publicado!");
      setMeta(prev => prev ? { ...prev, status: "published" } : prev);
    }
  }, [id, publicarFormulario]);

  function isTabActive(suffix: string) {
    return pathname === `/formularios/${id}${suffix}`;
  }

  const st        = meta ? STATUS_STYLE[meta.status] : null;
  const publicUrl = meta?.status === "published" && meta.slug
    ? (typeof window !== "undefined" ? `${window.location.origin}/form/${meta.slug}` : null)
    : null;

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--background)" }}>

      {/* ── Cabeçalho ── */}
      <div
        className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >

        {/* Linha: voltar | nome | badge | espaçador | url | publicar */}
        <div className="flex items-center gap-3 mb-3 min-w-0">

          <button
            onClick={() => router.push("/formularios")}
            className="flex items-center gap-1.5 text-xs flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
            aria-label="Voltar para lista de formulários"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Formulários</span>
          </button>

          <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.10)" }} aria-hidden="true" />

          {meta ? (
            <h1
              className="text-sm font-semibold truncate flex-1 min-w-0"
              style={{ color: "var(--text-title)", letterSpacing: "-0.01em" }}
            >
              {meta.name || "Sem título"}
            </h1>
          ) : (
            <div className="flex-1 h-4 max-w-[160px] rounded animate-pulse" style={{ background: "var(--card)" }} />
          )}

          {st && (
            <span
              className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full hidden sm:inline-block"
              style={{ background: st.bg, color: st.color }}
              aria-label={`Status: ${st.label}`}
            >
              {st.label}
            </span>
          )}

          <div className="flex-1 hidden sm:block" />

          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-opacity hover:opacity-80 flex-shrink-0 hidden md:flex"
              style={{
                background: "rgba(34,197,94,0.10)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.18)",
              }}
            >
              <Globe size={11} aria-hidden="true" />
              Ver publicado
            </a>
          )}

          {meta && meta.status !== "published" && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0"
              style={{
                background: "rgba(102,174,214,0.12)",
                color: "#66aed6",
                border: "1px solid rgba(102,174,214,0.22)",
              }}
              aria-label="Publicar formulário"
            >
              {isPublishing
                ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                : <Send size={12} aria-hidden="true" />
              }
              <span className="hidden sm:inline">{isPublishing ? "Publicando…" : "Publicar"}</span>
            </button>
          )}
        </div>

        {/* Tab bar */}
        <nav
          className="flex items-end gap-0 overflow-x-auto"
          aria-label="Navegação do formulário"
          role="tablist"
        >
          {TABS.map(tab => {
            const active = isTabActive(tab.suffix);
            return (
              <button
                key={tab.suffix}
                role="tab"
                aria-selected={active}
                onClick={() => router.push(`/formularios/${id}${tab.suffix}`)}
                className="flex-shrink-0 px-4 py-2 text-xs font-medium transition-all border-b-2"
                style={{
                  color: active ? "var(--text-title)" : "var(--muted-foreground)",
                  borderColor: active ? "var(--primary)" : "transparent",
                  background: "transparent",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Conteúdo da aba ── */}
      <div className="flex-1 min-h-0">
        {children}
      </div>

    </div>
  );
}
