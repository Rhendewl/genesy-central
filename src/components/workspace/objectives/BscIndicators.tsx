"use client";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import { useBscMetrics } from "@/hooks/useBscMetrics";
import type { BscMetric } from "@/lib/workspace/bsc";
import { metricProgress } from "@/lib/workspace/objective-progress";
import { HalfDonutGauge } from "@/components/dashboard-geral/HalfDonutGauge";
const field = "w-full rounded-lg border bg-[var(--background)] p-2 text-sm";
export function BscIndicators({
  objectiveId,
  onChange,
}: {
  objectiveId: string;
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const data = useBscMetrics([objectiveId]);
  const refresh = () => {
    data.refetch();
    onChange();
  };
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Indicadores e metas</h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        Defina o que medir, a meta acumulada e o realizado do objetivo. A
        conclusão das tarefas não altera estes resultados.
      </p>
      {data.error && (
        <p role="alert" className="text-xs text-red-400">
          {data.error}
        </p>
      )}
      {data.loading ? (
        <p className="text-xs">Carregando indicadores…</p>
      ) : (
        data.metrics.map((m) => (
          <IndicatorEditor
            key={`${m.id}-${JSON.stringify(m)}`}
            metric={m}
            onChange={refresh}
          />
        ))
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const result = await getSupabaseClient()
            .from("workspace_objective_metrics")
            .insert({
              objective_id: objectiveId,
              title: title.trim(),
              unit: "",
              baseline: 0,
              target: 100,
              current_value: 0,
            });
          setBusy(false);
          if (result.error) toast.error(result.error.message);
          else {
            setTitle("");
            refresh();
          }
        }}
      >
        <input
          aria-label="Nome do indicador"
          placeholder="Ex.: Faturamento, clientes, prazo de entrega"
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
        <button
          className="lc-btn px-3 text-xs"
          disabled={busy || !title.trim()}
        >
          Adicionar indicador
        </button>
      </form>
    </section>
  );
}
function IndicatorEditor({
  metric,
  onChange,
}: {
  metric: BscMetric;
  onChange: () => void;
}) {
  const [details, setDetails] = useState({
    title: metric.title,
    description: metric.description ?? "",
    unit: metric.unit,
  });
  const [values, setValues] = useState({
    baseline: String(metric.baseline),
    target: String(metric.target),
    current_value: String(metric.current_value),
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (
      !details.title.trim() ||
      !Object.values(values).every((v) => Number.isFinite(Number(v))) ||
      Number(values.baseline) === Number(values.target)
    )
      return toast.error(
        "Informe o indicador e uma meta diferente do valor inicial.",
      );
    setBusy(true);
    const db = getSupabaseClient();
    const r = await db
      .from("workspace_objective_metrics")
      .update({
        ...details,
        baseline: Number(values.baseline),
        target: Number(values.target),
        current_value: Number(values.current_value),
      })
      .eq("id", metric.id)
      .select("id")
      .single();
    setBusy(false);
    if (r.error) toast.error(r.error.message);
    else {
      toast.success("Meta e realizado salvos");
      onChange();
    }
  }
  return (
    <details className="lc-card p-3" open>
      <summary className="cursor-pointer text-sm font-medium">
        {metric.title} ·{" "}
        {Math.round(
          metricProgress(
            Number(metric.baseline),
            Number(metric.target),
            Number(metric.current_value),
          ),
        )}
        %
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <HalfDonutGauge
          percent={metricProgress(
            Number(metric.baseline),
            Number(metric.target),
            Number(metric.current_value),
          )}
          label="Atingimento da meta"
          caption={`${metric.current_value} / ${metric.target} ${metric.unit}`}
        />
        <label className="block text-xs">
          Indicador
          <input
            className={field}
            value={details.title}
            required
            maxLength={200}
            onChange={(e) => setDetails({ ...details, title: e.target.value })}
          />
        </label>
        <label className="block text-xs">
          Descrição
          <textarea
            className={field}
            value={details.description}
            placeholder="O que este indicador mede e como atualizar"
            onChange={(e) =>
              setDetails({ ...details, description: e.target.value })
            }
          />
        </label>
        <label className="block text-xs">
          Unidade
          <input
            className={field}
            value={details.unit}
            placeholder="R$, clientes, dias, %…"
            onChange={(e) => setDetails({ ...details, unit: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["baseline", "Valor inicial"],
              ["target", "Meta"],
              ["current_value", "Realizado"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs">
              {label}
              <input
                className={field}
                type="number"
                step="any"
                value={values[key]}
                required
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Para aumentar: (realizado − inicial) ÷ (meta − inicial). Metas de
          redução também são aceitas. O atingimento vai de 0 a 100%.
        </p>
        <div className="flex justify-between gap-2">
          <button disabled={busy} className="lc-btn px-3 py-2 text-xs">
            Salvar meta e realizado
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-red-400"
            onClick={async () => {
              if (!window.confirm("Excluir este indicador e seus resultados?"))
                return;
              setBusy(true);
              const r = await getSupabaseClient()
                .from("workspace_objective_metrics")
                .delete()
                .eq("id", metric.id)
                .select("id")
                .single();
              setBusy(false);
              if (r.error) toast.error(r.error.message);
              else onChange();
            }}
          >
            Excluir indicador
          </button>
        </div>
      </form>
    </details>
  );
}
