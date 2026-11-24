"use client";
import { useEffect, useRef, useState } from "react";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { ArrowDown, ArrowUp, Check, Loader2, RectangleHorizontal, RectangleVertical, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DateTimeInput } from "@/components/ui/DateInput";
import { useModalOpen } from "@/hooks/useModalOpen";
import { getSupabaseClient } from "@/lib/supabase";
import { STUDIO_FORMATS, studioSchedule, validateStudioAssets, type InstagramStudioFormat, type StudioConnection, type StudioImageRatio } from "@/lib/marketing/instagram-studio";
import { prepareStudioImage, prepareStudioVideo, type StudioDraftAsset } from "@/lib/marketing/instagram-studio-media";
import { InstagramPostPreview } from "./InstagramPostPreview";
async function request(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null); if (!res.ok || !data) throw Object.assign(new Error(data?.error || "Não recebemos a confirmação do servidor. Verifique o envio antes de tentar novamente."), { status: res.status }); return data;
}
export function InstagramComposer({ connections, accountId, initialFormat, initialDate, onClose, onSaved }: {
  connections: StudioConnection[]; accountId: string; initialFormat: InstagramStudioFormat; initialDate?: string; onClose: () => void; onSaved: () => void;
}) {
  useModalOpen(true);
  const [connectionId, setConnectionId] = useState(accountId);
  const [format, setFormat] = useState(initialFormat);
  const [assets, setAssets] = useState<StudioDraftAsset[]>([]);
  const assetsRef = useRef(assets); assetsRef.current = assets;
  useEffect(() => () => assetsRef.current.forEach(asset => URL.revokeObjectURL(asset.url)), []);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [ratio, setRatio] = useState<StudioImageRatio>("square");
  const [caption, setCaption] = useState("");
  const [timing, setTiming] = useState(initialDate ? "schedule" : "now");
  const formatSeg = useSegmentIndicator({ background: "color-mix(in srgb,var(--foreground) 10%,transparent)" }, { activeSelector: '[aria-pressed="true"]' });
  const timingSeg = useSegmentIndicator({ background: "var(--primary)", boxShadow: "0 2px 8px color-mix(in srgb,var(--primary) 28%,transparent)" }, { activeSelector: '[aria-pressed="true"]' });
  const [date, setDate] = useState(initialDate ? `${initialDate}T12:00` : "");
  const [busy, setBusy] = useState(false), [review, setReview] = useState(false), [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const ticket = useRef<string | null>(null);
  const committedBody = useRef<Record<string, unknown> | null>(null);
  const account = connections.find(item => item.id === connectionId);
  const input = useRef<HTMLInputElement>(null);
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    const prepared: StudioDraftAsset[] = [];
    try {
      if (format === "carousel" ? assets.length + files.length > 10 : files.length > 1) throw new Error("Escolha até 10 imagens no carrossel ou um arquivo nos demais formatos.");
      for (const file of Array.from(files)) prepared.push(file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mov") ? await prepareStudioVideo(file, format) : await prepareStudioImage(file, format, fit, ratio));
      if (format !== "carousel" || assets.length + prepared.length >= 2) validateStudioAssets(format, (format === "carousel" ? [...assets, ...prepared] : prepared).map(a => ({ type: a.type, size: a.file.size })));
      if (format !== "carousel") assets.forEach(a => URL.revokeObjectURL(a.url));
      setAssets(format === "carousel" ? [...assets, ...prepared] : prepared);
    } catch (e) { prepared.forEach(a => URL.revokeObjectURL(a.url)); setError((e as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function changeFit(next: "contain" | "cover") {
    setBusy(true); setError(""); const replacements: StudioDraftAsset[] = [];
    try {
      for (const asset of assets) replacements.push(asset.type === "image/jpeg" ? { ...await prepareStudioImage(asset.source, format, next, ratio), id: asset.id, altText: asset.altText } : asset);
      assets.filter(a => a.type === "image/jpeg").forEach(a => URL.revokeObjectURL(a.url)); setAssets(replacements); setFit(next);
    } catch (e) { replacements.filter(a => a.type === "image/jpeg").forEach(a => URL.revokeObjectURL(a.url)); setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function validate() {
    if (!account?.can_publish) throw new Error("Selecione uma conta com permissão para publicar.");
    validateStudioAssets(format, assets.map(a => ({ type: a.type, size: a.file.size })));
    if (Array.from(caption).length > 2200) throw new Error("Use até 2.200 caracteres na legenda.");
    return timing === "schedule" ? studioSchedule(date) : undefined;
  }
  async function publish() {
    setBusy(true); setError("");
    try {
      if (!committedBody.current) {
        const scheduledAt = validate();
        setProgress("Preparando envio seguro…");
        if (!ticket.current) {
          const signed = await request("/api/marketing/instagram/studio/uploads", { connectionId, format, ratio, assets: assets.map(a => ({ type: a.type, size: a.file.size })), previewSize: assets[0].poster.size });
          const blobs = [...assets.map(a => a.file), assets[0].poster];
          for (let index = 0; index < signed.uploads.length; index++) {
            setProgress(`Enviando arquivo ${index + 1} de ${signed.uploads.length}…`);
            const item = signed.uploads[index];
            const result = await getSupabaseClient().storage.from("criativos").uploadToSignedUrl(item.path, item.token, blobs[index], { contentType: item.type });
            if (result.error) throw new Error(result.error.message);
          }
          ticket.current = signed.ticket;
        }
        committedBody.current = { ticket: ticket.current, caption, timing, scheduledAt, altTexts: assets.map(a => a.altText) };
      }
      setProgress("Confirmando na agenda…");
      await request("/api/marketing/instagram/studio", committedBody.current);
      toast.success(timing === "schedule" ? "Publicação programada." : "Publicação na fila de envio. Acompanhe o status no painel.");
      window.dispatchEvent(new Event("instagram-publication-updated")); onSaved(); onClose();
    } catch (e) { setError((e as Error).message); if ([400, 403, 404].includes((e as { status?: number }).status ?? 0)) { committedBody.current = null; ticket.current = null; } }
    finally { setBusy(false); setProgress(""); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="ig-studio-composer" overlayClassName="ig-studio-overlay" showCloseButton={!busy}>
    <div className="ig-dialog-heading"><span className="ig-eyebrow">CRIAR PUBLICAÇÃO</span><DialogTitle>{review ? "Confira antes de confirmar" : "Do conteúdo para o seu Instagram"}</DialogTitle><p>A prévia acompanha os arquivos e a ordem que serão enviados.</p></div>
    <div className="ig-composer-grid"><div className="ig-composer-fields"><fieldset disabled={busy || review}>
      <label>Conta<select value={connectionId} onChange={e => setConnectionId(e.target.value)}>{connections.map(c => <option value={c.id} key={c.id} disabled={!c.can_publish}>@{c.username}{!c.can_publish ? " · Reconectar" : ""}</option>)}</select></label>
      <div ref={formatSeg.trackRef} className="ig-format-tabs">{formatSeg.indicator}{Object.entries(STUDIO_FORMATS).map(([key, label]) => <button type="button" key={key} aria-pressed={key === format} onClick={() => { assets.forEach(a => URL.revokeObjectURL(a.url)); setAssets([]); setFormat(key as InstagramStudioFormat); }}>{label}</button>)}</div>
      <input ref={input} type="file" className="sr-only" accept={format === "reel" ? "video/mp4,video/quicktime,.mov" : format === "story" ? "image/jpeg,image/png,image/webp,video/mp4" : "image/jpeg,image/png,image/webp"} multiple={format === "carousel"} onChange={e => void addFiles(e.target.files)} />
      <button type="button" className="ig-upload" onClick={() => input.current?.click()}><Upload size={22} /><b>{assets.length ? "Adicionar ou substituir mídia" : "Escolher arquivos"}</b><span>{format === "reel" ? "MP4 ou MOV vertical · até 300 MB · 3 s a 15 min" : format === "story" ? "Imagem ou MP4 vertical · vídeo de 3 a 60 s" : format === "carousel" ? "2 a 10 imagens · JPG, PNG ou WebP" : "JPG, PNG ou WebP · até 25 MB"}</span></button>
      {(format === "reel" || format === "story") && <small>Vídeos: 9:16, H.264/AAC{format === "reel" ? " e até 300 MB. Reels aceitam MP4 ou MOV" : ""}. Envie a edição final com áudio e textos incorporados.</small>}
      {(format === "image" || format === "carousel") && <div className="ig-ratio-options" role="group" aria-label="Proporção da publicação"><span>Proporção</span><div>{([{id:"square",label:"Quadrada",ratio:"1:1",Icon:Square},{id:"portrait",label:"Vertical",ratio:"4:5",Icon:RectangleVertical},{id:"landscape",label:"Horizontal",ratio:"1,91:1",Icon:RectangleHorizontal}] as const).map(option => <button type="button" key={option.id} aria-pressed={ratio === option.id} onClick={() => setRatio(option.id)}><option.Icon size={19} strokeWidth={1.7} /><b>{option.label}</b><small>{option.ratio}</small></button>)}</div></div>}
      {assets.some(a => a.type === "image/jpeg") && <label>Enquadramento<select value={fit} onChange={e => void changeFit(e.target.value as "contain" | "cover")}><option value="contain">Preservar imagem inteira (fundo escuro)</option><option value="cover">Preencher e recortar ao centro</option></select></label>}
      <div className="ig-assets">{assets.map((asset, index) => <div className="ig-asset" key={asset.id}><span>{index + 1}</span><span className="ig-asset-name">{asset.source.name}</span><button type="button" aria-label={`Mover mídia ${index + 1} para cima`} disabled={index === 0} onClick={() => setAssets(list => { const copy = [...list]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; return copy; })}><ArrowUp size={15} /></button><button type="button" aria-label={`Mover mídia ${index + 1} para baixo`} disabled={index === assets.length - 1} onClick={() => setAssets(list => { const copy = [...list]; [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]]; return copy; })}><ArrowDown size={15} /></button><button type="button" aria-label={`Remover mídia ${index + 1}`} onClick={() => { URL.revokeObjectURL(asset.url); setAssets(list => list.filter(a => a.id !== asset.id)); }}><Trash2 size={15} /></button>{asset.type === "image/jpeg" && format !== "story" && <input aria-label={`Texto alternativo da imagem ${index + 1}`} placeholder="Texto alternativo (acessibilidade)" maxLength={1000} value={asset.altText} onChange={e => setAssets(list => list.map(a => a.id === asset.id ? { ...a, altText: e.target.value } : a))} />}</div>)}</div>
      <label>{format === "story" ? "Identificação na agenda (não aparece no Story)" : "Legenda"}<textarea rows={4} value={caption} onChange={e => setCaption(e.target.value)} placeholder={format === "story" ? "Ex.: Bastidores da visita ao empreendimento" : "O que você quer contar nesta publicação?"} /><small>{Array.from(caption).length}/2.200</small></label>
      <div className="ig-timing-control" role="group" aria-label="Quando publicar"><span>Publicar</span><div ref={timingSeg.trackRef} className="ig-timing-switch">{timingSeg.indicator}<button type="button" aria-pressed={timing === "now"} onClick={() => setTiming("now")}>Agora</button><button type="button" aria-pressed={timing === "schedule"} onClick={() => setTiming("schedule")}>Agendar</button></div></div>
      {timing === "schedule" && <label>Data e horário · Fortaleza (UTC−3)<DateTimeInput aria-label="Data e horário da publicação" popupZIndex={1250} type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></label>}
    </fieldset></div><aside className="ig-composer-preview"><span className="ig-eyebrow">PRÉVIA DA PUBLICAÇÃO</span><InstagramPostPreview username={account?.username ?? ""} avatar={account?.profile_picture_url} format={format} caption={caption} assets={assets.map(a => ({ url: a.url, type: a.type }))} ratio={ratio} /><small>Simulação visual. Os controles e a aparência final seguem o aplicativo do Instagram.</small></aside></div>
    {review && <div className="ig-notice"><Check size={18} /><span><b>@{account?.username} · {STUDIO_FORMATS[format]}</b><br />{timing === "schedule" ? `${date.replace("T", " às ")} · Fortaleza` : "O envio começa na próxima execução da fila (aproximadamente 1 minuto), seguido do processamento do Instagram."}</span></div>}
    {error && <p className="ig-error" role="alert">{error}</p>}
    <footer className="ig-dialog-actions"><span>{progress}</span>{review && !committedBody.current && <button className="ig-btn" disabled={busy} onClick={() => { setReview(false); ticket.current = null; }}>Voltar e editar</button>}<button className="ig-btn ig-primary" disabled={busy} onClick={() => { if (review) void publish(); else try { validate(); setError(""); setReview(true); } catch (e) { setError((e as Error).message); } }}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{busy ? "Enviando…" : !review ? "Revisar publicação" : committedBody.current ? "Verificar envio" : timing === "schedule" ? "Confirmar agendamento" : "Confirmar publicação"}</button></footer>
  </DialogContent></Dialog>;
}
