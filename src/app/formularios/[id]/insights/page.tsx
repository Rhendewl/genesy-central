"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FormularioShell } from "../_components/FormularioShell";
import { useFormularioInsights } from "@/hooks/useFormularioInsights";
import { InsightsFilterBar, type InsightsPeriod, type DeviceFilter } from "@/components/insights/InsightsFilterBar";
import { FormInsightsDashboard, Skeletons } from "@/components/formularios/insights/FormInsightsDashboard";

export default function FormularioInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState<InsightsPeriod>({});
  const [device, setDevice] = useState<DeviceFilter>("todos");

  const { data, isLoading, error, refetch } = useFormularioInsights(id, {
    since:  period.since,
    until:  period.until,
    device: device !== "todos" ? device : undefined,
  });

  return (
    <FormularioShell id={id}>
      <div className="flex flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
        <InsightsFilterBar period={period} device={device} onPeriod={setPeriod} onDevice={setDevice} />

        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm" style={{ color: "var(--text-title)" }}>{error}<button onClick={refetch} className="text-xs font-semibold underline">Tentar novamente</button></div>}
        {isLoading && !data && <Skeletons />}
        {data && <FormInsightsDashboard data={data} />}

        {isLoading && data && (
          <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            <Loader2 size={12} className="animate-spin" /> Atualizando…
          </div>
        )}
      </div>
    </FormularioShell>
  );
}
