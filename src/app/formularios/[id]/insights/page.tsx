"use client";

import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { useFormularioInsights } from "@/hooks/useFormularioInsights";
import { Loader2 } from "lucide-react";

export default function FormularioInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const { insights, isLoading, error } = useFormularioInsights(id);

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <Header title="Insights" subtitle="Analytics do formulário" />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        {isLoading && (
          <div className="flex items-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Calculando métricas…</span>
          </div>
        )}

        {error && (
          <p className="text-sm py-8" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {insights && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Visualizações",    value: insights.total_views },
              { label: "Inícios",          value: insights.total_starts },
              { label: "Submissões",       value: insights.total_submissions },
              { label: "Taxa conclusão",   value: `${insights.completion_rate}%` },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border p-4"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: "var(--text-title)" }}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
