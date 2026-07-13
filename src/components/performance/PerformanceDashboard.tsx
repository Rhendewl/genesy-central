"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Save,
  Settings2,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import {
  DEFAULT_PERFORMANCE_ROLE_CONFIGS,
  PERFORMANCE_GOAL_OPTIONS,
  PERFORMANCE_ROLES,
} from "@/lib/performance-config";
import type {
  PerformanceCollaborator,
  PerformanceIndicator,
  PerformancePillars,
  PerformanceRole,
  PerformanceRoleConfig,
} from "@/types/performance";

const TONE_COLORS: Record<PerformanceIndicator["tone"], string> = {
  blue: "#38bdf8",
  green: "#34d399",
  amber: "#d97706",
  red: "#ef4444",
  violet: "#a78bfa",
};

function Avatar({ person, size = 40 }: { person: PerformanceCollaborator; size?: number }) {
  const initials = person.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  if (person.avatarUrl) {
    return <img src={person.avatarUrl} alt={person.name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ width: size, height: size, background: "var(--primary)", color: "#ffffff" }}
    >
      {initials || "?"}
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#d97706";
  return "#ef4444";
}

function MetricCard({ icon: Icon, label, value, hint, accent, delay }: {
  icon: ElementType;
  label: string;
  value: string;
  hint: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="lc-card p-4"
      style={{ background: "var(--glass-bg-soft)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{label}</p>
          <p className="mt-2 text-2xl font-bold" style={{ color: "var(--text-title)" }}>{value}</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{hint}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${accent}18` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
    </motion.div>
  );
}

function PillarBars({ pillars, weights }: { pillars: PerformancePillars; weights: PerformancePillars }) {
  const rows = [
    { label: "Resultado", value: pillars.resultado, weight: weights.resultado },
    { label: "Produtividade", value: pillars.produtividade, weight: weights.produtividade },
    { label: "Organização", value: pillars.organizacao, weight: weights.organizacao },
    { label: "Disciplina", value: pillars.disciplina, weight: weights.disciplina },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-title)" }}>{row.label}</span>
            <span style={{ color: "var(--muted-foreground)" }}>{row.value} · peso {row.weight}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--hover)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${row.value}%`, background: scoreColor(row.value) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingRow({ person, index, selected, onClick }: {
  person: PerformanceCollaborator;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5"
      style={{
        background: selected ? "var(--hover)" : "transparent",
        border: selected ? "1px solid var(--glass-border)" : "1px solid transparent",
      }}
    >
      <span className="w-5 text-center text-xs font-bold" style={{ color: "var(--muted-foreground)" }}>
        {index + 1}
      </span>
      <Avatar person={person} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{person.name}</p>
        <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>{person.roleLabel}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold" style={{ color: scoreColor(person.score) }}>{person.score}</p>
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>nota</p>
      </div>
    </button>
  );
}

function PrincipalIndicatorsCard({ person }: { person: PerformanceCollaborator }) {
  return (
    <div
      className="lc-card flex max-h-[320px] flex-col p-4"
      style={{ background: "var(--glass-bg-soft)" }}
    >
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Principais indicadores</h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
        Resumo operacional do colaborador selecionado
      </p>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {person.indicators.map((indicator) => (
          <div
            key={indicator.label}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
            style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium" style={{ color: "var(--text-title)" }}>{indicator.label}</p>
              <p className="truncate text-[11px]" style={{ color: "var(--muted-foreground)" }}>{indicator.hint}</p>
            </div>
            <p className="shrink-0 text-lg font-bold" style={{ color: TONE_COLORS[indicator.tone] }}>{indicator.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndividualDashboard({ person }: { person: PerformanceCollaborator }) {
  const delta = person.score - person.previousScore;
  const DeltaIcon = delta >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      key={person.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar person={person} size={64} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text-title)" }}>{person.name}</h2>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{person.jobTitle}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{person.summary}</p>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>Nota geral</p>
              <p className="text-5xl font-black" style={{ color: scoreColor(person.score) }}>{person.score}</p>
            </div>
            <div
              className="mb-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${delta >= 0 ? "#34d399" : "#ef4444"}18`, color: delta >= 0 ? "#34d399" : "#ef4444" }}
            >
              <DeltaIcon size={13} />
              {delta >= 0 ? "+" : ""}{delta}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Evolução mensal</h3>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Comparação com o mês anterior</p>
            </div>
            <Activity size={16} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={person.history}>
                <defs>
                  <linearGradient id={`score-${person.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={scoreColor(person.score)} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={scoreColor(person.score)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-title)" }} />
                <Area type="monotone" dataKey="score" stroke={scoreColor(person.score)} strokeWidth={2} fill={`url(#score-${person.id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Composição da nota</h3>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Quatro pilares automáticos</p>
          </div>
          <PillarBars pillars={person.pillars} weights={person.pillarWeights} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Target} label={person.mainGoalLabel} value={`${person.mainGoalValue}/${person.mainGoalTarget}`} hint="Meta principal do cargo" accent="#38bdf8" delay={0} />
        {person.indicators.slice(0, 3).map((indicator, index) => (
          <MetricCard
            key={indicator.label}
            icon={BarChart3}
            label={indicator.label}
            value={indicator.value}
            hint={indicator.hint}
            accent={TONE_COLORS[indicator.tone]}
            delay={0.04 + index * 0.04}
          />
        ))}
      </div>
    </motion.div>
  );
}

type CrmStageOption = {
  id: string;
  name: string;
  pipeline_id: string;
  is_won?: boolean | null;
  is_active?: boolean | null;
};

type CrmPipelineOption = {
  id: string;
  name: string;
  is_active?: boolean | null;
  crm_stages?: CrmStageOption[];
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>
      {children}
    </label>
  );
}

function fieldStyle(): CSSProperties {
  return {
    background: "var(--input-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-title)",
  };
}

function PerformanceSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [configs, setConfigs] = useState<PerformanceRoleConfig[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipelineOption[]>([]);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadConfig() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/performance/config");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar configurações");
        if (!alive) return;
        setConfigs(json.configs ?? Object.values(DEFAULT_PERFORMANCE_ROLE_CONFIGS));
        setPipelines(json.pipelines ?? []);
        setTableReady(json.tableReady !== false);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Erro ao carregar configurações");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadConfig();
    return () => { alive = false; };
  }, []);

  const updateConfig = (roleKey: PerformanceRole, patch: Partial<PerformanceRoleConfig>) => {
    setSaved(false);
    setConfigs((current) => current.map((config) => (
      config.roleKey === roleKey ? { ...config, ...patch } : config
    )));
  };

  const updateWeight = (roleKey: PerformanceRole, key: keyof PerformancePillars, value: string) => {
    const next = Math.max(0, Number(value) || 0);
    setSaved(false);
    setConfigs((current) => current.map((config) => (
      config.roleKey === roleKey
        ? { ...config, weights: { ...config.weights, [key]: next } }
        : config
    )));
  };

  const toggleStage = (roleKey: PerformanceRole, kind: "meeting" | "sales", stageId: string) => {
    setSaved(false);
    setConfigs((current) => current.map((config) => {
      if (config.roleKey !== roleKey) return config;
      const field = kind === "meeting" ? "meetingStageIds" : "salesStageIds";
      const currentIds = config[field];
      const nextIds = currentIds.includes(stageId)
        ? currentIds.filter((id) => id !== stageId)
        : [...currentIds, stageId];
      return { ...config, [field]: nextIds };
    }));
  };

  const saveConfigs = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/performance/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar configurações");
      setConfigs(json.configs ?? configs);
      setTableReady(json.tableReady !== false);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="lc-card h-48 animate-pulse" style={{ background: "var(--glass-bg-soft)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!tableReady && (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(217,119,6,0.12)", border: "1px solid rgba(217,119,6,0.35)", color: "#d97706" }}>
          A tabela de configuração ainda não existe no Supabase. Rode a migration 20260747 para salvar alterações; até lá, a régua padrão segue ativa.
        </div>
      )}

      {error && (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Motor de Performance</h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Configure as metas, pesos e etapas do CRM que alimentam a nota de cada cargo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveConfigs()}
          disabled={saving || !tableReady}
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#ffffff" }}
        >
          <Save size={16} />
          {saving ? "Salvando..." : saved ? "Salvo" : "Salvar configurações"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {PERFORMANCE_ROLES.map((roleKey) => {
          const config = configs.find((item) => item.roleKey === roleKey) ?? DEFAULT_PERFORMANCE_ROLE_CONFIGS[roleKey];
          const selectedPipeline = pipelines.find((pipeline) => pipeline.id === config.crmPipelineId) ?? null;
          const stages = config.crmPipelineId
            ? selectedPipeline?.crm_stages ?? []
            : pipelines.flatMap((pipeline) => pipeline.crm_stages ?? []);

          return (
            <div key={roleKey} className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold" style={{ color: "var(--text-title)" }}>{config.roleLabel}</h3>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Régua mensal usada para colaboradores identificados como este cargo.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <input
                    type="checkbox"
                    checked={config.isActive}
                    onChange={(event) => updateConfig(roleKey, { isActive: event.target.checked })}
                  />
                  Ativo
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Nome do cargo</FieldLabel>
                  <input
                    value={config.roleLabel}
                    onChange={(event) => updateConfig(roleKey, { roleLabel: event.target.value })}
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={fieldStyle()}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Objetivo principal</FieldLabel>
                  <select
                    value={config.mainGoalType}
                    onChange={(event) => updateConfig(roleKey, { mainGoalType: event.target.value as PerformanceRoleConfig["mainGoalType"] })}
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={fieldStyle()}
                  >
                    {PERFORMANCE_GOAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Nome exibido da meta</FieldLabel>
                  <input
                    value={config.mainGoalLabel}
                    onChange={(event) => updateConfig(roleKey, { mainGoalLabel: event.target.value })}
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={fieldStyle()}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Meta mensal</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={config.mainGoalTarget}
                    onChange={(event) => updateConfig(roleKey, { mainGoalTarget: Number(event.target.value) || 0 })}
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={fieldStyle()}
                  />
                </div>
              </div>

              <div className="mt-4">
                <FieldLabel>Pesos da nota</FieldLabel>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {([
                    ["resultado", "Resultado"],
                    ["produtividade", "Produtividade"],
                    ["organizacao", "Organização"],
                    ["disciplina", "Disciplina"],
                  ] as Array<[keyof PerformancePillars, string]>).map(([key, label]) => (
                    <label key={key} className="space-y-1">
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={config.weights[key]}
                        onChange={(event) => updateWeight(roleKey, key, event.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={fieldStyle()}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel>Pipeline de referência</FieldLabel>
                  <select
                    value={config.crmPipelineId ?? ""}
                    onChange={(event) => updateConfig(roleKey, {
                      crmPipelineId: event.target.value || null,
                      meetingStageIds: [],
                      salesStageIds: [],
                    })}
                    className="w-full rounded-2xl px-3 py-2 text-sm outline-none"
                    style={fieldStyle()}
                  >
                    <option value="">Todas as pipelines</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                    ))}
                  </select>
                </div>

                {stages.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                      <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-title)" }}>Etapas que contam como reunião</p>
                      <div className="space-y-2">
                        {stages.map((stage) => (
                          <label key={stage.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                            <input
                              type="checkbox"
                              checked={config.meetingStageIds.includes(stage.id)}
                              onChange={() => toggleStage(roleKey, "meeting", stage.id)}
                            />
                            {stage.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                      <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-title)" }}>Etapas que contam como venda</p>
                      <div className="space-y-2">
                        {stages.map((stage) => (
                          <label key={stage.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                            <input
                              type="checkbox"
                              checked={config.salesStageIds.includes(stage.id)}
                              onChange={() => toggleStage(roleKey, "sales", stage.id)}
                            />
                            {stage.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PerformanceDashboard() {
  const { team, collaborators, isLoading, error, refetch } = usePerformanceData();
  const { member, isOwner } = useCurrentMember();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");
  const selected = useMemo(
    () => collaborators.find((item) => item.id === selectedId) ?? collaborators[0] ?? null,
    [collaborators, selectedId]
  );
  const canManagePerformance = isOwner === true || member?.role === "admin";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="lc-card h-28 animate-pulse" style={{ background: "var(--glass-bg-soft)" }} />
          ))}
        </div>
        <div className="lc-card h-96 animate-pulse" style={{ background: "var(--glass-bg-soft)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="lc-card p-8 text-center" style={{ background: "var(--glass-bg-soft)" }}>
        <AlertTriangle className="mx-auto mb-3" size={28} style={{ color: "#ef4444" }} />
        <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Não foi possível carregar Performance</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{error}</p>
        <button onClick={() => void refetch()} className="mt-5 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "var(--primary)", color: "#ffffff" }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!team || collaborators.length === 0) {
    return (
      <div className="lc-card p-8 text-center" style={{ background: "var(--glass-bg-soft)" }}>
        <Users className="mx-auto mb-3" size={28} style={{ color: "var(--muted-foreground)" }} />
        <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Sem colaboradores ativos</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Cadastre usuários em Configurações para começar a medir performance.</p>
      </div>
    );
  }

  const delta = team.averageScore - team.previousAverageScore;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-full p-1" style={{ background: "var(--glass-bg-soft)", border: "1px solid var(--glass-border)" }}>
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: view === "dashboard" ? "var(--hover)" : "transparent", color: view === "dashboard" ? "var(--text-title)" : "var(--muted-foreground)" }}
          >
            Dashboard
          </button>
          {canManagePerformance && (
            <button
              type="button"
              onClick={() => setView("settings")}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all"
              style={{ background: view === "settings" ? "var(--hover)" : "transparent", color: view === "settings" ? "var(--text-title)" : "var(--muted-foreground)" }}
            >
              <Settings2 size={15} />
              Configurações
            </button>
          )}
        </div>
      </div>

      {view === "settings" && canManagePerformance ? (
        <PerformanceSettingsPanel onSaved={() => void refetch()} />
      ) : (
        <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} label="Nota média da equipe" value={String(team.averageScore)} hint={`${delta >= 0 ? "+" : ""}${delta} vs. mês anterior`} accent={scoreColor(team.averageScore)} delay={0} />
        <MetricCard icon={Trophy} label="Ranking geral" value={`${team.ranking[0]?.name.split(" ")[0] ?? "N/D"}`} hint="Melhor nota no mês" accent="#d97706" delay={0.05} />
        <MetricCard icon={CheckCircle2} label="Metas batidas" value={String(team.goalsHit)} hint="Metas principais atingidas" accent="#34d399" delay={0.1} />
        <MetricCard icon={AlertTriangle} label="Precisam de atenção" value={String(team.attention.length)} hint="Nota baixa ou atraso operacional" accent="#ef4444" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="lc-card p-4" style={{ background: "var(--glass-bg-soft)" }}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Ranking geral</h2>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Clique para abrir o dashboard individual</p>
              </div>
              <button onClick={() => void refetch()} className="rounded-full p-2 transition-colors hover:bg-[var(--hover)]" aria-label="Atualizar performance">
                <RefreshCw size={14} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div className="space-y-1">
              {team.ranking.map((person, index) => (
                <RankingRow
                  key={person.id}
                  person={person}
                  index={index}
                  selected={selected?.id === person.id}
                  onClick={() => setSelectedId(person.id)}
                />
              ))}
            </div>
          </div>

          <div className="lc-card p-4" style={{ background: "var(--glass-bg-soft)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Média por cargo</h2>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={team.byRole} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="role" width={92} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-title)" }} />
                  <Bar dataKey="average" fill="#b0b8c1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selected && <PrincipalIndicatorsCard person={selected} />}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
              <div className="mb-4 flex items-center gap-2">
                <Award size={16} style={{ color: "#34d399" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Melhor desempenho</h2>
              </div>
              <div className="space-y-2">
                {team.best.map((person) => (
                  <RankingRow key={person.id} person={person} index={team.ranking.findIndex((item) => item.id === person.id)} selected={selected?.id === person.id} onClick={() => setSelectedId(person.id)} />
                ))}
              </div>
            </div>

            <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: "#d97706" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Atenção operacional</h2>
              </div>
              {team.attention.length ? (
                <div className="space-y-2">
                  {team.attention.map((person) => (
                    <RankingRow key={person.id} person={person} index={team.ranking.findIndex((item) => item.id === person.id)} selected={selected?.id === person.id} onClick={() => setSelectedId(person.id)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
                  Nenhum colaborador em atenção neste mês.
                </div>
              )}
            </div>
          </div>

          {selected ? <IndividualDashboard person={selected} /> : (
            <div className="lc-card p-8 text-center" style={{ background: "var(--glass-bg-soft)" }}>
              <UserRound className="mx-auto mb-3" size={28} style={{ color: "var(--muted-foreground)" }} />
              <p style={{ color: "var(--muted-foreground)" }}>Selecione um colaborador para ver o dashboard individual.</p>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
