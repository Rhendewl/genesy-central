"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Film, Copy, ImageIcon, Loader2, MessageCircle, Plus, X } from "lucide-react";
import type { AutomationPost } from "@/lib/instagram-automation/posts";
import "./automation-posts.css";

export const MAX_POSTS = 30;

/* Posts already loaded in this tab, so cards, the trigger block and the picker share them. */
const postCache = new Map<string, AutomationPost>();
const missingCache = new Set<string>();
const pending = new Map<string, Promise<void>>();
const cacheKey = (connectionId: string, id: string) => `${connectionId}:${id}`;

function remember(connectionId: string, posts: AutomationPost[]) {
  for (const post of posts) postCache.set(cacheKey(connectionId, post.id), post);
}

async function loadIds(connectionId: string, ids: string[]) {
  const wanted = ids.filter(id => !postCache.has(cacheKey(connectionId, id)) && !missingCache.has(cacheKey(connectionId, id)));
  if (!wanted.length) return;
  const key = `${connectionId}|${wanted.join(",")}`;
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      try {
        const response = await fetch(`/api/marketing/instagram/automations/media?connectionId=${encodeURIComponent(connectionId)}&ids=${wanted.join(",")}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) return;
        remember(connectionId, body.posts ?? []);
        for (const id of wanted) if (!postCache.has(cacheKey(connectionId, id))) missingCache.add(cacheKey(connectionId, id));
      } finally {
        pending.delete(key);
      }
    })());
  }
  await pending.get(key);
}

/** Resolves chosen post ids to posts (thumbnail, caption). Unknown posts come back as null. */
export function usePosts(connectionId: string, ids: string[]) {
  const signature = ids.join(",");
  const read = useCallback(() => ids.map(id => postCache.get(cacheKey(connectionId, id)) ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectionId, signature]);
  const [posts, setPosts] = useState<Array<AutomationPost | null>>(read);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setPosts(read());
    if (!connectionId || !ids.length) return;
    let alive = true;
    setLoading(true);
    void loadIds(connectionId, ids).finally(() => { if (alive) { setPosts(read()); setLoading(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, signature, read]);
  return { posts, loading };
}

const TYPE_LABEL: Record<AutomationPost["type"], string> = { reel: "Reels", carousel: "Carrossel", video: "Vídeo", image: "Foto" };

function TypeIcon({ type, size = 12 }: { type: AutomationPost["type"]; size?: number }) {
  if (type === "reel" || type === "video") return <Film size={size} />;
  if (type === "carousel") return <Copy size={size} />;
  return <ImageIcon size={size} />;
}

export function PostThumb({ post, size, className = "" }: { post: AutomationPost | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  if (!post || !post.thumbnail || broken) {
    return <span className={`ig-pick-thumb is-empty ${className}`} style={style} title={post ? post.caption || TYPE_LABEL[post.type] : "Post indisponível"}><TypeIcon type={post?.type ?? "image"} size={Math.max(10, Math.round((size ?? 40) / 3))} /></span>;
  }
  return (
    <span className={`ig-pick-thumb ${className}`} style={style} title={post.caption || TYPE_LABEL[post.type]}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    </span>
  );
}

/** Overlapping thumbnails, used on flow cards and on the trigger block. */
export function PostStack({ connectionId, ids, size = 22, max = 3 }: { connectionId: string; ids: string[]; size?: number; max?: number }) {
  const { posts } = usePosts(connectionId, ids.slice(0, max));
  if (!ids.length) return null;
  return (
    <span className="ig-pick-stack" aria-label={`${ids.length} ${ids.length === 1 ? "post" : "posts"}`}>
      {posts.map((post, index) => <PostThumb key={ids[index]} post={post} size={size} />)}
      {ids.length > max && <span className="ig-pick-more" style={{ height: size, minWidth: size }}>+{ids.length - max}</span>}
    </span>
  );
}

/** "Todos os posts" or "Posts específicos", with the chosen thumbnails and the picker. */
export function PostScopeField({ connectionId, scope, mediaIds, onChange }: {
  connectionId: string;
  scope: "all" | "specific";
  mediaIds: string[];
  onChange: (patch: { scope: "all" | "specific"; mediaIds: string[] }) => void;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { posts } = usePosts(connectionId, mediaIds);
  const openPicker = () => setHost(root.current?.closest<HTMLElement>(".ig-flow-dialog") ?? document.body);
  return (
    <div className="ig-pick-scope" ref={root}>
      <div className="ig-flow-segmented" role="radiogroup" aria-label="Em quais posts">
        <button type="button" role="radio" aria-checked={scope === "all"} onClick={() => onChange({ scope: "all", mediaIds })}>Todos os posts</button>
        <button type="button" role="radio" aria-checked={scope === "specific"} onClick={() => {
          onChange({ scope: "specific", mediaIds });
          if (!mediaIds.length) openPicker();
        }}>Posts específicos</button>
      </div>
      {scope === "specific" && (
        <div className="ig-pick-chosen">
          {mediaIds.map((id, index) => (
            <span key={id} className="ig-pick-chosen-item">
              <PostThumb post={posts[index]} />
              {posts[index]?.type && posts[index]?.type !== "image" && <em className="ig-pick-badge"><TypeIcon type={posts[index]!.type} size={10} /></em>}
              <button type="button" aria-label="Remover post" onClick={() => onChange({ scope, mediaIds: mediaIds.filter(item => item !== id) })}><X size={11} /></button>
            </span>
          ))}
          <button type="button" className="ig-pick-add" onClick={openPicker} disabled={!connectionId}>
            <Plus size={15} /><span>{mediaIds.length ? "Alterar" : "Escolher"}</span>
          </button>
        </div>
      )}
      {host && createPortal(
        <PostPicker connectionId={connectionId} selected={mediaIds} onClose={() => setHost(null)} onConfirm={ids => { onChange({ scope: "specific", mediaIds: ids }); setHost(null); }} />,
        host,
      )}
    </div>
  );
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function PostPicker({ connectionId, selected, onClose, onConfirm }: {
  connectionId: string;
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [posts, setPosts] = useState<AutomationPost[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ connectionId });
      if (cursor) query.set("after", cursor);
      const response = await fetch(`/api/marketing/instagram/automations/media?${query}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os posts");
      const page = (body.posts ?? []) as AutomationPost[];
      remember(connectionId, page);
      setPosts(current => [...current, ...page.filter(post => !current.some(item => item.id === post.id))]);
      setAfter(body.after ?? null);
      setDone(!body.after);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os posts");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);
  useEffect(() => { void load(null); }, [load]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Chosen posts older than the loaded pages still show up first.
  const older = selected.filter(id => !posts.some(post => post.id === id));
  const { posts: olderPosts } = usePosts(connectionId, older);
  const list = [...olderPosts.filter((post): post is AutomationPost => Boolean(post) && !posts.some(item => item.id === post!.id)), ...posts];
  const toggle = (id: string) => setChosen(current => current.includes(id)
    ? current.filter(item => item !== id)
    : current.length >= MAX_POSTS ? current : [...current, id]);

  return (
    <div className="ig-pick-picker-layer" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="ig-pick-picker" role="dialog" aria-modal="true" aria-label="Escolher posts">
        <header>
          <div>
            <span className="ig-eyebrow">GATILHO</span>
            <h3>Escolher posts</h3>
            <p>O fluxo só começa com comentários nos posts marcados.</p>
          </div>
          <button type="button" className="ig-pick-picker-close" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </header>
        <div className="ig-pick-grid-wrap">
          {error && !list.length ? <div className="ig-pick-picker-state">{error}<button type="button" className="ig-btn" onClick={() => void load(null)}>Tentar de novo</button></div> : (
            <>
              <div className="ig-pick-grid">
                {list.map(post => {
                  const order = chosen.indexOf(post.id);
                  return (
                    <button key={post.id} type="button" className={`ig-pick-tile${order >= 0 ? " is-chosen" : ""}`} aria-pressed={order >= 0} onClick={() => toggle(post.id)}
                      disabled={order < 0 && chosen.length >= MAX_POSTS}>
                      <PostThumb post={post} />
                      <span className="ig-pick-tile-shade" />
                      <span className="ig-pick-tile-check">{order >= 0 ? order + 1 : <Check size={12} />}</span>
                      {post.type !== "image" && <em className="ig-pick-badge"><TypeIcon type={post.type} size={11} /></em>}
                      <span className="ig-pick-tile-meta">
                        <small>{shortDate(post.publishedAt)}</small>
                        <small><MessageCircle size={10} />{post.comments.toLocaleString("pt-BR")}</small>
                      </span>
                      {post.caption && <span className="ig-pick-tile-caption">{post.caption}</span>}
                    </button>
                  );
                })}
                {loading && Array.from({ length: list.length ? 4 : 12 }, (_, index) => <span key={`s${index}`} className="ig-pick-tile is-skeleton" />)}
              </div>
              {!loading && !list.length && <div className="ig-pick-picker-state">Nenhum post publicado nesta conta ainda.</div>}
              {error && list.length > 0 && <p className="ig-pick-picker-error">{error}</p>}
              {!done && !loading && list.length > 0 && <button type="button" className="ig-btn ig-pick-more-btn" onClick={() => void load(after)}>Carregar mais posts</button>}
              {loading && list.length > 0 && <p className="ig-pick-picker-loading"><Loader2 size={14} className="animate-spin" />Carregando…</p>}
            </>
          )}
        </div>
        <footer>
          <span>{chosen.length ? `${chosen.length} ${chosen.length === 1 ? "post selecionado" : "posts selecionados"}` : "Nenhum post selecionado"}<small> · até {MAX_POSTS}</small></span>
          <div>
            {chosen.length > 0 && <button type="button" className="ig-btn" onClick={() => setChosen([])}>Limpar</button>}
            <button type="button" className="ig-btn" onClick={onClose}>Cancelar</button>
            <button type="button" className="ig-btn ig-primary" onClick={() => onConfirm(chosen)} disabled={!chosen.length}>Usar {chosen.length || ""} {chosen.length === 1 ? "post" : "posts"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
