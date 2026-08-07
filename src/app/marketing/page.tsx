"use client";

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { endOfDay, format, isBefore, startOfDay, subDays } from "date-fns";
import {
  Activity, AlertTriangle, ArrowUpRight, CalendarDays, Clock3,
  Eye, Heart, Layers3, Send, Users,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useMarketing } from "@/context/MarketingContext";
import { MarketingEmptyState, MarketingSkeleton, ContentStatusBadge } from "@/components/marketing/MarketingUI";
import { MarketingContentDialog } from "@/components/marketing/MarketingContentDialog";
import { InstagramGlyph } from "@/components/marketing/InstagramReports";
import { useInstagramMarketing } from "@/hooks/useInstagramMarketing";
import { instagramReport } from "@/lib/marketing/instagram-report";
import {
  FORMAT_LABELS, PLATFORM_LABELS, type MarketingContent,
} from "@/types/marketing";
import { Button } from "@/components/ui/button";

const number = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
export default function MarketingDashboardPage() {
  const marketing = useMarketing();
  const today = new Date();
  const [contentOpen, setContentOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<MarketingContent | null>(null);
  const rangeStart = startOfDay(subDays(today, 29));
  const rangeEnd = endOfDay(today);
  const start = format(rangeStart, "yyyy-MM-dd");
  const end = format(rangeEnd, "yyyy-MM-dd");
  const compareEnd = format(subDays(rangeStart, 1), "yyyy-MM-dd");
  const compareStart = format(subDays(rangeStart, 30), "yyyy-MM-dd");
  const instagram = useInstagramMarketing(start, end, compareStart, compareEnd);
  const report = useMemo(
    () => instagramReport(instagram.media, instagram.accountTotals, instagram.dailyInsights),
    [instagram.accountTotals, instagram.dailyInsights, instagram.media],
  );

  const periodContents = useMemo(() => marketing.contents.filter((item) => {
    if (!item.scheduled_at) return false;
    const date = new Date(item.scheduled_at);
    return date >= rangeStart && date <= rangeEnd;
  }), [marketing.contents, rangeEnd, rangeStart]);
  const overdue = periodContents.filter((item) => item.scheduled_at && isBefore(new Date(item.scheduled_at), today) && item.status !== "published" && item.status !== "cancelled");
  const published = periodContents.filter((item) => item.status === "published").length;
  const inProduction = periodContents.filter((item) => ["in_production", "in_review", "approved"].includes(item.status)).length;
  const followers = instagram.connections.reduce((sum, item) => sum + Number(item.followers_count || 0), 0);
  const engagement = followers ? (report.averageInteractions / followers) * 100 : 0;
  const upcoming = [...periodContents]
    .filter((item) => item.status !== "published" && item.status !== "cancelled")
    .sort((a, b) => Number(overdue.includes(b)) - Number(overdue.includes(a)) || new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 6);

  const openContent = (content: MarketingContent | null) => {
    setSelectedContent(content);
    setContentOpen(true);
  };

  const loading = marketing.isLoading || instagram.isLoading;

  return (
    <div className="pb-10">
      <Header
        title="Marketing"
        subtitle="Operação editorial e performance digital dos últimos 30 dias"
        actions={<Button onClick={() => openContent(null)} icon={<CalendarDays size={15} />} signature size="medium">Criar conteúdo</Button>}
      />

      <div className="px-4 sm:px-6">
        {loading ? <MarketingSkeleton /> : marketing.error ? (
          <MarketingEmptyState title="Não foi possível carregar" description={marketing.error} action={<button onClick={() => void marketing.refetch()} className="lc-btn px-4 py-2 text-sm">Tentar novamente</button>} />
        ) : (
          <>
            <section className="relative mb-4 overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "var(--glass-bg-soft)" }}>
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 via-pink-500/15 to-orange-500/10 blur-3xl" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {instagram.connections[0]?.profile_picture_url ? <img src={instagram.connections[0].profile_picture_url} alt="Perfil do Instagram" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-600 via-pink-500 to-orange-400 text-white"><InstagramGlyph size={22} /></span>}
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-pink-500">Instagram conectado</p>
                    <h2 className="truncate text-lg font-semibold">{instagram.connections[0] ? `@${instagram.connections[0].username}` : "Conecte sua conta profissional"}</h2>
                    <p className="text-xs text-[var(--muted-foreground)]">{instagram.connections.length ? `${number.format(followers)} seguidores · ${instagram.media.length} conteúdos no período` : "Acompanhe alcance, audiência e melhores conteúdos"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[430px]">
                  <HeroMetric label="Alcance" value={number.format(report.totals.reach)} />
                  <HeroMetric label="Visualizações" value={number.format(report.totals.views)} />
                  <HeroMetric label="Interações" value={number.format(report.totals.interactions)} />
                </div>
                <Link href="/marketing/relatorios" className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-[var(--hover)]">Abrir Instagram <ArrowUpRight size={14} /></Link>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <MetricCard icon={Layers3} label="Conteúdos planejados" value={periodContents.length} hint={`${inProduction} em produção`} accent="#27a3ff" />
              <MetricCard icon={Send} label="Publicados" value={published} hint="Operação editorial" accent="#22c55e" />
              <MetricCard icon={AlertTriangle} label="Atrasados" value={overdue.length} hint={overdue.length ? "Requer atenção" : "Operação em dia"} accent={overdue.length ? "#ef4444" : "#64748b"} />
              <MetricCard icon={Users} label="Contas engajadas" value={report.totals.accountsEngaged} hint="Instagram" accent="#a855f7" />
              <MetricCard icon={Eye} label="Visitas ao perfil" value={report.totals.profileViews} hint="Instagram" accent="#f97316" />
              <MetricCard icon={Heart} label="Engajamento por post" value={`${engagement.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} hint={`${number.format(report.averageInteractions)} interações/post`} accent="#ec4899" raw />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <DashboardCard title="Próximos conteúdos" description="Atrasos e entregas mais próximas primeiro" action={<button onClick={() => openContent(null)} className="text-xs font-medium text-[var(--primary)]">Criar conteúdo</button>}>
                {upcoming.length ? <div className="divide-y divide-[var(--border)]">
                  {upcoming.map((item) => {
                    const member = marketing.members.find((profile) => profile.id === item.primary_assignee_id);
                    return <button key={item.id} onClick={() => openContent(item)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 py-3 text-left sm:grid-cols-[1fr_105px_110px_auto]"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="text-[10px] text-[var(--muted-foreground)]">{PLATFORM_LABELS[item.platform]} · {FORMAT_LABELS[item.format]}</p></div><span className="hidden text-xs sm:block"><Clock3 size={11} className="mr-1 inline" />{format(new Date(item.scheduled_at!), "dd/MM HH:mm")}</span><span className="hidden truncate text-xs sm:block">{member?.full_name ?? "Sem responsável"}</span><ContentStatusBadge status={item.status} /></button>;
                  })}
                </div> : <CompactEmpty text="Nenhum conteúdo pendente neste período." />}
              </DashboardCard>

              <DashboardCard title="Melhores conteúdos" description="Posts do Instagram com mais interações" action={<Link href="/marketing/relatorios" className="text-xs font-medium text-[var(--primary)]">Ver todos</Link>}>
                {report.best.length ? <div className="grid grid-cols-3 gap-2">
                  {report.best.slice(0, 3).map((item) => <a key={item.id} href={item.permalink ?? undefined} target={item.permalink ? "_blank" : undefined} rel="noreferrer" className="group min-w-0 overflow-hidden rounded-xl border bg-[var(--bg-modal)]"><div className="aspect-square overflow-hidden bg-[var(--hover)]">{item.thumbnail_url || item.media_url ? <img src={item.thumbnail_url || item.media_url || ""} alt="Conteúdo do Instagram" className="h-full w-full object-cover transition group-hover:scale-105" /> : <span className="grid h-full place-items-center"><InstagramGlyph size={20} className="text-[var(--muted-foreground)]" /></span>}</div><div className="p-2"><p className="text-xs font-semibold">{number.format(item.total_interactions)} interações</p><p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{number.format(Math.max(item.views, item.plays))} views</p></div></a>)}
                </div> : <CompactEmpty text="Os melhores posts aparecerão após a sincronização." />}
              </DashboardCard>
            </div>
          </>
        )}
      </div>

      <MarketingContentDialog open={contentOpen} onOpenChange={(open) => { setContentOpen(open); if (!open) setSelectedContent(null); }} content={selectedContent} />
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border px-3 py-2.5 text-center backdrop-blur"><p className="text-lg font-semibold">{value}</p><p className="text-[9px] text-[var(--muted-foreground)] sm:text-[10px]">{label}</p></div>;
}

function MetricCard({ icon: Icon, label, value, hint, accent, raw = false }: { icon: ComponentType<{ size?: string | number; style?: React.CSSProperties }>; label: string; value: number | string; hint: string; accent: string; raw?: boolean }) {
  return <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}><span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} /><Icon size={15} style={{ color: accent }} /><p className="mt-3 text-xl font-semibold">{raw ? value : number.format(Number(value))}</p><p className="mt-1 text-xs">{label}</p><p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{hint}</p></div>;
}

function DashboardCard({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border p-4 sm:p-5" style={{ background: "var(--glass-bg-soft)" }}><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{title}</h2><p className="text-xs text-[var(--muted-foreground)]">{description}</p></div>{action}</div>{children}</section>;
}

function CompactEmpty({ text }: { text: string }) {
  return <div className="grid min-h-40 place-items-center rounded-xl border border-dashed px-6 text-center text-xs text-[var(--muted-foreground)]"><div><Activity size={20} className="mx-auto mb-2 opacity-60" />{text}</div></div>;
}
