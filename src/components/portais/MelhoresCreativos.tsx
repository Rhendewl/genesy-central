"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, DollarSign, Eye, MousePointer, TrendingUp, ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalCreative } from "@/types";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Ranking badge colors ──────────────────────────────────────────────────────

const RANK_STYLES: Record<number, { bg: string; text: string; border: string; label: string }> = {
  1: {
    bg: "linear-gradient(135deg, #b8860b 0%, #ffd700 50%, #b8860b 100%)",
    text: "#000",
    border: "rgba(255,215,0,0.4)",
    label: "#1",
  },
  2: {
    bg: "linear-gradient(135deg, #6b7280 0%, #d1d5db 50%, #6b7280 100%)",
    text: "#000",
    border: "rgba(209,213,219,0.35)",
    label: "#2",
  },
  3: {
    bg: "linear-gradient(135deg, #92400e 0%, #d97706 50%, #92400e 100%)",
    text: "#000",
    border: "rgba(217,119,6,0.4)",
    label: "#3",
  },
};

function getRankStyle(rank: number) {
  return RANK_STYLES[rank] ?? {
    bg: "rgba(255,255,255,0.08)",
    text: "rgba(255,255,255,0.7)",
    border: "rgba(255,255,255,0.12)",
    label: `#${rank}`,
  };
}

// ── Metric pill ───────────────────────────────────────────────────────────────

function MetricRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={11} style={{ color }} strokeWidth={1.8} />
        <span className="text-white/40 text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <span className="text-white text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-3xl overflow-hidden shrink-0 w-[220px] sm:w-auto"
      style={{
        background: "rgba(0,0,0,0.07)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="aspect-[4/3] bg-white/[0.04] animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-white/[0.06] rounded-full animate-pulse w-3/4" />
        <div className="h-2.5 bg-white/[0.04] rounded-full animate-pulse w-1/2" />
        <div className="space-y-2 pt-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-2 bg-white/[0.04] rounded-full animate-pulse w-1/3" />
              <div className="h-2 bg-white/[0.06] rounded-full animate-pulse w-1/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Creative card ─────────────────────────────────────────────────────────────

function CreativeCard({ creative, index }: { creative: PortalCreative; index: number }) {
  const [imgError, setImgError] = useState(false);
  const rankStyle = getRankStyle(creative.ranking);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="rounded-3xl overflow-hidden shrink-0 w-[220px] sm:w-auto group cursor-default"
      style={{
        background: "rgba(0,0,0,0.07)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "border-color 0.25s ease, background 0.25s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
        (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.13)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.07)";
      }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
        {creative.image_url && !imgError ? (
          <img
            src={creative.image_url}
            alt={creative.creative_name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <ImageOff size={24} className="text-white/15" strokeWidth={1.3} />
            <span className="text-white/20 text-[10px]">Sem thumbnail</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)",
          }}
        />

        {/* Ranking badge — top left */}
        <div
          className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0"
          style={{
            background: rankStyle.bg,
            color: rankStyle.text,
            border: `1px solid ${rankStyle.border}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            letterSpacing: "-0.01em",
          }}
        >
          {rankStyle.label}
        </div>

        {/* Status badge — top right */}
        <div
          className={cn(
            "absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold capitalize",
            creative.status === "ativa"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/25"
              : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
          )}
        >
          {creative.status}
        </div>

        {/* Leads badge — bottom right overlay */}
        {creative.leads > 0 && (
          <div
            className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-lg"
            style={{
              background: "rgba(34,197,94,0.18)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            <Users size={9} className="text-emerald-400" />
            <span className="text-emerald-300 text-[10px] font-bold tabular-nums">
              {fmtNum(creative.leads)}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Names */}
        <p
          className="text-white text-sm font-semibold leading-tight mb-0.5 truncate"
          title={creative.creative_name}
        >
          {creative.creative_name}
        </p>
        <p className="text-white/35 text-[11px] mb-3 truncate" title={creative.campaign_name}>
          {creative.campaign_name}
        </p>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mb-3" />

        {/* Metrics */}
        <div className="space-y-1.5">
          <MetricRow icon={Users}        label="Leads"       value={fmtNum(creative.leads)}        color="#22c55e" />
          <MetricRow icon={DollarSign}   label="CPL"         value={creative.leads > 0 ? fmtBRL(creative.cpl) : "—"} color="#f59e0b" />
          <MetricRow icon={TrendingUp}   label="Investimento" value={fmtBRL(creative.spend)}       color="#27a3ff" />
          <MetricRow icon={Eye}          label="Alcance"     value={fmtNum(creative.reach)}         color="#a78bfa" />
          <MetricRow icon={MousePointer} label="Cliques"     value={fmtNum(creative.clicks)}        color="#fb923c" />
          {creative.ctr > 0 && (
            <MetricRow icon={MousePointer} label="CTR"       value={fmtPct(creative.ctr)}           color="#38bdf8" />
          )}
          {creative.cpc > 0 && (
            <MetricRow icon={DollarSign}   label="CPC"       value={fmtBRL(creative.cpc)}           color="#6b7280" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCreatives() {
  return (
    <div
      className="rounded-3xl p-10 text-center"
      style={{
        background: "rgba(0,0,0,0.07)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <ImageOff size={28} className="text-white/15 mx-auto mb-3" strokeWidth={1.3} />
      <p className="text-white/30 text-sm">Nenhum criativo com dados no período.</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MelhoresCreativosProps {
  slug: string;
  since: string;
  until: string;
}

export function MelhoresCreativos({ slug, since, until }: MelhoresCreativosProps) {
  const [creatives, setCreatives] = useState<PortalCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ since, until });
    fetch(`/api/portal/${slug}/creatives?${params}`)
      .then(r => r.json())
      .then((json: { creatives: PortalCreative[] }) => {
        setCreatives(json.creatives ?? []);
      })
      .catch(() => {
        setCreatives([]);
      })
      .finally(() => setLoading(false));
  }, [slug, since, until]);

  return (
    <section>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-white font-semibold text-sm">Melhores Criativos</h3>
        <p className="text-white/35 text-xs mt-0.5">
          Criativos com maior volume de leads e melhor eficiência.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          /* Skeleton grid */
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Mobile: horizontal scroll */}
            <div className="sm:hidden flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
            {/* Desktop: grid */}
            <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
            </div>
          </motion.div>
        ) : creatives.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyCreatives />
          </motion.div>
        ) : (
          <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Mobile: horizontal carousel */}
            <div
              ref={scrollRef}
              className="sm:hidden flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {creatives.map((c, i) => (
                <div key={c.ad_id} className="snap-start">
                  <CreativeCard creative={c} index={i} />
                </div>
              ))}
            </div>

            {/* Desktop: grid up to 4 columns */}
            <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
              {creatives.map((c, i) => (
                <CreativeCard key={c.ad_id} creative={c} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
