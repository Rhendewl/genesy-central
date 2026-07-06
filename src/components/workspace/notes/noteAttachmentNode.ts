import { Node, mergeAttributes } from "@tiptap/core";

// Node customizado para anexos dentro do documento da nota — evita criar uma
// tabela paralela de anexos: o arquivo vira um bloco do próprio conteúdo,
// reaproveitando 100% do upload/limpeza de storage já necessário para imagens.

export interface NoteAttachmentAttrs {
  url:      string | null;
  fileName: string | null;
  fileSize: number | null;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteAttachment: {
      setNoteAttachment: (attrs: NoteAttachmentAttrs) => ReturnType;
    };
  }
}

export const NoteAttachment = Node.create({
  name:  "noteAttachment",
  group: "block",
  atom:  true,

  addAttributes() {
    return {
      url:      { default: null },
      fileName: { default: null },
      fileSize: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-note-attachment]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, fileName, fileSize } = HTMLAttributes as NoteAttachmentAttrs;
    return [
      "a",
      mergeAttributes(
        { "data-note-attachment": "true", class: "note-attachment-chip", href: url, target: "_blank", rel: "noopener noreferrer" },
      ),
      `📎 ${fileName ?? "Anexo"}${fileSize ? ` (${fmtSize(fileSize)})` : ""}`,
    ];
  },

  addCommands() {
    return {
      setNoteAttachment:
        (attrs: NoteAttachmentAttrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
