"use client";

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
export function BscCharts(props: Props) {
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
  return <BscChartsView {...props} metrics={data.metrics} />;
}
export function BscChartsView({
  objectives,
  month,
  onOpen,
  onCreate,
  metrics,
}: Props & { metrics: BscMetric[] }) {
  const summary = bscSummary(objectives, metrics);

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
          <h2 className="font-semibold">Resultados por área</h2>
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
