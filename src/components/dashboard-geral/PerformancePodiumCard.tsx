"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Trophy } from "lucide-react";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { selectLowPerformers, selectPerformancePodium } from "@/lib/performance-podium";
import type { PerformanceCollaborator } from "@/types/performance";

const PODIUM_STYLES = [
  {
    label: "1º lugar",
    medal: "#f6c453",
    medalShadow: "rgba(246, 196, 83, 0.72)",
    surface: "rgba(246, 196, 83, 0.13)",
    border: "rgba(246, 196, 83, 0.38)",
    avatarSize: 82,
  },
  {
    label: "2º lugar",
    medal: "#cbd5e1",
    medalShadow: "rgba(203, 213, 225, 0.62)",
    surface: "rgba(203, 213, 225, 0.10)",
    border: "rgba(203, 213, 225, 0.30)",
    avatarSize: 68,
  },
  {
    label: "3º lugar",
    medal: "#d7945d",
    medalShadow: "rgba(215, 148, 93, 0.62)",
    surface: "rgba(215, 148, 93, 0.10)",
    border: "rgba(215, 148, 93, 0.30)",
    avatarSize: 68,
  },
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PodiumAvatar({
  person,
  size,
  color,
}: {
  person: PerformanceCollaborator;
  size: number;
  color: string;
}) {
  if (person.avatarUrl) {
    return (
      <Image
        src={person.avatarUrl}
        alt={`Avatar de ${person.name}`}
        width={size}
        height={size}
        unoptimized
        className="h-full w-full rounded-full object-cover"
      />
    );
  }

  return (
    <span
      className="flex h-full w-full items-center justify-center rounded-full text-base font-black"
      style={{ background: `${color}22`, color }}
      aria-hidden="true"
    >
      {initials(person.name) || "?"}
    </span>
  );
}

function PodiumPlace({
  person,
  position,
}: {
  person: PerformanceCollaborator | undefined;
  position: number;
}) {
  const reduceMotion = useReducedMotion();
  const style = PODIUM_STYLES[position];
  const isChampion = position === 0;

  if (!person) {
    return (
      <div
        className={`flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed px-2 py-3 sm:min-h-[178px] sm:rounded-3xl sm:px-4 sm:py-5 ${
          isChampion ? "-translate-y-2 sm:-translate-y-3" : ""
        }`}
        style={{ borderColor: "var(--glass-border)", background: "var(--hover)" }}
      >
        <span className="text-[10px] font-semibold sm:text-xs" style={{ color: "var(--muted-foreground)" }}>
          {style.label}
        </span>
        <span className="mt-2 hidden text-sm sm:inline" style={{ color: "var(--muted-foreground)" }}>
          Posição disponível
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex min-h-[150px] flex-col items-center overflow-hidden rounded-2xl border px-2 pb-3 pt-3 text-center sm:min-h-[178px] sm:rounded-3xl sm:px-4 sm:pb-5 sm:pt-4 ${
        isChampion ? "-translate-y-2 sm:-translate-y-3" : ""
      }`}
      style={{
        borderColor: style.border,
        background: `linear-gradient(180deg, ${style.surface}, var(--glass-bg-soft))`,
        boxShadow: isChampion ? `0 18px 48px ${style.medalShadow}20` : undefined,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-8 -top-16 h-28 rounded-full blur-3xl"
        style={{ background: style.medalShadow, opacity: isChampion ? 0.2 : 0.1 }}
      />

      <div className="relative mb-2 flex items-center">
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full blur-md"
          style={{ background: style.medalShadow }}
          animate={reduceMotion ? undefined : { opacity: [0.25, 0.75, 0.25], scale: [0.82, 1.2, 0.82] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: position * 0.2 }}
        />
        <span
          className="relative flex min-w-[58px] items-center justify-center rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] sm:min-w-[78px] sm:px-3 sm:text-[11px] sm:tracking-[0.12em]"
          style={{ background: `${style.medal}20`, color: style.medal }}
        >
          {style.label}
        </span>
      </div>

      <div
        className={`relative shrink-0 rounded-full p-[3px] ${
          isChampion
            ? "h-[68px] w-[68px] sm:h-[82px] sm:w-[82px]"
            : "h-[58px] w-[58px] sm:h-[68px] sm:w-[68px]"
        }`}
        style={{
          background: `linear-gradient(145deg, ${style.medal}, ${style.medal}55)`,
          boxShadow: `0 0 28px ${style.medalShadow}38`,
        }}
      >
        <div className="h-full w-full rounded-full bg-[var(--background)] p-[2px]">
          <PodiumAvatar person={person} size={style.avatarSize - 10} color={style.medal} />
        </div>
      </div>

      <p
        className={`mt-2 max-w-full truncate font-black sm:mt-3 ${isChampion ? "text-xs sm:text-base" : "text-[11px] sm:text-sm"}`}
        style={{ color: isChampion ? style.medal : "var(--text-title)" }}
        title={person.name}
      >
        {person.name}
      </p>
      <p className="mt-1 hidden text-xs font-semibold sm:block" style={{ color: "var(--muted-foreground)" }}>
        {person.roleLabel}
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={isChampion ? "text-xl font-black sm:text-3xl" : "text-lg font-black sm:text-2xl"} style={{ color: style.medal }}>
          {person.score}
        </span>
        <span className="hidden text-[10px] font-bold uppercase tracking-wider sm:inline" style={{ color: "var(--muted-foreground)" }}>
          pontos
        </span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-[150px] animate-pulse rounded-2xl sm:h-[178px] sm:rounded-3xl" style={{ background: "var(--hover)" }} />
      ))}
    </div>
  );
}

export function PerformancePodiumCard({ delay = 0.24 }: { delay?: number }) {
  const { team, isLoading, error, refetch } = usePerformanceData();
  const podium = selectPerformancePodium(team?.gamificationRanking ?? []);
  const attention = selectLowPerformers(team?.gamificationRanking ?? []);

  return (
    <motion.section
      className="lc-card overflow-hidden p-4 sm:p-6"
      style={{ background: "var(--glass-bg-soft)" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      aria-labelledby="performance-podium-title"
    >
      <div className="mb-5 flex items-start gap-3 sm:mb-7">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11"
            style={{ background: "rgba(246, 196, 83, 0.14)", color: "#f6c453" }}
          >
            <Trophy size={19} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#f6c453" }}>
              Ranking do mês
            </p>
            <h2 id="performance-podium-title" className="mt-0.5 text-base font-black sm:text-lg" style={{ color: "var(--text-title)" }}>
              Pódio de performance
            </h2>
            <p className="mt-1 text-[11px] sm:text-xs" style={{ color: "var(--muted-foreground)" }}>
              Destaques da equipe com base em organização, diciplina e execução.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <div className="rounded-2xl p-5 text-center" style={{ background: "var(--hover)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Não foi possível carregar o ranking.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-xs font-bold underline underline-offset-4"
            style={{ color: "var(--primary)" }}
          >
            Tentar novamente
          </button>
        </div>
      ) : podium.length === 0 ? (
        <div className="rounded-2xl p-5 text-center text-sm" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
          Ainda não há colaboradores com dados de performance neste mês.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-1.5 sm:gap-3">
            <div className="order-2">
              <PodiumPlace person={podium[0]} position={0} />
            </div>
            <div className="order-1">
              <PodiumPlace person={podium[1]} position={1} />
            </div>
            <div className="order-3">
              <PodiumPlace person={podium[2]} position={2} />
            </div>
          </div>

          <div
            className="mt-4 flex flex-col gap-3 rounded-2xl px-4 py-3.5 lg:flex-row lg:items-center"
            style={{
              background: attention.length > 0 ? "rgba(239, 68, 68, 0.07)" : "var(--hover)",
              border: `1px solid ${attention.length > 0 ? "rgba(239, 68, 68, 0.22)" : "var(--glass-border)"}`,
            }}
          >
            <div className="flex shrink-0 items-center gap-2">
              <AlertTriangle size={16} style={{ color: attention.length > 0 ? "#ef4444" : "#34d399" }} />
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--text-title)" }}>
                  Atenção à baixa performance
                </p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  Acompanhamento recomendado
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap gap-2 lg:justify-end">
              {attention.length > 0 ? attention.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                  title={`${person.name}: ${person.score} pontos`}
                >
                  <span className="max-w-[180px] truncate font-semibold" style={{ color: "var(--text-title)" }}>
                    {person.name}
                  </span>
                  <span className="font-black" style={{ color: "#ef4444" }}>{person.score}</span>
                </span>
              )) : (
                <span className="text-xs font-semibold" style={{ color: "#34d399" }}>
                  Nenhum usuário precisa de atenção neste mês.
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </motion.section>
  );
}
