"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { bscSummary, BSC_COLORS, type BscPerspective, type BscMetric } from "@/lib/workspace/bsc";
import { useBscMetrics } from "@/hooks/useBscMetrics";
import type { WorkspaceObjective } from "@/types/workspace-objectives";
import { BscTasks } from "./BscTasks";
import { BscInlineDetails } from "./BscInlineDetails";
import { useGlobalStore } from "@/store";
import styles from "./bsc.module.css";
import { progressColor, progressGradientFrom } from "@/lib/progress-color";

type Props = {
  objectives: WorkspaceObjective[];
  onOpen: (id: string) => void;
  onCreate: (area?: BscPerspective) => void;
  onChange?: () => void;
};
export function BscProgress({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  const theme = useGlobalStore((s) => s.theme);
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
          background: `linear-gradient(90deg, ${progressGradientFrom(value ?? 0, theme)}, ${progressColor(value ?? 0)})`,
        }}
      />
    </div>
  );
}
export function BscBoard(props: Props) {
  const { metrics, loading, error, refetch } = useBscMetrics(
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
  return (
    <BscBoardView
      {...props}
      metrics={metrics}
      onChange={() => {
        refetch();
        props.onChange?.();
      }}
    />
  );
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
  return (
    <div
      className={`${styles.root} grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]`}
    >
      <section
        className={`${styles.surface} min-w-0 overflow-hidden rounded-[22px]`}
        aria-label="Painel BSC por área"
      >
        <header
          className={`${styles.band} flex flex-wrap items-center justify-between gap-5 rounded-2xl px-6 py-7`}
        >
          <h2 className="text-2xl font-light tracking-wide">
            PAINEL <strong className="font-bold">BSC</strong>
          </h2>
          <div className="min-w-44 flex-1 sm:max-w-[48%]">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-[10px] tracking-wide text-white/70">
                PROGRESSO GERAL DAS METAS
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
                    background: `conic-gradient(${progressColor(p.score ?? 0)} ${p.score ?? 0}%, var(--border) 0)`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[var(--background)]">
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
                          color: "var(--text-title)",
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
                    onClick={() => onCreate(p.id)}
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
        className={`${styles.surface} min-w-0 rounded-[22px] p-5 sm:p-7 lg:sticky lg:top-5`}
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
                {tab === "tasks" && (
                  <h3 className="break-words text-2xl font-light leading-tight">
                    {selected.title}
                  </h3>
                )}
              </div>
            </div>
            <div hidden={tab !== "tasks"}>
              <BscTasks
                key={selected.id}
                objectiveId={selected.id}
                onChange={onChange}
                onManage={() => onOpen(selected.id)}
              />
            </div>
            {tab === "view" && (
              <>
                <BscInlineDetails
                  key={`${selected.id}:${selected.updated_at}`}
                  objective={selected}
                  metrics={selectedMetrics}
                  onSaved={() => onChange?.()}
                  onAdvanced={() => onOpen(selected.id)}
                />
                <footer
                  className={`${styles.band} -mx-5 -mb-5 mt-5 rounded-2xl p-5 sm:-mx-7 sm:-mb-7`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-light">METAS REALIZADAS</span>
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
