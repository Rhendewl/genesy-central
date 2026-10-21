"use client";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  bscSummary,
  BSC_COLORS,
  bscMetricProgress,
  type BscMetric,
} from "@/lib/workspace/bsc";
import { useBscMetrics } from "@/hooks/useBscMetrics";
import type { WorkspaceObjective } from "@/types/workspace-objectives";
import { BscTasks } from "./BscTasks";
import { AssigneeAvatarGroup } from "@/components/workspace/AssigneeAvatarGroup";

type Props = {
  objectives: WorkspaceObjective[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onChange?: () => void;
};
export function BscProgress({
  value,
  label,
  orange = false,
}: {
  value: number | null;
  label: string;
  orange?: boolean;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={
        value === null ? "Sem indicadores" : `${Math.round(value)}%`
      }
      className="h-2.5 overflow-hidden rounded-full bg-white/10"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${value ?? 0}%`,
          background: orange ? "#cc5424" : "#ffbd59",
        }}
      />
    </div>
  );
}
export function BscBoard(props: Props) {
  const { metrics, loading, error } = useBscMetrics(
    props.objectives.map((o) => o.id),
  );
  if (loading)
    return (
      <p role="status" className="p-8">
        Carregando painel BSC…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="p-8 text-red-400">
        {error}
      </p>
    );
  return <BscBoardView {...props} metrics={metrics} />;
}
export function BscBoardView({
  objectives,
  onOpen,
  onCreate,
  metrics,
  onChange,
}: Props & { metrics: BscMetric[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"view" | "tasks">("view");
  const summary = bscSummary(objectives, metrics);
  const selected =
    objectives.find((o) => o.id === selectedId) ??
    objectives.find((o) => o.perspective) ??
    objectives[0];
  const area = selected?.perspective ? BSC_COLORS[selected.perspective] : null;
  const selectedMetrics = metrics.filter(
    (m) => m.objective_id === selected?.id,
  );
  const score = selected ? (summary.scores.get(selected.id) ?? null) : null;
  const date = (v: string | null) =>
    v ? v.split("-").reverse().join("/") : "Não definida";
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] text-white">
      <section
        className="min-w-0 overflow-hidden rounded-[22px] bg-[#050606]"
        aria-label="Painel BSC por área"
      >
        <header className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-[#242424] to-[#0c0c0c] px-6 py-7">
          <h2 className="text-2xl font-light tracking-wide">
            PAINEL <strong className="font-bold">BSC</strong>
          </h2>
          <div className="min-w-44 flex-1 sm:max-w-[48%]">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-[10px] tracking-wide text-white/70">
                PROGRESSO GERAL
              </span>
              <span>
                {summary.overall === null
                  ? "—"
                  : `${Math.round(summary.overall)}%`}
              </span>
            </div>
            <BscProgress
              value={summary.overall}
              label="Progresso geral das metas"
            />
          </div>
        </header>
        <div className="px-4 sm:px-6">
          {summary.perspectives.map((p) => {
            const color = BSC_COLORS[p.id];
            return (
              <section
                key={p.id}
                className="flex min-w-0 items-center gap-4 border-b border-white/30 py-3 last:border-0 sm:gap-7"
                aria-label={color.name}
              >
                <div
                  className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full p-1"
                  style={{
                    background: `conic-gradient(#b2ed59 ${p.score ?? 0}%, #343b2e 0)`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#121414]">
                    <span className="text-3xl font-semibold leading-none">
                      {color.letter}
                    </span>
                    <span className="mt-0.5 text-[7px] uppercase">
                      {color.name}
                    </span>
                    <span className="text-[9px]">
                      {p.score === null ? "—" : `${Math.round(p.score)}%`}
                    </span>
                  </div>
                </div>
                <div
                  className="flex min-w-0 flex-1 gap-4 overflow-x-auto py-1 pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_94%,transparent)]"
                  tabIndex={0}
                  aria-label={`Objetivos de ${color.name}`}
                >
                  {objectives
                    .filter((o) => o.perspective === p.id)
                    .map((o) => (
                      <button
                        key={o.id}
                        aria-pressed={o.id === selected?.id}
                        onClick={() => {
                          setSelectedId(o.id);
                          setTab("view");
                        }}
                        className="relative isolate overflow-hidden backdrop-blur-xl hover:brightness-125 flex min-h-[68px] w-32 shrink-0 flex-col justify-between gap-2 rounded-xl border px-2.5 pb-1.5 pt-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        style={{
                          background: `linear-gradient(145deg, ${color.selected}${selected?.id === o.id ? "c0" : "75"} 0%, ${color.bg}80 55%, ${color.bg}40 100%)`,
                          borderColor: `${color.border}${selected?.id === o.id ? "ee" : "80"}`,
                          backdropFilter: "blur(20px) saturate(160%)",
                          WebkitBackdropFilter: "blur(20px) saturate(160%)",
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,${selected?.id === o.id ? ".3" : ".18"}), inset 0 -1px 0 rgba(255,255,255,.04), 0 6px 18px rgba(0,0,0,.3)${selected?.id === o.id ? `, 0 0 0 1px ${color.border}70, 0 0 20px ${color.selected}35` : ""}`,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/15 via-transparent to-transparent"
                        />
                        <span className="line-clamp-3 text-xs leading-tight">
                          {o.title}
                        </span>
                        <div className="w-full [&_[role=progressbar]]:h-1.5">
                          <BscProgress
                            value={summary.scores.get(o.id) ?? null}
                            label={`Progresso de ${o.title} em ${color.name}`}
                            orange
                          />
                          <span className="sr-only">
                            {o.status === "cancelado"
                              ? "Cancelado, fora da média"
                              : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                  <button
                    onClick={onCreate}
                    aria-label={`Cadastrar objetivo BSC em ${color.name}`}
                    className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 p-2 text-xs text-white/50 hover:text-white"
                  >
                    <Plus size={17} />
                    Cadastrar
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        {objectives.some((o) => !o.perspective) && (
          <details className="border-t border-white/10 p-4 text-xs">
            <summary className="cursor-pointer text-white/60">
              Objetivos anteriores sem área (
              {objectives.filter((o) => !o.perspective).length})
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {objectives
                .filter((o) => !o.perspective)
                .map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onOpen(o.id)}
                    className="rounded-lg border border-white/20 p-2"
                  >
                    {o.title} · Definir área
                  </button>
                ))}
            </div>
          </details>
        )}
      </section>
      <aside
        className="min-w-0 rounded-[22px] bg-[#050606] p-5 sm:p-7 lg:sticky lg:top-5"
        aria-label="Detalhes do objetivo selecionado"
      >
        <div
          className="mb-6 flex rounded-full bg-white/5 p-0.5"
          role="tablist"
          aria-label="Detalhes do objetivo"
        >
          {(
            [
              ["view", "Visualização"],
              ["tasks", "Tarefas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-full py-1 text-[10px] uppercase tracking-widest ${tab === id ? "bg-white/10" : "text-white/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {selected ? (
          <>
            <div className="mb-5 flex items-start gap-3 border-b border-white/20 pb-5">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[9px] uppercase text-white/65">
                  {tab === "view"
                    ? "Visualização do objetivo"
                    : "Tarefas do objetivo"}{" "}
                  |{" "}
                  <span style={{ color: area?.border ?? "#aaa" }}>
                    {area?.name ?? "Sem área"}
                  </span>
                </p>
                <h3 className="break-words text-2xl font-light leading-tight">
                  {selected.title}
                </h3>
              </div>
              <button
                aria-label="Editar objetivo e indicadores"
                onClick={() => onOpen(selected.id)}
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <Pencil size={15} />
              </button>
            </div>
            {tab === "tasks" ? (
              <BscTasks
                key={selected.id}
                objectiveId={selected.id}
                onChange={onChange}
                onManage={() => onOpen(selected.id)}
              />
            ) : (
              <>
                {selected.description && (
                  <p className="mb-4 whitespace-pre-wrap text-sm text-white/60">
                    {selected.description}
                  </p>
                )}
                <div className="space-y-5">
                  {selectedMetrics.map((m) => (
                    <div
                      key={m.id}
                      className="space-y-3 border-b border-white/15 pb-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">
                          Indicador:{" "}
                          <span className="font-normal">{m.title}</span>
                        </strong>
                        <span className="rounded-lg border border-white/10 px-3 py-1 text-xs">
                          {m.unit || "Unidades"}
                        </span>
                      </div>
                      {m.description && (
                        <p className="text-xs text-white/50">{m.description}</p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">Meta:</strong>
                        <span className="rounded-lg bg-white/5 px-3 py-1">
                          {formatBscValue(m.target, m.unit)}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-xs">
                        <span className="rounded-lg bg-white/5 px-2 py-2">
                          <b>Valor inicial:</b>{" "}
                          {formatBscValue(m.baseline, m.unit)}
                        </span>
                        <span className="rounded-lg bg-white/5 px-2 py-2">
                          <b>Realizado:</b>{" "}
                          {formatBscValue(m.current_value, m.unit)}
                        </span>
                      </div>
                      {selectedMetrics.length > 1 && (
                        <BscProgress
                          value={bscMetricProgress(
                            Number(m.baseline),
                            Number(m.target),
                            Number(m.current_value),
                          )}
                          label={`Atingimento de ${m.title}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {!selectedMetrics.length && (
                  <button
                    className="mb-5 rounded-lg border border-dashed border-white/20 p-4 text-sm text-white/60"
                    onClick={() => onOpen(selected.id)}
                  >
                    Adicionar indicadores e metas
                  </button>
                )}
                <div className="space-y-4 py-5 text-xs text-white/75">
                  <div className="flex items-center gap-3">
                    Prioridade:{" "}
                    <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-4 py-1 text-[10px] uppercase text-amber-300">
                      {selected.priority}
                    </span>
                  </div>
                  <p>
                    Horizonte:{" "}
                    <span className="ml-2">
                      {
                        { curto: "Curto", medio: "Médio", longo: "Longo" }[
                          selected.horizon
                        ]
                      }{" "}
                      prazo
                    </span>
                  </p>
                  <p>
                    Status:{" "}
                    <span className="ml-2">
                      {
                        {
                          planejado: "Planejado",
                          em_andamento: "Em andamento",
                          pausado: "Pausado",
                          concluido: "Concluído",
                          cancelado: "Cancelado",
                        }[selected.status]
                      }
                    </span>
                  </p>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>Início: {date(selected.start_date)}</span>
                    <span>Término: {date(selected.due_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    Responsáveis:{" "}
                    <AssigneeAvatarGroup
                      assigneeIds={selected.assignee_ids ?? []}
                      size={22}
                    />
                    {!selected.assignee_ids?.length && "Não definidos"}
                  </div>
                </div>
                <footer className="-mx-5 -mb-5 mt-2 rounded-2xl bg-gradient-to-r from-[#242424] to-[#0c0c0c] p-5 sm:-mx-7 sm:-mb-7">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-light">REALIZADO</span>
                    <span className="ml-auto text-lg">
                      {selectedMetrics.length === 1
                        ? formatBscValue(
                            selectedMetrics[0].current_value,
                            selectedMetrics[0].unit,
                          )
                        : ""}
                    </span>
                    <strong className="text-lg">
                      {score === null ? "—" : `${Math.round(score)}%`}
                    </strong>
                  </div>
                  <BscProgress
                    value={score}
                    label="Atingimento do objetivo selecionado"
                  />
                  <p className="mt-2 text-[9px] uppercase text-white/50">
                    Progresso acumulado das metas
                  </p>
                </footer>
              </>
            )}
          </>
        ) : (
          <div className="py-20 text-center text-sm text-white/50">
            Cadastre seu primeiro objetivo para começar.
          </div>
        )}
      </aside>
    </div>
  );
}
export function formatBscValue(value: number, unit: string) {
  const n = Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit === "R$" || unit.toLowerCase() === "reais"
    ? `R$ ${n}`
    : `${n}${unit ? ` ${unit}` : ""}`;
}
