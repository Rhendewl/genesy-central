"use client";

import { DateTimeInput } from "@/components/ui/DateInput";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const ENDPOINT = "/api/marketing/instagram/feed";
const PENDING = "genesy-pending-instagram-feed";
type Account = { id: string; username: string; needsReconnect: boolean };
type ScheduledPost = { id: string; connection_id: string; scheduled_at: string; caption: string; status: string; last_error: string | null };
const scheduleTime = (value: string) => new Date(`${value}:00-03:00`);
const displayTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
type Slide = { id: string; number: number };
async function responseJson(response: Response) {
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {
    if (response.status === 413) throw new Error("Os slides excederam o tamanho permitido. Selecione menos slides e tente novamente.");
    if (response.status === 504) throw new Error("O Instagram demorou para responder. Confira sua conta antes de tentar novamente.");
    throw new Error("Não foi possível confirmar a resposta do servidor. Confira sua conexão e tente verificar a publicação novamente.");
  }
  if (!response.ok) throw Object.assign(new Error(data.error || "Não foi possível acessar o Instagram."), { status: response.status });
  return data;
}

export async function feedJpeg(png: Blob) {
  const bitmap = await createImageBitmap(png);
  try {
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar o slide.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1080, 1350); ctx.drawImage(bitmap, 0, 0, 1080, 1350);
    for (const quality of [0.92, 0.8, 0.65]) {
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      // Keep the complete multipart request below common hosting limits.
      if (image && image.size <= 400 * 1024) return image;
    }
    throw new Error("O slide ficou muito grande. Reduza os detalhes e tente novamente.");
  } finally { bitmap.close(); }
}

export function InstagramFeedDialog({ slides, renderThumbnail, capture, onClose }: {
  slides: Slide[]; renderThumbnail?: (id: string) => ReactNode; capture: (id: string) => Promise<Blob>; onClose: () => void;
}) {
  const [selected, setSelected] = useState(() => slides.map((slide) => slide.id));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [timing, setTiming] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [schedulePending, setSchedulePending] = useState(false);
  const scheduleId = useRef("");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[] | null>(null);
  const [managing, setManaging] = useState(false);
  const [caption, setCaption] = useState("");
  const [altSlideId, setAltSlideId] = useState(slides[0]?.id ?? "");
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<{ id: string; url: string; image: Blob }[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");
  const lock = useRef(false);
  const urls = useRef<string[]>([]);
  const account = accounts.find((item) => item.id === accountId);
  useEffect(() => {
    let live = true;
    try { setTicket(sessionStorage.getItem(PENDING) || ""); } catch {}
    fetch(ENDPOINT).then(responseJson).then((data) => { if (live) { setAccounts(data.accounts); setAccountId(data.accounts[0]?.id ?? ""); } })
      .catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; urls.current.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  function resetPreview() { urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current = []; setPreviews([]); }
  async function review() {
    if (lock.current) return;
    if (timing === "schedule" && (!scheduledAt || !Number.isFinite(scheduleTime(scheduledAt).getTime()) || scheduleTime(scheduledAt).getTime() < Date.now() + 5 * 60_000)) {
      setError("Escolha data e horário com pelo menos 5 minutos de antecedência."); return;
    }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = [];
      for (const id of selected) {
        const image = await capture(id); const url = URL.createObjectURL(image); urls.current.push(url); result.push({ id, image, url });
      }
      setPreviews(result);
    } catch (e) { resetPreview(); setError(e instanceof Error ? e.message : "Erro ao preparar slides."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function publish() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    let current = ticket;
    function remember(value: string) { current = value; setTicket(value); try { sessionStorage.setItem(PENDING, value); } catch {} }
    try {
      if (!current) {
        const form = new FormData(); form.set("connectionId", accountId); form.set("caption", caption);
        form.set("altTexts", JSON.stringify(previews.map((item) => altTexts[item.id] || "")));
        if (timing === "schedule") {
          if (!scheduleId.current) scheduleId.current = crypto.randomUUID();
          form.set("scheduleId", scheduleId.current);
          form.set("scheduledAt", scheduleTime(scheduledAt).toISOString());
          setSchedulePending(true);
        }
        previews.forEach((item, index) => form.append("images", item.image, `slide-${index + 1}.jpg`));
        const prepared = await responseJson(await fetch(ENDPOINT, { method: "POST", body: form }));
        if (prepared.scheduled) {
          window.dispatchEvent(new Event("instagram-publication-updated"));
          toast.success(`Post programado para ${displayTime(prepared.scheduledAt)} (Fortaleza).`); onClose(); return;
        }
        remember(prepared.ticket);
      }
      for (let attempt = 0; attempt < 20; attempt++) {
        const result = await responseJson(await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: current }) }));
        if (result.ticket) remember(result.ticket);
        if (result.published) {
          try { sessionStorage.removeItem(PENDING); } catch {}
          window.dispatchEvent(new Event("instagram-publication-updated"));
          toast.success("Post publicado no Instagram."); onClose(); return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      throw new Error("O Instagram ainda está processando. Use Verificar publicação para continuar o mesmo envio.");
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setSchedulePending(false);
      setError(e instanceof Error ? e.message : "Falha ao publicar. Confira sua conta antes de tentar novamente.");
    }
    finally { lock.current = false; setBusy(false); }
  }
  async function loadScheduled() {
    setManaging(true); setError("");
    try { setScheduledPosts((await responseJson(await fetch("/api/marketing/instagram/scheduled"))).posts); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar os agendamentos."); }
    finally { setManaging(false); }
  }
  async function cancelScheduled(id: string) {
    setManaging(true); setError("");
    try {
      await responseJson(await fetch("/api/marketing/instagram/scheduled", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }));
      setScheduledPosts((items) => items?.map((item) => item.id === id ? { ...item, status: "cancelled" } : item) ?? null);
      window.dispatchEvent(new Event("instagram-publication-updated"));
      toast.success("Agendamento cancelado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível cancelar."); }
    finally { setManaging(false); }
  }
  const statusLabels: Record<string, string> = { scheduled: "Programado", publishing: "Em processamento", published: "Publicado", failed: "Falhou", cancelled: "Cancelado" };
  const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3";
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={false} className="z-[100] max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl" overlayClassName="z-[99]">
      <DialogTitle>Publicar no Instagram · Feed</DialogTitle>
      <button type="button" disabled={busy || managing} className="text-left text-sm underline" onClick={() => { if (scheduledPosts) setScheduledPosts(null); else void loadScheduled(); }}>{managing ? "Carregando…" : scheduledPosts ? "Ocultar publicações programadas" : "Ver publicações programadas"}</button>
      {scheduledPosts && <section className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] p-3" aria-label="Publicações programadas">
        <button type="button" disabled={managing || busy} className="text-xs underline" onClick={() => void loadScheduled()}>Atualizar lista</button>
        {!scheduledPosts.length && <p className="text-sm">Nenhuma publicação programada.</p>}
        {scheduledPosts.map((post) => <div key={post.id} className="border-b border-[var(--border)] pb-3 text-sm">
          <p className="font-medium">{displayTime(post.scheduled_at)} · {statusLabels[post.status]}</p>
          <p className="text-xs text-[var(--muted-foreground)]">@{accounts.find((item) => item.id === post.connection_id)?.username ?? "Instagram"} · Fortaleza (UTC−3)</p>
          <p className="mt-1 line-clamp-2">{post.caption || "Sem legenda"}</p>
          {post.last_error && <p className="mt-1 text-xs text-red-500">{post.last_error}</p>}
          {post.status === "scheduled" && <button type="button" disabled={managing || busy} onClick={() => void cancelScheduled(post.id)} className="mt-2 text-xs underline">Cancelar agendamento</button>}
        </div>)}
      </section>}
      {ticket ? <p className="text-sm">Há um envio pendente. Verifique sua publicação para concluir sem reenviar os slides.</p> : <fieldset disabled={busy || schedulePending} className="min-w-0 space-y-4">
        <label className="block text-sm">Conta do Instagram<select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {!accounts.length && <option value="">{loading ? "Carregando…" : "Nenhuma conta conectada"}</option>}
          {accounts.map((item) => <option key={item.id} value={item.id}>@{item.username}</option>)}
        </select></label>
        {!loading && (!account || account.needsReconnect) && <p className="text-sm"><a className="underline" href="/api/marketing/instagram/auth">Conectar ou reconectar Instagram</a>. Salve seu projeto antes de sair.</p>}
        <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{selected.length} de {slides.length} slides selecionados</span><button type="button" className="text-xs underline" onClick={() => { resetPreview(); setSelected(selected.length === slides.length ? [] : slides.map((slide) => slide.id)); }}>{selected.length === slides.length ? "Desmarcar todos" : "Selecionar todos"}</button></div>
        <p className="text-xs text-[var(--muted-foreground)]">Toque nas miniaturas para incluir ou remover slides. A sequência acompanha a ordem do projeto.</p>
        <div aria-label="Slides para publicação" className="flex gap-3 overflow-x-auto pb-3 pt-1 snap-x">{slides.map((slide) => {
          const included = selected.includes(slide.id);
          return <button key={slide.id} type="button" aria-label={`Slide ${slide.number}`} aria-pressed={included} onClick={() => {
            resetPreview(); setSelected(included ? selected.filter((id) => id !== slide.id) : slides.filter((item) => item.id === slide.id || selected.includes(item.id)).map((item) => item.id));
          }} className={`relative w-28 shrink-0 snap-start overflow-hidden rounded-xl border-2 text-left transition ${included ? "border-[var(--accent-blue)]" : "border-[var(--border)] opacity-45"}`}>
            <div className="pointer-events-none relative h-[140px] w-28 overflow-hidden bg-black">{renderThumbnail?.(slide.id) ?? <span className="grid h-full place-items-center text-sm">Slide {slide.number}</span>}</div>
            <div className="flex items-center justify-between bg-[var(--background)] px-2 py-2 text-xs"><span>Slide {slide.number}</span><span className={`grid h-5 w-5 place-items-center rounded-full ${included ? "bg-[var(--accent-blue)] text-white" : "border border-[var(--border)]"}`}>{included ? "✓" : "+"}</span></div>
          </button>;
        })}</div>
        {selected.length > 10 && <p role="alert" className="text-sm text-amber-500">O Instagram aceita até 10 slides por publicação. Desmarque {selected.length - 10} para continuar.</p>}
        <label className="block text-sm">Legenda (inclua hashtags e @menções)<textarea aria-label="Legenda" className={inputClass} rows={4} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} /><span className="text-xs">{caption.length}/2.200</span></label>
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
          <p className="text-sm font-medium">Quando publicar?</p>
          <div className="flex gap-4 text-sm"><label><input type="radio" name="instagram-timing" checked={timing === "now"} onChange={() => setTiming("now")} /> Agora</label><label><input type="radio" name="instagram-timing" checked={timing === "schedule"} onChange={() => setTiming("schedule")} /> Programar</label></div>
          {timing === "schedule" && <label className="block text-sm">Data e horário<DateTimeInput aria-label="Data e horário" type="datetime-local" className={inputClass} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /><span className="mt-2 block text-xs text-[var(--muted-foreground)]">Horário de Fortaleza (UTC−3). O envio começa no horário escolhido e pode levar alguns minutos para concluir. Você pode fechar o navegador.</span></label>}
        </div>
        <details className="rounded-xl border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-sm">Acessibilidade · texto alternativo <span className="text-xs text-[var(--muted-foreground)]">(opcional)</span></summary>
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">Descreva cada imagem para quem usa leitor de tela. Edite um slide por vez.</p>
          <label className="mt-3 block text-sm">Slide<select className={inputClass} value={selected.includes(altSlideId) ? altSlideId : selected[0] ?? ""} onChange={(e) => setAltSlideId(e.target.value)}>{slides.filter((slide) => selected.includes(slide.id)).map((slide) => <option key={slide.id} value={slide.id}>Slide {slide.number}{altTexts[slide.id] ? " · descrição adicionada" : ""}</option>)}</select></label>
          {selected.length > 0 && <label className="mt-3 block text-sm">Descrição da imagem<textarea aria-label="Texto alternativo" className={inputClass} rows={3} maxLength={1000} value={altTexts[selected.includes(altSlideId) ? altSlideId : selected[0]] || ""} placeholder="Descreva a imagem" onChange={(e) => setAltTexts({ ...altTexts, [selected.includes(altSlideId) ? altSlideId : selected[0]]: e.target.value })} /></label>}
        </details>
        {previews.length > 0 && <><p className="text-sm font-medium">{previews.length === 1 ? "Post estático" : `Carrossel com ${previews.length} slides`} · confira antes de publicar</p><div className="flex gap-3 overflow-x-auto">{previews.map((item, index) => <img key={item.id} src={item.url} alt={`Posição ${index + 1}, slide ${slides.find((slide) => slide.id === item.id)?.number}`} className="w-36 shrink-0 rounded-lg" />)}</div><p className="whitespace-pre-wrap text-sm">{caption || "Sem legenda"}</p>{timing === "schedule" && scheduledAt && <p className="text-sm font-medium">Programado para {displayTime(scheduleTime(scheduledAt).toISOString())} · Fortaleza</p>}</>}
      </fieldset>}
      {schedulePending && !busy && <p className="text-sm">Se a confirmação não chegou, consulte a lista de publicações programadas. Tentar confirmar novamente usa o mesmo agendamento.</p>}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" disabled={busy} onClick={onClose}>Fechar</Button>
        {ticket && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Confira sua conta no Instagram antes de encerrar. Uma nova tentativa poderá duplicar o post. Já conferiu e deseja encerrar esta pendência?")) { try { sessionStorage.removeItem(PENDING); } catch {} setTicket(""); resetPreview(); } }}>Encerrar pendência</Button>}
        {ticket ? <Button loading={busy} onClick={() => void publish()}>Verificar publicação</Button> : previews.length ? <Button loading={busy} disabled={!account || account.needsReconnect} onClick={() => void publish()}>{timing === "schedule" ? "Confirmar agendamento" : "Publicar agora"}</Button> : <Button loading={busy} disabled={loading || !selected.length || selected.length > 10 || !account || account.needsReconnect} onClick={() => void review()}>Revisar publicação</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
