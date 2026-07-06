import type { JSONContent } from "@tiptap/react";

// Extrai texto puro de um documento TipTap (JSONContent) para exibir um
// trecho de prévia (ex: card de "Últimas Notas"), sem precisar montar o editor.
export function extractPlainText(content: JSONContent | null | undefined, maxLength = 120): string {
  if (!content) return "";

  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.text) parts.push(node.text);
    if (node.content) {
      for (const child of node.content) walk(child);
      // Espaço entre blocos (parágrafos, itens de lista, etc.)
      if (node.type && node.type !== "text") parts.push(" ");
    }
  }

  walk(content);

  const text = parts.join("").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
