"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WorkspaceObjectiveDetail, WorkspaceObjectiveStep, WorkspaceObjectiveComment, WorkspaceObjectiveAttachment,
} from "@/types/workspace-objectives";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceObjectiveDetail — mesmo molde de useWorkspaceTaskDetail.ts.
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspaceObjectiveDetail(objectiveId: string | null) {
  const [detail,    setDetail]    = useState<WorkspaceObjectiveDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchDetail = useCallback(async () => {
    if (!objectiveId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/workspace/objectives/${objectiveId}`);
      const json = await res.json() as { objective?: WorkspaceObjectiveDetail; error?: string };
      if (!mountedRef.current) return;
      if (!res.ok || !json.objective) throw new Error(json.error ?? "Erro ao carregar objetivo");
      setDetail(json.objective);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    mountedRef.current = true;
    setDetail(null);
    if (objectiveId) void fetchDetail();
    return () => { mountedRef.current = false; };
  }, [objectiveId, fetchDetail]);

  async function addStep(label: string) {
    if (!objectiveId) return;
    const res  = await fetch(`/api/workspace/objectives/${objectiveId}/steps`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }),
    });
    const json = await res.json() as { step?: WorkspaceObjectiveStep; error?: string };
    if (res.ok && json.step) {
      setDetail((prev) => prev ? { ...prev, steps: [...prev.steps, json.step!] } : prev);
    }
    return json;
  }

  async function toggleStep(stepId: string, isCompleted: boolean) {
    if (!objectiveId) return;
    setDetail((prev) => prev ? {
      ...prev,
      steps: prev.steps.map((s) => s.id === stepId ? { ...s, is_completed: isCompleted } : s),
    } : prev);
    await fetch(`/api/workspace/objectives/${objectiveId}/steps/${stepId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_completed: isCompleted }),
    });
  }

  async function deleteStep(stepId: string) {
    if (!objectiveId) return;
    setDetail((prev) => prev ? { ...prev, steps: prev.steps.filter((s) => s.id !== stepId) } : prev);
    await fetch(`/api/workspace/objectives/${objectiveId}/steps/${stepId}`, { method: "DELETE" });
  }

  async function addComment(body: string) {
    if (!objectiveId) return;
    const res  = await fetch(`/api/workspace/objectives/${objectiveId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    const json = await res.json() as { comment?: WorkspaceObjectiveComment; error?: string };
    if (res.ok && json.comment) {
      setDetail((prev) => prev ? { ...prev, comments: [...prev.comments, json.comment!] } : prev);
    }
    return json;
  }

  async function deleteComment(commentId: string) {
    if (!objectiveId) return;
    setDetail((prev) => prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev);
    await fetch(`/api/workspace/objectives/${objectiveId}/comments/${commentId}`, { method: "DELETE" });
  }

  async function registerAttachment(payload: {
    file_name: string; mime_type: string; file_size: number; storage_path: string; public_url: string;
  }) {
    if (!objectiveId) return;
    const res  = await fetch(`/api/workspace/objectives/${objectiveId}/attachments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const json = await res.json() as { attachment?: WorkspaceObjectiveAttachment; error?: string };
    if (res.ok && json.attachment) {
      setDetail((prev) => prev ? { ...prev, attachments: [...prev.attachments, json.attachment!] } : prev);
    }
    return json;
  }

  async function deleteAttachment(attachmentId: string) {
    if (!objectiveId) return;
    setDetail((prev) => prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) } : prev);
    await fetch(`/api/workspace/objectives/${objectiveId}/attachments/${attachmentId}`, { method: "DELETE" });
  }

  return {
    detail, isLoading, error, refetch: fetchDetail,
    addStep, toggleStep, deleteStep,
    addComment, deleteComment,
    registerAttachment, deleteAttachment,
  };
}
