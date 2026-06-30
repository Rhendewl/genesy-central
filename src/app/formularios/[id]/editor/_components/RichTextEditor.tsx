"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";

// ── Props ──────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** "inline" = só marcas inline (título). "block" = formatação completa. */
  mode?: "inline" | "block";
  minHeight?: number;
}

// ── Utilitário: botão de toolbar ───────────────────────────────────────────────

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="p-1 rounded transition-all hover:opacity-90"
      style={{
        background: active ? "rgba(102,174,214,0.25)" : "rgba(255,255,255,0.06)",
        color: active ? "#66aed6" : "rgba(255,255,255,0.60)",
      }}
      aria-pressed={active}
      aria-label={title}
    >
      {children}
    </button>
  );
}

// ── Separador ─────────────────────────────────────────────────────────────────

function Sep() {
  return <div className="w-px h-4 mx-0.5" style={{ background: "rgba(255,255,255,0.10)" }} />;
}

// ── RichTextEditor ─────────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  mode = "block",
  minHeight = 80,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure(
        mode === "inline"
          ? {
              heading: false,
              blockquote: false,
              bulletList: false,
              orderedList: false,
              code: false,
              codeBlock: false,
              horizontalRule: false,
            }
          : {}
      ),
      Underline,
      ...(mode === "block"
        ? [TextAlign.configure({ types: ["heading", "paragraph"] })]
        : []),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "rte-placeholder",
      }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rte-content",
        spellcheck: "true",
      },
    },
  });

  // Sync quando o valor externo muda (ex: carregamento inicial) mas sem loop
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}
      >
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito (Ctrl+B)"
        >
          <Bold size={12} />
        </ToolbarBtn>

        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico (Ctrl+I)"
        >
          <Italic size={12} />
        </ToolbarBtn>

        <ToolbarBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon size={12} />
        </ToolbarBtn>

        {mode === "block" && (
          <>
            <Sep />

            <ToolbarBtn
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Lista com marcadores"
            >
              <List size={12} />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Lista numerada"
            >
              <ListOrdered size={12} />
            </ToolbarBtn>

            <Sep />

            <ToolbarBtn
              active={editor.isActive({ textAlign: "left" })}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              title="Alinhar à esquerda"
            >
              <AlignLeft size={12} />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive({ textAlign: "center" })}
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              title="Centralizar"
            >
              <AlignCenter size={12} />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive({ textAlign: "right" })}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              title="Alinhar à direita"
            >
              <AlignRight size={12} />
            </ToolbarBtn>
          </>
        )}

        {/* Dica de emoji */}
        <div className="ml-auto text-[9px] select-none" style={{ color: "rgba(255,255,255,0.25)" }}>
          {typeof window !== "undefined" && /Mac/i.test(navigator.userAgent)
            ? "⌃⌘Space = 😀"
            : "Win+; = 😀"}
        </div>
      </div>

      {/* Área editável */}
      <div
        style={{
          minHeight,
          background: "var(--background)",
          padding: "10px 12px",
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
