"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Send, X } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";

// Compartilhado entre TaskDetailPanel e ObjectiveDetailPanel.
export interface CommentLike {
  id:         string;
  author_id:  string | null;
  body:       string;
  created_at: string;
}

interface CommentsThreadProps {
  comments: CommentLike[];
  onAdd:    (body: string) => void;
  onDelete: (commentId: string) => void;
}

export function CommentsThread({ comments, onAdd, onDelete }: CommentsThreadProps) {
  const { profiles } = useUsers();
  const [body, setBody] = useState("");

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setBody("");
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 && (
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Sem comentários</p>
      )}
      {comments.map((comment) => {
        const author = profiles.find((p) => p.id === comment.author_id);
        return (
          <div key={comment.id} className="group flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium" style={{ color: "var(--text-title)" }}>
                {author?.full_name ?? "Você"}{" "}
                <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm" style={{ color: "var(--text-title)" }}>
                {comment.body}
              </p>
            </div>
            <button
              onClick={() => onDelete(comment.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Escrever um comentário..."
          className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          style={{ background: "var(--input)", border: "1px solid var(--border-color)", color: "var(--text-title)" }}
        />
        <button onClick={submit} disabled={!body.trim()} style={{ color: "var(--primary)" }} className="disabled:opacity-30">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
