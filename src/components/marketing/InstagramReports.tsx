"use client";

import { useEffect, useMemo, type ComponentType, type CSSProperties } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, Bookmark, ExternalLink, Eye, Heart, Loader2, MessageCircle,
  Plus, RefreshCw, Share2, Unplug, Users,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useInstagramMarketing } from "@/hooks/useInstagramMarketing";
import { instagramReport } from "@/lib/marketing/instagram-report";
import type { MarketingInstagramMedia } from "@/types/marketing";

const formatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const axisTick = { fill: "var(--text-body)", fontSize: 11 };
const tooltipStyle = {
  background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 12,
  color: "var(--chart-tooltip-text)", boxShadow: "0 14px 38px rgba(0,0,0,.24)",
};

export function InstagramGlyph({ size = 18, className, style }: { size?: string | number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InstagramReports({ start, end }: { start: string; end: string }) {
  const instagram = useInstagramMarketing(start, end);
  const report = useMemo(() => instagramReport(instagram.media), [instagram.media]);
  const followers = instagram.connections.reduce((sum, connection) => sum + Number(connection.followers_count || 0), 0);

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

      <div className="mb-5 flex flex-wrap items-stretch gap-3">
        {instagram.connections.map((connection) => {
          const isSyncing = instagram.syncing[connection.id];
          return (
            <div key={connection.id} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-3 sm:min-w-[360px]" style={{ background: "var(--glass-bg-soft)" }}>
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
                {connection.sync_error && !isSyncing && <p className="mt-1 truncate text-xs text-amber-500" title={connection.sync_error}>{connection.sync_error}</p>}
              </div>
              {instagram.isAdmin && (
                <div className="flex gap-1.5">
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
        {instagram.isAdmin && (
          <button onClick={instagram.connect} className="flex min-h-[68px] items-center gap-2 rounded-2xl border border-dashed px-4 text-sm font-medium text-[var(--muted-foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">
            <Plus size={16} /> Outra conta
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric icon={Users} label="Seguidores" value={followers} accent="#a855f7" />
        <Metric icon={Eye} label="Alcance" value={report.totals.reach} accent="#27a3ff" />
        <Metric icon={Eye} label="Visualizações" value={report.totals.views} accent="#06b6d4" />
        <Metric icon={Heart} label="Interações" value={report.totals.interactions} accent="#ec4899" />
        <Metric icon={Share2} label="Compartilhamentos" value={report.totals.shares} accent="#f97316" />
        <Metric icon={InstagramGlyph} label="Engajamento" value={`${report.engagementRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} accent="#22c55e" raw />
      </div>

      {!instagram.media.length ? (
        <div className="mt-5 rounded-2xl border p-10 text-center" style={{ background: "var(--glass-bg-soft)" }}>
          <InstagramGlyph className="mx-auto text-[var(--muted-foreground)]" size={28} />
          <p className="mt-3 text-sm font-medium">Nenhuma publicação encontrada neste período</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Altere o período ou sincronize a conta novamente.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
            <ChartCard title="Resultado das publicações" description="Alcance e interações agrupados pela data de publicação">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={report.daily} margin={{ top: 14, right: 8, left: -14, bottom: 4 }}>
                  <defs>
                    <linearGradient id="instagram-reach" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.48} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(value) => formatter.format(value)} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="reach" name="Alcance" stroke="#a855f7" strokeWidth={3} fill="url(#instagram-reach)" />
                  <Area type="monotone" dataKey="interactions" name="Interações" stroke="#ec4899" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Mix de formatos" description="Publicações no período selecionado">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.formats} layout="vertical" margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--hover)" }} />
                  <Bar dataKey="value" name="Publicações" fill="#ec4899" radius={[3, 8, 8, 3]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <section className="mt-5 rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Melhores conteúdos</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Ordenados pelo total de interações</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {report.best.map((item) => <MediaCard key={item.id} item={item} />)}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SmallMetric icon={Heart} label="Curtidas" value={report.totals.likes} />
            <SmallMetric icon={MessageCircle} label="Comentários" value={report.totals.comments} />
            <SmallMetric icon={Bookmark} label="Salvamentos" value={report.totals.saved} />
            <SmallMetric icon={Share2} label="Compartilhamentos" value={report.totals.shares} />
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ src, username }: { src: string | null; username: string }) {
  return src ? <img src={src} alt={`Perfil de ${username}`} className="h-11 w-11 rounded-xl object-cover" /> : (
    <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#7c3aed] via-[#db2777] to-[#f97316] text-sm font-bold text-white">{username.slice(0, 1).toUpperCase()}</div>
  );
}

function Metric({ icon: Icon, label, value, accent, raw = false }: { icon: ComponentType<{ size?: string | number; style?: CSSProperties }>; label: string; value: number | string; accent: string; raw?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <Icon size={15} style={{ color: accent }} />
      <p className="relative mt-3 text-xl font-semibold">{raw ? value : formatter.format(Number(value))}</p>
      <p className="relative mt-1 text-xs text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

function SmallMetric({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: number }) {
  return <div className="flex items-center gap-3 rounded-xl border p-3" style={{ background: "var(--glass-bg-soft)" }}><Icon size={16} className="text-pink-500" /><div><p className="text-sm font-semibold">{formatter.format(value)}</p><p className="text-[11px] text-[var(--muted-foreground)]">{label}</p></div></div>;
}

function MediaCard({ item }: { item: MarketingInstagramMedia }) {
  const image = item.thumbnail_url || item.media_url;
  const format = item.media_product_type === "REELS" ? "Reel" : item.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : item.media_type === "VIDEO" ? "Vídeo" : "Imagem";
  return (
    <article className="group overflow-hidden rounded-xl border bg-[var(--bg-modal)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-orange-500/15">
        {image ? <img src={image} alt="Miniatura da publicação" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <InstagramGlyph className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />}
        <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">{format}</span>
        {item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/65 text-white backdrop-blur transition hover:bg-black/80" title="Abrir no Instagram"><ExternalLink size={14} /></a>}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-[var(--text-body)]">{item.caption || "Publicação sem legenda"}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1"><Eye size={12} /> {formatter.format(Number(item.reach))}</span>
          <span className="flex items-center gap-1"><Heart size={12} /> {formatter.format(Number(item.likes))}</span>
          <span className="flex items-center gap-1"><MessageCircle size={12} /> {formatter.format(Number(item.comments))}</span>
          <span className="ml-auto font-semibold text-[var(--text-title)]">{formatter.format(Number(item.total_interactions))} interações</span>
        </div>
      </div>
    </article>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="relative overflow-hidden rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}><h2 className="text-sm font-semibold">{title}</h2><p className="mb-4 text-xs text-[var(--muted-foreground)]">{description}</p>{children}</section>;
}

function LoadingState() {
  return <div className="grid min-h-[360px] place-items-center rounded-2xl border" style={{ background: "var(--glass-bg-soft)" }}><div className="text-center"><Loader2 className="mx-auto animate-spin text-pink-500" /><p className="mt-3 text-sm text-[var(--muted-foreground)]">Carregando Instagram…</p></div></div>;
}
