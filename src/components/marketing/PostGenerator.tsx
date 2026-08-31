"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, AtSign,
  Bold, Bookmark, Check, ChevronRight, Copy, Download, GripVertical, Heart, Highlighter, ImagePlus,
  Italic, Layers3, MessageCircle, MoreHorizontal, Move, Moon, Palette, Plus, Send, Sun, Trash2,
  Underline, Upload, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createZip, defaultPostLineHeight, normalizePostLineHeight, normalizePostTextWidth, numberedSlideFilename, POST_FORMATS, postElementToPng, sanitizeDownloadName, saveBlob,
  type PostFormat, type PostTemplate,
} from "@/lib/marketing/post-generator";
import {
  getRemotePostProject,
  getRemotePostProjectIfChanged,
  newestPostProject,
  postProjectHasUserContent,
  saveRemotePostProject,
} from "@/lib/marketing/post-project-sync";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store";

type Slide = {
  id: string;
  background: string;
  foreground: string;
  content: string;
  textBlocks: TextBlock[];
  layout: string[];
  media: string[];
  mediaCrops: MediaCrop[];
  backgroundImage: string;
  imageDarkness: number;
  fontSize: number;
  textX: number;
  textY: number;
  textWidth: number;
  textPlacement: "above" | "below" | "free";
  mediaPosition: "top" | "bottom";
};

type MediaCrop = { x: number; y: number; zoom: number };
type TextBlock = { id: string; content: string; fontSize: number; textWidth: number; lineHeight: number };
type TweetProfile = { avatar: string; avatarCrop: MediaCrop; name: string; handle: string; verified: boolean };
type PersistedPostProject = { version: 1; format: PostFormat; slides: Slide[]; activeId: string; tweetProfile: TweetProfile; updatedAt: number };

const ACTIVE_TEMPLATE_KEY = "genesy-post-generator-active-template";
const QUICK_TEXT_COLORS = [
  { value: "#dd1c00", label: "Vermelho" },
  { value: "#f8ad1b", label: "Amarelo" },
  { value: "#007ae6", label: "Azul" },
  { value: "#07d140", label: "Verde" },
] as const;

const DEFAULT_PROFILE: TweetProfile = {
  avatar: "",
  avatarCrop: { x: 50, y: 50, zoom: 1 },
  name: "Genesy Company",
  handle: "@genesycompany",
  verified: true,
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function defaultMediaCrop(): MediaCrop { return { x: 50, y: 50, zoom: 1 }; }
function makeTextBlock(template: PostTemplate, content: string): TextBlock { return { id: uid(), content, fontSize: template === "tweet" ? 45 : 70, textWidth: template === "tweet" ? 76 : 84, lineHeight: defaultPostLineHeight(template) }; }

let postProjectDatabase: Promise<IDBDatabase> | null = null;

function openPostProjectDatabase() {
  if (!postProjectDatabase) postProjectDatabase = new Promise((resolve, reject) => {
    const request = indexedDB.open("genesy-post-generator", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("projects")) request.result.createObjectStore("projects");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return postProjectDatabase;
}

async function loadPostProject(template: PostTemplate): Promise<PersistedPostProject | undefined> {
  const database = await openPostProjectDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("projects", "readonly").objectStore("projects").get(template);
    request.onsuccess = () => resolve(request.result as PersistedPostProject | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function savePostProject(template: PostTemplate, project: PersistedPostProject) {
  const database = await openPostProjectDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("projects", "readwrite");
    transaction.objectStore("projects").put(project, template);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function contrastColor(background: string) {
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (red * 299 + green * 587 + blue * 114) / 255000;
  return luminance > 0.56 ? "#000000" : "#ffffff";
}

function makeSlide(template: PostTemplate, index = 0): Slide {
  const content = template === "tweet"
    ? "<p>Escreva aqui uma ideia forte, simples e impossível de ignorar.</p>"
    : `<p>${index === 0 ? "Uma boa história começa com uma frase que prende." : "Continue a narrativa com clareza e ritmo."}</p>`;
  const textBlock = makeTextBlock(template, content);
  return {
    id: uid(),
    background: template === "tweet" ? "#ffffff" : "#000000",
    foreground: template === "tweet" ? "#0f1419" : "#ffffff",
    content,
    textBlocks: [textBlock],
    layout: [textBlock.id, "media"],
    media: [],
    mediaCrops: [],
    backgroundImage: "",
    imageDarkness: 42,
    fontSize: template === "tweet" ? 45 : 70,
    textX: template === "tweet" ? 12 : 8,
    textY: template === "tweet" ? 31 : 12,
    textWidth: template === "tweet" ? 76 : 84,
    textPlacement: "above",
    mediaPosition: "bottom",
  };
}

function normalizePostProject(template: PostTemplate, project: PersistedPostProject) {
  const slides = project.slides.map((slide, index) => {
    const base = makeSlide(template, index);
    const media = Array.isArray(slide.media) ? slide.media.slice(0, 2) : [];
    const mediaCrops = media.map((_, mediaIndex) => ({ ...defaultMediaCrop(), ...(Array.isArray(slide.mediaCrops) ? slide.mediaCrops[mediaIndex] : undefined) }));
    const textBlocks = Array.isArray(slide.textBlocks) && slide.textBlocks.length
      ? slide.textBlocks.map((block) => ({
          ...makeTextBlock(template, block.content || "<p>Novo texto</p>"),
          ...block,
          id: block.id || uid(),
          lineHeight: normalizePostLineHeight(template, block.lineHeight),
          textWidth: normalizePostTextWidth(template, block.textWidth),
        }))
      : [{ ...makeTextBlock(template, slide.content || base.content), fontSize: slide.fontSize || base.fontSize, textWidth: normalizePostTextWidth(template, slide.textWidth) }];
    const validKeys = new Set(["media", ...textBlocks.map((block) => block.id)]);
    const savedLayout = Array.isArray(slide.layout) ? slide.layout.filter((key) => validKeys.has(key)) : [];
    const fallbackLayout = slide.mediaPosition === "top" ? ["media", ...textBlocks.map((block) => block.id)] : [...textBlocks.map((block) => block.id), "media"];
    const layout = [...savedLayout, ...fallbackLayout.filter((key) => !savedLayout.includes(key))];
    return { ...base, ...slide, id: slide.id || uid(), media, mediaCrops, textBlocks, layout };
  });
  const activeId = slides.some((slide) => slide.id === project.activeId) ? project.activeId : slides[0].id;
  return {
    slides,
    activeId,
    activeTextBlockId: slides.find((slide) => slide.id === activeId)?.textBlocks[0].id || slides[0].textBlocks[0].id,
    format: project.format === "portrait" ? "portrait" as const : "story" as const,
    tweetProfile: {
      ...DEFAULT_PROFILE,
      ...project.tweetProfile,
      avatarCrop: { ...defaultMediaCrop(), ...project.tweetProfile?.avatarCrop },
    },
  };
}

export function PostGenerator() {
  const [template, setTemplate] = useState<PostTemplate | null>(null);
  const [templateReady, setTemplateReady] = useState(false);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(ACTIVE_TEMPLATE_KEY);
      if (saved === "tweet" || saved === "stories") setTemplate(saved);
    } catch {
      // Alguns modos privados bloqueiam storage; a sessão segue apenas em memória.
    } finally {
      setTemplateReady(true);
    }
  }, []);
  const chooseTemplate = (value: PostTemplate) => {
    try { window.sessionStorage.setItem(ACTIVE_TEMPLATE_KEY, value); } catch { /* O editor ainda funciona sem persistência de sessão. */ }
    setTemplate(value);
  };
  const closeEditor = () => {
    try { window.sessionStorage.removeItem(ACTIVE_TEMPLATE_KEY); } catch { /* Storage indisponível. */ }
    setTemplate(null);
  };
  if (!templateReady) return <div className="min-h-[calc(100dvh-65px)]" aria-label="Restaurando gerador de posts" />;
  if (!template) return <TemplateGallery onChoose={chooseTemplate} />;
  return <PostEditor key={template} template={template} onBack={closeEditor} />;
}

function TemplateGallery({ onChoose }: { onChoose: (template: PostTemplate) => void }) {
  return (
    <div className="px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--accent-blue)]">Criação visual</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-title)] sm:text-3xl">Gerador de Posts</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">Escolha um modelo, crie sua sequência e exporte tudo pronto para publicar.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] text-[var(--muted-foreground)]" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}><Layers3 size={13} /> PNG em alta qualidade</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <TemplateCard template="tweet" title="Tweet" description="Post com perfil fixo, texto formatável e uma ou duas imagens horizontais." onChoose={onChoose} />
          <TemplateCard template="stories" title="Stories Plus" description="Composição editorial limpa em Advercase para stories e posts verticais." onChoose={onChoose} />
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, title, description, onChoose }: { template: PostTemplate; title: string; description: string; onChoose: (value: PostTemplate) => void }) {
  return (
    <button onClick={() => onChoose(template)} className="group overflow-hidden rounded-[24px] border text-left transition duration-300 hover:-translate-y-1" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
      <div className="relative grid h-72 place-items-center overflow-hidden bg-[var(--hover)] p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(39,163,255,.15),transparent_42%)]" />
        {template === "tweet" ? <TweetMiniature /> : <StoriesMiniature />}
      </div>
      <div className="flex items-center justify-between gap-5 p-5">
        <div><h2 className="text-lg font-semibold text-[var(--text-title)]">{title}</h2><p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p></div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-[var(--text-title)] transition group-hover:bg-[var(--hover)]"><ChevronRight size={18} /></span>
      </div>
    </button>
  );
}

function TweetMiniature() {
  return <div className="relative w-full max-w-[370px] rounded-[24px] bg-white p-6 text-[#0f1419] shadow-2xl"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0f1419] text-white"><UserRound size={18} /></span><div><p className="text-sm font-bold">Genesy Company <span className="text-[#1d9bf0]">●</span></p><p className="text-[11px] text-[#536471]">@genesycompany</p></div></div><p className="mt-4 text-xl font-medium leading-snug">Ideias que parecem simples são as mais difíceis de esquecer.</p><div className="mt-4 aspect-[16/7] rounded-xl bg-gradient-to-br from-[#111] via-[#26313b] to-[#27a3ff]" /></div>;
}

function StoriesMiniature() {
  return <div className="relative h-64 w-44 overflow-hidden rounded-[20px] bg-black p-5 text-white shadow-2xl"><div className="absolute left-5 right-5 top-10 aspect-video rounded-lg bg-gradient-to-br from-[#27a3ff] to-[#8047ff]" /><p className="absolute bottom-10 left-5 right-5 font-[Advercase] text-2xl font-normal leading-[.9]">Conteúdo que ocupa espaço na memória.</p></div>;
}

function PostEditor({ template, onBack }: { template: PostTemplate; onBack: () => void }) {
  const preserveState = useGlobalStore((state) => state.preserveState);
  const releaseState = useGlobalStore((state) => state.releaseState);
  const firstSlide = useMemo(() => makeSlide(template), [template]);
  const [format, setFormat] = useState<PostFormat>("story");
  const [slides, setSlides] = useState<Slide[]>([firstSlide]);
  const [activeId, setActiveId] = useState(firstSlide.id);
  const [activeTextBlockId, setActiveTextBlockId] = useState(firstSlide.textBlocks[0].id);
  const [tweetProfile, setTweetProfile] = useState<TweetProfile>(DEFAULT_PROFILE);
  const [storageReady, setStorageReady] = useState(false);
  const [syncState, setSyncState] = useState<"saving" | "synced" | "offline">("saving");
  const [exporting, setExporting] = useState<"one" | "all" | null>(null);
  const defaultExportName = template === "tweet" ? "posts-tweet" : "stories-plus";
  const [exportName, setExportName] = useState(defaultExportName);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const exportRefs = useRef(new Map<string, HTMLDivElement>());
  const activeIdRef = useRef(activeId);
  const activeTextBlockIdRef = useRef(activeTextBlockId);
  const lastProjectUpdatedAtRef = useRef(0);
  const currentProjectRef = useRef<PersistedPostProject | undefined>(undefined);
  const storageRevisionRef = useRef<string | null>(null);
  const applyingRemoteRef = useRef(false);
  const remoteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  activeIdRef.current = activeId;
  activeTextBlockIdRef.current = activeTextBlockId;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeId));
  const active = slides[activeIndex];
  const activeTextBlock = active.textBlocks.find((block) => block.id === activeTextBlockId) || active.textBlocks[0];
  const dimensions = POST_FORMATS[format];

  useEffect(() => {
    preserveState();
    return () => releaseState();
  }, [preserveState, releaseState]);

  const restoreProject = useCallback((project: PersistedPostProject) => {
    if (!project.slides?.length) return;
    const restored = normalizePostProject(template, project);
    applyingRemoteRef.current = true;
    lastProjectUpdatedAtRef.current = project.updatedAt;
    currentProjectRef.current = project;
    setSlides(restored.slides);
    setActiveId(restored.activeId);
    setActiveTextBlockId(restored.activeTextBlockId);
    setFormat(restored.format);
    setTweetProfile(restored.tweetProfile);
  }, [template]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, bulletList: false, orderedList: false, code: false, codeBlock: false, horizontalRule: false }),
      UnderlineExtension,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: firstSlide.textBlocks[0].content,
    onUpdate: ({ editor: currentEditor }) => {
      const id = activeIdRef.current;
      const blockId = activeTextBlockIdRef.current;
      setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, textBlocks: slide.textBlocks.map((block) => block.id === blockId ? { ...block, content: currentEditor.getHTML() } : block) } : slide));
    },
  });

  useEffect(() => {
    let mounted = true;
    void Promise.allSettled([
      loadPostProject(template),
      getRemotePostProject<PersistedPostProject>(template),
    ]).then(async ([localResult, remoteResult]) => {
      if (!mounted) return;
      const local = localResult.status === "fulfilled" ? localResult.value : undefined;
      const remote = remoteResult.status === "fulfilled" ? remoteResult.value.project : undefined;
      if (remoteResult.status === "fulfilled") storageRevisionRef.current = remoteResult.value.storageUpdatedAt;
      const project = newestPostProject(local, remote);
      if (project?.slides?.length) {
        restoreProject(project);
        await savePostProject(template, project).catch(() => undefined);
      }
      if (project && postProjectHasUserContent(project) && (!remote || project !== remote)) {
        try {
          storageRevisionRef.current = await saveRemotePostProject(template, project);
          if (mounted) setSyncState("synced");
        } catch (error) {
          console.error("Não foi possível migrar o projeto local para a nuvem.", error);
          if (mounted) setSyncState("offline");
        }
      } else if (remoteResult.status === "fulfilled") {
        setSyncState("synced");
      } else {
        setSyncState("offline");
      }
    }).finally(() => {
      if (mounted) {
        applyingRemoteRef.current = true;
        setStorageReady(true);
      }
    });
    return () => { mounted = false; };
  }, [restoreProject, template]);

  useEffect(() => {
    if (!storageReady) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    const project: PersistedPostProject = { version: 1, format, slides, activeId, tweetProfile, updatedAt: Date.now() };
    lastProjectUpdatedAtRef.current = project.updatedAt;
    currentProjectRef.current = project;
    void savePostProject(template, project).catch((error) => console.error("Não foi possível salvar o Gerador de Posts localmente.", error));
    setSyncState("saving");
    if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    remoteSaveTimerRef.current = setTimeout(() => {
      void saveRemotePostProject(template, project).then((storageUpdatedAt) => {
        storageRevisionRef.current = storageUpdatedAt;
        setSyncState("synced");
      }).catch((error) => {
        console.error("Não foi possível sincronizar o Gerador de Posts.", error);
        setSyncState("offline");
      });
    }, 600);
    return () => {
      if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    };
  }, [activeId, format, slides, storageReady, template, tweetProfile]);

  useEffect(() => {
    if (!storageReady) return;
    let checking = false;
    const checkRemote = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const remote = await getRemotePostProjectIfChanged<PersistedPostProject>(template, storageRevisionRef.current);
        storageRevisionRef.current = remote.storageUpdatedAt;
        const preferred = remote.project?.slides?.length
          ? newestPostProject(currentProjectRef.current, remote.project)
          : currentProjectRef.current;
        if (remote.changed && remote.project && preferred === remote.project && remote.project !== currentProjectRef.current) {
          restoreProject(remote.project);
          await savePostProject(template, remote.project);
          setSyncState("synced");
        }
      } catch (error) {
        console.error("Não foi possível verificar atualizações do Gerador de Posts.", error);
        setSyncState((current) => current === "saving" ? current : "offline");
      } finally {
        checking = false;
      }
    };
    const interval = window.setInterval(() => void checkRemote(), 5000);
    const onFocus = () => void checkRemote();
    const onVisibility = () => { if (document.visibilityState === "visible") void checkRemote(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [restoreProject, storageReady, template]);

  useEffect(() => {
    const pasteImage = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      const file = Array.from(clipboard?.files ?? []).find((item) => item.type.startsWith("image/"))
        ?? Array.from(clipboard?.items ?? []).find((item) => item.type.startsWith("image/"))?.getAsFile();
      if (!file) return;
      event.preventDefault();
      if (active.media.length >= 2) return toast.error("Este slide já possui duas imagens. Remova uma delas para colar outra.");
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        setSlides((current) => current.map((slide) => slide.id === activeId
          ? { ...slide, media: [...slide.media, url].slice(0, 2), mediaCrops: [...slide.mediaCrops, defaultMediaCrop()].slice(0, 2) }
          : slide));
        toast.success("Imagem colada no slide.");
      };
      reader.onerror = () => toast.error("Não foi possível ler a imagem copiada.");
      reader.readAsDataURL(file);
    };
    window.addEventListener("paste", pasteImage);
    return () => window.removeEventListener("paste", pasteImage);
  }, [active.media.length, activeId]);

  useEffect(() => {
    if (!editor) return;
    const next = slides.find((slide) => slide.id === activeId);
    const block = next?.textBlocks.find((item) => item.id === activeTextBlockId) || next?.textBlocks[0];
    if (block && editor.getHTML() !== block.content) editor.commands.setContent(block.content, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeTextBlockId, editor]);

  useEffect(() => {
    if (!active.textBlocks.some((block) => block.id === activeTextBlockId)) setActiveTextBlockId(active.textBlocks[0].id);
  }, [active, activeTextBlockId]);

  const update = (patch: Partial<Slide>) => setSlides((current) => current.map((slide) => slide.id === activeId ? { ...slide, ...patch } : slide));
  const updateTextBlock = (patch: Partial<TextBlock>) => update({ textBlocks: active.textBlocks.map((block) => block.id === activeTextBlockId ? { ...block, ...patch } : block) });

  const addTextBlock = () => {
    const block = makeTextBlock(template, "<p>Novo texto</p>");
    const activeLayoutIndex = active.layout.indexOf(activeTextBlockId);
    const layout = [...active.layout];
    layout.splice(activeLayoutIndex >= 0 ? activeLayoutIndex + 1 : layout.length, 0, block.id);
    update({ textBlocks: [...active.textBlocks, block], layout });
    setActiveTextBlockId(block.id);
  };

  const removeTextBlock = () => {
    if (active.textBlocks.length === 1) return toast.error("O slide precisa ter pelo menos uma caixa de texto.");
    const index = active.textBlocks.findIndex((block) => block.id === activeTextBlockId);
    const textBlocks = active.textBlocks.filter((block) => block.id !== activeTextBlockId);
    update({ textBlocks, layout: active.layout.filter((key) => key !== activeTextBlockId) });
    setActiveTextBlockId(textBlocks[Math.min(Math.max(index, 0), textBlocks.length - 1)].id);
  };

  const reorderLayout = (sourceId: string, targetId: string, after: boolean) => {
    if (sourceId === targetId) return;
    const layout = active.layout.filter((key) => key !== sourceId);
    const targetIndex = layout.indexOf(targetId);
    layout.splice(targetIndex < 0 ? layout.length : targetIndex + (after ? 1 : 0), 0, sourceId);
    update({ layout, textPlacement: "above" });
  };

  const placeActiveText = (placement: "above" | "below") => {
    const layout = active.layout.filter((key) => key !== activeTextBlockId);
    const mediaIndex = layout.indexOf("media");
    layout.splice(mediaIndex < 0 ? layout.length : mediaIndex + (placement === "below" ? 1 : 0), 0, activeTextBlockId);
    update({ layout, mediaPosition: placement === "above" ? "bottom" : "top", textPlacement: placement });
  };

  const addSlide = () => {
    const next = {
      ...makeSlide(template, slides.length),
      background: active.background,
      foreground: contrastColor(active.background),
    };
    setSlides((current) => [...current, next]);
    setActiveId(next.id);
    setActiveTextBlockId(next.textBlocks[0].id);
  };

  const duplicateSlide = (id: string) => {
    const sourceIndex = slides.findIndex((slide) => slide.id === id);
    if (sourceIndex < 0) return;
    const source = slides[sourceIndex];
    const idMap = new Map(source.textBlocks.map((block) => [block.id, uid()]));
    const textBlocks = source.textBlocks.map((block) => ({ ...block, id: idMap.get(block.id)! }));
    const next = { ...source, id: uid(), media: [...source.media], mediaCrops: source.mediaCrops.map((crop) => ({ ...crop })), textBlocks, layout: source.layout.map((key) => idMap.get(key) || key) };
    setSlides((current) => [...current.slice(0, sourceIndex + 1), next, ...current.slice(sourceIndex + 1)]);
    setActiveId(next.id);
    setActiveTextBlockId(textBlocks[0].id);
  };
  const duplicate = () => duplicateSlide(activeId);

  const removeSlide = (id: string) => {
    if (slides.length === 1) return toast.error("O projeto precisa ter pelo menos um slide.");
    const removeIndex = slides.findIndex((slide) => slide.id === id);
    if (removeIndex < 0) return;
    const next = slides.filter((slide) => slide.id !== id);
    setSlides(next);
    if (activeId === id) setActiveId(next[Math.min(removeIndex, next.length - 1)].id);
  };
  const remove = () => removeSlide(activeId);

  const reorderSlides = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setSlides((current) => {
      const sourceIndex = current.findIndex((slide) => slide.id === sourceId);
      const targetIndex = current.findIndex((slide) => slide.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const move = (direction: -1 | 1) => {
    const target = activeIndex + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((current) => { const next = [...current]; [next[activeIndex], next[target]] = [next[target], next[activeIndex]]; return next; });
  };

  async function exportOne() {
    const element = exportRefs.current.get(activeId);
    if (!element) return;
    setExporting("one");
    try {
      const blob = await postElementToPng(element, dimensions.width, dimensions.height);
      await saveBlob(blob, numberedSlideFilename(activeIndex));
      toast.success("Slide exportado em alta qualidade.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao exportar o slide."); }
    finally { setExporting(null); }
  }

  async function exportAll(requestedName: string) {
    const filename = `${sanitizeDownloadName(requestedName, defaultExportName)}.zip`;
    setExporting("all");
    try {
      const files: Array<{ name: string; data: Uint8Array }> = [];
      for (let index = 0; index < slides.length; index++) {
        const element = exportRefs.current.get(slides[index].id);
        if (!element) continue;
        const blob = await postElementToPng(element, dimensions.width, dimensions.height);
        files.push({ name: numberedSlideFilename(index), data: new Uint8Array(await blob.arrayBuffer()) });
      }
      await saveBlob(createZip(files), filename);
      toast.success(`${filename} enviado para os downloads do navegador.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao exportar os slides."); }
    finally { setExporting(null); }
  }

  if (!storageReady) {
    return (
      <div className="flex min-h-[calc(100dvh-65px)] flex-col">
        <div className="flex items-center gap-3 border-b px-3 py-3 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar aos modelos"><ArrowLeft /></Button>
          <div><h1 className="text-sm font-semibold text-[var(--text-title)]">{template === "tweet" ? "Modelo Tweet" : "Stories Plus"}</h1><p className="text-[10px] text-[var(--muted-foreground)]">Restaurando seu projeto…</p></div>
        </div>
        <div className="grid flex-1 place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--glass-border)] border-t-[var(--accent-blue)]" aria-label="Restaurando projeto" /></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-65px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-5" style={{ borderColor: "var(--border)" }}>
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar aos modelos"><ArrowLeft /></Button>
        <div className="mr-auto min-w-0"><h1 className="truncate text-sm font-semibold text-[var(--text-title)]">{template === "tweet" ? "Modelo Tweet" : "Stories Plus"}</h1><p className="text-[10px] text-[var(--muted-foreground)]">{slides.length} {slides.length === 1 ? "slide" : "slides"} · {dimensions.label} · <span aria-live="polite">{syncState === "saving" ? "Salvando…" : syncState === "synced" ? "Sincronizado" : "Salvo neste dispositivo · aguardando conexão"}</span></p></div>
        <div className="hidden items-center gap-1 rounded-xl border p-1 sm:flex" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
          {(Object.entries(POST_FORMATS) as Array<[PostFormat, typeof dimensions]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium transition", format === value ? "bg-[var(--segment-active-bg)] text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]")}>{item.label}</button>)}
        </div>
        <Button variant="outline" onClick={() => void exportOne()} loading={exporting === "one"} icon={<Download />}>Slide atual</Button>
        <Button onClick={() => setExportDialogOpen(true)} loading={exporting === "all"} icon={<Layers3 />} signature>Baixar todos</Button>
      </div>

      <div className="grid flex-1 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <SlidesRail slides={slides} activeId={activeId} template={template} format={format} profile={tweetProfile} onSelect={setActiveId} onAdd={addSlide} onDuplicate={duplicateSlide} onRemove={removeSlide} onReorder={reorderSlides} />

        <main className="min-w-0 border-b p-4 lg:border-b-0 lg:border-x lg:p-6" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--text-title)]">Pré-visualização</p><p className="text-[10px] text-[var(--muted-foreground)]">Selecione um trecho para formatar ou cole uma imagem com Ctrl+V / ⌘V.</p></div><span className="rounded-full border px-2.5 py-1 text-[10px] text-[var(--muted-foreground)]">Slide {activeIndex + 1} de {slides.length}</span></div>
          <TextToolbar editor={editor} defaultColor={active.foreground} allowItalic={template === "stories"} />
          <ScaledCanvas width={dimensions.width} height={dimensions.height} format={format} profile={tweetProfile}>
            <PostCanvas slide={active} profile={tweetProfile} template={template} width={dimensions.width} height={dimensions.height} editable editor={editor} activeTextBlockId={activeTextBlockId} onSelectTextBlock={setActiveTextBlockId} onReorderText={reorderLayout} />
          </ScaledCanvas>
          <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-1.5"><Button variant="outline" size="sm" onClick={() => move(-1)} disabled={activeIndex === 0} aria-label="Mover slide para cima"><ArrowUp /></Button><Button variant="outline" size="sm" onClick={() => move(1)} disabled={activeIndex === slides.length - 1} aria-label="Mover slide para baixo"><ArrowDown /></Button><Button variant="outline" size="sm" onClick={duplicate} icon={<Copy />}>Duplicar</Button><Button variant="danger" size="sm" onClick={remove} icon={<Trash2 />}>Excluir</Button></div>
        </main>

        <PropertiesPanel template={template} format={format} setFormat={setFormat} slide={active} update={update} activeTextBlock={activeTextBlock} selectTextBlock={setActiveTextBlockId} updateTextBlock={updateTextBlock} addTextBlock={addTextBlock} removeTextBlock={removeTextBlock} placeText={placeActiveText} profile={tweetProfile} setProfile={setTweetProfile} />
      </div>

      <div aria-hidden className="pointer-events-none fixed left-[-12000px] top-0">
        {slides.map((slide) => <PostCanvas key={slide.id} slide={slide} profile={tweetProfile} template={template} width={dimensions.width} height={dimensions.height} refCallback={(node) => { if (node) exportRefs.current.set(slide.id, node); else exportRefs.current.delete(slide.id); }} />)}
      </div>

      {exportDialogOpen && (
        <ExportNameDialog
          value={exportName}
          onChange={setExportName}
          onClose={() => setExportDialogOpen(false)}
          onConfirm={() => {
            setExportDialogOpen(false);
            void exportAll(exportName);
          }}
        />
      )}
    </div>
  );
}

function ExportNameDialog({ value, onChange, onClose, onConfirm }: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="export-name-title">
      <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-label="Cancelar exportação" />
      <form
        className="lc-modal-panel relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        onSubmit={(event) => { event.preventDefault(); onConfirm(); }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="export-name-title" className="text-base font-semibold text-[var(--text-title)]">Nomear arquivo</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">O arquivo será baixado como ZIP. Dentro dele, os slides serão numerados como 1.png, 2.png, 3.png e assim por diante.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--hover)] hover:text-[var(--text-title)]" aria-label="Fechar"><X size={16} /></button>
        </div>
        <label className="mt-5 block text-xs font-medium text-[var(--text-title)]" htmlFor="post-export-name">Nome do arquivo</label>
        <div className="mt-2 flex items-center rounded-xl border px-3" style={{ background: "var(--hover)", borderColor: "var(--border)" }}>
          <input
            id="post-export-name"
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[var(--text-title)] outline-none"
            placeholder="Ex.: campanha-agosto"
            maxLength={100}
          />
          <span className="text-xs text-[var(--muted-foreground)]">.zip</span>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" icon={<Download />}>Baixar slides</Button>
        </div>
      </form>
    </div>
  );
}

function SlidesRail({ slides, activeId, template, format, profile, onSelect, onAdd, onDuplicate, onRemove, onReorder }: { slides: Slide[]; activeId: string; template: PostTemplate; format: PostFormat; profile: TweetProfile; onSelect: (id: string) => void; onAdd: () => void; onDuplicate: (id: string) => void; onRemove: (id: string) => void; onReorder: (sourceId: string, targetId: string) => void }) {
  const dimensions = POST_FORMATS[format];
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const previewWidth = 36;
  const previewHeight = 48;
  const scale = Math.min(previewWidth / dimensions.width, previewHeight / dimensions.height);
  const left = (previewWidth - dimensions.width * scale) / 2;
  const top = (previewHeight - dimensions.height * scale) / 2;
  return <aside className="border-b p-3 lg:border-b-0 lg:p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">Slides</p><span className="text-[10px] text-[var(--muted-foreground)]">{slides.length}</span></div><div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">{slides.map((slide, index) => <div key={slide.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", slide.id); setDraggedId(slide.id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetId(slide.id); }} onDragLeave={() => setDropTargetId((current) => current === slide.id ? null : current)} onDrop={(event) => { event.preventDefault(); const sourceId = draggedId || event.dataTransfer.getData("text/plain"); if (sourceId) onReorder(sourceId, slide.id); setDraggedId(null); setDropTargetId(null); }} onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }} className={cn("group flex min-w-[190px] cursor-grab items-center gap-1 rounded-xl border p-1.5 text-left transition active:cursor-grabbing lg:w-full lg:min-w-0", activeId === slide.id ? "border-[var(--accent-blue)] bg-[var(--hover)]" : "border-transparent hover:bg-[var(--hover)]", draggedId === slide.id && "opacity-45", dropTargetId === slide.id && draggedId !== slide.id && "border-dashed border-[var(--accent-blue)]")}>
    <button type="button" onClick={() => onSelect(slide.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left" aria-label={`Selecionar slide ${index + 1}`}><GripVertical size={14} className="shrink-0 text-[var(--muted-foreground)]" /><span className="w-5 shrink-0 text-[10px] text-[var(--muted-foreground)]">{String(index + 1).padStart(2, "0")}</span><span className="relative h-12 w-9 shrink-0 overflow-hidden rounded border bg-black"><span className="absolute origin-top-left" style={{ transform: `scale(${scale})`, left, top, width: dimensions.width, height: dimensions.height }}><PostCanvas slide={slide} profile={profile} template={template} width={dimensions.width} height={dimensions.height} /></span></span><span className="min-w-0 flex-1 truncate text-xs text-[var(--text-title)]">{index === 0 ? "Capa" : `Slide ${index + 1}`}</span></button>
    <div className="flex shrink-0 flex-col gap-1"><button type="button" draggable={false} onClick={() => onDuplicate(slide.id)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-foreground)] transition hover:bg-[var(--glass-bg-soft)] hover:text-[var(--text-title)]" aria-label={`Duplicar slide ${index + 1}`} title="Duplicar slide"><Copy size={13} /></button><button type="button" draggable={false} onClick={() => onRemove(slide.id)} disabled={slides.length === 1} className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-foreground)] transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Excluir slide ${index + 1}`} title={slides.length === 1 ? "O projeto precisa ter pelo menos um slide" : "Excluir slide"}><Trash2 size={13} /></button></div>
  </div>)}</div><Button variant="outline" fullWidth size="sm" onClick={onAdd} icon={<Plus />} className="mt-3">Adicionar slide</Button></aside>;
}

function TextToolbar({ editor, defaultColor, allowItalic }: { editor: Editor | null; defaultColor: string; allowItalic: boolean }) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => setRevision((value) => value + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => { editor.off("selectionUpdate", refresh); editor.off("transaction", refresh); };
  }, [editor]);
  if (!editor) return <div className="mx-auto mb-3 h-11 max-w-xl rounded-xl border border-dashed" />;
  const hasSelection = editor.state.selection.from !== editor.state.selection.to;
  const tool = (active: boolean) => cn("editor-tool", active && "bg-[var(--hover)] text-[var(--accent-blue)]");
  return <div className="mx-auto mb-3 flex min-h-11 max-w-xl flex-wrap items-center gap-1 rounded-xl border p-1.5 shadow-lg" style={{ background: "var(--bg-modal)", borderColor: hasSelection ? "var(--accent-blue)" : "var(--glass-border)" }}>
    <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!hasSelection} className={tool(editor.isActive("bold"))} title="Negrito"><Bold /></button>
    {allowItalic && <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!hasSelection} className={tool(editor.isActive("italic"))} title="Itálico" aria-label="Aplicar itálico ao trecho selecionado"><Italic /></button>}
    <button onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!hasSelection} className={tool(editor.isActive("underline"))} title="Sublinhar"><Underline /></button>
    <TextColorTool disabled={!hasSelection} value={editor.getAttributes("textStyle").color || defaultColor} onChange={(color) => editor.chain().focus().setColor(color).run()} />
    <ColorTool title="Marca-texto" disabled={!hasSelection} value={editor.getAttributes("highlight").color || "#ffdf2b"} icon={<Highlighter />} onChange={(color) => editor.chain().focus().setHighlight({ color }).run()} />
    <span className="mx-1 h-6 w-px bg-[var(--border)]" />
    <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className={tool(editor.isActive({ textAlign: "left" }))} title="Alinhar à esquerda"><AlignLeft /></button>
    <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className={tool(editor.isActive({ textAlign: "center" }))} title="Centralizar"><AlignCenter /></button>
    <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className={tool(editor.isActive({ textAlign: "right" }))} title="Alinhar à direita"><AlignRight /></button>
    <span className="ml-auto pr-2 text-[9px] text-[var(--muted-foreground)]">{hasSelection ? "Formatação do trecho selecionado" : "Selecione um trecho para formatar"}</span>
  </div>;
}

function TextColorTool({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const selected = value.toLowerCase();
  return <div role="group" aria-label="Cor do texto" className={cn("flex items-center gap-1 rounded-lg px-1", disabled && "pointer-events-none opacity-40")}>
    {QUICK_TEXT_COLORS.map((color) => <button key={color.value} type="button" disabled={disabled} title={color.label} aria-label={`Aplicar cor ${color.label}`} aria-pressed={selected === color.value} onClick={() => onChange(color.value)} className={cn("h-6 w-6 rounded-full border border-white/20 shadow-sm transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]", selected === color.value && "ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-modal)]")} style={{ background: color.value }} />)}
    <label className="editor-tool relative cursor-pointer" title="Mais cores" aria-label="Abrir seletor de cores personalizado"><Palette /><input aria-label="Cor personalizada do texto" type="color" value={value} disabled={disabled} className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => onChange(event.target.value)} /></label>
  </div>;
}

function ColorTool({ title, value, disabled, icon, onChange }: { title: string; value: string; disabled: boolean; icon?: React.ReactNode; onChange: (value: string) => void }) {
  return <label className={cn("editor-tool relative cursor-pointer", disabled && "pointer-events-none opacity-40")} title={title}>{icon ?? <span className="h-4 w-4 rounded-full border" style={{ background: value }} />}<input type="color" value={value} disabled={disabled} className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => onChange(event.target.value)} /></label>;
}

function ScaledCanvas({ width, height, format, profile, children }: { width: number; height: number; format: PostFormat; profile: TweetProfile; children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.42);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const chromeHeight = format === "portrait" ? 154 : 0;
    const update = () => setScale(Math.min(node.clientWidth / width, (680 - chromeHeight) / height));
    update();
    const observer = new ResizeObserver(update); observer.observe(node);
    return () => observer.disconnect();
  }, [format, height, width]);
  const canvasWidth = width * scale;
  const canvasHeight = height * scale;
  return <div ref={host} className="mx-auto w-full max-w-3xl">
    <div className="mx-auto overflow-hidden border border-black/10 bg-white text-[#0f1419] shadow-2xl dark:border-white/15 dark:bg-[#090909] dark:text-white" style={{ width: canvasWidth, borderRadius: format === "story" ? 28 : 16 }}>
      {format === "portrait" && <div className="flex h-[58px] items-center gap-2.5 px-3"><Avatar src={profile.avatar} crop={profile.avatarCrop} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{profile.handle.replace(/^@/, "") || "seu_perfil"}</p><p className="text-[9px] opacity-55">Publicação</p></div><MoreHorizontal size={17} /></div>}
      <div className="relative overflow-hidden" style={{ width: canvasWidth, height: canvasHeight }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
        {format === "story" && <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-white [text-shadow:0_1px_4px_rgba(0,0,0,.65)]"><div><div className="mb-2 flex gap-1">{[0, 1, 2, 3].map((item) => <span key={item} className="h-[2px] flex-1 rounded-full bg-white/75" />)}</div><div className="flex items-center gap-2"><Avatar src={profile.avatar} crop={profile.avatarCrop} size={28} /><span className="text-[10px] font-semibold">Seu story</span><span className="text-[9px] opacity-70">agora</span><MoreHorizontal className="ml-auto" size={16} /></div></div><div className="mx-auto mb-1 flex h-9 w-[82%] items-center rounded-full border border-white/65 px-3 text-[10px]">Enviar mensagem…<Heart className="ml-auto" size={16} /><Send className="ml-2" size={15} /></div></div>}
      </div>
      {format === "portrait" && <div className="px-3 py-2.5"><div className="flex items-center gap-3"><Heart size={20} /><MessageCircle size={19} /><Send size={19} /><Bookmark className="ml-auto" size={19} /></div><p className="mt-2 text-[9px] font-semibold">Prévia do post no feed</p><p className="mt-1 text-[9px] opacity-55">Veja como o enquadramento será percebido no Instagram.</p></div>}
    </div>
  </div>;
}

function PostCanvas({ slide, profile, template, width, height, editable = false, editor, refCallback, activeTextBlockId, onSelectTextBlock, onReorderText }: { slide: Slide; profile: TweetProfile; template: PostTemplate; width: number; height: number; editable?: boolean; editor?: Editor | null; refCallback?: (node: HTMLDivElement | null) => void; activeTextBlockId?: string; onSelectTextBlock?: (id: string) => void; onReorderText?: (sourceId: string, targetId: string, after: boolean) => void }) {
  const safeLeft = template === "tweet" ? 12 : 8;
  const safeWidth = 100 - safeLeft * 2;
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const media = slide.media.length ? <HorizontalMedia media={slide.media} crops={slide.mediaCrops} /> : null;
  const profileBlock = template === "tweet" ? <TweetProfileBlock profile={profile} foreground={slide.foreground} /> : null;
  const textMap = new Map(slide.textBlocks.map((block) => [block.id, block]));
  const layout = [...slide.layout, ...slide.textBlocks.map((block) => block.id).filter((id) => !slide.layout.includes(id)), ...(slide.layout.includes("media") ? [] : ["media"] )];
  const layoutItems = layout.map((key) => {
    const block = textMap.get(key);
    const child = key === "media" ? media : block ? <TextBlockItem block={block} editor={editor} editable={editable} active={activeTextBlockId === block.id} foreground={slide.foreground} story={template === "stories"} safeWidth={safeWidth} onSelect={() => onSelectTextBlock?.(block.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); setDraggedTextId(block.id); }} onDragEnd={() => { setDraggedTextId(null); setDropTargetId(null); }} /> : null;
    if (!child) return null;
    return <div key={key} className={cn("relative w-full min-w-0 max-w-full transition", dropTargetId === key && draggedTextId !== key && "rounded-[28px] ring-[8px] ring-[#27a3ff]/35")} onDragOver={editable ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetId(key); } : undefined} onDragLeave={editable ? () => setDropTargetId((current) => current === key ? null : current) : undefined} onDrop={editable ? (event) => { event.preventDefault(); const sourceId = draggedTextId || event.dataTransfer.getData("text/plain"); if (sourceId && sourceId !== key) { const rect = event.currentTarget.getBoundingClientRect(); onReorderText?.(sourceId, key, event.clientY >= rect.top + rect.height / 2); } setDraggedTextId(null); setDropTargetId(null); } : undefined}>{child}</div>;
  });

  return <div ref={refCallback} data-post-canvas={template} className="relative overflow-hidden" style={{ width, height, background: slide.background, color: slide.foreground, fontFamily: template === "tweet" ? "Arial, Helvetica, sans-serif" : "Advercase, Georgia, serif", fontWeight: 400 }}>
    {template === "stories" && slide.backgroundImage && <><img src={slide.backgroundImage} alt="Fundo do slide" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-black" style={{ opacity: slide.imageDarkness / 100 }} /></>}
    <BalancedContent safeLeft={safeLeft} safeWidth={safeWidth} gap={template === "tweet" ? 44 : 52}>{profileBlock}{layoutItems}</BalancedContent>
  </div>;
}

function BalancedContent({ safeLeft, safeWidth, gap, children }: { safeLeft: number; safeWidth: number; gap: number; children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  useEffect(() => {
    const hostNode = host.current;
    const contentNode = content.current;
    if (!hostNode || !contentNode) return;
    const fit = () => setFitScale(Math.min(
      1,
      hostNode.clientHeight / Math.max(contentNode.scrollHeight, 1),
      hostNode.clientWidth / Math.max(contentNode.scrollWidth, 1),
    ));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(hostNode);
    observer.observe(contentNode);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} className="absolute grid min-w-0 max-w-full place-items-center overflow-x-clip" style={{ left: `${safeLeft}%`, top: "7%", width: `${safeWidth}%`, height: "86%" }}><div ref={content} className="flex w-full min-w-0 max-w-full flex-col" style={{ gap, transform: `scale(${fitScale})`, transformOrigin: "center center" }}>{children}</div></div>;
}

function TweetProfileBlock({ profile, foreground }: { profile: TweetProfile; foreground: string }) {
  return <div className="flex items-center gap-[24px]"><Avatar src={profile.avatar} crop={profile.avatarCrop} size={122} /><div><p className="flex items-center gap-[12px] text-[45px] font-bold leading-none">{profile.name}{profile.verified && <img src="/brand/verified-badge.png" alt="Perfil verificado" className="h-[38px] w-[38px] shrink-0 object-contain" />}</p><p className="mt-[14px] text-[34px]" style={{ color: foreground, opacity: .62 }}>{profile.handle}</p></div></div>;
}

function TextBlockItem({ block, editor, editable, active, foreground, story, safeWidth, onSelect, onDragStart, onDragEnd }: { block: TextBlock; editor?: Editor | null; editable: boolean; active: boolean; foreground: string; story: boolean; safeWidth: number; onSelect: () => void; onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void; onDragEnd: () => void }) {
  const width = Math.min(block.textWidth, safeWidth) / safeWidth * 100;
  return <div onClick={editable ? onSelect : undefined} className={cn("relative mx-auto min-w-0 max-w-full", editable && "cursor-text", active && "z-10")} style={{ width: `${width}%`, color: foreground, fontSize: block.fontSize, fontWeight: 400, lineHeight: block.lineHeight, overflowWrap: "anywhere", wordBreak: "break-word" }}>
    {editable && active && <button type="button" draggable aria-label="Mover caixa de texto" title="Arraste para reorganizar esta caixa" className="absolute -bottom-14 left-1/2 grid h-12 w-12 -translate-x-1/2 cursor-grab place-items-center rounded-full bg-[#27a3ff] text-white shadow-xl active:cursor-grabbing" onDragStart={onDragStart} onDragEnd={onDragEnd}><Move size={24} /></button>}
    <PostText block={block} editor={active ? editor : undefined} editable={editable && active} className={cn("w-full", story && "tracking-[-.03em]", editable && !active && "rounded-lg ring-[5px] ring-transparent hover:ring-[#27a3ff]/20", active && "rounded-lg ring-[5px] ring-[#27a3ff]/25")} />
  </div>;
}

function PostText({ block, editor, editable, className }: { block: TextBlock; editor?: Editor | null; editable: boolean; className: string }) {
  if (editable && editor) return <EditorContent editor={editor} className={cn("post-rich-text min-w-0 max-w-full rounded-lg outline-none ring-[5px] ring-transparent transition focus-within:ring-[#27a3ff]/35", className)} />;
  return <div className={cn("post-rich-text min-w-0 max-w-full", className)} dangerouslySetInnerHTML={{ __html: block.content }} />;
}

function HorizontalMedia({ media, crops, className }: { media: string[]; crops: MediaCrop[]; className?: string }) {
  if (!media.length) return null;
  return <div className={cn("grid aspect-[16/9] overflow-hidden rounded-[36px] border border-black/10", className)} style={{ gridTemplateColumns: `repeat(${media.length},minmax(0,1fr))` }}>{media.map((image, index) => { const crop = { ...defaultMediaCrop(), ...crops[index] }; return <div key={`${image.slice(-20)}-${index}`} className="h-full min-w-0 overflow-hidden" style={{ borderLeft: index ? "3px solid rgba(255,255,255,.8)" : undefined }}><img src={image} alt="Mídia do post" className="h-full w-full object-cover" style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} /></div>; })}</div>;
}

function Avatar({ src, size, crop = defaultMediaCrop() }: { src: string; size: number; crop?: MediaCrop }) {
  return src ? <span className="block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}><img src={src} alt="Foto do perfil" className="h-full w-full object-cover" style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} /></span> : <span className="grid shrink-0 place-items-center rounded-full bg-[#20252a] text-white" style={{ width: size, height: size }}><UserRound size={size * .42} /></span>;
}

function PropertiesPanel({ template, format, setFormat, slide, update, activeTextBlock, selectTextBlock, updateTextBlock, addTextBlock, removeTextBlock, placeText, profile, setProfile }: { template: PostTemplate; format: PostFormat; setFormat: (format: PostFormat) => void; slide: Slide; update: (patch: Partial<Slide>) => void; activeTextBlock: TextBlock; selectTextBlock: (id: string) => void; updateTextBlock: (patch: Partial<TextBlock>) => void; addTextBlock: () => void; removeTextBlock: () => void; placeText: (placement: "above" | "below") => void; profile: TweetProfile; setProfile: React.Dispatch<React.SetStateAction<TweetProfile>> }) {
  const addFile = (file: File | undefined, callback: (url: string) => void) => { if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem."); const reader = new FileReader(); reader.onload = () => callback(String(reader.result)); reader.readAsDataURL(file); };
  const updateProfile = (patch: Partial<TweetProfile>) => setProfile((current) => ({ ...current, ...patch }));
  const updateBackground = (background: string) => update({ background, foreground: contrastColor(background) });
  const textLayoutIndex = slide.layout.indexOf(activeTextBlock.id);
  const mediaLayoutIndex = slide.layout.indexOf("media");
  const textPlacement = textLayoutIndex < mediaLayoutIndex ? "above" : "below";
  return <aside className="p-4 lg:p-5"><div className="space-y-6"><PanelSection title="Documento"><div className="grid grid-cols-2 gap-2">{(Object.entries(POST_FORMATS) as Array<[PostFormat, { label: string; width: number; height: number }]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("rounded-xl border p-3 text-left transition", format === value ? "border-[var(--accent-blue)] bg-[var(--hover)]" : "border-[var(--glass-border)]")}><span className="block text-xs font-semibold text-[var(--text-title)]">{item.label}</span><span className="text-[9px] text-[var(--muted-foreground)]">{value === "story" ? "Story" : "Feed 4:5"}</span>{format === value && <Check size={13} className="float-right -mt-5 text-[var(--accent-blue)]" />}</button>)}</div></PanelSection>

      <PanelSection title="Caixas de texto">
        <div className="flex flex-wrap gap-1.5">
          {slide.textBlocks.map((block, index) => <button key={block.id} type="button" onClick={() => selectTextBlock(block.id)} className={cn("rounded-lg border px-2.5 py-1.5 text-[10px]", activeTextBlock.id === block.id ? "border-[var(--accent-blue)] bg-[var(--hover)] text-[var(--text-title)]" : "border-[var(--glass-border)] text-[var(--muted-foreground)]")}>Texto {index + 1}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={addTextBlock} icon={<Plus />}>Novo texto</Button>
          <Button variant="danger" size="sm" className="h-9 rounded-xl" onClick={removeTextBlock} disabled={slide.textBlocks.length === 1} icon={<Trash2 />}>Remover</Button>
        </div>
        <Field label={`Tamanho · ${activeTextBlock.fontSize}px`}><input aria-label="Tamanho do texto" type="range" min={template === "tweet" ? 28 : 36} max={template === "tweet" ? 128 : 190} step="1" value={activeTextBlock.fontSize} onChange={(event) => updateTextBlock({ fontSize: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>
        <Field label={`Espaçamento entre linhas · ${Math.round(activeTextBlock.lineHeight * 100)}%`}><input aria-label="Espaçamento entre linhas" type="range" min="0.75" max="1.8" step="0.05" value={activeTextBlock.lineHeight} onChange={(event) => updateTextBlock({ lineHeight: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>
        <Field label={`Largura do bloco · ${activeTextBlock.textWidth}%`}><input aria-label="Largura do texto" type="range" min="40" max={template === "tweet" ? 76 : 84} step="2" value={Math.min(activeTextBlock.textWidth, template === "tweet" ? 76 : 84)} onChange={(event) => updateTextBlock({ textWidth: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>
        <div className="grid grid-cols-2 gap-2"><button onClick={() => placeText("above")} className={cn("rounded-xl border px-3 py-2 text-xs", textPlacement === "above" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Acima da imagem</button><button onClick={() => placeText("below")} className={cn("rounded-xl border px-3 py-2 text-xs", textPlacement === "below" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Abaixo da imagem</button></div>
        <p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]"><Move size={11} className="mr-1 inline" />Selecione uma caixa e arraste o controle azul. Ela se encaixa na sequência sem alterar margens ou distâncias.</p>
      </PanelSection>

      {template === "tweet" ? <>
        <PanelSection title="Perfil · aplicado a todos os slides">
          <AvatarUploadField
            value={profile.avatar}
            crop={profile.avatarCrop}
            onFile={(file) => addFile(file, (avatar) => updateProfile({ avatar, avatarCrop: defaultMediaCrop() }))}
            onRemove={() => updateProfile({ avatar: "", avatarCrop: defaultMediaCrop() })}
            onCropChange={(avatarCrop) => updateProfile({ avatarCrop })}
          />
          <Field label="Nome"><input value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} className="editor-input" /></Field>
          <Field label="Arroba"><div className="relative"><AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={profile.handle.replace(/^@/, "")} onChange={(event) => updateProfile({ handle: `@${event.target.value.replace(/^@/, "")}` })} className="editor-input pl-8" /></div></Field>
          <label className="flex items-center justify-between text-xs"><span>Selo de verificação</span><input type="checkbox" checked={profile.verified} onChange={(event) => updateProfile({ verified: event.target.checked })} className="accent-[#27a3ff]" /></label>
        </PanelSection>
        <PanelSection title="Aparência"><div className="grid grid-cols-2 gap-2"><button onClick={() => updateBackground("#ffffff")} className={cn("rounded-xl border p-3 text-left", slide.background === "#ffffff" && "border-[#27a3ff]")}><Sun size={15} /><span className="mt-2 block text-xs">Claro</span></button><button onClick={() => updateBackground("#000000")} className={cn("rounded-xl border p-3 text-left", slide.background === "#000000" && "border-[#27a3ff]")}><Moon size={15} /><span className="mt-2 block text-xs">Escuro absoluto</span></button></div></PanelSection>
        <MediaPanel slide={slide} update={update} addFile={addFile} title="Imagem do post" />
      </> : <>
        <PanelSection title="Cores"><BackgroundColorRow value={slide.background} onChange={updateBackground} /><div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">Texto automático</span><span className="h-7 w-7 rounded-full border" style={{ background: slide.foreground, borderColor: "var(--glass-border)" }} /></div></PanelSection>
        <PanelSection title="Imagem de fundo"><UploadField label="Imagem do slide" value={slide.backgroundImage} square onFile={(file) => addFile(file, (backgroundImage) => update({ backgroundImage }))} onRemove={() => update({ backgroundImage: "" })} />{slide.backgroundImage && <Field label={`Escurecer foto · ${slide.imageDarkness}%`}><input type="range" min="0" max="90" value={slide.imageDarkness} onChange={(event) => update({ imageDarkness: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>}</PanelSection>
        <MediaPanel slide={slide} update={update} addFile={addFile} title="Imagem complementar" />
      </>}
    </div></aside>;
}

function MediaPanel({ slide, update, addFile, title }: { slide: Slide; update: (patch: Partial<Slide>) => void; addFile: (file: File | undefined, callback: (url: string) => void) => void; title: string }) {
  const setMediaFile = (index: number, url: string) => {
    const media = [...slide.media];
    const mediaCrops = [...slide.mediaCrops];
    media[index] = url;
    mediaCrops[index] = defaultMediaCrop();
    const pairs = media.map((image, mediaIndex) => ({ image, crop: mediaCrops[mediaIndex] || defaultMediaCrop() })).filter((item) => Boolean(item.image)).slice(0, 2);
    update({ media: pairs.map((item) => item.image), mediaCrops: pairs.map((item) => item.crop) });
  };
  return <PanelSection title={title}><p className="mb-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">O quadro é sempre horizontal. Envie um arquivo ou cole uma imagem com Ctrl+V / ⌘V; use até duas lado a lado.</p><div className="grid grid-cols-2 gap-2">{[0, 1].map((index) => <UploadTile key={index} value={slide.media[index]} crop={{ ...defaultMediaCrop(), ...slide.mediaCrops[index] }} label={`Imagem ${index + 1}`} onCropChange={(crop) => { const mediaCrops = [...slide.mediaCrops]; mediaCrops[index] = crop; update({ mediaCrops }); }} onFile={(file) => addFile(file, (url) => setMediaFile(index, url))} onRemove={() => update({ media: slide.media.filter((_, mediaIndex) => mediaIndex !== index), mediaCrops: slide.mediaCrops.filter((_, mediaIndex) => mediaIndex !== index) })} />)}</div></PanelSection>;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="post-generator-panel-section border-b pb-5 last:border-0" style={{ borderColor: "var(--border)" }}><h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">{title}</h2><div className="space-y-3">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] text-[var(--muted-foreground)]">{label}</span>{children}</label>; }
function BackgroundColorRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const normalizedValue = value.toLowerCase();
  return <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">Fundo</span><div className="flex items-center gap-2">{[{ value: "#000000", label: "Preto puro" }, { value: "#ffffff", label: "Branco puro" }].map((color) => <button key={color.value} type="button" onClick={() => onChange(color.value)} aria-label={`Usar fundo ${color.label.toLowerCase()}`} title={color.label} className={cn("h-8 w-8 rounded-full border transition hover:scale-105", normalizedValue === color.value ? "ring-2 ring-[#27a3ff] ring-offset-2 ring-offset-[var(--background)]" : "border-[var(--glass-border)]")} style={{ backgroundColor: color.value }} />)}<label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border text-[var(--muted-foreground)] transition hover:bg-[var(--hover)] hover:text-[var(--text-title)]" style={{ borderColor: "var(--glass-border)" }} title="Escolher cor personalizada"><Palette size={15} /><input aria-label="Escolher cor de fundo personalizada" type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" /></label></div></div>;
}

function AvatarUploadField({ value, crop, onFile, onRemove, onCropChange }: { value: string; crop: MediaCrop; onFile: (file?: File) => void; onRemove: () => void; onCropChange: (crop: MediaCrop) => void }) {
  return <div className="space-y-3">
    <div className="flex items-center gap-3">
      <span className="rounded-full border" style={{ borderColor: "var(--glass-border)" }}><Avatar src={value} crop={crop} size={76} /></span>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        <label className="cursor-pointer rounded-xl border px-3 py-2 text-center text-[10px] hover:bg-[var(--hover)]" style={{ borderColor: "var(--glass-border)" }}><Upload size={12} className="mr-1 inline" />{value ? "Trocar foto" : "Enviar foto"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>
        <button type="button" onClick={onRemove} disabled={!value} className="rounded-xl border px-3 py-2 text-[10px] text-[var(--muted-foreground)] transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: "var(--glass-border)" }}><Trash2 size={12} className="mr-1 inline" />Remover</button>
      </div>
    </div>
    {value && <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--glass-border)", background: "var(--hover)" }}>
      <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-[var(--text-title)]">Enquadramento da foto</span><button type="button" onClick={() => onCropChange(defaultMediaCrop())} className="text-[9px] text-[var(--accent-blue)] hover:underline">Centralizar</button></div>
      <CropSlider label="Horizontal" value={crop.x} min={0} max={100} onChange={(x) => onCropChange({ ...crop, x })} />
      <CropSlider label="Vertical" value={crop.y} min={0} max={100} onChange={(y) => onCropChange({ ...crop, y })} />
      <CropSlider label="Zoom" value={crop.zoom} min={1} max={4} step={0.05} onChange={(zoom) => onCropChange({ ...crop, zoom })} />
    </div>}
  </div>;
}

function UploadField({ label, value, onFile, onRemove, square = false }: { label: string; value: string; onFile: (file?: File) => void; onRemove: () => void; square?: boolean }) { return <div className="flex items-center gap-3"><span className={cn("grid h-11 w-11 shrink-0 place-items-center overflow-hidden border bg-[var(--hover)]", square ? "rounded-lg" : "rounded-full")}>{value ? <img src={value} alt="Arquivo selecionado" className="h-full w-full object-cover" /> : <UserRound size={17} />}</span><label className="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-[10px] hover:bg-[var(--hover)]"><Upload size={12} className="mr-1 inline" />{value ? "Trocar" : label}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>{value && <button onClick={onRemove} className="text-[var(--muted-foreground)] hover:text-red-500" aria-label="Remover imagem"><X size={15} /></button>}</div>; }

function UploadTile({ label, value, crop, onFile, onRemove, onCropChange }: { label: string; value?: string; crop: MediaCrop; onFile: (file?: File) => void; onRemove: () => void; onCropChange: (crop: MediaCrop) => void }) { return <div className="min-w-0 space-y-2"><div className="relative aspect-video overflow-hidden rounded-xl border bg-[var(--hover)]" style={{ borderColor: "var(--glass-border)" }}>{value ? <><img src={value} alt={label} className="h-full w-full object-cover" style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} /><button onClick={onRemove} aria-label={`Remover ${label}`} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X size={12} /></button></> : <label className="grid h-full cursor-pointer place-items-center text-center text-[10px] text-[var(--muted-foreground)]"><span><ImagePlus size={18} className="mx-auto mb-1" />{label}</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>}</div>{value && <div className="space-y-1.5 rounded-lg border p-2" style={{ borderColor: "var(--glass-border)" }}><CropSlider label="Horizontal" value={crop.x} min={0} max={100} onChange={(x) => onCropChange({ ...crop, x })} /><CropSlider label="Vertical" value={crop.y} min={0} max={100} onChange={(y) => onCropChange({ ...crop, y })} /><CropSlider label="Zoom" value={crop.zoom} min={1} max={2.5} step={0.05} onChange={(zoom) => onCropChange({ ...crop, zoom })} /></div>}</div>; }

function CropSlider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) { return <label className="block"><span className="mb-0.5 flex justify-between text-[8px] text-[var(--muted-foreground)]"><span>{label}</span><span>{label === "Zoom" ? `${value.toFixed(2)}×` : `${Math.round(value)}%`}</span></span><input type="range" aria-label={`${label} da imagem`} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="block w-full accent-[#27a3ff]" /></label>; }
