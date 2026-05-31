"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, DollarSign, MousePointer, BarChart2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalCreative } from "@/types";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Ranking badge ─────────────────────────────────────────────────────────────

const RANK_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: "linear-gradient(135deg,#b8860b,#ffd700,#b8860b)", color: "#000" },
  2: { bg: "linear-gradient(135deg,#6b7280,#d1d5db,#6b7280)", color: "#000" },
  3: { bg: "linear-gradient(135deg,#92400e,#d97706,#92400e)", color: "#000" },
};

function getRankStyle(rank: number) {
  return RANK_STYLES[rank] ?? { bg: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" };
}

// ── Mini metric card ──────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}

function MetricCard({ icon: Icon, label, value, accent }: MetricCardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[14px] px-3 py-2.5"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={10} style={{ color: accent }} strokeWidth={1.8} />
        <span
          className="text-[9px] font-semibold tracking-widest uppercase"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-[13px] font-bold leading-none tabular-nums"
        style={{ color: "#fff" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Thumb */}
      <div className="aspect-[4/3] bg-white/[0.04] animate-pulse" />
      {/* Body */}
      <div className="p-3.5 space-y-3">
        <div className="h-3 bg-white/[0.06] rounded-full animate-pulse w-3/4" />
        <div className="h-2 bg-white/[0.04] rounded-full animate-pulse w-1/2" />
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-12 rounded-[14px] animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Creative card ─────────────────────────────────────────────────────────────

// Minimum width (px) to consider an image "high enough quality" for display.
// Meta thumbnail_url is typically 100-200px; real creative images are 1000px+.
const MIN_IMG_WIDTH = 280;

function CreativeCard({ creative, index }: { creative: PortalCreative; index: number }) {
  const [imgError, setImgError] = useState(false);
  const [imgTooSmall, setImgTooSmall] = useState(false);
  const rankStyle = getRankStyle(creative.ranking);

  const showImage = creative.image_url && !imgError && !imgTooSmall;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.32 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "border-color .22s, background .22s",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(255,255,255,0.14)";
        el.style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(255,255,255,0.08)";
        el.style.background = "rgba(255,255,255,0.03)";
      }}
    >
      {/* ── Thumbnail ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {showImage ? (
          <img
            src={creative.image_url!}
            alt={creative.creative_name}
            className="w-full h-full"
            style={{ objectFit: "cover", objectPosition: "center", display: "block" }}
            onError={() => setImgError(true)}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalWidth < MIN_IMG_WIDTH) {
                setImgTooSmall(true);
              }
            }}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-end px-3 pb-3"
            style={{
              background: "linear-gradient(145deg,rgba(20,20,28,1) 0%,rgba(14,14,22,1) 100%)",
            }}
          >
            <span
              className="text-[10px] font-medium tracking-widest uppercase"
              style={{ color: "rgba(255,255,255,0.18)" }}
            >
              Sem preview
            </span>
          </div>
        )}

        {/* Bottom gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.18) 45%,transparent 100%)",
          }}
        />

        {/* Ranking badge */}
        <div
          className="absolute top-2.5 left-2.5 text-[11px] font-black px-2 py-0.5 rounded-lg"
          style={{
            background: rankStyle.bg,
            color: rankStyle.color,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            letterSpacing: "-0.01em",
          }}
        >
          #{creative.ranking}
        </div>

        {/* Status badge */}
        <div
          className={cn(
            "absolute top-2.5 right-2.5 text-[9px] font-semibold capitalize px-2 py-0.5 rounded-lg",
            creative.status === "ativa"
              ? "text-emerald-300"
              : "text-amber-400"
          )}
          style={{
            background:
              creative.status === "ativa"
                ? "rgba(34,197,94,0.18)"
                : "rgba(245,158,11,0.15)",
            border:
              creative.status === "ativa"
                ? "1px solid rgba(34,197,94,0.25)"
                : "1px solid rgba(245,158,11,0.22)",
          }}
        >
          {creative.status}
        </div>

        {/* Leads pill bottom-right */}
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

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 p-3.5">
        {/* Name + campaign */}
        <div className="min-w-0">
          <p
            className="text-white text-[13px] font-semibold leading-snug truncate"
            title={creative.creative_name}
          >
            {creative.creative_name}
          </p>
          {creative.campaign_name !== creative.creative_name && (
            <p
              className="text-[11px] truncate mt-0.5"
              style={{ color: "rgba(255,255,255,0.32)" }}
              title={creative.campaign_name}
            >
              {creative.campaign_name}
            </p>
          )}
        </div>

        {/* 2×2 metric grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <MetricCard
            icon={DollarSign}
            label="Invest."
            value={fmtBRL(creative.spend)}
            accent="#27a3ff"
          />
          <MetricCard
            icon={Users}
            label="Leads"
            value={fmtNum(creative.leads)}
            accent="#22c55e"
          />
          <MetricCard
            icon={DollarSign}
            label="CPL"
            value={creative.leads > 0 ? fmtBRL(creative.cpl) : "—"}
            accent="#f59e0b"
          />
          <MetricCard
            icon={BarChart2}
            label="CTR"
            value={fmtPct(creative.ctr)}
            accent="#38bdf8"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCreatives() {
  return (
    <div
      className="rounded-2xl p-10 text-center"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <ImageOff size={22} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.12)" }} strokeWidth={1.3} />
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.28)" }}>
        Nenhum criativo com dados no período.
      </p>
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

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ since, until });
    fetch(`/api/portal/${slug}/creatives?${params}`)
      .then(r => r.json())
      .then((json: { creatives: PortalCreative[] }) => {
        setCreatives(json.creatives ?? []);
      })
      .catch(() => setCreatives([]))
      .finally(() => setLoading(false));
  }, [slug, since, until]);

  return (
    <section>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-white font-semibold text-sm">Melhores Criativos</h3>
        <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          Campanhas com maior volume de leads e melhor eficiência.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </motion.div>
        ) : creatives.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyCreatives />
          </motion.div>
        ) : (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {creatives.map((c, i) => (
              <CreativeCard key={c.ad_id} creative={c} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
