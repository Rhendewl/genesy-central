"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, FilterX, Plus } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useMarketing } from "@/context/MarketingContext";
import { MarketingContentDialog } from "@/components/marketing/MarketingContentDialog";
import { ContentStatusBadge, MarketingEmptyState, MarketingSkeleton } from "@/components/marketing/MarketingUI";
import { CONTENT_STATUS_LABELS, FORMAT_LABELS, MARKETING_CONTENT_STATUSES, MARKETING_FORMATS, MARKETING_PLATFORMS, PLATFORM_LABELS, type MarketingContent } from "@/types/marketing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type View = "month" | "week" | "list";
type PublicationSnapshot = Pick<MarketingContent, "status" | "published_at" | "manual_publication">;
export default function MarketingCalendarPage() {
  const params = useSearchParams(); const marketing = useMarketing(); const [view,setView] = useState<View>("month"); const [cursor,setCursor] = useState(() => { const raw = params.get("date"); return raw ? new Date(`${raw}T12:00:00`) : new Date(); }); const [status,setStatus] = useState(params.get("status") ?? ""); const [platform,setPlatform] = useState(""); const [formatFilter,setFormat] = useState(""); const [assignee,setAssignee] = useState(""); const [selected,setSelected] = useState<MarketingContent | null>(null); const [createDate,setCreateDate] = useState<Date | null>(null); const [open,setOpen] = useState(false); const [publishingIds,setPublishingIds] = useState<Set<string>>(() => new Set());
  const openedContentId = useRef<string | null>(null);
  const publicationSnapshots = useRef(new Map<string, PublicationSnapshot>());
  useEffect(() => { const contentId = params.get("content"); if (!contentId || marketing.isLoading || openedContentId.current === contentId) return; const content = marketing.contents.find((item) => item.id === contentId); if (content) { openedContentId.current = contentId; setSelected(content); setCreateDate(null); setOpen(true); } }, [marketing.contents, marketing.isLoading, params]);
  const rangeStart = view === "week" ? startOfWeek(cursor,{weekStartsOn:0}) : startOfMonth(cursor); const rangeEnd = view === "week" ? endOfWeek(cursor,{weekStartsOn:0}) : endOfMonth(cursor);
  const filtered = useMemo(() => marketing.contents.filter((item) => { if (!item.scheduled_at) return view === "list"; const date = new Date(item.scheduled_at); if (view !== "list" && (date < rangeStart || date > rangeEnd)) return false; if (status === "overdue" && !(date < new Date() && !["published","cancelled"].includes(item.status))) return false; if (status && status !== "overdue" && item.status !== status) return false; if (platform && item.platform !== platform) return false; if (formatFilter && item.format !== formatFilter) return false; if (assignee && item.primary_assignee_id !== assignee) return false; return true; }).sort((a,b) => (a.scheduled_at ?? "z").localeCompare(b.scheduled_at ?? "z")), [assignee, formatFilter, marketing.contents, platform, rangeEnd, rangeStart, status, view]);
  const days = view === "month" ? Array.from({length:42},(_,i) => addDays(startOfWeek(startOfMonth(cursor),{weekStartsOn:0}),i)) : Array.from({length:7},(_,i) => addDays(startOfWeek(cursor,{weekStartsOn:0}),i));
  const navigate = (direction:number) => setCursor((date) => view === "week" ? addWeeks(date,direction) : addMonths(date,direction));
  const openCreate = (date = new Date()) => { setSelected(null); setCreateDate(date); setOpen(true); }; const openEdit = (item: MarketingContent) => { setSelected(item); setCreateDate(null); setOpen(true); };
  async function dropOn(day: Date, id: string) { const item = marketing.contents.find((value) => value.id === id); if (!item?.scheduled_at || !item.can_edit) return; const original = new Date(item.scheduled_at); const target = new Date(day); target.setHours(original.getHours(),original.getMinutes(),0,0); await marketing.updateContent(id,{ ...item, scheduled_at: target.toISOString() }); }
  async function restorePublication(item: MarketingContent, snapshot: PublicationSnapshot, message = "Publicação desmarcada") {
    setPublishingIds((current) => new Set(current).add(item.id));
    const restored = await marketing.updatePublication(item.id, snapshot);
    setPublishingIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    if (!restored) return false;
    publicationSnapshots.current.delete(item.id);
    toast.success(message, { description: `Status restaurado para ${CONTENT_STATUS_LABELS[snapshot.status]}.` });
    return true;
  }
  async function quickPublish(item: MarketingContent) {
    if (!item.can_edit || publishingIds.has(item.id)) return;
    if (item.status === "published") {
      const snapshot = publicationSnapshots.current.get(item.id) ?? { status: "approved", published_at: null, manual_publication: false };
      await restorePublication(item, snapshot);
      return;
    }
    const snapshot: PublicationSnapshot = { status: item.status, published_at: item.published_at, manual_publication: item.manual_publication };
    publicationSnapshots.current.set(item.id, snapshot);
    setPublishingIds((current) => new Set(current).add(item.id));
    const published = await marketing.updatePublication(item.id, { status: "published", published_at: new Date().toISOString(), manual_publication: true });
    setPublishingIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    if (!published) { publicationSnapshots.current.delete(item.id); return; }
    toast.success("Conteúdo marcado como publicado", {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => void restorePublication(item, snapshot, "Publicação desfeita"),
      },
    });
  }
  const clear = () => { setStatus(""); setPlatform(""); setFormat(""); setAssignee(""); };
  return <div className="pb-10"><Header title="Calendário Editorial" subtitle={view === "week" ? `${format(rangeStart,"dd MMM",{locale:ptBR})} – ${format(rangeEnd,"dd MMM yyyy",{locale:ptBR})}` : format(cursor,"MMMM 'de' yyyy",{locale:ptBR})} actions={<Button onClick={() => openCreate()} icon={<CalendarDays size={15}/>} signature size="medium">Criar conteúdo</Button>}/><div className="px-4 sm:px-6"><div className="mb-4 flex flex-wrap items-center gap-2"><button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-[var(--hover)]"><ChevronLeft size={16}/></button><button onClick={() => setCursor(new Date())} className="rounded-lg px-3 py-2 text-xs" style={{background:"var(--hover)"}}>Hoje</button><button onClick={() => navigate(1)} className="rounded-lg p-2 hover:bg-[var(--hover)]"><ChevronRight size={16}/></button><div className="ml-auto flex rounded-xl p-1" style={{background:"var(--glass-bg-soft)",border:"1px solid var(--glass-border)"}}>{([['month','Mês'],['week','Semana'],['list','Lista']] as const).map(([id,label]) => <button key={id} onClick={() => setView(id)} className={cn("rounded-lg px-3 py-1.5 text-xs",view===id?"text-[var(--text-title)]":"text-[var(--muted-foreground)]")} style={view===id?{background:"var(--hover)"}:{}}>{label}</button>)}</div></div><div className="mb-4 flex gap-2 overflow-x-auto pb-1"><Filter value={status} onChange={setStatus} label="Status" options={[["","Todos"],["overdue","Atrasados"],...MARKETING_CONTENT_STATUSES.map((v) => [v,CONTENT_STATUS_LABELS[v]] as [string,string])]}/><Filter value={platform} onChange={setPlatform} label="Plataforma" options={[["","Todas"],...MARKETING_PLATFORMS.map((v) => [v,PLATFORM_LABELS[v]] as [string,string])]}/><Filter value={formatFilter} onChange={setFormat} label="Formato" options={[["","Todos"],...MARKETING_FORMATS.map((v) => [v,FORMAT_LABELS[v]] as [string,string])]}/><Filter value={assignee} onChange={setAssignee} label="Responsável" options={[["","Todos"],...marketing.members.map((m) => [m.id,m.full_name] as [string,string])]}/>{(status||platform||formatFilter||assignee)&&<button onClick={clear} className="flex shrink-0 items-center gap-1 rounded-xl px-3 text-xs" style={{background:"var(--hover)"}}><FilterX size={13}/>Limpar</button>}</div>{marketing.isLoading ? <MarketingSkeleton/> : marketing.error ? <MarketingEmptyState title="Erro ao carregar calendário" description={marketing.error}/> : view === "list" ? <ListView items={filtered} onOpen={openEdit}/> : <CalendarGrid days={days} items={filtered} month={cursor} onCreate={openCreate} onOpen={openEdit} onDrop={(day,id) => void dropOn(day,id)} onQuickPublish={(item) => void quickPublish(item)} publishingIds={publishingIds} weekly={view === "week"}/>}</div><MarketingContentDialog open={open} onOpenChange={setOpen} content={selected} initialDate={createDate}/></div>;
}

function CalendarGrid({ days, items, month, onCreate, onOpen, onDrop, onQuickPublish, publishingIds, weekly }: { days: Date[]; items: MarketingContent[]; month: Date; onCreate:(d:Date)=>void; onOpen:(i:MarketingContent)=>void; onDrop:(d:Date,id:string)=>void; onQuickPublish:(i:MarketingContent)=>void; publishingIds:Set<string>; weekly:boolean }) {
  return (
    <div className="min-w-0 pb-2">
      <div className={cn("grid min-w-0 overflow-hidden rounded-2xl border bg-[var(--glass-bg-soft)]", weekly ? "grid-cols-1 md:grid-cols-7" : "grid-cols-4 sm:grid-cols-7")} style={{ borderColor: "var(--glass-border)" }}>
        {!weekly && "DSTQQSS".split("").map((label, index) => <div key={index} className="hidden border-b p-2 text-center text-[10px] font-medium text-[var(--muted-foreground)] sm:block" style={{ borderColor: "var(--border)" }}>{label}</div>)}
        {days.map((day) => {
          const dayItems = items.filter((item) => item.scheduled_at && isSameDay(new Date(item.scheduled_at), day));
          return (
            <div key={day.toISOString()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(day, event.dataTransfer.getData("text/marketing-content"))} className={cn("group min-w-0 overflow-hidden border-b border-r p-1.5", weekly ? "min-h-28 md:min-h-[420px]" : "aspect-square sm:aspect-auto sm:min-h-28", !isSameMonth(day, month) && !weekly && "opacity-35")} style={{ borderColor: "var(--border)" }}>
              <button onClick={() => onCreate(day)} className="mb-1 flex w-full min-w-0 items-center justify-between text-xs"><span className="flex min-w-0 items-center gap-1"><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", isSameDay(day, new Date()) && "bg-[var(--primary)] text-[var(--primary-foreground)]")}>{format(day, "d")}</span>{!weekly && <span className="truncate text-[9px] uppercase text-[var(--muted-foreground)] sm:hidden">{format(day, "EEE", { locale: ptBR }).replace(".", "")}</span>}</span><Plus size={12} className="shrink-0 opacity-50 sm:opacity-0 sm:group-hover:opacity-100" /></button>
              <div className="min-w-0 space-y-1">{dayItems.slice(0, weekly ? 20 : 3).map((item) => <CalendarContentCard key={item.id} item={item} onOpen={onOpen} onQuickPublish={onQuickPublish} isPublishing={publishingIds.has(item.id)} />)}{!weekly && dayItems.length > 3 && <p className="truncate text-[9px] text-[var(--muted-foreground)] sm:text-[10px]">+{dayItems.length - 3} conteúdos</p>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function CalendarContentCard({ item, onOpen, onQuickPublish, isPublishing }: { item: MarketingContent; onOpen:(i:MarketingContent)=>void; onQuickPublish:(i:MarketingContent)=>void; isPublishing:boolean }) {
  const isPublished = item.status === "published";
  return <div draggable={item.can_edit && !isPublishing} onDragStart={(event) => event.dataTransfer.setData("text/marketing-content", item.id)} className="group/content relative min-w-0 overflow-hidden rounded-lg border" style={{ background: isPublished ? "color-mix(in srgb, #22c55e 10%, var(--hover))" : "var(--hover)", borderColor: isPublished ? "color-mix(in srgb, #22c55e 55%, var(--glass-border))" : "var(--glass-border)" }}>
    <button type="button" onClick={() => onOpen(item)} className="w-full min-w-0 p-1.5 text-left" aria-label={`Abrir conteúdo: ${item.title}`}>
      <p className="truncate pr-7 text-[10px] font-medium sm:text-[11px]">{item.title}</p>
      <div className="mt-1 flex min-w-0 items-center"><ContentStatusBadge status={item.status} compact /></div>
    </button>
    {item.can_edit ? <button type="button" draggable={false} disabled={isPublishing} aria-busy={isPublishing} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onQuickPublish(item); }} className={cn("absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm border shadow-sm transition after:absolute after:-inset-3 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-wait disabled:opacity-80", isPublished ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : "lc-quick-publish border-emerald-500/40 bg-[var(--bg-modal)] text-emerald-500 hover:bg-emerald-500 hover:text-white")} title={isPublished ? "Desmarcar como publicado" : "Marcar como publicado"} aria-label={isPublished ? `Desmarcar ${item.title} como publicado` : `Marcar ${item.title} como publicado`}><Check size={11} strokeWidth={isPublished ? 3 : 2.5}/></button> : isPublished ? <span role="status" className="pointer-events-none absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm bg-emerald-500 text-white shadow-sm" title="Publicado" aria-label="Publicado"><Check size={11} strokeWidth={3}/></span> : null}
  </div>;
}
function ListView({items,onOpen}:{items:MarketingContent[];onOpen:(i:MarketingContent)=>void}) { if(!items.length)return <MarketingEmptyState title="Nenhum conteúdo encontrado" description="Ajuste os filtros ou crie um novo conteúdo."/>; return <div className="space-y-2">{items.map((item)=><button key={item.id} onClick={()=>onOpen(item)} className="grid w-full gap-2 rounded-2xl border p-4 text-left sm:grid-cols-[100px_1fr_130px_auto]" style={{background:"var(--glass-bg-soft)",borderColor:"var(--glass-border)"}}><span className="text-xs">{item.scheduled_at?format(new Date(item.scheduled_at),"dd/MM HH:mm"):"Sem data"}</span><div><p className="text-sm font-medium">{item.title}</p><p className="text-[11px] text-[var(--muted-foreground)]">{PLATFORM_LABELS[item.platform]} · {FORMAT_LABELS[item.format]}</p></div><span className="text-xs">{CONTENT_STATUS_LABELS[item.status]}</span><ContentStatusBadge status={item.status}/></button>)}</div>; }
function Filter({value,onChange,label,options}:{value:string;onChange:(v:string)=>void;label:string;options:[string,string][]}) { return <select aria-label={label} value={value} onChange={(e)=>onChange(e.target.value)} className="shrink-0 rounded-xl border px-3 py-2 text-xs outline-none" style={{background:"var(--bg-modal)",borderColor:"var(--glass-border)",color:"var(--text-title)"}}>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>; }
