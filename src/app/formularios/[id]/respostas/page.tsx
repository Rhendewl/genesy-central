"use client";

import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { useFormularioRespostas } from "@/hooks/useFormularioRespostas";
import { Loader2 } from "lucide-react";

export default function FormularioRespostasPage() {
  const { id } = useParams<{ id: string }>();
  const { respostas, total, isLoading, error } = useFormularioRespostas(id);

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <Header title="Respostas" subtitle={`${total} submissão${total !== 1 ? "ões" : ""} recebida${total !== 1 ? "s" : ""}`} />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        {isLoading && (
          <div className="flex items-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Carregando respostas…</span>
          </div>
        )}

        {error && (
          <p className="text-sm py-8" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {!isLoading && !error && respostas.length === 0 && (
          <p className="text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
            Nenhuma resposta ainda. Publique o formulário e compartilhe o link.
          </p>
        )}

        {/* Tabela de respostas — implementação completa na Parte 03 */}
        {!isLoading && respostas.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                    DATA
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                    STATUS
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                    RESPOSTAS
                  </th>
                </tr>
              </thead>
              <tbody>
                {respostas.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: i < respostas.length - 1 ? "1px solid var(--border)" : "none",
                      background: "var(--card)",
                    }}
                  >
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: r.status === "completed" ? "#22c55e20" : "rgba(255,255,255,0.06)",
                          color: r.status === "completed" ? "#22c55e" : "var(--muted-foreground)",
                        }}
                      >
                        {r.status === "completed" ? "Completo" : "Parcial"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {Object.keys(r.answers).length} campo{Object.keys(r.answers).length !== 1 ? "s" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
