"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, AtSign,
  Bold, Bookmark, Check, ChevronRight, Copy, Download, GripVertical, Heart, Highlighter, ImagePlus,
  Layers3, MessageCircle, MoreHorizontal, Move, Moon, Plus, Send, Sun, Trash2,
  Underline, Upload, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createZip, downloadBlob, POST_FORMATS, postElementToPng,
  type PostFormat, type PostTemplate,
} from "@/lib/marketing/post-generator";
import { cn } from "@/lib/utils";

type Slide = {
  id: string;
  background: string;
  foreground: string;
  content: string;
  media: string[];
  backgroundImage: string;
  imageDarkness: number;
  fontSize: number;
  textX: number;
  textY: number;
  textWidth: number;
  textPlacement: "above" | "below" | "free";
  mediaPosition: "top" | "bottom";
};

type TweetProfile = { avatar: string; name: string; handle: string; verified: boolean };
type PersistedPostProject = { version: 1; format: PostFormat; slides: Slide[]; activeId: string; tweetProfile: TweetProfile; updatedAt: number };

const DEFAULT_PROFILE: TweetProfile = {
  avatar: "",
  name: "Genesy Company",
  handle: "@genesycompany",
  verified: true,
};

function uid() { return Math.random().toString(36).slice(2, 10); }

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
  return {
    id: uid(),
    background: template === "tweet" ? "#ffffff" : "#000000",
    foreground: template === "tweet" ? "#0f1419" : "#ffffff",
    content,
    media: [],
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

export function PostGenerator() {
  const [template, setTemplate] = useState<PostTemplate | null>(null);
  if (!template) return <TemplateGallery onChoose={setTemplate} />;
  return <PostEditor key={template} template={template} onBack={() => setTemplate(null)} />;
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
  const firstSlide = useMemo(() => makeSlide(template), [template]);
  const [format, setFormat] = useState<PostFormat>("story");
  const [slides, setSlides] = useState<Slide[]>([firstSlide]);
  const [activeId, setActiveId] = useState(firstSlide.id);
  const [tweetProfile, setTweetProfile] = useState<TweetProfile>(DEFAULT_PROFILE);
  const [storageReady, setStorageReady] = useState(false);
  const [exporting, setExporting] = useState<"one" | "all" | null>(null);
  const exportRefs = useRef(new Map<string, HTMLDivElement>());
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeId));
  const active = slides[activeIndex];
  const dimensions = POST_FORMATS[format];

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
    content: firstSlide.content,
    onUpdate: ({ editor: currentEditor }) => {
      const id = activeIdRef.current;
      setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, content: currentEditor.getHTML() } : slide));
    },
  });

  useEffect(() => {
    let mounted = true;
    void loadPostProject(template).then((project) => {
      if (!mounted || !project?.slides?.length) return;
      const restoredSlides = project.slides.map((slide, index) => ({ ...makeSlide(template, index), ...slide, id: slide.id || uid(), media: Array.isArray(slide.media) ? slide.media.slice(0, 2) : [] }));
      const restoredActiveId = restoredSlides.some((slide) => slide.id === project.activeId) ? project.activeId : restoredSlides[0].id;
      setSlides(restoredSlides);
      setActiveId(restoredActiveId);
      setFormat(project.format === "portrait" ? "portrait" : "story");
      setTweetProfile({ ...DEFAULT_PROFILE, ...project.tweetProfile });
    }).catch((error) => console.error("Não foi possível restaurar o Gerador de Posts.", error)).finally(() => {
      if (mounted) setStorageReady(true);
    });
    return () => { mounted = false; };
  }, [template]);

  useEffect(() => {
    if (!storageReady) return;
    void savePostProject(template, { version: 1, format, slides, activeId, tweetProfile, updatedAt: Date.now() }).catch((error) => console.error("Não foi possível salvar o Gerador de Posts.", error));
  }, [activeId, format, slides, storageReady, template, tweetProfile]);

  useEffect(() => {
    if (!editor) return;
    const next = slides.find((slide) => slide.id === activeId);
    if (next && editor.getHTML() !== next.content) editor.commands.setContent(next.content, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, editor]);

  const update = (patch: Partial<Slide>) => setSlides((current) => current.map((slide) => slide.id === activeId ? { ...slide, ...patch } : slide));

  const addSlide = () => {
    const next = {
      ...makeSlide(template, slides.length),
      background: active.background,
      foreground: contrastColor(active.background),
    };
    setSlides((current) => [...current, next]);
    setActiveId(next.id);
  };

  const duplicateSlide = (id: string) => {
    const sourceIndex = slides.findIndex((slide) => slide.id === id);
    if (sourceIndex < 0) return;
    const source = slides[sourceIndex];
    const next = { ...source, id: uid(), media: [...source.media] };
    setSlides((current) => [...current.slice(0, sourceIndex + 1), next, ...current.slice(sourceIndex + 1)]);
    setActiveId(next.id);
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
      downloadBlob(blob, `slide-${String(activeIndex + 1).padStart(2, "0")}-de-${String(slides.length).padStart(2, "0")}.png`);
      toast.success("Slide exportado em alta qualidade.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao exportar o slide."); }
    finally { setExporting(null); }
  }

  async function exportAll() {
    setExporting("all");
    try {
      const files: Array<{ name: string; data: Uint8Array }> = [];
      for (let index = 0; index < slides.length; index++) {
        const element = exportRefs.current.get(slides[index].id);
        if (!element) continue;
        const blob = await postElementToPng(element, dimensions.width, dimensions.height);
        files.push({ name: `${String(index + 1).padStart(2, "0")}-de-${String(slides.length).padStart(2, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      downloadBlob(createZip(files), `posts-${template}-${dimensions.width}x${dimensions.height}.zip`);
      toast.success(`${files.length} slides exportados e numerados.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao exportar os slides."); }
    finally { setExporting(null); }
  }

  return (
    <div className="flex min-h-[calc(100dvh-65px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-5" style={{ borderColor: "var(--border)" }}>
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar aos modelos"><ArrowLeft /></Button>
        <div className="mr-auto min-w-0"><h1 className="truncate text-sm font-semibold text-[var(--text-title)]">{template === "tweet" ? "Modelo Tweet" : "Stories Plus"}</h1><p className="text-[10px] text-[var(--muted-foreground)]">{slides.length} {slides.length === 1 ? "slide" : "slides"} · {dimensions.label}</p></div>
        <div className="hidden items-center gap-1 rounded-xl border p-1 sm:flex" style={{ background: "var(--glass-bg-soft)", borderColor: "var(--glass-border)" }}>
          {(Object.entries(POST_FORMATS) as Array<[PostFormat, typeof dimensions]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium transition", format === value ? "bg-[var(--segment-active-bg)] text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]")}>{item.label}</button>)}
        </div>
        <Button variant="outline" onClick={() => void exportOne()} loading={exporting === "one"} icon={<Download />}>Slide atual</Button>
        <Button onClick={() => void exportAll()} loading={exporting === "all"} icon={<Layers3 />} signature>Baixar todos</Button>
      </div>

      <div className="grid flex-1 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <SlidesRail slides={slides} activeId={activeId} template={template} format={format} profile={tweetProfile} onSelect={setActiveId} onAdd={addSlide} onDuplicate={duplicateSlide} onRemove={removeSlide} onReorder={reorderSlides} />

        <main className="min-w-0 border-b p-4 lg:border-b-0 lg:border-x lg:p-6" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--text-title)]">Pré-visualização</p><p className="text-[10px] text-[var(--muted-foreground)]">Selecione um trecho para formatar. O alinhamento vale para o parágrafo.</p></div><span className="rounded-full border px-2.5 py-1 text-[10px] text-[var(--muted-foreground)]">Slide {activeIndex + 1} de {slides.length}</span></div>
          <TextToolbar editor={editor} defaultColor={active.foreground} />
          <ScaledCanvas width={dimensions.width} height={dimensions.height} format={format} profile={tweetProfile}>
            <PostCanvas slide={active} profile={tweetProfile} template={template} width={dimensions.width} height={dimensions.height} editable editor={editor} onTextMove={(textX, textY) => update({ textX, textY, textPlacement: "free" })} />
          </ScaledCanvas>
          <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-1.5"><Button variant="outline" size="sm" onClick={() => move(-1)} disabled={activeIndex === 0} aria-label="Mover slide para cima"><ArrowUp /></Button><Button variant="outline" size="sm" onClick={() => move(1)} disabled={activeIndex === slides.length - 1} aria-label="Mover slide para baixo"><ArrowDown /></Button><Button variant="outline" size="sm" onClick={duplicate} icon={<Copy />}>Duplicar</Button><Button variant="danger" size="sm" onClick={remove} icon={<Trash2 />}>Excluir</Button></div>
        </main>

        <PropertiesPanel template={template} format={format} setFormat={setFormat} slide={active} update={update} profile={tweetProfile} setProfile={setTweetProfile} />
      </div>

      <div aria-hidden className="pointer-events-none fixed left-[-12000px] top-0">
        {slides.map((slide) => <PostCanvas key={slide.id} slide={slide} profile={tweetProfile} template={template} width={dimensions.width} height={dimensions.height} refCallback={(node) => { if (node) exportRefs.current.set(slide.id, node); else exportRefs.current.delete(slide.id); }} />)}
      </div>
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

function TextToolbar({ editor, defaultColor }: { editor: Editor | null; defaultColor: string }) {
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
    <button onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!hasSelection} className={tool(editor.isActive("underline"))} title="Sublinhar"><Underline /></button>
    <ColorTool title="Cor do texto" disabled={!hasSelection} value={editor.getAttributes("textStyle").color || defaultColor} onChange={(color) => editor.chain().focus().setColor(color).run()} />
    <ColorTool title="Marca-texto" disabled={!hasSelection} value={editor.getAttributes("highlight").color || "#ffdf2b"} icon={<Highlighter />} onChange={(color) => editor.chain().focus().setHighlight({ color }).run()} />
    <span className="mx-1 h-6 w-px bg-[var(--border)]" />
    <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className={tool(editor.isActive({ textAlign: "left" }))} title="Alinhar à esquerda"><AlignLeft /></button>
    <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className={tool(editor.isActive({ textAlign: "center" }))} title="Centralizar"><AlignCenter /></button>
    <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className={tool(editor.isActive({ textAlign: "right" }))} title="Alinhar à direita"><AlignRight /></button>
    <span className="ml-auto pr-2 text-[9px] text-[var(--muted-foreground)]">{hasSelection ? "Formatação do trecho selecionado" : "Selecione um trecho para formatar"}</span>
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
      {format === "portrait" && <div className="flex h-[58px] items-center gap-2.5 px-3"><Avatar src={profile.avatar} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{profile.handle.replace(/^@/, "") || "seu_perfil"}</p><p className="text-[9px] opacity-55">Publicação</p></div><MoreHorizontal size={17} /></div>}
      <div className="relative overflow-hidden" style={{ width: canvasWidth, height: canvasHeight }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
        {format === "story" && <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-white [text-shadow:0_1px_4px_rgba(0,0,0,.65)]"><div><div className="mb-2 flex gap-1">{[0, 1, 2, 3].map((item) => <span key={item} className="h-[2px] flex-1 rounded-full bg-white/75" />)}</div><div className="flex items-center gap-2"><Avatar src={profile.avatar} size={28} /><span className="text-[10px] font-semibold">Seu story</span><span className="text-[9px] opacity-70">agora</span><MoreHorizontal className="ml-auto" size={16} /></div></div><div className="mx-auto mb-1 flex h-9 w-[82%] items-center rounded-full border border-white/65 px-3 text-[10px]">Enviar mensagem…<Heart className="ml-auto" size={16} /><Send className="ml-2" size={15} /></div></div>}
      </div>
      {format === "portrait" && <div className="px-3 py-2.5"><div className="flex items-center gap-3"><Heart size={20} /><MessageCircle size={19} /><Send size={19} /><Bookmark className="ml-auto" size={19} /></div><p className="mt-2 text-[9px] font-semibold">Prévia do post no feed</p><p className="mt-1 text-[9px] opacity-55">Veja como o enquadramento será percebido no Instagram.</p></div>}
    </div>
  </div>;
}

function PostCanvas({ slide, profile, template, width, height, editable = false, editor, refCallback, onTextMove }: { slide: Slide; profile: TweetProfile; template: PostTemplate; width: number; height: number; editable?: boolean; editor?: Editor | null; refCallback?: (node: HTMLDivElement | null) => void; onTextMove?: (x: number, y: number) => void }) {
  const safeLeft = template === "tweet" ? 12 : 8;
  const safeWidth = 100 - safeLeft * 2;
  const automatic = slide.textPlacement !== "free";
  const text = <PositionedText slide={slide} editor={editor} editable={editable} onMove={onTextMove} story={template === "stories"} flow={automatic} safeLeft={safeLeft} safeWidth={safeWidth} />;
  const media = slide.media.length ? <HorizontalMedia media={slide.media} /> : null;
  const profileBlock = template === "tweet" ? <TweetProfileBlock profile={profile} foreground={slide.foreground} /> : null;
  const orderedContent = <>
    {profileBlock}
    {slide.mediaPosition === "top" && media}
    {text}
    {slide.mediaPosition === "bottom" && media}
  </>;

  return <div ref={refCallback} data-post-canvas={template} className="relative overflow-hidden" style={{ width, height, background: slide.background, color: slide.foreground, fontFamily: template === "tweet" ? "Arial, Helvetica, sans-serif" : "Advercase, Georgia, serif", fontWeight: 400 }}>
    {template === "stories" && slide.backgroundImage && <><img src={slide.backgroundImage} alt="Fundo do slide" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-black" style={{ opacity: slide.imageDarkness / 100 }} /></>}
    {automatic ? <BalancedContent safeLeft={safeLeft} safeWidth={safeWidth} gap={template === "tweet" ? (media ? 44 : 38) : (media ? 52 : 0)}>{orderedContent}</BalancedContent> : <>
      {profileBlock && <div className="absolute" style={{ left: `${safeLeft}%`, top: `${safeLeft}%`, width: `${safeWidth}%` }}>{profileBlock}</div>}
      {media && <div className="absolute" style={{ left: `${safeLeft}%`, top: slide.mediaPosition === "top" ? "24%" : "58%", width: `${safeWidth}%` }}>{media}</div>}
      {text}
    </>}
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
    const fit = () => setFitScale(Math.min(1, hostNode.clientHeight / Math.max(contentNode.scrollHeight, 1)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(hostNode);
    observer.observe(contentNode);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} className="absolute grid place-items-center" style={{ left: `${safeLeft}%`, top: "7%", width: `${safeWidth}%`, height: "86%" }}><div ref={content} className="flex w-full flex-col" style={{ gap, transform: `scale(${fitScale})`, transformOrigin: "center center" }}>{children}</div></div>;
}

function TweetProfileBlock({ profile, foreground }: { profile: TweetProfile; foreground: string }) {
  return <div className="flex items-center gap-[24px]"><Avatar src={profile.avatar} size={122} /><div><p className="flex items-center gap-[12px] text-[45px] font-bold leading-none">{profile.name}{profile.verified && <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#1d9bf0] text-[20px] text-white">✓</span>}</p><p className="mt-[14px] text-[34px]" style={{ color: foreground, opacity: .62 }}>{profile.handle}</p></div></div>;
}

function PositionedText({ slide, editor, editable, onMove, story = false, flow, safeLeft, safeWidth }: { slide: Slide; editor?: Editor | null; editable: boolean; onMove?: (x: number, y: number) => void; story?: boolean; flow: boolean; safeLeft: number; safeWidth: number }) {
  const drag = useRef<{ pointerId: number; startX: number; startY: number; textX: number; textY: number; canvasRect: DOMRect; textHeight: number } | null>(null);
  const flowWidth = Math.min(slide.textWidth, safeWidth) / safeWidth * 100;
  return <div className={cn(flow ? "relative self-center" : "absolute", editable && "z-10")} style={{ ...(flow ? { width: `${flowWidth}%` } : { left: `${slide.textX}%`, top: `${slide.textY}%`, width: `${Math.min(slide.textWidth, safeWidth)}%` }), color: slide.foreground, fontSize: slide.fontSize, fontWeight: 400, lineHeight: story ? .94 : 1.18, overflowWrap: "anywhere" }}>
    {editable && <button type="button" aria-label="Arrastar texto" title="Arraste para posicionar o texto" className="absolute -bottom-16 left-1/2 grid h-12 w-12 -translate-x-1/2 touch-none place-items-center rounded-full bg-[#27a3ff] text-white shadow-xl" onPointerDown={(event) => { const canvas = event.currentTarget.closest<HTMLElement>("[data-post-canvas]"); const textNode = event.currentTarget.parentElement; if (!canvas || !textNode) return; event.currentTarget.setPointerCapture(event.pointerId); const canvasRect = canvas.getBoundingClientRect(); const textRect = textNode.getBoundingClientRect(); drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, textX: flow ? safeLeft + (safeWidth - Math.min(slide.textWidth, safeWidth)) / 2 : slide.textX, textY: flow ? (textRect.top - canvasRect.top) / canvasRect.height * 100 : slide.textY, canvasRect, textHeight: textRect.height / canvasRect.height * 100 }; }} onPointerMove={(event) => { const current = drag.current; if (!current || current.pointerId !== event.pointerId) return; const textWidth = Math.min(slide.textWidth, safeWidth); const nextX = Math.max(safeLeft, Math.min(safeLeft + safeWidth - textWidth, current.textX + (event.clientX - current.startX) / current.canvasRect.width * 100)); const nextY = Math.max(safeLeft, Math.min(100 - safeLeft - current.textHeight, current.textY + (event.clientY - current.startY) / current.canvasRect.height * 100)); onMove?.(Number(nextX.toFixed(2)), Number(nextY.toFixed(2))); }} onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><Move size={24} /></button>}
    <PostText slide={slide} editor={editor} editable={editable} className={cn("w-full", story && "tracking-[-.03em]")} />
  </div>;
}

function PostText({ slide, editor, editable, className }: { slide: Slide; editor?: Editor | null; editable: boolean; className: string }) {
  if (editable && editor) return <EditorContent editor={editor} className={cn("post-rich-text rounded-lg outline-none ring-[5px] ring-transparent transition focus-within:ring-[#27a3ff]/35", className)} />;
  return <div className={cn("post-rich-text", className)} dangerouslySetInnerHTML={{ __html: slide.content }} />;
}

function HorizontalMedia({ media, className }: { media: string[]; className?: string }) {
  if (!media.length) return null;
  return <div className={cn("grid aspect-[16/9] overflow-hidden rounded-[36px] border border-black/10", className)} style={{ gridTemplateColumns: `repeat(${media.length},minmax(0,1fr))` }}>{media.map((image, index) => <img key={`${image.slice(-20)}-${index}`} src={image} alt="Mídia do post" className="h-full w-full object-cover" style={{ borderLeft: index ? "3px solid rgba(255,255,255,.8)" : undefined }} />)}</div>;
}

function Avatar({ src, size }: { src: string; size: number }) {
  return src ? <img src={src} alt="Foto do perfil" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} /> : <span className="grid shrink-0 place-items-center rounded-full bg-[#20252a] text-white" style={{ width: size, height: size }}><UserRound size={size * .42} /></span>;
}

function PropertiesPanel({ template, format, setFormat, slide, update, profile, setProfile }: { template: PostTemplate; format: PostFormat; setFormat: (format: PostFormat) => void; slide: Slide; update: (patch: Partial<Slide>) => void; profile: TweetProfile; setProfile: React.Dispatch<React.SetStateAction<TweetProfile>> }) {
  const addFile = (file: File | undefined, callback: (url: string) => void) => { if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem."); const reader = new FileReader(); reader.onload = () => callback(String(reader.result)); reader.readAsDataURL(file); };
  const updateProfile = (patch: Partial<TweetProfile>) => setProfile((current) => ({ ...current, ...patch }));
  const updateBackground = (background: string) => update({ background, foreground: contrastColor(background) });
  const placeText = (placement: "above" | "below") => update({
    textPlacement: placement,
    mediaPosition: placement === "above" ? "bottom" : "top",
    textX: template === "tweet" ? 12 : 8,
    textY: template === "tweet" ? 31 : 12,
  });
  return <aside className="p-4 lg:p-5"><div className="space-y-6"><PanelSection title="Documento"><div className="grid grid-cols-2 gap-2">{(Object.entries(POST_FORMATS) as Array<[PostFormat, { label: string; width: number; height: number }]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("rounded-xl border p-3 text-left transition", format === value ? "border-[var(--accent-blue)] bg-[var(--hover)]" : "border-[var(--glass-border)]")}><span className="block text-xs font-semibold text-[var(--text-title)]">{item.label}</span><span className="text-[9px] text-[var(--muted-foreground)]">{value === "story" ? "Story" : "Feed 4:5"}</span>{format === value && <Check size={13} className="float-right -mt-5 text-[var(--accent-blue)]" />}</button>)}</div></PanelSection>

      <PanelSection title="Texto"><Field label={`Tamanho · ${slide.fontSize}px`}><input aria-label="Tamanho do texto" type="range" min={template === "tweet" ? 28 : 36} max={template === "tweet" ? 128 : 190} step="1" value={slide.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field><Field label={`Largura do bloco · ${slide.textWidth}%`}><input aria-label="Largura do texto" type="range" min="40" max={template === "tweet" ? 76 : 84} step="2" value={Math.min(slide.textWidth, template === "tweet" ? 76 : 84)} onChange={(event) => { const textWidth = Number(event.target.value); const safeLeft = template === "tweet" ? 12 : 8; const safeWidth = 100 - safeLeft * 2; update({ textWidth, textX: Math.max(safeLeft, Math.min(slide.textX, safeLeft + safeWidth - textWidth)) }); }} className="w-full accent-[#27a3ff]" /></Field><div className="grid grid-cols-2 gap-2"><button onClick={() => placeText("above")} className={cn("rounded-xl border px-3 py-2 text-xs", slide.textPlacement === "above" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Texto acima</button><button onClick={() => placeText("below")} className={cn("rounded-xl border px-3 py-2 text-xs", slide.textPlacement === "below" && "border-[var(--accent-blue)] bg-[var(--hover)]")}>Texto abaixo</button></div><p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]"><Move size={11} className="mr-1 inline" />O conteúdo é enquadrado automaticamente. Ao arrastar, o texto respeita as mesmas margens da imagem.</p></PanelSection>

      {template === "tweet" ? <>
        <PanelSection title="Perfil · aplicado a todos os slides"><UploadField label="Foto do usuário" value={profile.avatar} onFile={(file) => addFile(file, (avatar) => updateProfile({ avatar }))} onRemove={() => updateProfile({ avatar: "" })} /><Field label="Nome"><input value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} className="editor-input" /></Field><Field label="Arroba"><div className="relative"><AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={profile.handle.replace(/^@/, "")} onChange={(event) => updateProfile({ handle: `@${event.target.value.replace(/^@/, "")}` })} className="editor-input pl-8" /></div></Field><label className="flex items-center justify-between text-xs"><span>Selo de verificação</span><input type="checkbox" checked={profile.verified} onChange={(event) => updateProfile({ verified: event.target.checked })} className="accent-[#27a3ff]" /></label></PanelSection>
        <PanelSection title="Aparência"><div className="grid grid-cols-2 gap-2"><button onClick={() => updateBackground("#ffffff")} className={cn("rounded-xl border p-3 text-left", slide.background === "#ffffff" && "border-[#27a3ff]")}><Sun size={15} /><span className="mt-2 block text-xs">Claro</span></button><button onClick={() => updateBackground("#000000")} className={cn("rounded-xl border p-3 text-left", slide.background === "#000000" && "border-[#27a3ff]")}><Moon size={15} /><span className="mt-2 block text-xs">Escuro absoluto</span></button></div></PanelSection>
        <MediaPanel slide={slide} update={update} addFile={addFile} title="Imagem do post" />
      </> : <>
        <PanelSection title="Cores"><ColorRow label="Fundo" value={slide.background} onChange={updateBackground} /><div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">Texto automático</span><span className="h-7 w-7 rounded-full border" style={{ background: slide.foreground, borderColor: "var(--glass-border)" }} /></div></PanelSection>
        <PanelSection title="Imagem de fundo"><UploadField label="Imagem do slide" value={slide.backgroundImage} square onFile={(file) => addFile(file, (backgroundImage) => update({ backgroundImage }))} onRemove={() => update({ backgroundImage: "" })} />{slide.backgroundImage && <Field label={`Escurecer foto · ${slide.imageDarkness}%`}><input type="range" min="0" max="90" value={slide.imageDarkness} onChange={(event) => update({ imageDarkness: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>}</PanelSection>
        <MediaPanel slide={slide} update={update} addFile={addFile} title="Imagem complementar" />
      </>}
    </div></aside>;
}

function MediaPanel({ slide, update, addFile, title }: { slide: Slide; update: (patch: Partial<Slide>) => void; addFile: (file: File | undefined, callback: (url: string) => void) => void; title: string }) {
  return <PanelSection title={title}><p className="mb-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">O quadro é sempre horizontal. Adicione uma imagem ou duas divididas lado a lado.</p><div className="grid grid-cols-2 gap-2">{[0, 1].map((index) => <UploadTile key={index} value={slide.media[index]} label={`Imagem ${index + 1}`} onFile={(file) => addFile(file, (url) => { const media = [...slide.media]; media[index] = url; update({ media: media.filter(Boolean).slice(0, 2) }); })} onRemove={() => update({ media: slide.media.filter((_, mediaIndex) => mediaIndex !== index) })} />)}</div></PanelSection>;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b pb-5 last:border-0" style={{ borderColor: "var(--border)" }}><h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">{title}</h2><div className="space-y-3">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] text-[var(--muted-foreground)]">{label}</span>{children}</label>; }
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">{label}</span><span className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">{value}<input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" /></span></label>; }

function UploadField({ label, value, onFile, onRemove, square = false }: { label: string; value: string; onFile: (file?: File) => void; onRemove: () => void; square?: boolean }) { return <div className="flex items-center gap-3"><span className={cn("grid h-11 w-11 shrink-0 place-items-center overflow-hidden border bg-[var(--hover)]", square ? "rounded-lg" : "rounded-full")}>{value ? <img src={value} alt="Arquivo selecionado" className="h-full w-full object-cover" /> : <UserRound size={17} />}</span><label className="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-[10px] hover:bg-[var(--hover)]"><Upload size={12} className="mr-1 inline" />{value ? "Trocar" : label}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>{value && <button onClick={onRemove} className="text-[var(--muted-foreground)] hover:text-red-500" aria-label="Remover imagem"><X size={15} /></button>}</div>; }

function UploadTile({ label, value, onFile, onRemove }: { label: string; value?: string; onFile: (file?: File) => void; onRemove: () => void }) { return <div className="relative aspect-video overflow-hidden rounded-xl border bg-[var(--hover)]" style={{ borderColor: "var(--glass-border)" }}>{value ? <><img src={value} alt={label} className="h-full w-full object-cover" /><button onClick={onRemove} aria-label={`Remover ${label}`} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X size={12} /></button></> : <label className="grid h-full cursor-pointer place-items-center text-center text-[10px] text-[var(--muted-foreground)]"><span><ImagePlus size={18} className="mx-auto mb-1" />{label}</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>}</div>; }
