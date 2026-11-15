"use client";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import type { InstagramStudioFormat, StudioImageRatio } from "@/lib/marketing/instagram-studio";
export function InstagramPostPreview({ username, avatar, format, caption, assets, ratio = "portrait" }: {
  username: string; avatar?: string | null; format: InstagramStudioFormat; caption: string; assets: { url: string; type: string }[]; ratio?: StudioImageRatio;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [assets.length, format]);
  const active = assets[Math.min(index, Math.max(0, assets.length - 1))];
  const vertical = format === "story" || format === "reel";
  return <div className={`ig-phone-preview ${vertical ? "is-vertical" : ""}`}>
    <header><span className="ig-avatar">{avatar ? <img src={avatar} alt="" /> : username.slice(0, 1).toUpperCase()}</span><b>{username || "seu_perfil"}</b><MoreHorizontal size={17} /></header>
    <div className={`ig-preview-media ${format !== "story" && format !== "reel" ? `is-${ratio}` : ""}`}>
      {active ? active.type.startsWith("video/") ? <video key={active.url} src={active.url} controls playsInline preload="metadata" /> : <img src={active.url} alt={`Prévia ${index + 1}`} /> : <div className="ig-preview-placeholder"><span>{format === "reel" ? "Seu Reel" : format === "story" ? "Seu Story" : "Sua publicação"}</span><small>A mídia aparece aqui antes do envio</small></div>}
      {assets.length > 1 && <><span className="ig-preview-counter">{index + 1}/{assets.length}</span><button type="button" className="ig-preview-prev" aria-label="Slide anterior" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><ChevronLeft size={18} /></button><button type="button" className="ig-preview-next" aria-label="Próximo slide" disabled={index === assets.length - 1} onClick={() => setIndex(value => value + 1)}><ChevronRight size={18} /></button></>}
    </div>
    {format !== "story" && <div className="ig-preview-caption"><div><Heart size={19} /><MessageCircle size={19} /><Send size={19} /><Bookmark size={19} className="ml-auto" /></div><p><b>{username || "seu_perfil"}</b> {caption || "Sua legenda aparecerá aqui…"}</p></div>}
    {format === "story" && <div className="ig-preview-story-footer">Enviar mensagem <Heart size={18} /><Send size={18} /></div>}
  </div>;
}
