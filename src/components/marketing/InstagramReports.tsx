"use client";

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, Bookmark, ExternalLink, Eye, Heart, Loader2, MessageCircle,
  Info, MousePointerClick, Plus, RefreshCw, TrendingDown, TrendingUp, Unplug, UserCheck, UserRound, Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useInstagramMarketing } from "@/hooks/useInstagramMarketing";
import { instagramReport } from "@/lib/marketing/instagram-report";
import type { MarketingInstagramMedia } from "@/types/marketing";
import { KpiReadingGuide, type KpiGuidanceItem } from "@/components/insights/KpiReadingGuide";

const formatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const axisTick = { fill: "var(--text-body)", fontSize: 11 };
const tooltipStyle = {
  background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 12,
  color: "var(--chart-tooltip-text)", boxShadow: "0 14px 38px rgba(0,0,0,.24)",
};
const RIVAL_IQ_BENCHMARK = "https://www.rivaliq.com/blog/good-engagement-rate-instagram/";
const BUFFER_BENCHMARK = "https://buffer.com/insights/instagram-benchmarks";

export function InstagramGlyph({ size = 18, className, style }: { size?: string | number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InstagramSendGlyph({ size = 18, className, style }: { size?: string | number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M22 2 9.7 14.3" />
      <path d="m22 2-7.8 20-4.5-7.7L2 9.8 22 2Z" />
    </svg>
  );
}

export function InstagramReports({ start, end, compareStart, compareEnd }: { start: string; end: string; compareStart: string; compareEnd: string }) {
  const instagram = useInstagramMarketing(start, end, compareStart, compareEnd);
  const report = useMemo(() => instagramReport(instagram.media, instagram.accountTotals, instagram.dailyInsights), [instagram.accountTotals, instagram.dailyInsights, instagram.media]);
  const previousReport = useMemo(() => instagramReport(instagram.previousMedia, instagram.previousAccountTotals), [instagram.previousAccountTotals, instagram.previousMedia]);
  const followers = instagram.connections.reduce((sum, connection) => sum + Number(connection.followers_count || 0), 0);
  const [audienceMode, setAudienceMode] = useState<"interactions" | "followers">("interactions");
  const engagementPerPost = followers ? (report.averageInteractions / followers) * 100 : 0;
  const previousEngagementPerPost = followers ? (previousReport.averageInteractions / followers) * 100 : 0;
  const followerAnalysis = useMemo(() => {
    const data = report.daily.map((item) => ({ date: item.date, followers: Number(item.followers || 0) }));
    if (!data.some((item) => item.followers !== 0)) return { data: [] as Array<{ date: string; followers: number }>, gain: 0, rate: 0 };
    const gain = data.reduce((sum, item) => sum + item.followers, 0);
    return { data, gain, rate: followers ? (gain / Math.max(1, followers - gain)) * 100 : 0 };
  }, [followers, report.daily]);
  const followerPeriodLabel = followerAnalysis.gain > 0
    ? `+${formatter.format(followerAnalysis.gain)} no período`
    : followerAnalysis.gain < 0 ? `${formatter.format(followerAnalysis.gain)} no período` : "Sem variação líquida no período";
  const periodDays = Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000) + 1);
  const expectedPosts = Math.max(1, Math.round((17 * periodDays) / 30));
  const reachChange = previousReport.totals.reach > 0
    ? ((report.totals.reach - previousReport.totals.reach) / previousReport.totals.reach) * 100
    : null;
  const instagramGuidance: KpiGuidanceItem[] = [
    {
      id: "engagement",
      status: engagementPerPost >= 1.02 ? "good" : engagementPerPost >= 0.6 ? "attention" : "critical",
      title: "Engajamento por post",
      signal: `${engagementPerPost.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% no período, frente à referência de 1,02%.`,
      diagnosis: "Qualidade do gancho, relevância do tema, formato, salvamentos e compartilhamentos dos melhores posts.",
      action: engagementPerPost >= 1.02
        ? "Repita temas e formatos dos conteúdos líderes sem abandonar testes de novas abordagens."
        : "Compare os três melhores e os três piores posts e teste um novo gancho ou formato por vez.",
    },
    {
      id: "reach",
      status: reachChange === null ? "info" : reachChange >= 0 ? "good" : reachChange > -15 ? "attention" : "critical",
      title: "Alcance versus período anterior",
      signal: reachChange === null
        ? "Ainda não há base anterior suficiente para comparar o alcance."
        : `${reachChange >= 0 ? "+" : ""}${reachChange.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de variação no alcance.`,
      diagnosis: "Frequência, distribuição por formato e alcance individual das publicações do período.",
      action: reachChange === null
        ? "Use este período como linha de base e mantenha a cadência para formar comparação."
        : reachChange >= 0 ? "Mantenha a cadência e identifique quais formatos puxaram o crescimento." : "Localize quando a queda começou e compare frequência, formatos e temas com o período anterior.",
    },
    {
      id: "followers",
      status: followerAnalysis.rate >= 0.5 ? "good" : followerAnalysis.rate >= 0 ? "attention" : "critical",
      title: "Crescimento de seguidores",
      signal: `${followerAnalysis.rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de crescimento líquido no período; referência mensal de 0,5%.`,
      diagnosis: "Conversão de alcance em visita ao perfil, clareza da bio e conteúdos que atraem pessoas novas.",
      action: followerAnalysis.rate >= 0.5
        ? "Continue promovendo os conteúdos que mais geram descoberta e visitas ao perfil."
        : "Reforce a promessa da bio e inclua chamadas claras para seguir nos conteúdos de maior alcance.",
    },
    {
      id: "cadence",
      status: instagram.media.length >= expectedPosts ? "good" : instagram.media.length >= expectedPosts * 0.7 ? "attention" : "critical",
      title: "Cadência de publicação",
      signal: `${instagram.media.length} conteúdo${instagram.media.length === 1 ? "" : "s"} publicado${instagram.media.length === 1 ? "" : "s"}; referência proporcional de cerca de ${expectedPosts} para ${periodDays} dias.`,
      diagnosis: "Calendário editorial, capacidade de produção e consistência entre os dias da semana.",
      action: instagram.media.length >= expectedPosts
        ? "Sustente o ritmo e priorize qualidade para não transformar volume em queda de engajamento."
        : "Feche as lacunas do calendário com formatos replicáveis e um ritmo que a equipe consiga sustentar.",
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("instagram_connected") === "1") toast.success("Instagram conectado. Iniciando a primeira sincronização.");
    if (params.get("instagram_error")) toast.error("Não foi possível conectar o Instagram. Tente novamente.");
  }, []);

  if (instagram.isLoading) return <LoadingState />;

  if (!instagram.connections.length) {
    return (
      <section className="overflow-hidden rounded-3xl border" style={{ background: "var(--glass-bg-soft)" }}>
        <div className="relative grid min-h-[430px] place-items-center px-6 py-14 text-center">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#a855f7]/20 via-[#ec4899]/14 to-[#f97316]/18 blur-3xl" />
          <div className="relative max-w-lg">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#7c3aed] via-[#db2777] to-[#f97316] text-white shadow-xl shadow-pink-500/20">
              <InstagramGlyph size={31} />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-title)]">Conecte seu Instagram profissional</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Importe publicações e acompanhe alcance, visualizações, interações e os conteúdos com melhor resultado diretamente no Marketing.
            </p>
            {instagram.isAdmin ? (
              <button onClick={instagram.connect} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 transition hover:brightness-110">
                <InstagramGlyph size={17} /> Conectar Instagram
              </button>
            ) : (
              <p className="mt-6 rounded-xl border px-4 py-3 text-sm text-[var(--muted-foreground)]">Peça a um administrador para conectar a conta.</p>
            )}
            <p className="mt-4 text-xs text-[var(--muted-foreground)]">Disponível para contas Business e Creator.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      {instagram.error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertCircle size={16} /> {instagram.error}
        </div>
      )}

      {instagram.isRefreshing && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-[var(--primary)]">
          <Loader2 size={14} className="animate-spin" /> Atualizando métricas do período…
        </div>
      )}

      <div key={`${start}-${end}-${instagram.isRefreshing}`} className={instagram.isRefreshing ? "pointer-events-none opacity-45 transition-opacity" : "instagram-report-enter"}>

      <div className="mb-5 flex flex-wrap items-stretch gap-3">
        {instagram.connections.map((connection, index) => {
          const isSyncing = instagram.syncing[connection.id];
          return (
            <div key={connection.id} className="relative flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-3 sm:min-w-[360px] sm:flex-1 sm:p-4" style={{ background: "var(--glass-bg-soft)" }}>
              <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#7c3aed] via-[#db2777] to-[#f97316]" />
              <Avatar src={connection.profile_picture_url} username={connection.username} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">@{connection.username}</p>
                  <span className={`h-2 w-2 rounded-full ${connection.status === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
                </div>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {isSyncing ? "Atualizando dados…" : connection.last_sync_at
                    ? `Atualizado ${formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: ptBR })}`
                    : "Aguardando primeira sincronização"}
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--text-title)]">{formatter.format(Number(connection.followers_count))} seguidores · {formatter.format(Number(connection.media_count))} publicações</p>
                {connection.sync_error && !isSyncing && <p className="mt-1 truncate text-xs text-amber-500" title={connection.sync_error}>{connection.sync_error}</p>}
              </div>
              {instagram.isAdmin && (
                <div className="flex gap-1.5">
                  {index === 0 && <button onClick={instagram.connect} title="Adicionar outra conta" aria-label="Adicionar outra conta" className="grid h-9 w-9 place-items-center rounded-lg border text-[var(--muted-foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--hover)] hover:text-[var(--primary)]"><Plus size={16} /></button>}
                  <button onClick={async () => {
                    const result = await instagram.sync(connection.id);
                    result.error ? toast.error(result.error) : toast.success("Instagram atualizado");
                  }} disabled={isSyncing} title="Sincronizar agora" className="grid h-9 w-9 place-items-center rounded-lg border text-[var(--muted-foreground)] transition hover:bg-[var(--hover)] hover:text-[var(--text-title)] disabled:opacity-50">
                    {isSyncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  </button>
                  <button onClick={async () => {
                    if (!window.confirm(`Desconectar @${connection.username}? Os relatórios importados desta conta serão removidos.`)) return;
                    const result = await instagram.disconnect(connection.id);
                    result.error ? toast.error(result.error) : toast.success("Instagram desconectado");
                  }} title="Desconectar" className="grid h-9 w-9 place-items-center rounded-lg border text-[var(--muted-foreground)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500">
                    <Unplug size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Eye} label="Alcance" value={report.totals.reach} previous={previousReport.totals.reach} accent="#27a3ff" />
        <Metric icon={Eye} label="Visualizações" value={report.totals.views} previous={previousReport.totals.views} accent="#06b6d4" />
        <Metric icon={UserCheck} label="Contas engajadas" value={report.totals.accountsEngaged} previous={previousReport.totals.accountsEngaged} accent="#a855f7" />
        <Metric icon={Heart} label="Interações" value={report.totals.interactions} previous={previousReport.totals.interactions} accent="#ec4899" />
        <Metric icon={Users} label="Visitas ao perfil" value={report.totals.profileViews} previous={previousReport.totals.profileViews} accent="#f97316" />
        <Metric
          icon={InstagramGlyph}
          label="Engajamento por post"
          value={`${engagementPerPost.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
          previous={previousEngagementPerPost}
          currentNumeric={engagementPerPost}
          accent="#22c55e"
          benchmark="Ideal ≥ 1,02%"
          benchmarkUrl={RIVAL_IQ_BENCHMARK}
          raw
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Insight label="Seguidores atuais" value={formatter.format(followers)} hint={followerPeriodLabel} benchmark="Ideal ≥ 0,5%/mês" benchmarkUrl={BUFFER_BENCHMARK} />
        <Insight label="Conteúdos publicados" value={String(instagram.media.length)} hint="No período selecionado" benchmark="Ideal ≈ 17/mês" benchmarkUrl={BUFFER_BENCHMARK} />
        <Insight label="Média por conteúdo" value={formatter.format(report.averageInteractions)} hint="Interações por publicação" />
        <Insight label="Conversão do perfil" value={`${report.profileConversionRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} hint="Visitas ao perfil ÷ alcance" />
      </div>

      <KpiReadingGuide
        className="mt-5"
        title="Guia de leitura do Instagram"
        description="Cruza evolução, benchmarks e cadência para mostrar o que está saudável, onde investigar e o que fazer em seguida."
        items={instagramGuidance}
      />

      {instagram.metricsSource === "content_fallback" && (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> A Meta ainda não devolveu os insights completos da conta para este período. Os números exibidos são uma consolidação temporária dos conteúdos sincronizados.
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Evolução da audiência"
          description={audienceMode === "interactions" ? "Visualizações da conta e interações dos conteúdos por dia" : "Saldo líquido diário: novos seguidores menos unfollows"}
          actions={<div className="inline-flex rounded-lg bg-[var(--hover)] p-1">
            <button onClick={() => setAudienceMode("interactions")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition ${audienceMode === "interactions" ? "bg-[var(--bg-modal)] text-[var(--text-title)] shadow-sm" : "text-[var(--muted-foreground)]"}`}>Interações</button>
            <button onClick={() => setAudienceMode("followers")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition ${audienceMode === "followers" ? "bg-[var(--bg-modal)] text-[var(--text-title)] shadow-sm" : "text-[var(--muted-foreground)]"}`}>Seguidores</button>
          </div>}
        >
          {(audienceMode === "interactions" ? report.daily.length : followerAnalysis.data.length) ? <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={audienceMode === "interactions" ? report.daily : followerAnalysis.data} margin={{ top: 14, right: 8, left: -18, bottom: 4 }}>
              <defs>
                <linearGradient id="instagram-reach" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.48} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} /></linearGradient>
                <linearGradient id="instagram-followers" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" vertical={false} />
              <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
              {audienceMode === "interactions" ? <>
                <YAxis yAxisId="reach" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(value) => formatter.format(value)} />
                <YAxis yAxisId="detail" orientation="right" tick={{ ...axisTick, fill: "#ec4899" }} tickLine={false} axisLine={false} allowDecimals={false} />
              </> : <YAxis yAxisId="detail" tick={{ ...axisTick, fill: "#22c55e" }} tickLine={false} axisLine={false} allowDecimals={false} />}
              <Tooltip contentStyle={tooltipStyle} />
              {audienceMode === "interactions" ? <>
                <Area yAxisId="reach" type="monotone" dataKey="views" name="Visualizações" stroke="#a855f7" strokeWidth={3} fill="url(#instagram-reach)" />
                <Area yAxisId="detail" type="monotone" dataKey="interactions" name="Interações" stroke="#ec4899" strokeWidth={2.5} fill="transparent" dot={{ r: 3, fill: "#ec4899" }} />
              </> : <Area yAxisId="detail" type="monotone" dataKey="followers" name="Novos seguidores" stroke="#22c55e" strokeWidth={3} fill="url(#instagram-followers)" dot={{ r: 3, fill: "#22c55e" }} />}
            </AreaChart>
          </ResponsiveContainer> : <ChartEmpty message={audienceMode === "followers" ? "O histórico de ganho de seguidores começa a ser formado após a conexão e as sincronizações diárias." : undefined} />}
        </ChartCard>
        <ChartCard title="Ações da audiência" description="Como as pessoas interagiram com o perfil e os conteúdos">
          <div className="grid grid-cols-2 gap-3 pt-2">
            <ActionMetric icon={Heart} label="Curtidas" value={report.totals.likes} />
            <ActionMetric icon={MessageCircle} label="Comentários" value={report.totals.comments} />
            <ActionMetric icon={Bookmark} label="Salvamentos" value={report.totals.saved} />
            <ActionMetric icon={InstagramSendGlyph} label="Compartilhamentos" value={report.totals.shares} />
            <ActionMetric icon={MousePointerClick} label="Cliques no perfil" value={report.totals.profileLinksTaps} wide />
          </div>
        </ChartCard>
      </div>

      {!instagram.media.length ? (
        <div className="mt-5 rounded-2xl border p-10 text-center" style={{ background: "var(--glass-bg-soft)" }}>
          <InstagramGlyph className="mx-auto text-[var(--muted-foreground)]" size={28} />
          <p className="mt-3 text-sm font-medium">Nenhuma publicação encontrada neste período</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Altere o período ou sincronize a conta novamente.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
            <ChartCard title="Mix de formatos" description="Volume publicado e alcance acumulado por categoria">
              <div className="space-y-3 pt-2">
                {report.formats.map((formatItem, index) => <FormatRow key={formatItem.name} {...formatItem} index={index} />)}
              </div>
            </ChartCard>
            <ChartCard title="Desempenho dos conteúdos" description="Métricas somadas apenas para avaliar as publicações do período">
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <ActionMetric icon={UserRound} label="Alcance dos posts" value={report.contentTotals.reach} />
                <ActionMetric icon={Eye} label="Views dos posts" value={report.contentTotals.views} />
                <ActionMetric icon={Heart} label="Interações" value={report.contentTotals.interactions} />
                <ActionMetric icon={InstagramSendGlyph} label="Compartilhamentos" value={report.contentTotals.shares} />
              </div>
            </ChartCard>
          </div>

          <section className="mt-5 rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Melhores conteúdos</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Ordenados pelo total de interações</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.best.map((item) => <MediaCard key={item.id} item={item} />)}
            </div>
          </section>
        </>
      )}
      </div>
      <style>{`@keyframes instagram-report-enter{from{opacity:.25;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}.instagram-report-enter{animation:instagram-report-enter .38s cubic-bezier(.2,.8,.2,1) both}`}</style>
    </div>
  );
}

function Avatar({ src, username }: { src: string | null; username: string }) {
  return src ? <img src={src} alt={`Perfil de ${username}`} className="h-11 w-11 rounded-full object-cover" /> : (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#7c3aed] via-[#db2777] to-[#f97316] text-sm font-bold text-white">{username.slice(0, 1).toUpperCase()}</div>
  );
}

function Metric({ icon: Icon, label, value, previous = 0, currentNumeric, accent, benchmark, benchmarkUrl, raw = false }: { icon: ComponentType<{ size?: string | number; style?: CSSProperties }>; label: string; value: number | string; previous?: number; currentNumeric?: number; accent: string; benchmark?: string; benchmarkUrl?: string; raw?: boolean }) {
  const current = currentNumeric ?? Number(value);
  const change = previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-center justify-between"><Icon size={15} style={{ color: accent }} />{benchmark ? <BenchmarkTag label={benchmark} href={benchmarkUrl} corner /> : change !== null && <ChangeTag value={change} />}</div>
      <p className="relative mt-3 text-xl font-semibold">{raw ? value : formatter.format(Number(value))}</p>
      <p className="relative mt-1 text-xs text-[var(--muted-foreground)]">{label}</p>
      {benchmark && change !== null && <div className="mt-1"><ChangeTag value={change} /></div>}
    </div>
  );
}

function Insight({ label, value, hint, benchmark, benchmarkUrl }: { label: string; value: string; hint: string; benchmark?: string; benchmarkUrl?: string }) {
  return <div className="relative rounded-xl border px-4 py-3" style={{ background: "var(--glass-bg-soft)" }}>{benchmark && <BenchmarkTag label={benchmark} href={benchmarkUrl} corner />}<p className={benchmark ? "pr-24 text-lg font-semibold" : "text-lg font-semibold"}>{value}</p><p className="text-xs font-medium">{label}</p><p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{hint}</p></div>;
}

function ActionMetric({ icon: Icon, label, value, wide = false }: { icon: ComponentType<{ size?: string | number; className?: string }>; label: string; value: number; wide?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-3 ${wide ? "col-span-2" : ""}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-500/10 text-pink-500"><Icon size={15} /></span><div className="min-w-0"><p className="text-base font-semibold">{formatter.format(value)}</p><p className="truncate text-[11px] text-[var(--muted-foreground)]">{label}</p></div></div>;
}

function ChangeTag({ value }: { value: number }) {
  return <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${value >= 0 ? "text-emerald-500" : "text-red-500"}`}>{value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>;
}

function BenchmarkTag({ label, href, corner = false }: { label: string; href?: string; corner?: boolean }) {
  const content = <><Info size={10} /> {label}</>;
  const className = `${corner ? "absolute right-3 top-3 " : "mt-2 "}inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-300`;
  return href ? <a href={href} target="_blank" rel="noreferrer" className={className} title="Abrir fonte do benchmark">{content}</a> : <span className={className}>{content}</span>;
}

function ChartEmpty({ message = "A evolução diária aparecerá após a próxima sincronização." }: { message?: string }) {
  return <div className="grid h-[260px] place-items-center px-6 text-center text-xs leading-5 text-[var(--muted-foreground)]">{message}</div>;
}

function MediaCard({ item }: { item: MarketingInstagramMedia }) {
  const image = item.thumbnail_url || item.media_url;
  const format = item.media_product_type === "REELS" ? "Reel" : item.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : item.media_type === "VIDEO" ? "Vídeo" : "Imagem";
  return (
    <article className="group overflow-hidden rounded-xl border bg-[var(--bg-modal)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-orange-500/15">
        {image ? <img src={image} alt="Miniatura da publicação" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <InstagramGlyph className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />}
        <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">{format}</span>
        {item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/65 text-white backdrop-blur transition hover:bg-black/80" title="Abrir no Instagram"><ExternalLink size={14} /></a>}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 min-h-9 text-[11px] leading-[18px] text-[var(--text-body)]">{item.caption || "Publicação sem legenda"}</p>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-2 text-[10px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1" title="Visualizações"><Eye size={12} /> {formatter.format(Math.max(Number(item.views), Number(item.plays)))}</span>
          <span className="flex items-center gap-1"><Heart size={12} /> {formatter.format(Number(item.likes))}</span>
          <span className="flex items-center gap-1"><MessageCircle size={12} /> {formatter.format(Number(item.comments))}</span>
          <span className="ml-auto font-semibold text-[var(--text-title)]">{formatter.format(Number(item.total_interactions))} interações</span>
        </div>
      </div>
    </article>
  );
}

function FormatRow({ name, publications, reach, index }: { name: string; publications: number; reach: number; index: number }) {
  const colors = ["#27a3ff", "#a855f7", "#ec4899"];
  return <div className="rounded-xl border p-3"><div className="flex items-center gap-3"><span className="h-9 w-1 rounded-full" style={{ background: colors[index] }} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{name}</p><p className="text-[10px] text-[var(--muted-foreground)]">{publications} {publications === 1 ? "publicação" : "publicações"}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatter.format(reach)}</p><p className="text-[10px] text-[var(--muted-foreground)]">pessoas alcançadas</p></div></div></div>;
}

function ChartCard({ title, description, actions, children }: { title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <section className="relative overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ background: "var(--glass-bg-soft)" }}><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-semibold">{title}</h2><p className="text-xs text-[var(--muted-foreground)]">{description}</p></div>{actions}</div>{children}</section>;
}

function LoadingState() {
  return <div className="grid min-h-[360px] place-items-center rounded-2xl border" style={{ background: "var(--glass-bg-soft)" }}><div className="text-center"><Loader2 className="mx-auto animate-spin text-pink-500" /><p className="mt-3 text-sm text-[var(--muted-foreground)]">Carregando Instagram…</p></div></div>;
}
