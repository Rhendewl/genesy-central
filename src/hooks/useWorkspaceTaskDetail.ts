"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WorkspaceTaskDetail, WorkspaceTaskChecklistItem, WorkspaceTaskComment, WorkspaceTaskAttachment,
} from "@/types/workspace";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceTaskDetail
// Busca sob demanda (ao abrir o painel lateral) a tarefa + checklist + comentários
// + anexos, e expõe handlers de mutação para cada sub-recurso. Mantém o hook de
// listagem (useWorkspaceTasks) leve — não carrega o detalhe completo de toda tarefa
// só para exibir os cards do board.
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspaceTaskDetail(taskId: string | null) {
  const [detail,    setDetail]    = useState<WorkspaceTaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchDetail = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/workspace/tasks/${taskId}`);
      const json = await res.json() as { task?: WorkspaceTaskDetail; error?: string };
      if (!mountedRef.current) return;
      if (!res.ok || !json.task) throw new Error(json.error ?? "Erro ao carregar tarefa");
      setDetail(json.task);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    mountedRef.current = true;
    setDetail(null);
    if (taskId) void fetchDetail();
    return () => { mountedRef.current = false; };
  }, [taskId, fetchDetail]);

  async function addChecklistItem(label: string) {
    if (!taskId) return;
    const res  = await fetch(`/api/workspace/tasks/${taskId}/checklist`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }),
    });
    const json = await res.json() as { item?: WorkspaceTaskChecklistItem; error?: string };
    if (res.ok && json.item) {
      setDetail((prev) => prev ? { ...prev, checklist_items: [...prev.checklist_items, json.item!] } : prev);
    }
    return json;
  }

  async function toggleChecklistItem(itemId: string, isCompleted: boolean) {
    if (!taskId) return;
    setDetail((prev) => prev ? {
      ...prev,
      checklist_items: prev.checklist_items.map((i) => i.id === itemId ? { ...i, is_completed: isCompleted } : i),
    } : prev);
    await fetch(`/api/workspace/tasks/${taskId}/checklist/${itemId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_completed: isCompleted }),
    });
  }

  async function deleteChecklistItem(itemId: string) {
    if (!taskId) return;
    setDetail((prev) => prev ? { ...prev, checklist_items: prev.checklist_items.filter((i) => i.id !== itemId) } : prev);
    await fetch(`/api/workspace/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" });
  }

  async function addComment(body: string) {
    if (!taskId) return;
    const res  = await fetch(`/api/workspace/tasks/${taskId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    const json = await res.json() as { comment?: WorkspaceTaskComment; error?: string };
    if (res.ok && json.comment) {
      setDetail((prev) => prev ? { ...prev, comments: [...prev.comments, json.comment!] } : prev);
    }
    return json;
  }

  async function deleteComment(commentId: string) {
    if (!taskId) return;
    setDetail((prev) => prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev);
    await fetch(`/api/workspace/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
  }

  async function registerAttachment(payload: {
    file_name: string; mime_type: string; file_size: number; storage_path: string; public_url: string;
  }) {
    if (!taskId) return;
    const res  = await fetch(`/api/workspace/tasks/${taskId}/attachments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const json = await res.json() as { attachment?: WorkspaceTaskAttachment; error?: string };
    if (res.ok && json.attachment) {
      setDetail((prev) => prev ? { ...prev, attachments: [...prev.attachments, json.attachment!] } : prev);
    }
    return json;
  }

  async function deleteAttachment(attachmentId: string) {
    if (!taskId) return;
    setDetail((prev) => prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) } : prev);
    await fetch(`/api/workspace/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
  }

  return {
    detail, isLoading, error, refetch: fetchDetail,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    addComment, deleteComment,
    registerAttachment, deleteAttachment,
  };
}
