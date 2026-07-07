"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Highlight from "@tiptap/extension-highlight";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import { FileHandler } from "@tiptap/extension-file-handler";
import { toast } from "sonner";
import { NoteEditorToolbar } from "./NoteEditorToolbar";
import { NoteAttachment } from "./noteAttachmentNode";

interface NoteEditorProps {
  noteId:  string;
  content: JSONContent;
  onChange: (content: JSONContent) => void;
}

async function uploadFile(noteId: string, file: File): Promise<{ url: string } | null> {
  try {
    const signRes = await fetch(`/api/workspace/notes/${noteId}/imagens`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ nome_arquivo: file.name, mime_type: file.type }),
    });
    const signJson = await signRes.json() as { signed_url?: string; public_url?: string; error?: string };
    if (!signRes.ok || !signJson.signed_url) throw new Error(signJson.error ?? "Erro ao gerar URL de upload");

    const uploadRes = await fetch(signJson.signed_url, {
      method:  "PUT",
      headers: { "Content-Type": file.type },
      body:    file,
    });
    if (!uploadRes.ok) throw new Error("Falha no upload do arquivo");

    return { url: signJson.public_url! };
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Erro no upload");
    return null;
  }
}

export function NoteEditor({ noteId, content, onChange }: NoteEditorProps) {
  const imageInputRef      = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ autolink: true, openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Details.configure({ persist: true }),
      DetailsSummary,
      DetailsContent,
      NoteAttachment,
      FileHandler.configure({
        allowedMimeTypes: ["image/*"],
        onDrop: (editorInstance, files, pos) => {
          files.forEach((file) => {
            void uploadFile(noteId, file).then((result) => {
              if (!result) return;
              editorInstance.chain().insertContentAt(pos, { type: "image", attrs: { src: result.url } }).focus().run();
            });
          });
        },
        onPaste: (editorInstance, files) => {
          files.forEach((file) => {
            void uploadFile(noteId, file).then((result) => {
              if (!result) return;
              editorInstance.chain().focus().setImage({ src: result.url }).run();
            });
          });
        },
      }),
      Placeholder.configure({ placeholder: "Comece a escrever...", emptyNodeClass: "rte-placeholder" }),
    ],
    content,
    onUpdate({ editor: editorInstance }) {
      onChange(editorInstance.getJSON());
    },
    editorProps: {
      attributes: { class: "note-editor-content", spellcheck: "true" },
    },
    immediatelyRender: false,
  });

  // Sync controlado — só reaplica content externo quando o editor não está
  // focado, evitando o cursor "pular" durante o autosave (mesmo padrão de
  // RichTextEditor.tsx usado no editor de Formulários).
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    editor.commands.setContent(content ?? {}, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content]);

  async function handleImageSelected(file: File) {
    const result = await uploadFile(noteId, file);
    if (result && editor) editor.chain().focus().setImage({ src: result.url }).run();
  }

  async function handleAttachmentSelected(file: File) {
    const result = await uploadFile(noteId, file);
    if (result && editor) {
      editor.chain().focus().setNoteAttachment({ url: result.url, fileName: file.name, fileSize: file.size }).run();
    }
  }

  if (!editor) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <NoteEditorToolbar
        editor={editor}
        onRequestImage={() => imageInputRef.current?.click()}
        onRequestAttachment={() => attachmentInputRef.current?.click()}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageSelected(f); e.target.value = ""; }}
      />
      <input
        ref={attachmentInputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAttachmentSelected(f); e.target.value = ""; }}
      />

      <div style={{ minHeight: 320, background: "var(--background)", padding: "16px 20px" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
