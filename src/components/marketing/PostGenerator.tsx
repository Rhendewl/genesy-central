"use client";

import {
  useEffect, useMemo, useRef, useState,
  type FormEvent, type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, AtSign, Bold, Check, ChevronRight, Copy,
  Download, Highlighter, ImagePlus, Layers3, Moon, Plus, Sun,
  Trash2, Underline, Upload, UserRound, X,
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
  eyebrow: string;
  avatar: string;
  profileName: string;
  handle: string;
  verified: boolean;
  media: string[];
  backgroundImage: string;
  imageDarkness: number;
};

const PALETTE = ["#ffffff", "#f5f2ea", "#ffdf2b", "#ff654d", "#27a3ff", "#8047ff", "#111111", "#000000"];

function uid() { return Math.random().toString(36).slice(2, 10); }

function makeSlide(template: PostTemplate, index = 0): Slide {
  return {
    id: uid(),
    background: template === "tweet" ? "#ffffff" : "#0a0a0a",
    foreground: template === "tweet" ? "#0f1419" : "#ffffff",
    content: template === "tweet"
      ? "Escreva aqui uma ideia forte, simples e impossível de ignorar."
      : index === 0 ? "Uma boa história começa com uma frase que prende." : "Continue a narrativa com clareza e ritmo.",
    eyebrow: template === "stories" ? `SLIDE ${String(index + 1).padStart(2, "0")}` : "",
    avatar: "",
    profileName: "Genesy Company",
    handle: "@genesycompany",
    verified: true,
    media: [],
    backgroundImage: "",
    imageDarkness: 42,
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
          <TemplateCard template="tweet" title="Tweet" description="Post com perfil, texto formatável e uma ou duas imagens horizontais." onChoose={onChoose} />
          <TemplateCard template="stories" title="Stories Plus" description="Composição editorial em Advercase para stories e posts verticais." onChoose={onChoose} />
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
  return <div className="relative h-64 w-44 overflow-hidden rounded-[20px] bg-black p-5 text-white shadow-2xl"><span className="inline-flex bg-[#ffdf2b] px-2 py-1 text-[8px] font-bold tracking-wider text-black">SLIDE 01</span><div className="absolute left-5 right-5 top-20 h-20 rounded-lg bg-gradient-to-br from-[#27a3ff] to-[#8047ff]" /><p className="absolute bottom-9 left-5 right-5 font-[Advercase] text-2xl font-bold leading-[.9]">Conteúdo que ocupa espaço na memória.</p></div>;
}

function PostEditor({ template, onBack }: { template: PostTemplate; onBack: () => void }) {
  const [format, setFormat] = useState<PostFormat>("story");
  const [slides, setSlides] = useState<Slide[]>([makeSlide(template)]);
  const [activeId, setActiveId] = useState(slides[0].id);
  const [exporting, setExporting] = useState<"one" | "all" | null>(null);
  const exportRefs = useRef(new Map<string, HTMLDivElement>());
  const activeEditor = useRef<HTMLDivElement | null>(null);
  const selectionRange = useRef<Range | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeId));
  const active = slides[activeIndex];
  const dimensions = POST_FORMATS[format];

  const update = (patch: Partial<Slide>) => setSlides((current) => current.map((slide) => slide.id === activeId ? { ...slide, ...patch } : slide));
  const setSlide = (id: string, patch: Partial<Slide>) => setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...patch } : slide));

  const addSlide = () => {
    const next = makeSlide(template, slides.length);
    setSlides((current) => [...current, next]);
    setActiveId(next.id);
  };

  const duplicate = () => {
    const next = { ...active, id: uid(), media: [...active.media] };
    setSlides((current) => [...current.slice(0, activeIndex + 1), next, ...current.slice(activeIndex + 1)]);
    setActiveId(next.id);
  };

  const remove = () => {
    if (slides.length === 1) return toast.error("O projeto precisa ter pelo menos um slide.");
    const next = slides.filter((slide) => slide.id !== activeId);
    setSlides(next);
    setActiveId(next[Math.min(activeIndex, next.length - 1)].id);
  };

  const move = (direction: -1 | 1) => {
    const target = activeIndex + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((current) => { const next = [...current]; [next[activeIndex], next[target]] = [next[target], next[activeIndex]]; return next; });
  };

  function apply(command: string, value?: string) {
    activeEditor.current?.focus();
    if (selectionRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRange.current);
    }
    document.execCommand(command, false, value);
    if (activeEditor.current) update({ content: activeEditor.current.innerHTML });
  }

  function rememberSelection() {
    const editor = activeEditor.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return setHasSelection(false);
    const range = selection.getRangeAt(0);
    const insideEditor = editor.contains(range.commonAncestorContainer);
    const selected = insideEditor && !range.collapsed;
    selectionRange.current = selected ? range.cloneRange() : null;
    setHasSelection(selected);
  }

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

      <div className="grid flex-1 lg:grid-cols-[190px_minmax(0,1fr)_300px]">
        <SlidesRail slides={slides} activeId={activeId} template={template} format={format} onSelect={setActiveId} onAdd={addSlide} />

        <main className="min-w-0 border-b p-4 lg:border-b-0 lg:border-x lg:p-6" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--text-title)]">Pré-visualização</p><p className="text-[10px] text-[var(--muted-foreground)]">Selecione o texto para abrir as opções de formatação.</p></div><span className="rounded-full border px-2.5 py-1 text-[10px] text-[var(--muted-foreground)]">Slide {activeIndex + 1} de {slides.length}</span></div>
          <TextToolbar visible={hasSelection} onCommand={apply} />
          <ScaledCanvas width={dimensions.width} height={dimensions.height}>
            <PostCanvas slide={active} template={template} width={dimensions.width} height={dimensions.height} editable editorRef={activeEditor} onChange={(html) => update({ content: html })} onSelectText={rememberSelection} />
          </ScaledCanvas>
          <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-1.5"><Button variant="outline" size="sm" onClick={() => move(-1)} disabled={activeIndex === 0} aria-label="Mover slide para cima"><ArrowUp /></Button><Button variant="outline" size="sm" onClick={() => move(1)} disabled={activeIndex === slides.length - 1} aria-label="Mover slide para baixo"><ArrowDown /></Button><Button variant="outline" size="sm" onClick={duplicate} icon={<Copy />}>Duplicar</Button><Button variant="danger" size="sm" onClick={remove} icon={<Trash2 />}>Excluir</Button></div>
        </main>

        <PropertiesPanel template={template} format={format} setFormat={setFormat} slide={active} update={update} setSlide={setSlide} />
      </div>

      <div aria-hidden className="pointer-events-none fixed left-[-12000px] top-0">
        {slides.map((slide) => <PostCanvas key={slide.id} slide={slide} template={template} width={dimensions.width} height={dimensions.height} refCallback={(node) => { if (node) exportRefs.current.set(slide.id, node); else exportRefs.current.delete(slide.id); }} />)}
      </div>
    </div>
  );
}

function SlidesRail({ slides, activeId, template, format, onSelect, onAdd }: { slides: Slide[]; activeId: string; template: PostTemplate; format: PostFormat; onSelect: (id: string) => void; onAdd: () => void }) {
  const dimensions = POST_FORMATS[format];
  return <aside className="border-b p-3 lg:border-b-0 lg:p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">Slides</p><span className="text-[10px] text-[var(--muted-foreground)]">{slides.length}</span></div><div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">{slides.map((slide, index) => <button key={slide.id} onClick={() => onSelect(slide.id)} className={cn("flex min-w-[145px] items-center gap-2 rounded-xl border p-2 text-left transition lg:w-full lg:min-w-0", activeId === slide.id ? "border-[var(--accent-blue)] bg-[var(--hover)]" : "border-transparent hover:bg-[var(--hover)]")}><span className="w-5 text-[10px] text-[var(--muted-foreground)]">{String(index + 1).padStart(2, "0")}</span><span className="relative h-12 w-9 shrink-0 overflow-hidden rounded border bg-black"><span className="absolute inset-0 origin-top-left" style={{ transform: `scale(${9 / dimensions.width})`, width: dimensions.width, height: dimensions.height }}><PostCanvas slide={slide} template={template} width={dimensions.width} height={dimensions.height} /></span></span><span className="truncate text-xs text-[var(--text-title)]">{index === 0 ? "Capa" : `Slide ${index + 1}`}</span></button>)}</div><Button variant="outline" fullWidth size="sm" onClick={onAdd} icon={<Plus />} className="mt-3">Adicionar slide</Button></aside>;
}

function TextToolbar({ visible, onCommand }: { visible: boolean; onCommand: (command: string, value?: string) => void }) {
  const preserve = (event: ReactMouseEvent) => event.preventDefault();
  if (!visible) return <div className="mx-auto mb-3 flex h-11 max-w-xl items-center justify-center rounded-xl border border-dashed text-[10px] text-[var(--muted-foreground)]">Selecione uma palavra ou trecho para formatar</div>;
  return <div className="mx-auto mb-3 flex max-w-xl flex-wrap items-center gap-1 rounded-xl border p-1.5 shadow-lg" style={{ background: "var(--bg-modal)", borderColor: "var(--accent-blue)" }}><button onMouseDown={preserve} onClick={() => onCommand("bold")} className="editor-tool" title="Negrito"><Bold /></button><button onMouseDown={preserve} onClick={() => onCommand("underline")} className="editor-tool" title="Sublinhar"><Underline /></button><label onMouseDown={preserve} className="editor-tool cursor-pointer" title="Cor do texto"><span className="h-4 w-4 rounded-full border bg-current" /><input type="color" className="sr-only" onInput={(event) => onCommand("foreColor", event.currentTarget.value)} /></label><label onMouseDown={preserve} className="editor-tool cursor-pointer" title="Marca-texto"><Highlighter /><input type="color" defaultValue="#ffdf2b" className="sr-only" onInput={(event) => onCommand("hiliteColor", event.currentTarget.value)} /></label><span className="ml-auto pr-2 text-[9px] text-[var(--muted-foreground)]">Aplicando ao trecho selecionado</span></div>;
}

function ScaledCanvas({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.42);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const update = () => setScale(Math.min(node.clientWidth / width, 680 / height));
    update();
    const observer = new ResizeObserver(update); observer.observe(node);
    return () => observer.disconnect();
  }, [height, width]);
  return <div ref={host} className="mx-auto w-full max-w-3xl"><div className="mx-auto overflow-hidden rounded-[16px] shadow-2xl ring-1 ring-black/10" style={{ width: width * scale, height: height * scale }}><div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div></div></div>;
}

function PostCanvas({ slide, template, width, height, editable = false, editorRef, onChange, onSelectText, refCallback }: { slide: Slide; template: PostTemplate; width: number; height: number; editable?: boolean; editorRef?: React.MutableRefObject<HTMLDivElement | null>; onChange?: (html: string) => void; onSelectText?: () => void; refCallback?: (node: HTMLDivElement | null) => void }) {
  const portrait = height === 1350;
  if (template === "tweet") return <div ref={refCallback} className="relative flex items-center justify-center overflow-hidden" style={{ width, height, background: slide.background, color: slide.foreground, fontFamily: "Arial, Helvetica, sans-serif" }}><div style={{ width: 830, padding: portrait ? "84px 0" : "120px 0" }}><div className="flex items-center gap-[24px]"><Avatar src={slide.avatar} size={122} /><div><p className="flex items-center gap-[12px] text-[45px] font-bold leading-none">{slide.profileName}{slide.verified && <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#1d9bf0] text-[20px] text-white">✓</span>}</p><p className="mt-[14px] text-[34px] text-[#536471]">{slide.handle}</p></div></div><RichText className="mt-[55px] whitespace-pre-wrap text-[56px] leading-[1.23]" html={slide.content} editable={editable} editorRef={editorRef} onChange={onChange} onSelectText={onSelectText} />{slide.media.length > 0 && <div className="mt-[52px] grid aspect-[16/9] overflow-hidden rounded-[36px] border border-black/10" style={{ gridTemplateColumns: `repeat(${slide.media.length},minmax(0,1fr))` }}>{slide.media.map((image, index) => <img key={`${image.slice(-20)}-${index}`} src={image} alt="Mídia do post" className="h-full w-full object-cover" style={{ borderLeft: index ? "3px solid rgba(255,255,255,.8)" : undefined }} />)}</div>}</div></div>;

  return <div ref={refCallback} className="relative overflow-hidden" style={{ width, height, background: slide.background, color: slide.foreground, fontFamily: "Advercase, Georgia, serif" }}>{slide.backgroundImage && <><img src={slide.backgroundImage} alt="Fundo do slide" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-black" style={{ opacity: slide.imageDarkness / 100 }} /></>}<div className="relative flex h-full flex-col p-[86px]"><div className="flex items-center justify-between"><span className="inline-flex min-h-[48px] items-center bg-[#ffdf2b] px-20 text-[22px] font-bold tracking-[.12em] text-black">{slide.eyebrow}</span><span className="text-[20px] opacity-60">{width} × {height}</span></div><div className="flex flex-1 items-center"><RichText className={cn("w-full whitespace-pre-wrap font-bold tracking-[-.03em]", portrait ? "text-[88px] leading-[.95]" : "text-[104px] leading-[.94]")} html={slide.content} editable={editable} editorRef={editorRef} onChange={onChange} onSelectText={onSelectText} /></div><div className="flex items-center justify-between border-t pt-28 text-[20px] uppercase tracking-[.16em] opacity-75" style={{ borderColor: `${slide.foreground}40` }}><span>{slide.handle || "@genesycompany"}</span><span>GENESY</span></div></div></div>;
}

function RichText({ html, editable, className, editorRef, onChange, onSelectText }: { html: string; editable: boolean; className: string; editorRef?: React.MutableRefObject<HTMLDivElement | null>; onChange?: (html: string) => void; onSelectText?: () => void }) {
  return <div ref={(node) => { if (editorRef) editorRef.current = node; }} className={cn(className, editable && "rounded-lg outline-none ring-[5px] ring-transparent transition focus:ring-[#27a3ff]/35")} contentEditable={editable} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: html }} onInput={(event: FormEvent<HTMLDivElement>) => onChange?.(event.currentTarget.innerHTML)} onMouseUp={onSelectText} onKeyUp={onSelectText} />;
}

function Avatar({ src, size }: { src: string; size: number }) {
  return src ? <img src={src} alt="Foto do perfil" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} /> : <span className="grid shrink-0 place-items-center rounded-full bg-[#20252a] text-white" style={{ width: size, height: size }}><UserRound size={size * .42} /></span>;
}

function PropertiesPanel({ template, format, setFormat, slide, update }: { template: PostTemplate; format: PostFormat; setFormat: (format: PostFormat) => void; slide: Slide; update: (patch: Partial<Slide>) => void; setSlide: (id: string, patch: Partial<Slide>) => void }) {
  const addFile = (file: File | undefined, callback: (url: string) => void) => { if (!file) return; if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem."); const reader = new FileReader(); reader.onload = () => callback(String(reader.result)); reader.readAsDataURL(file); };
  return <aside className="p-4 lg:p-5"><div className="space-y-6"><PanelSection title="Documento"><div className="grid grid-cols-2 gap-2">{(Object.entries(POST_FORMATS) as Array<[PostFormat, { label: string; width: number; height: number }]>).map(([value, item]) => <button key={value} onClick={() => setFormat(value)} className={cn("rounded-xl border p-3 text-left transition", format === value ? "border-[var(--accent-blue)] bg-[var(--hover)]" : "border-[var(--glass-border)]")}><span className="block text-xs font-semibold text-[var(--text-title)]">{item.label}</span><span className="text-[9px] text-[var(--muted-foreground)]">{value === "story" ? "Story" : "Feed 4:5"}</span>{format === value && <Check size={13} className="float-right -mt-5 text-[var(--accent-blue)]" />}</button>)}</div></PanelSection>

      {template === "tweet" ? <><PanelSection title="Perfil"><UploadField label="Foto do usuário" value={slide.avatar} onFile={(file) => addFile(file, (avatar) => update({ avatar }))} onRemove={() => update({ avatar: "" })} /><Field label="Nome"><input value={slide.profileName} onChange={(event) => update({ profileName: event.target.value })} className="editor-input" /></Field><Field label="Arroba"><div className="relative"><AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={slide.handle.replace(/^@/, "")} onChange={(event) => update({ handle: `@${event.target.value.replace(/^@/, "")}` })} className="editor-input pl-8" /></div></Field><label className="flex items-center justify-between text-xs"><span>Selo de verificação</span><input type="checkbox" checked={slide.verified} onChange={(event) => update({ verified: event.target.checked })} className="accent-[#27a3ff]" /></label></PanelSection><PanelSection title="Aparência"><div className="grid grid-cols-2 gap-2"><button onClick={() => update({ background: "#ffffff", foreground: "#0f1419" })} className={cn("rounded-xl border p-3 text-left", slide.background === "#ffffff" && "border-[#27a3ff]")}><Sun size={15} /><span className="mt-2 block text-xs">Claro</span></button><button onClick={() => update({ background: "#000000", foreground: "#ffffff" })} className={cn("rounded-xl border p-3 text-left", slide.background === "#000000" && "border-[#27a3ff]")}><Moon size={15} /><span className="mt-2 block text-xs">Escuro</span></button></div></PanelSection><PanelSection title="Imagem do post"><p className="mb-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">O quadro é sempre horizontal. Adicione até duas imagens, divididas lado a lado.</p><div className="grid grid-cols-2 gap-2">{[0, 1].map((index) => <UploadTile key={index} value={slide.media[index]} label={`Imagem ${index + 1}`} onFile={(file) => addFile(file, (url) => { const media = [...slide.media]; media[index] = url; update({ media: media.filter(Boolean).slice(0, 2) }); })} onRemove={() => update({ media: slide.media.filter((_, mediaIndex) => mediaIndex !== index) })} />)}</div></PanelSection></> : <><PanelSection title="Identidade do slide"><Field label="Etiqueta"><input value={slide.eyebrow} onChange={(event) => update({ eyebrow: event.target.value })} className="editor-input" /></Field><Field label="Arroba"><input value={slide.handle} onChange={(event) => update({ handle: event.target.value })} className="editor-input" /></Field></PanelSection><PanelSection title="Cores"><ColorRow label="Fundo" value={slide.background} onChange={(background) => update({ background })} /><ColorRow label="Texto" value={slide.foreground} onChange={(foreground) => update({ foreground })} /><div className="flex flex-wrap gap-2">{PALETTE.map((color) => <button key={color} aria-label={`Usar cor ${color}`} onClick={() => update({ background: color, foreground: ["#ffffff", "#f5f2ea", "#ffdf2b"].includes(color) ? "#111111" : "#ffffff" })} className="h-7 w-7 rounded-full border shadow-sm" style={{ background: color, borderColor: "var(--glass-border)" }} />)}</div></PanelSection><PanelSection title="Imagem de fundo"><UploadField label="Imagem do slide" value={slide.backgroundImage} onFile={(file) => addFile(file, (backgroundImage) => update({ backgroundImage }))} onRemove={() => update({ backgroundImage: "" })} />{slide.backgroundImage && <Field label={`Escurecer foto · ${slide.imageDarkness}%`}><input type="range" min="0" max="90" value={slide.imageDarkness} onChange={(event) => update({ imageDarkness: Number(event.target.value) })} className="w-full accent-[#27a3ff]" /></Field>}</PanelSection></>}
    </div></aside>;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b pb-5 last:border-0" style={{ borderColor: "var(--border)" }}><h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">{title}</h2><div className="space-y-3">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] text-[var(--muted-foreground)]">{label}</span>{children}</label>; }
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--glass-border)" }}><span className="text-xs">{label}</span><span className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">{value}<input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" /></span></label>; }

function UploadField({ label, value, onFile, onRemove }: { label: string; value: string; onFile: (file?: File) => void; onRemove: () => void }) { return <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border bg-[var(--hover)]">{value ? <img src={value} alt="Arquivo selecionado" className="h-full w-full object-cover" /> : <UserRound size={17} />}</span><label className="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-[10px] hover:bg-[var(--hover)]"><Upload size={12} className="mr-1 inline" />{value ? "Trocar" : label}<input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>{value && <button onClick={onRemove} className="text-[var(--muted-foreground)] hover:text-red-500" aria-label="Remover imagem"><X size={15} /></button>}</div>; }

function UploadTile({ label, value, onFile, onRemove }: { label: string; value?: string; onFile: (file?: File) => void; onRemove: () => void }) { return <div className="relative aspect-video overflow-hidden rounded-xl border bg-[var(--hover)]" style={{ borderColor: "var(--glass-border)" }}>{value ? <><img src={value} alt={label} className="h-full w-full object-cover" /><button onClick={onRemove} aria-label={`Remover ${label}`} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X size={12} /></button></> : <label className="grid h-full cursor-pointer place-items-center text-center text-[10px] text-[var(--muted-foreground)]"><span><ImagePlus size={18} className="mx-auto mb-1" />{label}</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label>}</div>; }
