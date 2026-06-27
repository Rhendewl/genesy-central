"use client";

import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { useFormularioEditor } from "@/hooks/useFormularioEditor";
import { Loader2 } from "lucide-react";

// Configurações completas (slug, notificações, integrações, webhook, pixel)
// — implementação completa na Parte 03 da especificação.
export default function FormularioConfiguracoesPage() {
  const { id } = useParams<{ id: string }>();
  const { form, isLoading } = useFormularioEditor(id);

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <Header title="Configurações" subtitle={form?.name ?? ""} />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        {isLoading && (
          <div className="flex items-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Carregando…</span>
          </div>
        )}

        {!isLoading && form && (
          <div
            className="rounded-xl border p-4 text-sm"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            <p className="mb-1 font-medium" style={{ color: "var(--text-title)" }}>Link público</p>
            <code className="text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/form/{form.slug}</code>
          </div>
        )}
      </div>
    </div>
  );
}
