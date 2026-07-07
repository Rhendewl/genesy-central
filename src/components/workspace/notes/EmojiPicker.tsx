"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

// Popover simples com grade de emojis comuns — sem @tiptap/extension-emoji
// (que precisaria de tippy.js para o autocomplete ":shortcode:", biblioteca
// que não existe no projeto). Insere o caractere direto no cursor.

const EMOJIS = [
  "😀", "😂", "😍", "🤔", "😅", "😎", "🙌", "👍", "👎", "🙏",
  "🔥", "✨", "🎉", "💡", "✅", "❌", "⚠️", "📌", "📎", "📅",
  "🚀", "💰", "📈", "📉", "❤️", "⭐", "🏆", "🕒", "📝", "💬",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Emoji"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="rounded p-1 transition-all hover:opacity-90"
        style={{ background: "var(--hover)", color: "var(--text-card-secondary)" }}
        aria-label="Inserir emoji"
      >
        <Smile size={12} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 grid grid-cols-6 gap-1 rounded-xl p-2"
          style={{ background: "var(--bg-tooltip)", border: "1px solid var(--border-tooltip)", boxShadow: "0 12px 32px var(--shadow-md)" }}
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(emoji); setOpen(false); }}
              className="rounded-lg p-1 text-base transition-colors hover:bg-[var(--hover)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
