"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, AtSign,
  Bold, Bookmark, Check, ChevronRight, Copy, Download, GripVertical, Heart, ImagePlus,
  Italic, Layers3, MessageCircle, MoreHorizontal, Move, Moon, Palette, Plus, Redo2, RotateCcw, Send, Share2, Square, Sun, Trash2,
  Type, Underline, Undo2, Upload, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createZip, defaultPostLineHeight, normalizePostLineHeight, normalizePostTextWidth, numberedSlideFilename, POST_FORMATS, postElementToPng, sanitizeDownloadName, saveBlob,
  type PostFormat, type PostTemplate,
} from "@/lib/marketing/post-generator";
import { snapCanvasPosition, type AlignmentGuide } from "@/lib/marketing/free-layout";
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
  mediaAspects: MediaAspect[];
  mediaNaturalAspects: number[];
  backgroundImage: string;
  imageDarkness: number;
  fontSize: number;
  textX: number;
  textY: number;
  textWidth: number;
  textPlacement: "above" | "below" | "free";
  mediaPosition: "top" | "bottom";
  layoutMode: "auto" | "free";
  freePositions: Record<string, CanvasPoint>;
};

type MediaCrop = { x: number; y: number; zoom: number };
type MediaAspect = "original" | "1:1" | "4:5" | "16:9" | "9:16";
type CanvasPoint = { x: number; y: number };
type TextBlock = { id: string; content: string; fontSize: number; textWidth: number; lineHeight: number };
type TweetProfile = { avatar: string; avatarCrop: MediaCrop; name: string; handle: string; verified: boolean };
type PersistedPostProject = { version: 1; format: PostFormat; slides: Slide[]; activeId: string; tweetProfile: TweetProfile; updatedAt: number };
type MobileEditorPanel = "text" | "image" | "background" | "slide" | "export" | null;
type MobileInlineTool = "format" | "textColor" | "backdrop";
type MobileTextTool = MobileInlineTool | "fontSize" | "lineHeight" | "textWidth" | null;
type MobileVisualTool =
  | { kind: "backgroundColor" }
  | { kind: "backgroundDarkness" }
  | { kind: "mediaCrop"; index: number; axis: keyof MediaCrop }
  | { kind: "avatarCrop"; axis: keyof MediaCrop }
  | { kind: "textPlacement" }
  | null;

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

const TextBackdrop = Mark.create({
  name: "textBackdrop",
  addAttributes() {
    return {
      backgroundColor: { default: "#000000", parseHTML: (element) => element.style.backgroundColor || "#000000" },
      color: { default: "#ffffff", parseHTML: (element) => element.style.color || "#ffffff" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-text-backdrop]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { backgroundColor, color, ...attributes } = HTMLAttributes;
    return ["span", mergeAttributes(attributes, {
      "data-text-backdrop": "true",
      class: "post-text-backdrop",
      style: `background-color:${backgroundColor};color:${color}`,
    }), 0];
  },
});

function uid() { return Math.random().toString(36).slice(2, 10); }
function defaultMediaCrop(): MediaCrop { return { x: 50, y: 50, zoom: 1 }; }
function mediaAspectValue(aspect: MediaAspect, naturalAspect = 16 / 9) {
  if (aspect === "original") return naturalAspect > 0 ? naturalAspect : 16 / 9;
  const [width, height] = aspect.split(":").map(Number);
  return width / height;
}
function readImageAspect(url: string) {
  return new Promise<number>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 16 / 9);
    image.onerror = () => resolve(16 / 9);
    image.src = url;
  });
}
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
    mediaAspects: [],
    mediaNaturalAspects: [],
    backgroundImage: "",
    imageDarkness: 42,
    fontSize: template === "tweet" ? 45 : 70,
    textX: template === "tweet" ? 12 : 8,
    textY: template === "tweet" ? 31 : 12,
    textWidth: template === "tweet" ? 76 : 84,
    textPlacement: "above",
    mediaPosition: "bottom",
    layoutMode: "auto",
    freePositions: {},
  };
}

function normalizePostProject(template: PostTemplate, project: PersistedPostProject) {
  const slides = project.slides.map((slide, index) => {
    const base = makeSlide(template, index);
    const media = Array.isArray(slide.media) ? slide.media.slice(0, 2) : [];
    const mediaCrops = media.map((_, mediaIndex) => ({ ...defaultMediaCrop(), ...(Array.isArray(slide.mediaCrops) ? slide.mediaCrops[mediaIndex] : undefined) }));
    const mediaAspects = media.map((_, mediaIndex) => {
      const aspect = Array.isArray(slide.mediaAspects) ? slide.mediaAspects[mediaIndex] : undefined;
      return (["original", "1:1", "4:5", "16:9", "9:16"] as const).includes(aspect as MediaAspect) ? aspect as MediaAspect : "16:9";
    });
    const mediaNaturalAspects = media.map((_, mediaIndex) => Number.isFinite(slide.mediaNaturalAspects?.[mediaIndex]) ? slide.mediaNaturalAspects[mediaIndex] : 16 / 9);
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
    return { ...base, ...slide, id: slide.id || uid(), media, mediaCrops, mediaAspects, mediaNaturalAspects, textBlocks, layout, layoutMode: slide.layoutMode === "free" ? "free" as const : "auto" as const, freePositions: slide.freePositions || {} };
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
  const setCanvasMode = useGlobalStore((state) => state.setCanvasMode);
  const firstSlide = useMemo(() => makeSlide(template), [template]);
  const [format, setFormat] = useState<PostFormat>("story");
  const [slides, setSlides] = useState<Slide[]>([firstSlide]);
  const [activeId, setActiveId] = useState(firstSlide.id);
  const [activeTextBlockId, setActiveTextBlockId] = useState(firstSlide.textBlocks[0].id);
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(null);
  const [tweetProfile, setTweetProfile] = useState<TweetProfile>(DEFAULT_PROFILE);
  const [storageReady, setStorageReady] = useState(false);
  const [syncState, setSyncState] = useState<"saving" | "synced" | "offline">("saving");
  const [exporting, setExporting] = useState<"one" | "all" | "share" | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobileEditorPanel>(null);
  const [mobileTextTool, setMobileTextTool] = useState<MobileTextTool>(null);
  const [mobileVisualTool, setMobileVisualTool] = useState<MobileVisualTool>(null);
  const [mobileCanvasMaxHeight, setMobileCanvasMaxHeight] = useState(560);
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0);
  const [isMobileEditor, setIsMobileEditor] = useState(false);
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

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const updateMobileMode = () => {
      setCanvasMode(query.matches);
      setIsMobileEditor(query.matches);
      setMobileCanvasMaxHeight(Math.max(360, window.innerHeight - 260));
    };
    updateMobileMode();
    query.addEventListener("change", updateMobileMode);
    window.addEventListener("resize", updateMobileMode);
    return () => {
      query.removeEventListener("change", updateMobileMode);
      window.removeEventListener("resize", updateMobileMode);
      setCanvasMode(false);
    };
  }, [setCanvasMode]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setMobileKeyboardInset(inset > 100 ? Math.round(inset) : 0);
    };
    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
    };
  }, []);

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
      TextBackdrop,
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
      reader.onload = async () => {
        const url = String(reader.result);
        const naturalAspect = await readImageAspect(url);
        setSlides((current) => current.map((slide) => slide.id === activeId
          ? { ...slide, media: [...slide.media, url].slice(0, 2), mediaCrops: [...slide.mediaCrops, defaultMediaCrop()].slice(0, 2), mediaAspects: [...slide.mediaAspects, "original" as const].slice(0, 2), mediaNaturalAspects: [...slide.mediaNaturalAspects, naturalAspect].slice(0, 2) }
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

  useEffect(() => setEditingTextBlockId(null), [activeId]);

  useEffect(() => {
    if (!editingTextBlockId || !editor) return;
    const frame = window.requestAnimationFrame(() => editor.commands.focus("end"));
    return () => window.cancelAnimationFrame(frame);
  }, [editingTextBlockId, editor]);

  const selectTextBlock = (id: string) => {
    setActiveTextBlockId(id);
    setEditingTextBlockId(null);
  };

  const editTextBlock = (id: string) => {
    setActiveTextBlockId(id);
    setEditingTextBlockId(id);
  };

  const update = (patch: Partial<Slide>) => setSlides((current) => current.map((slide) => slide.id === activeId ? { ...slide, ...patch } : slide));
  const updateTextBlock = (patch: Partial<TextBlock>) => update({ textBlocks: active.textBlocks.map((block) => block.id === activeTextBlockId ? { ...block, ...patch } : block) });
  const updateFreePosition = (key: string, position: CanvasPoint) => update({ freePositions: { ...active.freePositions, [key]: position } });

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
    const freePositions = Object.fromEntries(Object.entries(source.freePositions).map(([key, value]) => [idMap.get(key) || key, { ...value }]));
    const next = { ...source, id: uid(), media: [...source.media], mediaCrops: source.mediaCrops.map((crop) => ({ ...crop })), mediaAspects: [...source.mediaAspects], mediaNaturalAspects: [...source.mediaNaturalAspects], freePositions, textBlocks, layout: source.layout.map((key) => idMap.get(key) || key) };
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

  async function shareOne() {
    const element = exportRefs.current.get(activeId);
    if (!element) return;
    setExporting("share");
    try {
      const blob = await postElementToPng(element, dimensions.width, dimensions.height);
      const file = new File([blob], numberedSlideFilename(activeIndex), { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: `Slide ${activeIndex + 1}` });
      } else {
        await saveBlob(blob, numberedSlideFilename(activeIndex));
        toast.success("Compartilhamento não disponível; o slide foi baixado.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Falha ao compartilhar o slide.");
    } finally {
      setExporting(null);
    }
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
    <div className="flex min-h-[calc(100dvh-65px)] flex-col lg:min-h-[calc(100dvh-65px)]">
      <div className="hidden flex-wrap items-center gap-2 border-b px-5 py-3 lg:flex" style={{ borderColor: "var(--border)" }}>
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar aos modelos"><ArrowLeft /></Button>
        <div className="mr-auto min-w-0"><h1 className="truncate text-sm font-semibold text-[var(--text-title)]">{template === "tweet" ? "Modelo Tweet" : "Stories Plus"}</h1><p className="text-[10px] text-[var(--muted-foreground)]">{slides.length} {slides.length === 1 ? "slide" : "slides"} · {dimensions.label} · <span aria-live="polite">{syncState === "saving" ? "Salvando…" : syncState === "synced" ? "Sincronizado" : "Salvo neste dispositivo · aguardando conexão"}</span></p></div>
        <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
          {(Object.entries(POST_FORMATS) as Array<[PostFormat, typeof dimensions]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium transition", format === value ? "bg-[var(--segment-active-bg)] text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]")}>{item.label}</button>)}
        </div>
        <Button variant="outline" onClick={() => void exportOne()} loading={exporting === "one"} icon={<Download />}>Slide atual</Button>
        <Button onClick={() => setExportDialogOpen(true)} loading={exporting === "all"} icon={<Layers3 />} signature>Baixar todos</Button>
      </div>

      <div className="hidden flex-1 grid-cols-[230px_minmax(0,1fr)_300px] lg:grid">
        <SlidesRail slides={slides} activeId={activeId} template={template} format={format} profile={tweetProfile} onSelect={setActiveId} onAdd={addSlide} onDuplicate={duplicateSlide} onRemove={removeSlide} onReorder={reorderSlides} />

        <main className="min-w-0 border-b p-4 lg:border-b-0 lg:border-x lg:p-6" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--text-title)]">Pré-visualização</p><p className="text-[10px] text-[var(--muted-foreground)]">Um clique seleciona e permite mover; dois cliques liberam a edição do texto.</p></div><span className="rounded-full border px-2.5 py-1 text-[10px] text-[var(--muted-foreground)]">Slide {activeIndex + 1} de {slides.length}</span></div>
          <TextToolbar editor={editor} defaultColor={active.foreground} allowItalic={template === "stories"} />
          <ScaledCanvas width={dimensions.width} height={dimensions.height} format={format} profile={tweetProfile}>
            <PostCanvas slide={active} profile={tweetProfile} template={template} width={dimensions.width} height={dimensions.height} editable={!isMobileEditor} editor={isMobileEditor ? undefined : editor} activeTextBlockId={activeTextBlockId} editingTextBlockId={editingTextBlockId} onSelectTextBlock={selectTextBlock} onEditTextBlock={editTextBlock} onReorderText={reorderLayout} onPositionChange={updateFreePosition} />
          </ScaledCanvas>
          <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-1.5"><Button variant="outline" size="sm" onClick={() => move(-1)} disabled={activeIndex === 0} aria-label="Mover slide para cima"><ArrowUp /></Button><Button variant="outline" size="sm" onClick={() => move(1)} disabled={activeIndex === slides.length - 1} aria-label="Mover slide para baixo"><ArrowDown /></Button><Button variant="outline" size="sm" onClick={duplicate} icon={<Copy />}>Duplicar</Button><Button variant="danger" size="sm" onClick={remove} icon={<Trash2 />}>Excluir</Button></div>
        </main>

        <PropertiesPanel template={template} format={format} setFormat={setFormat} slide={active} update={update} activeTextBlock={activeTextBlock} selectTextBlock={selectTextBlock} updateTextBlock={updateTextBlock} addTextBlock={addTextBlock} removeTextBlock={removeTextBlock} placeText={placeActiveText} profile={tweetProfile} setProfile={setTweetProfile} />
      </div>

      <div className="fixed inset-0 z-40 flex min-h-0 flex-col bg-[var(--background)] lg:hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)]" style={{ borderColor: "var(--border)", background: "var(--bg-modal)" }}>
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--text-title)] active:bg-[var(--hover)]" aria-label="Voltar aos modelos"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text-title)]">Slide {activeIndex + 1} de {slides.length}</p>
            <p className="truncate text-[10px] text-[var(--muted-foreground)]" aria-live="polite">{syncState === "saving" ? "Salvando…" : syncState === "synced" ? "Sincronizado" : "Salvo no dispositivo"} · {dimensions.label}</p>
          </div>
          <button type="button" onClick={() => setMobilePanel("export")} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--text-title)] active:bg-[var(--hover)]" aria-label="Exportar ou compartilhar"><Share2 size={18} /></button>
        </header>

        <main className="flex min-h-0 flex-1 items-center overflow-auto px-3 py-2">
          <ScaledCanvas width={dimensions.width} height={dimensions.height} format={format} profile={tweetProfile} maxHeight={mobileCanvasMaxHeight}>
            <PostCanvas
              slide={active}
              profile={tweetProfile}
              template={template}
              width={dimensions.width}
              height={dimensions.height}
              editable
              activeTextBlockId={activeTextBlockId}
              onSelectTextBlock={(id) => {
                setActiveTextBlockId(id);
                setMobileTextTool(null);
                setMobileVisualTool(null);
                setMobilePanel("text");
              }}
              onReorderText={reorderLayout}
              onPositionChange={updateFreePosition}
            />
          </ScaledCanvas>
        </main>

        <MobileSlidesRail
          slides={slides}
          activeId={activeId}
          template={template}
          format={format}
          profile={tweetProfile}
          onSelect={(id) => { setActiveId(id); setMobilePanel(null); }}
          onAdd={addSlide}
        />

        <MobileEditorDock active={mobilePanel} onChange={(panel) => {
          setMobileTextTool(null);
          setMobileVisualTool(null);
          setMobilePanel(panel);
        }} />

        {isMobileEditor && mobilePanel && !mobileTextTool && !mobileVisualTool && (
          <MobilePanelSheet
            title={mobilePanel === "text" ? "Texto" : mobilePanel === "image" ? "Imagens" : mobilePanel === "background" ? "Aparência" : mobilePanel === "slide" ? "Slide" : "Exportar"}
            keyboardInset={mobilePanel === "text" ? mobileKeyboardInset : 0}
            onClose={() => {
              setMobileTextTool(null);
              setMobileVisualTool(null);
              setMobilePanel(null);
            }}
          >
            {mobilePanel === "text" && (
              <>
                <TextToolbar editor={editor} defaultColor={active.foreground} allowItalic={template === "stories"} compact onToolUse={setMobileTextTool} />
                <MobileTextComposer editor={editor} />
              </>
            )}
            {mobilePanel === "export" ? (
              <div className="grid gap-2 p-4">
                <Button fullWidth onClick={() => void shareOne()} loading={exporting === "share"} icon={<Share2 />}>Compartilhar slide atual</Button>
                <Button fullWidth variant="outline" onClick={() => void exportOne()} loading={exporting === "one"} icon={<Download />}>Baixar slide atual</Button>
                <Button fullWidth variant="outline" onClick={() => { setMobilePanel(null); setExportDialogOpen(true); }} loading={exporting === "all"} icon={<Layers3 />}>Baixar todos os slides</Button>
              </div>
            ) : (
              <>
                <PropertiesPanel
                  section={mobilePanel}
                  template={template}
                  format={format}
                  setFormat={setFormat}
                  slide={active}
                  update={update}
                  activeTextBlock={activeTextBlock}
                  selectTextBlock={setActiveTextBlockId}
                  updateTextBlock={updateTextBlock}
                  addTextBlock={addTextBlock}
                  removeTextBlock={removeTextBlock}
                  placeText={placeActiveText}
                  profile={tweetProfile}
                  setProfile={setTweetProfile}
                  onFocusTextControl={setMobileTextTool}
                  onFocusVisualControl={setMobileVisualTool}
                />
                {mobilePanel === "slide" && (
                  <div className="grid grid-cols-2 gap-2 border-t p-4" style={{ borderColor: "var(--border)" }}>
                    <Button variant="outline" onClick={() => move(-1)} disabled={activeIndex === 0} icon={<ArrowUp />}>Mover antes</Button>
                    <Button variant="outline" onClick={() => move(1)} disabled={activeIndex === slides.length - 1} icon={<ArrowDown />}>Mover depois</Button>
                    <Button variant="outline" onClick={duplicate} icon={<Copy />}>Duplicar</Button>
                    <Button variant="danger" onClick={remove} disabled={slides.length === 1} icon={<Trash2 />}>Excluir</Button>
                  </div>
                )}
              </>
            )}
          </MobilePanelSheet>
        )}

        {isMobileEditor && mobilePanel === "text" && mobileTextTool && (
          <MobileTextQuickPanel
            tool={mobileTextTool}
            editor={editor}
            defaultColor={active.foreground}
            allowItalic={template === "stories"}
            template={template}
            textBlock={activeTextBlock}
            updateTextBlock={updateTextBlock}
            onExpand={() => setMobileTextTool(null)}
            onClose={() => {
              setMobileTextTool(null);
              setMobileVisualTool(null);
              setMobilePanel(null);
            }}
          />
        )}

        {isMobileEditor && mobileVisualTool && (
          <MobileVisualQuickPanel
            tool={mobileVisualTool}
            slide={active}
            textBlockId={activeTextBlock.id}
            update={update}
            profile={tweetProfile}
            setProfile={setTweetProfile}
            placeText={placeActiveText}
            onExpand={() => setMobileVisualTool(null)}
            onClose={() => {
              setMobileVisualTool(null);
              setMobilePanel(null);
            }}
          />
        )}
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

function MobileSlidesRail({ slides, activeId, template, format, profile, onSelect, onAdd }: {
  slides: Slide[];
  activeId: string;
  template: PostTemplate;
  format: PostFormat;
  profile: TweetProfile;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const dimensions = POST_FORMATS[format];
  const previewWidth = format === "story" ? 34 : 40;
  const previewHeight = format === "story" ? 60 : 50;
  const scale = Math.min(previewWidth / dimensions.width, previewHeight / dimensions.height);

  return (
    <div className="shrink-0 border-t px-2 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-modal)" }}>
      <div className="flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
        {slides.map((slide, index) => {
          const active = slide.id === activeId;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelect(slide.id)}
              aria-label={`Selecionar slide ${index + 1}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative flex h-[68px] w-[54px] shrink-0 items-center justify-center rounded-xl border transition active:scale-95",
                active ? "border-[var(--accent-blue)] bg-[#27a3ff]/10" : "border-[var(--glass-border)] bg-[var(--hover)]",
              )}
            >
              <span className="relative overflow-hidden rounded-md bg-black" style={{ width: previewWidth, height: previewHeight }}>
                <span className="absolute left-1/2 top-1/2 origin-top-left" style={{ width: dimensions.width, height: dimensions.height, transform: `translate(-50%, -50%) scale(${scale})` }}>
                  <PostCanvas slide={slide} profile={profile} template={template} width={dimensions.width} height={dimensions.height} />
                </span>
              </span>
              <span className={cn("absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-bold", active ? "bg-[var(--accent-blue)] text-white" : "bg-[var(--bg-modal)] text-[var(--muted-foreground)]")}>{index + 1}</span>
            </button>
          );
        })}
        <button type="button" onClick={onAdd} className="grid h-[68px] w-[54px] shrink-0 place-items-center rounded-xl border border-dashed text-[var(--accent-blue)] active:scale-95" style={{ borderColor: "color-mix(in srgb, var(--accent-blue) 55%, transparent)" }} aria-label="Adicionar slide"><Plus size={20} /></button>
      </div>
    </div>
  );
}

function MobileEditorDock({ active, onChange }: { active: MobileEditorPanel; onChange: (panel: MobileEditorPanel) => void }) {
  const tools: Array<{ id: Exclude<MobileEditorPanel, "export" | null>; label: string; icon: React.ReactNode }> = [
    { id: "text", label: "Texto", icon: <Type size={19} /> },
    { id: "image", label: "Imagem", icon: <ImagePlus size={19} /> },
    { id: "background", label: "Aparência", icon: <Palette size={19} /> },
    { id: "slide", label: "Slide", icon: <Layers3 size={19} /> },
  ];
  return (
    <nav className="z-50 grid shrink-0 grid-cols-4 border-t pb-[env(safe-area-inset-bottom)]" style={{ borderColor: "var(--border)", background: "var(--bg-modal)" }} aria-label="Ferramentas do editor">
      {tools.map((tool) => (
        <button key={tool.id} type="button" onClick={() => onChange(active === tool.id ? null : tool.id)} aria-pressed={active === tool.id} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition active:bg-[var(--hover)]", active === tool.id ? "text-[var(--accent-blue)]" : "text-[var(--muted-foreground)]")}>
          {tool.icon}
          <span>{tool.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MobilePanelSheet({ title, keyboardInset = 0, onClose, children }: { title: string; keyboardInset?: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={`Configurações de ${title.toLowerCase()}`}>
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/35" aria-label="Fechar painel" />
      <section className="absolute inset-x-0 flex flex-col overflow-hidden rounded-t-[24px] border-t shadow-2xl transition-[bottom,max-height] duration-200" style={{ background: "var(--bg-modal)", borderColor: "var(--glass-border)", bottom: `calc(4rem + env(safe-area-inset-bottom) + ${keyboardInset}px)`, maxHeight: keyboardInset ? `calc(100dvh - ${keyboardInset}px - 5rem - env(safe-area-inset-top))` : "68dvh" }}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--glass-border)]" />
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold text-[var(--text-title)]">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted-foreground)] active:bg-[var(--hover)]" aria-label="Fechar"><X size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </section>
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
  return <aside className="border-b p-3 lg:border-b-0 lg:p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">Slides</p><span className="text-[10px] text-[var(--muted-foreground)]">{slides.length}</span></div><div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">{slides.map((slide, index) => {
    const isActive = activeId === slide.id;
    return <div key={slide.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", slide.id); setDraggedId(slide.id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetId(slide.id); }} onDragLeave={() => setDropTargetId((current) => current === slide.id ? null : current)} onDrop={(event) => { event.preventDefault(); const sourceId = draggedId || event.dataTransfer.getData("text/plain"); if (sourceId) onReorder(sourceId, slide.id); setDraggedId(null); setDropTargetId(null); }} onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }} className={cn("group relative flex min-w-[190px] cursor-grab items-center gap-1 overflow-hidden rounded-xl border p-1.5 text-left transition-all duration-200 active:cursor-grabbing lg:w-full lg:min-w-0", isActive ? "border-[#168fe0] bg-[#27a3ff]/[0.08] shadow-[0_0_0_1px_rgba(39,163,255,0.12),0_8px_20px_rgba(15,23,42,0.06)] dark:border-[#49b4ff] dark:bg-[#27a3ff]/[0.12] dark:shadow-[0_0_0_1px_rgba(73,180,255,0.16),0_8px_22px_rgba(0,0,0,0.18)]" : "border-transparent hover:bg-[var(--hover)]", draggedId === slide.id && "opacity-45", dropTargetId === slide.id && draggedId !== slide.id && "border-dashed border-[var(--accent-blue)]")}>
    {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--accent-blue)] shadow-[0_0_10px_rgba(39,163,255,0.45)]" />}
    <button type="button" onClick={() => onSelect(slide.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left" aria-label={`Selecionar slide ${index + 1}`} aria-current={isActive ? "true" : undefined}><GripVertical size={14} className={cn("shrink-0 transition-colors", isActive ? "text-[var(--accent-blue)]" : "text-[var(--muted-foreground)]")} /><span className={cn("w-5 shrink-0 text-[10px] transition-colors", isActive ? "font-semibold text-[var(--accent-blue)]" : "text-[var(--muted-foreground)]")}>{String(index + 1).padStart(2, "0")}</span><span className={cn("relative h-12 w-9 shrink-0 overflow-hidden rounded border bg-black transition-shadow", isActive ? "border-[#49b4ff] ring-2 ring-[#27a3ff]/20" : "border-[var(--glass-border)]")}><span className="absolute origin-top-left" style={{ transform: `scale(${scale})`, left, top, width: dimensions.width, height: dimensions.height }}><PostCanvas slide={slide} profile={profile} template={template} width={dimensions.width} height={dimensions.height} /></span></span><span className={cn("min-w-0 flex-1 truncate text-xs text-[var(--text-title)] transition", isActive && "font-semibold")}>{index === 0 ? "Capa" : `Slide ${index + 1}`}</span></button>
    <div className="flex shrink-0 flex-col gap-1"><button type="button" draggable={false} onClick={() => onDuplicate(slide.id)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-foreground)] transition hover:bg-[var(--glass-bg-soft)] hover:text-[var(--text-title)]" aria-label={`Duplicar slide ${index + 1}`} title="Duplicar slide"><Copy size={13} /></button><button type="button" draggable={false} onClick={() => onRemove(slide.id)} disabled={slides.length === 1} className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-foreground)] transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Excluir slide ${index + 1}`} title={slides.length === 1 ? "O projeto precisa ter pelo menos um slide" : "Excluir slide"}><Trash2 size={13} /></button></div>
  </div>;})}</div><Button variant="outline" fullWidth size="sm" onClick={onAdd} icon={<Plus />} className="mt-3">Adicionar slide</Button></aside>;
}

function MobileVisualQuickPanel({ tool, slide, textBlockId, update, profile, setProfile, placeText, onExpand, onClose }: {
  tool: Exclude<MobileVisualTool, null>;
  slide: Slide;
  textBlockId: string;
  update: (patch: Partial<Slide>) => void;
  profile: TweetProfile;
  setProfile: React.Dispatch<React.SetStateAction<TweetProfile>>;
  placeText: (placement: "above" | "below") => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const mediaCrop = tool.kind === "mediaCrop" ? { ...defaultMediaCrop(), ...slide.mediaCrops[tool.index] } : null;
  const avatarCrop = profile.avatarCrop;
  const textLayoutIndex = slide.layout.indexOf(textBlockId);
  const mediaLayoutIndex = slide.layout.indexOf("media");
  const textPlacement = textLayoutIndex < mediaLayoutIndex ? "above" : "below";
  const axisLabel = (axis: keyof MediaCrop) => axis === "x" ? "Horizontal" : axis === "y" ? "Vertical" : "Zoom";
  const label = tool.kind === "backgroundColor" ? "Cor de fundo"
    : tool.kind === "backgroundDarkness" ? `Escurecer foto · ${slide.imageDarkness}%`
    : tool.kind === "textPlacement" ? "Posição do texto"
    : tool.kind === "mediaCrop" ? `Imagem ${tool.index + 1} · ${axisLabel(tool.axis)}`
    : `Foto do perfil · ${axisLabel(tool.axis)}`;

  const updateMediaCrop = (value: number) => {
    if (tool.kind !== "mediaCrop" || !mediaCrop) return;
    const mediaCrops = [...slide.mediaCrops];
    mediaCrops[tool.index] = { ...mediaCrop, [tool.axis]: value };
    update({ mediaCrops });
  };
  const updateAvatarCrop = (value: number) => {
    if (tool.kind !== "avatarCrop") return;
    setProfile((current) => ({ ...current, avatarCrop: { ...current.avatarCrop, [tool.axis]: value } }));
  };

  return (
    <section className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border shadow-2xl lg:hidden" style={{ background: "var(--bg-modal)", borderColor: "var(--accent-blue)" }} role="dialog" aria-label={label}>
      <div className="flex h-11 items-center gap-2 border-b px-2" style={{ borderColor: "var(--border)" }}>
        <button type="button" onClick={onExpand} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--accent-blue)] active:bg-[var(--hover)]" aria-label="Voltar à edição completa"><ArrowUp size={16} /></button>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-title)]">{label}</p>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted-foreground)] active:bg-[var(--hover)]" aria-label="Fechar ajuste"><X size={16} /></button>
      </div>
      <div className="px-4 py-4">
        {tool.kind === "backgroundColor" && <BackgroundColorRow value={slide.background} onChange={(background) => update({ background, foreground: contrastColor(background) })} />}
        {tool.kind === "backgroundDarkness" && <input aria-label="Escurecer foto" type="range" min="0" max="90" value={slide.imageDarkness} onChange={(event) => update({ imageDarkness: Number(event.target.value) })} className="block h-8 w-full accent-[#27a3ff]" />}
        {tool.kind === "mediaCrop" && mediaCrop && <input aria-label={`${axisLabel(tool.axis)} da imagem ${tool.index + 1}`} type="range" min={tool.axis === "zoom" ? 1 : 0} max={tool.axis === "zoom" ? 2.5 : 100} step={tool.axis === "zoom" ? 0.05 : 1} value={mediaCrop[tool.axis]} onChange={(event) => updateMediaCrop(Number(event.target.value))} className="block h-8 w-full accent-[#27a3ff]" />}
        {tool.kind === "avatarCrop" && <input aria-label={`${axisLabel(tool.axis)} da foto do perfil`} type="range" min={tool.axis === "zoom" ? 1 : 0} max={tool.axis === "zoom" ? 4 : 100} step={tool.axis === "zoom" ? 0.05 : 1} value={avatarCrop[tool.axis]} onChange={(event) => updateAvatarCrop(Number(event.target.value))} className="block h-8 w-full accent-[#27a3ff]" />}
        {tool.kind === "textPlacement" && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => placeText("above")} className={cn("rounded-xl border px-3 py-2.5 text-xs", textPlacement === "above" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Acima da imagem</button><button type="button" onClick={() => placeText("below")} className={cn("rounded-xl border px-3 py-2.5 text-xs", textPlacement === "below" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Abaixo da imagem</button></div>}
      </div>
    </section>
  );
}

function MobileTextQuickPanel({ tool, editor, defaultColor, allowItalic, template, textBlock, updateTextBlock, onExpand, onClose }: {
  tool: Exclude<MobileTextTool, null>;
  editor: Editor | null;
  defaultColor: string;
  allowItalic: boolean;
  template: PostTemplate;
  textBlock: TextBlock;
  updateTextBlock: (patch: Partial<TextBlock>) => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const labels: Record<Exclude<MobileTextTool, null>, string> = {
    format: "Formatação",
    textColor: "Cor do texto",
    backdrop: "Texto destacado",
    fontSize: `Tamanho · ${textBlock.fontSize}px`,
    lineHeight: `Espaçamento · ${Math.round(textBlock.lineHeight * 100)}%`,
    textWidth: `Largura · ${textBlock.textWidth}%`,
  };

  return (
    <section className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border shadow-2xl lg:hidden" style={{ background: "var(--bg-modal)", borderColor: "var(--accent-blue)" }} role="dialog" aria-label={labels[tool]}>
      <div className="flex h-11 items-center gap-2 border-b px-2" style={{ borderColor: "var(--border)" }}>
        <button type="button" onClick={onExpand} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--accent-blue)] active:bg-[var(--hover)]" aria-label="Voltar à edição completa"><ArrowUp size={16} /></button>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-title)]">{labels[tool]}</p>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted-foreground)] active:bg-[var(--hover)]" aria-label="Fechar ajuste"><X size={16} /></button>
      </div>
      {(["format", "textColor", "backdrop"] as string[]).includes(tool) ? (
        <TextToolbar editor={editor} defaultColor={defaultColor} allowItalic={allowItalic} compact visibleGroup={tool as MobileInlineTool} preserveSelection />
      ) : (
        <div className="px-4 py-4">
          {tool === "fontSize" && <input aria-label="Tamanho do texto" type="range" min={template === "tweet" ? 28 : 36} max={template === "tweet" ? 128 : 190} step="1" value={textBlock.fontSize} onChange={(event) => updateTextBlock({ fontSize: Number(event.target.value) })} className="block h-8 w-full accent-[#27a3ff]" />}
          {tool === "lineHeight" && <input aria-label="Espaçamento entre linhas" type="range" min="0.75" max="1.8" step="0.05" value={textBlock.lineHeight} onChange={(event) => updateTextBlock({ lineHeight: Number(event.target.value) })} className="block h-8 w-full accent-[#27a3ff]" />}
          {tool === "textWidth" && <input aria-label="Largura do texto" type="range" min="40" max={template === "tweet" ? 76 : 84} step="2" value={Math.min(textBlock.textWidth, template === "tweet" ? 76 : 84)} onChange={(event) => updateTextBlock({ textWidth: Number(event.target.value) })} className="block h-8 w-full accent-[#27a3ff]" />}
        </div>
      )}
    </section>
  );
}

function MobileTextComposer({ editor }: { editor: Editor | null }) {
  const editorHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      editorHost.current?.querySelector<HTMLElement>(".tiptap")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
      <p className="mb-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
        Edite abaixo. Para formatar somente uma parte, toque e segure para selecionar o trecho.
      </p>
      <div ref={editorHost} className="mobile-post-text-composer rounded-2xl border bg-[var(--input)] p-3 text-[var(--text-title)] focus-within:border-[var(--accent-blue)] focus-within:ring-2 focus-within:ring-[#27a3ff]/15" style={{ borderColor: "var(--glass-border)" }}>
        <EditorContent editor={editor} className="post-rich-text" />
      </div>
    </div>
  );
}

function TextToolbar({ editor, defaultColor, allowItalic, compact = false, visibleGroup, preserveSelection = false, onToolUse }: { editor: Editor | null; defaultColor: string; allowItalic: boolean; compact?: boolean; visibleGroup?: MobileInlineTool; preserveSelection?: boolean; onToolUse?: (tool: MobileInlineTool) => void }) {
  const [, setRevision] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => setRevision((value) => value + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => { editor.off("selectionUpdate", refresh); editor.off("transaction", refresh); };
  }, [editor]);
  if (!editor) return <div className={cn("mx-auto h-11 max-w-xl rounded-xl border border-dashed", compact ? "m-3" : "mb-3")} />;
  const hasSelection = editor.state.selection.from !== editor.state.selection.to;
  const toolClass = (active: boolean) => cn("editor-tool shrink-0", active && "bg-[var(--hover)] text-[var(--accent-blue)]");
  const chain = () => preserveSelection ? editor.chain() : editor.chain().focus();
  const backdropActive = editor.isActive("textBackdrop");
  const backdropAttributes = editor.getAttributes("textBackdrop") as { backgroundColor?: string; color?: string };
  const show = (group: MobileInlineTool) => !visibleGroup || visibleGroup === group;
  const cycleBackdrop = () => {
    if (!backdropActive) {
      chain().setMark("textBackdrop", { backgroundColor: "#000000", color: "#ffffff" }).run();
    } else {
      const background = (backdropAttributes.backgroundColor || "").replace(/\s/g, "").toLowerCase();
      if (background === "#000000" || background === "rgb(0,0,0)") chain().setMark("textBackdrop", { backgroundColor: "#ffffff", color: "#000000" }).run();
      else chain().unsetMark("textBackdrop").run();
    }
    onToolUse?.("backdrop");
  };
  return <div className={cn("mx-auto flex min-h-11 max-w-xl items-center gap-1 border p-1.5", compact ? "sticky top-0 z-10 flex-nowrap overflow-x-auto border-x-0 border-t-0 px-3 py-2 shadow-sm [scrollbar-width:none]" : "mb-3 flex-wrap rounded-xl shadow-lg")} style={{ background: "var(--bg-modal)", borderColor: hasSelection ? "var(--accent-blue)" : "var(--glass-border)" }}>
    {show("format") && <>
      <button onClick={() => { chain().toggleBold().run(); onToolUse?.("format"); }} disabled={!hasSelection} className={toolClass(editor.isActive("bold"))} title="Negrito"><Bold /></button>
      {allowItalic && <button onClick={() => { chain().toggleItalic().run(); onToolUse?.("format"); }} disabled={!hasSelection} className={toolClass(editor.isActive("italic"))} title="Itálico" aria-label="Aplicar itálico ao trecho selecionado"><Italic /></button>}
      <button onClick={() => { chain().toggleUnderline().run(); onToolUse?.("format"); }} disabled={!hasSelection} className={toolClass(editor.isActive("underline"))} title="Sublinhar"><Underline /></button>
      <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />
      <button onClick={() => { chain().setTextAlign("left").run(); onToolUse?.("format"); }} className={toolClass(editor.isActive({ textAlign: "left" }))} title="Alinhar à esquerda"><AlignLeft /></button>
      <button onClick={() => { chain().setTextAlign("center").run(); onToolUse?.("format"); }} className={toolClass(editor.isActive({ textAlign: "center" }))} title="Centralizar"><AlignCenter /></button>
      <button onClick={() => { chain().setTextAlign("right").run(); onToolUse?.("format"); }} className={toolClass(editor.isActive({ textAlign: "right" }))} title="Alinhar à direita"><AlignRight /></button>
      <span className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />
      <button onClick={() => chain().undo().run()} disabled={!editor.can().undo()} className={toolClass(false)} title="Desfazer" aria-label="Desfazer"><Undo2 /></button>
      <button onClick={() => chain().redo().run()} disabled={!editor.can().redo()} className={toolClass(false)} title="Refazer" aria-label="Refazer"><Redo2 /></button>
    </>}
    {show("textColor") && <TextColorTool disabled={!hasSelection} value={editor.getAttributes("textStyle").color || defaultColor} isAutomatic={!editor.getAttributes("textStyle").color} onAuto={() => { chain().unsetColor().run(); onToolUse?.("textColor"); }} onChange={(color) => { chain().setColor(color).run(); onToolUse?.("textColor"); }} />}
    {show("backdrop") && <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={cycleBackdrop} disabled={!hasSelection} className={toolClass(backdropActive)} title="Texto destacado" aria-label="Alternar texto destacado"><Square fill={backdropActive ? backdropAttributes.backgroundColor || "#000000" : "none"} /></button>{backdropActive && <label className="editor-tool relative shrink-0 cursor-pointer" title="Cor do fundo destacado" aria-label="Escolher cor do fundo destacado"><Palette /><input aria-label="Cor do fundo destacado" type="color" value={toHexColor(backdropAttributes.backgroundColor || "#000000")} disabled={!hasSelection} className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => { const backgroundColor = event.target.value; chain().setMark("textBackdrop", { backgroundColor, color: contrastColor(backgroundColor) }).run(); onToolUse?.("backdrop"); }} /></label>}</div>}
    {!compact && <span className="ml-auto pr-2 text-[9px] text-[var(--muted-foreground)]">{hasSelection ? "Formatação do trecho selecionado" : "Selecione um trecho para formatar"}</span>}
  </div>;
}

function toHexColor(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? `#${match.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}` : "#000000";
}

function TextColorTool({ value, disabled, isAutomatic, onAuto, onChange }: { value: string; disabled: boolean; isAutomatic: boolean; onAuto: () => void; onChange: (value: string) => void }) {
  const selected = value.toLowerCase();
  return <div role="group" aria-label="Cor do texto" className={cn("flex shrink-0 items-center gap-1 rounded-lg px-1", disabled && "pointer-events-none opacity-40")}>
    <button type="button" disabled={disabled} title="Cor automática" aria-label="Usar cor automática do texto" aria-pressed={isAutomatic} onClick={onAuto} className={cn("grid h-7 w-7 place-items-center rounded-full border transition", isAutomatic ? "border-[var(--accent-blue)] text-[var(--accent-blue)]" : "border-[var(--glass-border)] text-[var(--muted-foreground)]")}><RotateCcw size={12} /></button>
    {QUICK_TEXT_COLORS.map((color) => <button key={color.value} type="button" disabled={disabled} title={color.label} aria-label={`Aplicar cor ${color.label}`} aria-pressed={selected === color.value} onClick={() => onChange(color.value)} className={cn("h-6 w-6 rounded-full border border-white/20 shadow-sm transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]", selected === color.value && "ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-modal)]")} style={{ background: color.value }} />)}
    <label className="editor-tool relative shrink-0 cursor-pointer" title="Mais cores" aria-label="Abrir seletor de cores personalizado"><Palette /><input aria-label="Cor personalizada do texto" type="color" value={toHexColor(value)} disabled={disabled} className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => onChange(event.target.value)} /></label>
  </div>;
}

function ScaledCanvas({ width, height, format, profile, children, maxHeight = 680 }: { width: number; height: number; format: PostFormat; profile: TweetProfile; children: React.ReactNode; maxHeight?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.42);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const chromeHeight = format === "portrait" ? 154 : 0;
    const update = () => setScale(Math.min(node.clientWidth / width, (maxHeight - chromeHeight) / height));
    update();
    const observer = new ResizeObserver(update); observer.observe(node);
    return () => observer.disconnect();
  }, [format, height, maxHeight, width]);
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

function PostCanvas({ slide, profile, template, width, height, editable = false, editor, refCallback, activeTextBlockId, editingTextBlockId, onSelectTextBlock, onEditTextBlock, onReorderText, onPositionChange }: { slide: Slide; profile: TweetProfile; template: PostTemplate; width: number; height: number; editable?: boolean; editor?: Editor | null; refCallback?: (node: HTMLDivElement | null) => void; activeTextBlockId?: string; editingTextBlockId?: string | null; onSelectTextBlock?: (id: string) => void; onEditTextBlock?: (id: string) => void; onReorderText?: (sourceId: string, targetId: string, after: boolean) => void; onPositionChange?: (key: string, position: CanvasPoint) => void }) {
  const safeLeft = template === "tweet" ? 12 : 8;
  const safeWidth = 100 - safeLeft * 2;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const media = slide.media.length ? <HorizontalMedia media={slide.media} crops={slide.mediaCrops} aspects={slide.mediaAspects} naturalAspects={slide.mediaNaturalAspects} /> : null;
  const profileBlock = template === "tweet" ? <TweetProfileBlock profile={profile} foreground={slide.foreground} /> : null;
  const textMap = new Map(slide.textBlocks.map((block) => [block.id, block]));
  const layout = [...slide.layout, ...slide.textBlocks.map((block) => block.id).filter((id) => !slide.layout.includes(id)), ...(slide.layout.includes("media") ? [] : ["media"] )];
  const layoutItems = layout.map((key) => {
    const block = textMap.get(key);
    const child = key === "media" ? media : block ? <TextBlockItem block={block} editor={editor} editable={editable} active={activeTextBlockId === block.id} editing={editingTextBlockId === block.id} foreground={slide.foreground} story={template === "stories"} safeWidth={safeWidth} onSelect={() => onSelectTextBlock?.(block.id)} onEdit={() => onEditTextBlock?.(block.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); setDraggedTextId(block.id); }} onDragEnd={() => { setDraggedTextId(null); setDropTargetId(null); }} /> : null;
    if (!child) return null;
    return <div key={key} className={cn("relative w-full min-w-0 max-w-full transition", dropTargetId === key && draggedTextId !== key && "rounded-[28px] ring-[8px] ring-[#27a3ff]/35")} onDragOver={editable ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetId(key); } : undefined} onDragLeave={editable ? () => setDropTargetId((current) => current === key ? null : current) : undefined} onDrop={editable ? (event) => { event.preventDefault(); const sourceId = draggedTextId || event.dataTransfer.getData("text/plain"); if (sourceId && sourceId !== key) { const rect = event.currentTarget.getBoundingClientRect(); onReorderText?.(sourceId, key, event.clientY >= rect.top + rect.height / 2); } setDraggedTextId(null); setDropTargetId(null); } : undefined}>{child}</div>;
  });

  const defaultPosition = (key: string, index = 0): CanvasPoint => {
    if (key === "profile") return { x: safeLeft, y: 7 };
    if (key.startsWith("media:")) return { x: safeLeft + (slide.media.length > 1 ? index * 44 : 0), y: template === "tweet" ? 52 : 46 };
    return { x: safeLeft, y: (template === "tweet" ? 25 : 12) + index * 20 };
  };
  const setRefs = (node: HTMLDivElement | null) => { canvasRef.current = node; refCallback?.(node); };
  const freeContent = slide.layoutMode === "free" ? <>
    {profileBlock && <FreeCanvasElement elementKey="profile" position={slide.freePositions.profile || defaultPosition("profile")} canvasRef={canvasRef} canvas={{ width, height }} editable={editable} onPositionChange={onPositionChange} onGuidesChange={setGuides}>{profileBlock}</FreeCanvasElement>}
    {slide.textBlocks.map((block, index) => <FreeCanvasElement key={block.id} elementKey={block.id} position={slide.freePositions[block.id] || defaultPosition(block.id, index)} canvasRef={canvasRef} canvas={{ width, height }} editable={editable} onPositionChange={onPositionChange} onGuidesChange={setGuides} className="max-w-full" style={{ width: `${block.textWidth}%` }}><TextBlockItem block={block} editor={editor} editable={editable} active={activeTextBlockId === block.id} editing={editingTextBlockId === block.id} foreground={slide.foreground} story={template === "stories"} safeWidth={100} onSelect={() => onSelectTextBlock?.(block.id)} onEdit={() => onEditTextBlock?.(block.id)} onDragStart={() => undefined} onDragEnd={() => undefined} free /></FreeCanvasElement>)}
    {slide.media.map((image, index) => {
      const aspect = mediaAspectValue(slide.mediaAspects[index] || "16:9", slide.mediaNaturalAspects[index]);
      const baseWidth = slide.media.length > 1 ? 40 : 76;
      const itemWidth = Math.max(24, Math.min(baseWidth, (height * .44 * aspect) / width * 100));
      return <FreeCanvasElement key={`media:${index}`} elementKey={`media:${index}`} position={slide.freePositions[`media:${index}`] || defaultPosition(`media:${index}`, index)} canvasRef={canvasRef} canvas={{ width, height }} editable={editable} onPositionChange={onPositionChange} onGuidesChange={setGuides} style={{ width: `${itemWidth}%` }}><MediaFrame image={image} crop={slide.mediaCrops[index]} aspect={aspect} /></FreeCanvasElement>;
    })}
  </> : <BalancedContent safeLeft={safeLeft} safeWidth={safeWidth} gap={template === "tweet" ? 44 : 52}>{profileBlock}{layoutItems}</BalancedContent>;

  return <div ref={setRefs} data-post-canvas={template} className="relative overflow-hidden" style={{ width, height, background: slide.background, color: slide.foreground, fontFamily: template === "tweet" ? "Arial, Helvetica, sans-serif" : "Advercase, Georgia, serif", fontWeight: 400 }}>
    {template === "stories" && slide.backgroundImage && <><img src={slide.backgroundImage} alt="Fundo do slide" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-black" style={{ opacity: slide.imageDarkness / 100 }} /></>}
    {freeContent}
    {editable && guides.map((guide) => <span key={`${guide.axis}:${guide.value}`} aria-hidden className="pointer-events-none absolute z-50 bg-[#ff3ca6] shadow-[0_0_0_1px_rgba(255,255,255,.65)]" style={guide.axis === "x" ? { left: guide.value, top: 0, bottom: 0, width: 3 } : { top: guide.value, left: 0, right: 0, height: 3 }} />)}
  </div>;
}

function FreeCanvasElement({ elementKey, position, canvasRef, canvas, editable, onPositionChange, onGuidesChange, className, style, children }: { elementKey: string; position: CanvasPoint; canvasRef: React.RefObject<HTMLDivElement>; canvas: { width: number; height: number }; editable: boolean; onPositionChange?: (key: string, position: CanvasPoint) => void; onGuidesChange: (guides: AlignmentGuide[]) => void; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; start: CanvasPoint; size: { width: number; height: number }; siblings: Array<CanvasPoint & { width: number; height: number }>; scale: number } | null>(null);
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onPositionChange || event.button !== 0) return;
    if (event.detail > 1) return;
    const target = event.target as HTMLElement;
    if (target.closest("[contenteditable='true']") && !target.closest("[data-free-drag-handle]")) return;
    const canvasNode = canvasRef.current;
    const elementNode = elementRef.current;
    if (!canvasNode || !elementNode) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const canvasRect = canvasNode.getBoundingClientRect();
    const scale = canvasRect.width / canvas.width;
    const rect = elementNode.getBoundingClientRect();
    const siblings = Array.from(canvasNode.querySelectorAll<HTMLElement>("[data-free-key]")).filter((node) => node !== elementNode).map((node) => {
      const sibling = node.getBoundingClientRect();
      return { x: (sibling.left - canvasRect.left) / scale, y: (sibling.top - canvasRect.top) / scale, width: sibling.width / scale, height: sibling.height / scale };
    });
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, start: { x: position.x / 100 * canvas.width, y: position.y / 100 * canvas.height }, size: { width: rect.width / scale, height: rect.height / scale }, siblings, scale };
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onPositionChange) return;
    const candidate = { x: drag.start.x + (event.clientX - drag.clientX) / drag.scale, y: drag.start.y + (event.clientY - drag.clientY) / drag.scale };
    const snapped = snapCanvasPosition(candidate, drag.size, canvas, drag.siblings, 9 / drag.scale);
    onGuidesChange(snapped.guides);
    onPositionChange(elementKey, { x: snapped.position.x / canvas.width * 100, y: snapped.position.y / canvas.height * 100 });
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    onGuidesChange([]);
  };
  return <div ref={elementRef} data-free-key={elementKey} className={cn("absolute z-10 touch-none", editable && "cursor-move select-none", className)} style={{ ...style, left: `${position.x}%`, top: `${position.y}%` }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>{children}</div>;
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

function TextBlockItem({ block, editor, editable, active, editing, foreground, story, safeWidth, onSelect, onEdit, onDragStart, onDragEnd, free = false }: { block: TextBlock; editor?: Editor | null; editable: boolean; active: boolean; editing: boolean; foreground: string; story: boolean; safeWidth: number; onSelect: () => void; onEdit: () => void; onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void; onDragEnd: () => void; free?: boolean }) {
  const width = free ? 100 : Math.min(block.textWidth, safeWidth) / safeWidth * 100;
  return <div onPointerDown={editable && !editing ? onSelect : undefined} onDoubleClick={editable ? (event) => { event.stopPropagation(); onEdit(); } : undefined} className={cn("relative mx-auto min-w-0 max-w-full", editable && (editing ? "cursor-text select-text" : free ? "cursor-move select-none" : "cursor-text"), active && "z-10")} style={{ width: `${width}%`, color: foreground, fontSize: block.fontSize, fontWeight: 400, lineHeight: block.lineHeight, overflowWrap: "anywhere", wordBreak: "break-word" }}>
    {editable && active && <button type="button" draggable={!free} data-free-drag-handle={free ? "true" : undefined} aria-label="Mover caixa de texto" title={free ? "Arraste para posicionar livremente" : "Arraste para reorganizar esta caixa"} className="absolute -bottom-14 left-1/2 hidden h-12 w-12 -translate-x-1/2 cursor-grab place-items-center rounded-full bg-[#27a3ff] text-white shadow-xl active:cursor-grabbing lg:grid" onDragStart={free ? undefined : onDragStart} onDragEnd={free ? undefined : onDragEnd}><Move size={24} /></button>}
    <PostText block={block} editor={editing ? editor : undefined} editable={editable && editing} className={cn("w-full", story && "tracking-[-.03em]", editable && !active && "rounded-lg ring-[5px] ring-transparent hover:ring-[#27a3ff]/20", active && "rounded-lg ring-[5px] ring-[#27a3ff]/25", editing && "ring-[#27a3ff]/45")} />
  </div>;
}

function PostText({ block, editor, editable, className }: { block: TextBlock; editor?: Editor | null; editable: boolean; className: string }) {
  if (editable && editor) return <EditorContent editor={editor} className={cn("post-rich-text min-w-0 max-w-full rounded-lg outline-none ring-[5px] ring-transparent transition focus-within:ring-[#27a3ff]/35", className)} />;
  return <div className={cn("post-rich-text min-w-0 max-w-full", className)} dangerouslySetInnerHTML={{ __html: block.content }} />;
}

function MediaFrame({ image, crop: savedCrop, aspect }: { image: string; crop?: MediaCrop; aspect: number }) {
  const crop = { ...defaultMediaCrop(), ...savedCrop };
  return <div className="w-full overflow-hidden rounded-[36px] border border-black/10" style={{ aspectRatio: aspect }}><img src={image} alt="Mídia do post" className="h-full w-full object-cover" draggable={false} style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} /></div>;
}

function HorizontalMedia({ media, crops, aspects, naturalAspects, className }: { media: string[]; crops: MediaCrop[]; aspects: MediaAspect[]; naturalAspects: number[]; className?: string }) {
  if (!media.length) return null;
  return <div className={cn("flex w-full items-center justify-center gap-2", className)}>{media.map((image, index) => <div key={`${image.slice(-20)}-${index}`} className="min-w-0 flex-1"><MediaFrame image={image} crop={crops[index]} aspect={mediaAspectValue(aspects[index] || "16:9", naturalAspects[index])} /></div>)}</div>;
}

function Avatar({ src, size, crop = defaultMediaCrop() }: { src: string; size: number; crop?: MediaCrop }) {
  return src ? <span className="block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}><img src={src} alt="Foto do perfil" className="h-full w-full object-cover" style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} /></span> : <span className="grid shrink-0 place-items-center rounded-full bg-[#20252a] text-white" style={{ width: size, height: size }}><UserRound size={size * .42} /></span>;
}

function PropertiesPanel({ section, template, format, setFormat, slide, update, activeTextBlock, selectTextBlock, updateTextBlock, addTextBlock, removeTextBlock, placeText, profile, setProfile, onFocusTextControl, onFocusVisualControl }: { section?: Exclude<MobileEditorPanel, "export" | null>; template: PostTemplate; format: PostFormat; setFormat: (format: PostFormat) => void; slide: Slide; update: (patch: Partial<Slide>) => void; activeTextBlock: TextBlock; selectTextBlock: (id: string) => void; updateTextBlock: (patch: Partial<TextBlock>) => void; addTextBlock: () => void; removeTextBlock: () => void; placeText: (placement: "above" | "below") => void; profile: TweetProfile; setProfile: React.Dispatch<React.SetStateAction<TweetProfile>>; onFocusTextControl?: (tool: Exclude<MobileTextTool, null>) => void; onFocusVisualControl?: (tool: Exclude<MobileVisualTool, null>) => void }) {
  const addFile = (file: File | undefined, callback: (url: string) => void) => { if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem."); const reader = new FileReader(); reader.onload = () => callback(String(reader.result)); reader.readAsDataURL(file); };
  const updateProfile = (patch: Partial<TweetProfile>) => setProfile((current) => ({ ...current, ...patch }));
  const updateBackground = (background: string) => update({ background, foreground: contrastColor(background) });
  const textLayoutIndex = slide.layout.indexOf(activeTextBlock.id);
  const mediaLayoutIndex = slide.layout.indexOf("media");
  const textPlacement = textLayoutIndex < mediaLayoutIndex ? "above" : "below";
  return <aside className="p-4 lg:p-5"><div className="space-y-6">{(!section || section === "slide") && <><PanelSection title="Documento"><div className="grid grid-cols-2 gap-2">{(Object.entries(POST_FORMATS) as Array<[PostFormat, { label: string; width: number; height: number }]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("min-h-14 rounded-xl border p-3 text-left transition", format === value ? "border-[var(--accent-blue)] bg-[var(--hover)]" : "border-[var(--glass-border)]")}><span className="block text-xs font-semibold text-[var(--text-title)]">{item.label}</span><span className="text-[9px] text-[var(--muted-foreground)]">{value === "story" ? "Story" : "Feed 4:5"}</span>{format === value && <Check size={13} className="float-right -mt-5 text-[var(--accent-blue)]" />}</button>)}</div></PanelSection><PanelSection title="Composição"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => update({ layoutMode: "auto" })} className={cn("rounded-xl border px-3 py-2.5 text-xs", slide.layoutMode === "auto" ? "border-[var(--accent-blue)] bg-[var(--hover)] text-[var(--text-title)]" : "border-[var(--glass-border)] text-[var(--muted-foreground)]")}>Automático</button><button type="button" onClick={() => update({ layoutMode: "free" })} className={cn("rounded-xl border px-3 py-2.5 text-xs", slide.layoutMode === "free" ? "border-[var(--accent-blue)] bg-[var(--hover)] text-[var(--text-title)]" : "border-[var(--glass-border)] text-[var(--muted-foreground)]")}><Move size={13} className="mr-1 inline" />Livre</button></div><p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">No modo livre, arraste textos e imagens. Guias magnéticas aparecem ao alinhar centros e bordas.</p></PanelSection></>}

      {(!section || section === "text") && <PanelSection title="Caixas de texto">
        <div className="flex flex-wrap gap-1.5">
          {slide.textBlocks.map((block, index) => <button key={block.id} type="button" onClick={() => selectTextBlock(block.id)} className={cn("rounded-lg border px-2.5 py-1.5 text-[10px]", activeTextBlock.id === block.id ? "border-[var(--accent-blue)] bg-[var(--hover)] text-[var(--text-title)]" : "border-[var(--glass-border)] text-[var(--muted-foreground)]")}>Texto {index + 1}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={addTextBlock} icon={<Plus />}>Novo texto</Button>
          <Button variant="danger" size="sm" className="h-9 rounded-xl" onClick={removeTextBlock} disabled={slide.textBlocks.length === 1} icon={<Trash2 />}>Remover</Button>
        </div>
        {section && onFocusTextControl ? (
          <div className="grid gap-2">
            <MobileAdjustmentButton label="Tamanho" value={`${activeTextBlock.fontSize}px`} onClick={() => onFocusTextControl("fontSize")} />
            <MobileAdjustmentButton label="Espaçamento entre linhas" value={`${Math.round(activeTextBlock.lineHeight * 100)}%`} onClick={() => onFocusTextControl("lineHeight")} />
            <MobileAdjustmentButton label="Largura do bloco" value={`${activeTextBlock.textWidth}%`} onClick={() => onFocusTextControl("textWidth")} />
          </div>
        ) : (
          <>
            <Field label={`Tamanho · ${activeTextBlock.fontSize}px`}><input aria-label="Tamanho do texto" type="range" min={template === "tweet" ? 28 : 36} max={template === "tweet" ? 128 : 190} step="1" value={activeTextBlock.fontSize} onChange={(event) => updateTextBlock({ fontSize: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>
            <Field label={`Espaçamento entre linhas · ${Math.round(activeTextBlock.lineHeight * 100)}%`}><input aria-label="Espaçamento entre linhas" type="range" min="0.75" max="1.8" step="0.05" value={activeTextBlock.lineHeight} onChange={(event) => updateTextBlock({ lineHeight: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>
            <Field label={`Largura do bloco · ${activeTextBlock.textWidth}%`}><input aria-label="Largura do texto" type="range" min="40" max={template === "tweet" ? 76 : 84} step="2" value={Math.min(activeTextBlock.textWidth, template === "tweet" ? 76 : 84)} onChange={(event) => updateTextBlock({ textWidth: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>
          </>
        )}
        {slide.layoutMode === "auto" && <div className="grid grid-cols-2 gap-2"><button onClick={() => { placeText("above"); onFocusVisualControl?.({ kind: "textPlacement" }); }} className={cn("rounded-xl border px-3 py-2 text-xs", textPlacement === "above" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Acima da imagem</button><button onClick={() => { placeText("below"); onFocusVisualControl?.({ kind: "textPlacement" }); }} className={cn("rounded-xl border px-3 py-2 text-xs", textPlacement === "below" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Abaixo da imagem</button></div>}
        <p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]"><Move size={11} className="mr-1 inline" />{slide.layoutMode === "free" ? "Arraste a caixa diretamente no slide; ela se alinha ao centro e aos demais elementos." : section ? "Use os botões acima para posicionar a caixa em relação à imagem." : "Selecione uma caixa e arraste o controle azul. Ela se encaixa na sequência sem alterar margens ou distâncias."}</p>
      </PanelSection>}

      {template === "tweet" ? <>
        {(!section || section === "background") && <><PanelSection title="Perfil · aplicado a todos os slides">
          <AvatarUploadField
            value={profile.avatar}
            crop={profile.avatarCrop}
            onFile={(file) => addFile(file, (avatar) => updateProfile({ avatar, avatarCrop: defaultMediaCrop() }))}
            onRemove={() => updateProfile({ avatar: "", avatarCrop: defaultMediaCrop() })}
            onCropChange={(avatarCrop) => updateProfile({ avatarCrop })}
            onFocusCrop={section ? (axis) => onFocusVisualControl?.({ kind: "avatarCrop", axis }) : undefined}
          />
          <Field label="Nome"><input value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} className="editor-input" /></Field>
          <Field label="Arroba"><div className="relative"><AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={profile.handle.replace(/^@/, "")} onChange={(event) => updateProfile({ handle: `@${event.target.value.replace(/^@/, "")}` })} className="editor-input pl-8" /></div></Field>
          <label className="flex items-center justify-between text-xs"><span>Selo de verificação</span><input type="checkbox" checked={profile.verified} onChange={(event) => updateProfile({ verified: event.target.checked })} className="accent-[#27a3ff]" /></label>
        </PanelSection>
        <PanelSection title="Aparência">{section ? <MobileAdjustmentButton label="Cor de fundo" value={slide.background.toUpperCase()} onClick={() => onFocusVisualControl?.({ kind: "backgroundColor" })} /> : <div className="grid grid-cols-2 gap-2"><button onClick={() => updateBackground("#ffffff")} className={cn("min-h-14 rounded-xl border p-3 text-left", slide.background === "#ffffff" && "border-[#27a3ff]")}><Sun size={15} /><span className="mt-2 block text-xs">Claro</span></button><button onClick={() => updateBackground("#000000")} className={cn("min-h-14 rounded-xl border p-3 text-left", slide.background === "#000000" && "border-[#27a3ff]")}><Moon size={15} /><span className="mt-2 block text-xs">Escuro absoluto</span></button></div>}</PanelSection></>}
        {(!section || section === "image") && <MediaPanel slide={slide} update={update} addFile={addFile} title="Imagem do post" mobile={Boolean(section)} onFocusCrop={section ? (index, axis) => onFocusVisualControl?.({ kind: "mediaCrop", index, axis }) : undefined} />}
      </> : <>
        {(!section || section === "background") && <><PanelSection title="Cores">{section ? <MobileAdjustmentButton label="Cor de fundo" value={slide.background.toUpperCase()} onClick={() => onFocusVisualControl?.({ kind: "backgroundColor" })} /> : <BackgroundColorRow value={slide.background} onChange={updateBackground} />}<div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">Texto automático</span><span className="h-7 w-7 rounded-full border" style={{ background: slide.foreground, borderColor: "var(--glass-border)" }} /></div></PanelSection>
        <PanelSection title="Imagem de fundo"><UploadField label="Imagem do slide" value={slide.backgroundImage} square onFile={(file) => addFile(file, (backgroundImage) => update({ backgroundImage }))} onRemove={() => update({ backgroundImage: "" })} />{slide.backgroundImage && (section ? <MobileAdjustmentButton label="Escurecer foto" value={`${slide.imageDarkness}%`} onClick={() => onFocusVisualControl?.({ kind: "backgroundDarkness" })} /> : <Field label={`Escurecer foto · ${slide.imageDarkness}%`}><input type="range" min="0" max="90" value={slide.imageDarkness} onChange={(event) => update({ imageDarkness: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>)}</PanelSection></>}
        {(!section || section === "image") && <MediaPanel slide={slide} update={update} addFile={addFile} title="Imagem complementar" mobile={Boolean(section)} onFocusCrop={section ? (index, axis) => onFocusVisualControl?.({ kind: "mediaCrop", index, axis }) : undefined} />}
      </>}
    </div></aside>;
}

function MediaPanel({ slide, update, addFile, title, mobile = false, onFocusCrop }: { slide: Slide; update: (patch: Partial<Slide>) => void; addFile: (file: File | undefined, callback: (url: string) => void) => void; title: string; mobile?: boolean; onFocusCrop?: (index: number, axis: keyof MediaCrop) => void }) {
  const setMediaFile = async (index: number, url: string) => {
    const naturalAspect = await readImageAspect(url);
    const media = [...slide.media];
    const mediaCrops = [...slide.mediaCrops];
    const mediaAspects = [...slide.mediaAspects];
    const mediaNaturalAspects = [...slide.mediaNaturalAspects];
    media[index] = url;
    mediaCrops[index] = defaultMediaCrop();
    mediaAspects[index] = "original";
    mediaNaturalAspects[index] = naturalAspect;
    const pairs = media.map((image, mediaIndex) => ({ image, crop: mediaCrops[mediaIndex] || defaultMediaCrop(), aspect: mediaAspects[mediaIndex] || "original" as const, naturalAspect: mediaNaturalAspects[mediaIndex] || 16 / 9 })).filter((item) => Boolean(item.image)).slice(0, 2);
    update({ media: pairs.map((item) => item.image), mediaCrops: pairs.map((item) => item.crop), mediaAspects: pairs.map((item) => item.aspect), mediaNaturalAspects: pairs.map((item) => item.naturalAspect) });
  };
  const removeMedia = (index: number) => {
    const freePositions = { ...slide.freePositions };
    delete freePositions[`media:${index}`];
    if (index === 0 && freePositions["media:1"]) { freePositions["media:0"] = freePositions["media:1"]; delete freePositions["media:1"]; }
    update({ media: slide.media.filter((_, mediaIndex) => mediaIndex !== index), mediaCrops: slide.mediaCrops.filter((_, mediaIndex) => mediaIndex !== index), mediaAspects: slide.mediaAspects.filter((_, mediaIndex) => mediaIndex !== index), mediaNaturalAspects: slide.mediaNaturalAspects.filter((_, mediaIndex) => mediaIndex !== index), freePositions });
  };
  return <PanelSection title={title}><p className="mb-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">{mobile ? "Escolha a proporção e ajuste zoom e enquadramento de cada imagem." : "Cada imagem pode manter o formato original ou usar uma proporção fixa. Cole também com Ctrl+V / ⌘V."}</p><div className="grid grid-cols-2 gap-2">{[0, 1].map((index) => <UploadTile key={index} value={slide.media[index]} crop={{ ...defaultMediaCrop(), ...slide.mediaCrops[index] }} aspect={slide.mediaAspects[index] || "original"} naturalAspect={slide.mediaNaturalAspects[index]} label={`Imagem ${index + 1}`} compactControls={mobile} onFocusCrop={(axis) => onFocusCrop?.(index, axis)} onCropChange={(crop) => { const mediaCrops = [...slide.mediaCrops]; mediaCrops[index] = crop; update({ mediaCrops }); }} onAspectChange={(aspect) => { const mediaAspects = [...slide.mediaAspects]; mediaAspects[index] = aspect; update({ mediaAspects }); }} onFile={(file) => addFile(file, (url) => void setMediaFile(index, url))} onRemove={() => removeMedia(index)} />)}</div></PanelSection>;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="post-generator-panel-section border-b pb-5 last:border-0" style={{ borderColor: "var(--border)" }}><h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">{title}</h2><div className="space-y-3">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] text-[var(--muted-foreground)]">{label}</span>{children}</label>; }
function MobileAdjustmentButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left active:bg-[var(--hover)]" style={{ borderColor: "var(--glass-border)" }}><span className="min-w-0 flex-1 text-xs text-[var(--text-title)]">{label}</span><span className="text-[10px] font-semibold text-[var(--accent-blue)]">{value}</span><ChevronRight size={14} className="text-[var(--muted-foreground)]" /></button>; }
function BackgroundColorRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const normalizedValue = value.toLowerCase();
  return <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">Fundo</span><div className="flex items-center gap-2">{[{ value: "#000000", label: "Preto puro" }, { value: "#ffffff", label: "Branco puro" }].map((color) => <button key={color.value} type="button" onClick={() => onChange(color.value)} aria-label={`Usar fundo ${color.label.toLowerCase()}`} title={color.label} className={cn("h-8 w-8 rounded-full border transition hover:scale-105", normalizedValue === color.value ? "ring-2 ring-[#27a3ff] ring-offset-2 ring-offset-[var(--background)]" : "border-[var(--glass-border)]")} style={{ backgroundColor: color.value }} />)}<label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border text-[var(--muted-foreground)] transition hover:bg-[var(--hover)] hover:text-[var(--text-title)]" style={{ borderColor: "var(--glass-border)" }} title="Escolher cor personalizada"><Palette size={15} /><input aria-label="Escolher cor de fundo personalizada" type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" /></label></div></div>;
}

function AvatarUploadField({ value, crop, onFile, onRemove, onCropChange, onFocusCrop }: { value: string; crop: MediaCrop; onFile: (file?: File) => void; onRemove: () => void; onCropChange: (crop: MediaCrop) => void; onFocusCrop?: (axis: keyof MediaCrop) => void }) {
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
      {onFocusCrop ? <div className="grid gap-1.5"><MobileAdjustmentButton label="Horizontal" value={`${Math.round(crop.x)}%`} onClick={() => onFocusCrop("x")} /><MobileAdjustmentButton label="Vertical" value={`${Math.round(crop.y)}%`} onClick={() => onFocusCrop("y")} /><MobileAdjustmentButton label="Zoom" value={`${crop.zoom.toFixed(2)}×`} onClick={() => onFocusCrop("zoom")} /></div> : <><CropSlider label="Horizontal" value={crop.x} min={0} max={100} onChange={(x) => onCropChange({ ...crop, x })} /><CropSlider label="Vertical" value={crop.y} min={0} max={100} onChange={(y) => onCropChange({ ...crop, y })} /><CropSlider label="Zoom" value={crop.zoom} min={1} max={4} step={0.05} onChange={(zoom) => onCropChange({ ...crop, zoom })} /></>}
    </div>}
  </div>;
}

function UploadField({ label, value, onFile, onRemove, square = false }: { label: string; value: string; onFile: (file?: File) => void; onRemove: () => void; square?: boolean }) { return <div className="flex items-center gap-3"><span className={cn("grid h-11 w-11 shrink-0 place-items-center overflow-hidden border bg-[var(--hover)]", square ? "rounded-lg" : "rounded-full")}>{value ? <img src={value} alt="Arquivo selecionado" className="h-full w-full object-cover" /> : <UserRound size={17} />}</span><label className="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-[10px] hover:bg-[var(--hover)]"><Upload size={12} className="mr-1 inline" />{value ? "Trocar" : label}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>{value && <button onClick={onRemove} className="text-[var(--muted-foreground)] hover:text-red-500" aria-label="Remover imagem"><X size={15} /></button>}</div>; }

function UploadTile({ label, value, crop, aspect, naturalAspect, onFile, onRemove, onCropChange, onAspectChange, compactControls = false, onFocusCrop }: { label: string; value?: string; crop: MediaCrop; aspect: MediaAspect; naturalAspect?: number; onFile: (file?: File) => void; onRemove: () => void; onCropChange: (crop: MediaCrop) => void; onAspectChange: (aspect: MediaAspect) => void; compactControls?: boolean; onFocusCrop?: (axis: keyof MediaCrop) => void }) { const previewAspect = mediaAspectValue(aspect, naturalAspect); return <div className="min-w-0 space-y-2"><div className="relative mx-auto w-full overflow-hidden rounded-xl border bg-[var(--hover)]" style={{ borderColor: "var(--glass-border)", aspectRatio: previewAspect }}>{value ? <><img src={value} alt={label} className="h-full w-full object-cover" style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} /><button onClick={onRemove} aria-label={`Remover ${label}`} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X size={12} /></button></> : <label className="grid h-full min-h-20 cursor-pointer place-items-center text-center text-[10px] text-[var(--muted-foreground)]"><span><ImagePlus size={18} className="mx-auto mb-1" />{label}</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>}</div>{value && <div className="space-y-2 rounded-lg border p-2" style={{ borderColor: "var(--glass-border)" }}><label className="block"><span className="mb-1 block text-[8px] text-[var(--muted-foreground)]">Proporção</span><select aria-label={`Proporção da ${label.toLowerCase()}`} value={aspect} onChange={(event) => onAspectChange(event.target.value as MediaAspect)} className="editor-input h-9 w-full py-1 text-[10px]"><option value="original">Original · livre</option><option value="1:1">Quadrada · 1:1</option><option value="4:5">Vertical · 4:5</option><option value="9:16">Story · 9:16</option><option value="16:9">Horizontal · 16:9</option></select></label>{compactControls ? <><MobileAdjustmentButton label="Horizontal" value={`${Math.round(crop.x)}%`} onClick={() => onFocusCrop?.("x")} /><MobileAdjustmentButton label="Vertical" value={`${Math.round(crop.y)}%`} onClick={() => onFocusCrop?.("y")} /><MobileAdjustmentButton label="Zoom" value={`${crop.zoom.toFixed(2)}×`} onClick={() => onFocusCrop?.("zoom")} /></> : <><CropSlider label="Horizontal" value={crop.x} min={0} max={100} onChange={(x) => onCropChange({ ...crop, x })} /><CropSlider label="Vertical" value={crop.y} min={0} max={100} onChange={(y) => onCropChange({ ...crop, y })} /><CropSlider label="Zoom" value={crop.zoom} min={1} max={2.5} step={0.05} onChange={(zoom) => onCropChange({ ...crop, zoom })} /></>}</div>}</div>; }

function CropSlider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) { return <label className="block"><span className="mb-0.5 flex justify-between text-[8px] text-[var(--muted-foreground)]"><span>{label}</span><span>{label === "Zoom" ? `${value.toFixed(2)}×` : `${Math.round(value)}%`}</span></span><input type="range" aria-label={`${label} da imagem`} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="block w-full accent-[#27a3ff]" /></label>; }
