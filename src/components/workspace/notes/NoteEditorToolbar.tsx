"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Highlighter,
  Quote, List, ListOrdered, ListTodo, Table as TableIcon, Minus, Link as LinkIcon,
  Image as ImageIcon, Paperclip, ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";

function ToolbarBtn({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title:   string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="rounded p-1 transition-all hover:opacity-90"
      style={{
        background: active ? "rgba(74,143,212,0.22)" : "var(--hover)",
        color:      active ? "var(--primary)" : "var(--text-card-secondary)",
      }}
      aria-pressed={active}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-4 w-px" style={{ background: "var(--border)" }} />;
}

interface NoteEditorToolbarProps {
  editor:              Editor;
  onRequestImage:      () => void;
  onRequestAttachment: () => void;
}

export function NoteEditorToolbar({ editor, onRequestImage, onRequestAttachment }: NoteEditorToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--glass-bg-soft)" }}
    >
      <ToolbarBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1">H1</ToolbarBtn>
      <ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">H2</ToolbarBtn>
      <ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3">H3</ToolbarBtn>

      <Sep />

      <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)"><Bold size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)"><Italic size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)"><UnderlineIcon size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado"><Strikethrough size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Código"><Code size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Destacar"><Highlighter size={12} /></ToolbarBtn>

      <Sep />

      <ToolbarBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores"><List size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered size={12} /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist"><ListTodo size={12} /></ToolbarBtn>

      <Sep />

      <ToolbarBtn
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Inserir tabela"
      >
        <TableIcon size={12} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divisor"><Minus size={12} /></ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("link")}
        onClick={() => {
          const prevUrl = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL do link:", prevUrl ?? "");
          if (url === null) return;
          if (url === "") { editor.chain().focus().unsetLink().run(); return; }
          editor.chain().focus().setLink({ href: url }).run();
        }}
        title="Link"
      >
        <LinkIcon size={12} />
      </ToolbarBtn>
      <ToolbarBtn onClick={onRequestImage} title="Inserir imagem"><ImageIcon size={12} /></ToolbarBtn>
      <ToolbarBtn onClick={onRequestAttachment} title="Anexar arquivo"><Paperclip size={12} /></ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setDetails().run()}
        title="Bloco recolhível"
      >
        <ChevronDownIcon size={12} />
      </ToolbarBtn>

      <Sep />

      <EmojiPicker onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} />
    </div>
  );
}
