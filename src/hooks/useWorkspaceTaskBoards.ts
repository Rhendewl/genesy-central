"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { WorkspaceTaskBoard } from "@/types/workspace";

export function useWorkspaceTaskBoards() {
  const [boards, setBoards] = useState<WorkspaceTaskBoard[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoards = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/workspace/task-boards");
    const json = await response.json() as {
      boards?: WorkspaceTaskBoard[];
      canManage?: boolean;
      error?: string;
    };
    if (!response.ok || !json.boards) {
      setError(json.error ?? "Erro ao carregar workspaces");
      return;
    }
    setBoards(json.boards);
    setCanManage(json.canManage === true);
  }, []);

  useEffect(() => {
    void fetchBoards().finally(() => setIsLoading(false));
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("workspace-task-boards-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_boards" }, () => {
        void fetchBoards();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchBoards]);

  async function createBoard(input: { name: string; color: string }) {
    const response = await fetch("/api/workspace/task-boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await response.json() as { board?: WorkspaceTaskBoard; error?: string };
    if (!response.ok || !json.board) return { board: null, error: json.error ?? "Erro ao criar workspace" };
    setBoards((current) => [...current, json.board!]);
    return { board: json.board, error: null };
  }

  async function updateBoard(id: string, input: { name: string; color: string }) {
    const response = await fetch(`/api/workspace/task-boards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await response.json() as { board?: WorkspaceTaskBoard; error?: string };
    if (!response.ok || !json.board) return { board: null, error: json.error ?? "Erro ao atualizar workspace" };
    setBoards((current) => current.map((board) => board.id === id ? json.board! : board));
    return { board: json.board, error: null };
  }

  async function deleteBoard(id: string) {
    const response = await fetch(`/api/workspace/task-boards/${id}`, { method: "DELETE" });
    const json = await response.json() as { fallback_board_id?: string; error?: string };
    if (!response.ok) return { fallbackBoardId: null, error: json.error ?? "Erro ao excluir workspace" };
    setBoards((current) => current.filter((board) => board.id !== id));
    return { fallbackBoardId: json.fallback_board_id ?? null, error: null };
  }

  return {
    boards,
    canManage,
    isLoading,
    error,
    createBoard,
    updateBoard,
    deleteBoard,
    refetch: fetchBoards,
  };
}
