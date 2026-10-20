"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { HalfDonutGauge } from "@/components/dashboard-geral/HalfDonutGauge";
import type { WorkspaceObjective } from "@/types/workspace-objectives";
export const objectiveStatuses = {
  planejado: "Planejados",
  em_andamento: "Em andamento",
  pausado: "Pausados",
  concluido: "Concluídos",
  cancelado: "Cancelados",
};
export function ObjectivesDashboard({
  objectives,
  onOpen,
}: {
  objectives: WorkspaceObjective[];
  onOpen: (id: string) => void;
}) {
  return <ObjectivesDashboardView objectives={objectives} onOpen={onOpen} />;
}
export function ObjectivesDashboardView({
  objectives,
  onOpen,
}: {
  objectives: WorkspaceObjective[];
  onOpen: (id: string) => void;
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const active = objectives.filter(
    (o) => !["concluido", "cancelado"].includes(o.status),
  );
  const roots = objectives.filter(
    (o) => !o.parent_id || !objectives.some((p) => p.id === o.parent_id),
  );
  const uniqueItems = Array.from(
    new Map(
      roots.flatMap((o) => o.execution_items ?? []).map((i) => [i.id, i]),
    ).values(),
  );
  const total = uniqueItems.length,
    done = uniqueItems.filter((i) => i.completed).length;
  const colors = ["#4a8fd4", "#9b7fe0", "#e0a344", "#6b9b6f", "#7c878e"];
  const statuses = Object.entries(objectiveStatuses).map(([key, name], i) => ({
    name,
    value: objectives.filter((o) => o.status === key).length,
    color: colors[i],
  }));
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Ativos", active.length],
          [
            "Concluídos",
            objectives.filter((o) => o.status === "concluido").length,
          ],
          [
            "Atrasados",
            active.filter((o) => o.due_date && o.due_date < today).length,
          ],
          ["Total de objetivos", objectives.length],
        ].map(([label, value]) => (
          <div key={label} className="lc-card p-4">
            <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="lc-card flex flex-col sm:flex-row items-center gap-6 p-6"
          style={{ background: "var(--glass-bg-soft)" }}
        >
          <HalfDonutGauge
            percent={total ? (done / total) * 100 : 0}
            label="Execução"
            caption={`${done}/${total} tarefas e etapas`}
            size={150}
          />
          <div className="min-w-0 w-full sm:w-auto flex-1">
            <h2 className="mb-3 text-sm font-semibold">Próximos prazos</h2>
            {active
              .filter((o) => o.due_date)
              .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
              .slice(0, 5)
              .map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOpen(o.id)}
                  className="flex w-full justify-between gap-2 rounded-lg py-2 text-left text-xs hover:bg-[var(--hover)]"
                >
                  <span className="truncate">{o.title}</span>
                  <span className={o.due_date! < today ? "text-red-400" : ""}>
                    {o.due_date?.split("-").reverse().join("/")}
                  </span>
                </button>
              ))}
            {!active.some((o) => o.due_date) && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Nenhum prazo definido
              </p>
            )}
          </div>
        </section>
        <section className="lc-card p-5">
          <h2 className="text-sm font-semibold">Objetivos por status</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statuses}
                layout="vertical"
                margin={{ left: 12, right: 20 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={95}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="value" name="Objetivos" radius={[0, 6, 6, 0]}>
                  {statuses.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="lc-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Execução por objetivo</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {roots.map((o) => (
            <button
              key={o.id}
              onClick={() => onOpen(o.id)}
              className="rounded-xl p-3 hover:bg-[var(--hover)]"
            >
              <HalfDonutGauge
                percent={
                  o.execution_total
                    ? ((o.execution_done ?? 0) / o.execution_total) * 100
                    : 0
                }
                label={o.title}
                caption={`${o.execution_done ?? 0}/${o.execution_total ?? 0} concluídas`}
                size={132}
              />
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Inclui subobjetivos e tarefas visíveis para você. Tarefas repetidas
          dentro do mesmo objetivo contam uma vez.
        </p>
      </section>
    </div>
  );
}
