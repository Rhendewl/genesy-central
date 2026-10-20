"use client";
import { Plus } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { HalfDonutGauge } from "@/components/dashboard-geral/HalfDonutGauge";
import {
  bscSummary,
  type BscPerspective,
  type BscMetric,
} from "@/lib/workspace/bsc";
import { useBscMetrics } from "@/hooks/useBscMetrics";
import type { WorkspaceObjective } from "@/types/workspace-objectives";
type Props = {
  objectives: WorkspaceObjective[];
  month: string;
  onOpen: (id: string) => void;
  onCreate: (perspective: BscPerspective) => void;
};
export function BscBoard(props: Props) {
  const data = useBscMetrics(props.objectives.map((o) => o.id));
  if (data.loading)
    return (
      <p className="py-8 text-sm" role="status">
        Carregando resultados do BSC…
      </p>
    );
  if (data.error)
    return (
      <p role="alert" className="py-8 text-sm text-red-400">
        Não foi possível carregar o BSC: {data.error}
      </p>
    );
  return <BscBoardView {...props} metrics={data.metrics} />;
}
export function BscBoardView({
  objectives,
  month,
  onOpen,
  onCreate,
  metrics,
}: Props & { metrics: BscMetric[] }) {
  const summary = bscSummary(objectives, metrics);
  const unclassified = objectives.filter((o) => !o.perspective);
  return (
    <div className="space-y-4">
      <section className="lc-card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {summary.overall === null ? (
          <div className="text-lg font-semibold">Sem indicadores medidos</div>
        ) : (
          <HalfDonutGauge
            percent={summary.overall}
            label="Atingimento BSC"
            caption="Metas acumuladas"
            size={160}
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Mapa de objetivos</h2>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Indicadores → objetivos → perspectivas → resultado geral. Médias com
            pesos iguais; tarefas não alteram o atingimento das metas.
          </p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {summary.perspectives.reduce((n, p) => n + p.measured, 0)} de{" "}
            {summary.perspectives.reduce((n, p) => n + p.total, 0)} objetivos
            classificados têm indicadores. Objetivos sem indicadores e
            cancelados ficam fora da média.
          </p>
        </div>
      </section>
      {summary.perspectives.map((p) => (
        <section key={p.id} className="lc-card p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="shrink-0 sm:w-44">
              <h3 className="mb-3 text-sm font-semibold">{p.label}</h3>
              {p.score === null ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Sem medição
                </p>
              ) : (
                <HalfDonutGauge
                  percent={p.score}
                  label="Atingimento"
                  caption={`${p.measured}/${p.total} objetivos medidos`}
                  size={112}
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {objectives
                .filter((o) => o.perspective === p.id)
                .map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onOpen(o.id)}
                    className="max-w-full rounded-xl border bg-[var(--glass-bg-soft)] px-4 py-3 text-left hover:bg-[var(--hover)]"
                  >
                    <span className="block max-w-xs break-words text-sm font-medium">
                      {o.title}
                    </span>
                    <span className="mt-1 block text-[10px] text-[var(--muted-foreground)]">
                      {`Indicadores: ${metrics.filter((m) => m.objective_id === o.id).length}`}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                      {o.status === "cancelado"
                        ? "Cancelado · fora da média"
                        : summary.scores.get(o.id) == null
                          ? "Sem indicadores"
                          : `${Math.round(summary.scores.get(o.id)!)}% de atingimento`}
                    </span>
                  </button>
                ))}
              <button
                onClick={() => onCreate(p.id)}
                className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs"
              >
                <Plus size={14} />
                Novo objetivo
              </button>
            </div>
          </div>
        </section>
      ))}
      {unclassified.length > 0 && (
        <section className="lc-card p-4">
          <h3 className="text-sm font-semibold">
            Sem perspectiva ({unclassified.length})
          </h3>
          <p className="my-2 text-xs text-[var(--muted-foreground)]">
            Escolha a perspectiva nos detalhes para incluir estes objetivos no
            BSC.
          </p>
          <div className="flex flex-wrap gap-2">
            {unclassified.map((o) => (
              <button
                className="rounded-lg border px-3 py-2 text-xs"
                key={o.id}
                onClick={() => onOpen(o.id)}
              >
                {o.title}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="lc-card p-5">
          <h3 className="mb-3 text-sm font-semibold">
            Atingimento por perspectiva
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.perspectives.filter((p) => p.score !== null)}
                layout="vertical"
                margin={{ left: 10, right: 15 }}
              >
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v) => `${Number(v).toFixed(1)}%`}
                  contentStyle={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Bar
                  dataKey="score"
                  name="Atingimento"
                  fill="#9b7fe0"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="lc-card p-5">
          <h3 className="mb-3 text-sm font-semibold">
            Cobertura de indicadores
          </h3>
          <p className="mb-4 text-xs text-[var(--muted-foreground)]">
            O mês filtra a vigência dos objetivos pelas datas de início e prazo.
            Objetivos sem datas aparecem em todos os meses. Os valores são
            sempre os resultados acumulados atuais, não um retrato histórico.
          </p>
          {summary.perspectives.map((p) => (
            <div key={p.id} className="mb-3 text-xs">
              <div className="mb-1 flex justify-between gap-2">
                <span>{p.label}</span>
                <span>
                  {p.measured}/{p.total} objetivos com indicadores
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--hover)]">
                <div
                  className="h-2 rounded-full bg-[#4a8fd4]"
                  style={{
                    width: `${p.total ? (p.measured / p.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-[var(--muted-foreground)]">
            {month
              ? `Objetivos vigentes em ${month.split("-").reverse().join("/")}`
              : "Todos os períodos"}
            . Os demais filtros também se aplicam às médias.
          </p>
        </section>
      </div>
    </div>
  );
}
