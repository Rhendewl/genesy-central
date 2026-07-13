"use client";

import { useMemo, useState } from "react";
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
import type { PerformanceCollaborator, PerformanceIndicator, PerformancePillars } from "@/types/performance";

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
  icon: React.ElementType;
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

function PillarBars({ pillars }: { pillars: PerformancePillars }) {
  const rows = [
    { label: "Resultado", value: pillars.resultado, weight: "50%" },
    { label: "Produtividade", value: pillars.produtividade, weight: "20%" },
    { label: "Organização", value: pillars.organizacao, weight: "15%" },
    { label: "Disciplina", value: pillars.disciplina, weight: "15%" },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-title)" }}>{row.label}</span>
            <span style={{ color: "var(--muted-foreground)" }}>{row.value} · peso {row.weight}</span>
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
          <PillarBars pillars={person.pillars} />
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

export function PerformanceDashboard() {
  const { team, collaborators, isLoading, error, refetch } = usePerformanceData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => collaborators.find((item) => item.id === selectedId) ?? collaborators[0] ?? null,
    [collaborators, selectedId]
  );

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
    </div>
  );
}
