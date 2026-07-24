"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WORKSPACE_BOARD_COLORS } from "@/lib/workspace/task-board";
import type { useWorkspaceTaskBoards } from "@/hooks/useWorkspaceTaskBoards";
import type { WorkspaceTaskBoard } from "@/types/workspace";

interface Props {
  boardsHook: ReturnType<typeof useWorkspaceTaskBoards>;
  activeBoard: WorkspaceTaskBoard | null;
  onActiveChange: (boardId: string) => void;
}

export function TaskBoardWorkspaceBar({ boardsHook, activeBoard, onActiveChange }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceTaskBoard | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(WORKSPACE_BOARD_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!dialogOpen) setConfirmDelete(false);
  }, [dialogOpen]);

  function openCreate() {
    setEditing(null);
    setName("");
    setColor(WORKSPACE_BOARD_COLORS[0]);
    setDialogOpen(true);
  }

  function openEdit() {
    if (!activeBoard) return;
    setEditing(activeBoard);
    setName(activeBoard.name);
    setColor(activeBoard.color);
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const result = editing
      ? await boardsHook.updateBoard(editing.id, { name, color })
      : await boardsHook.createBoard({ name, color });
    setSaving(false);
    if (result.error || !result.board) {
      toast.error(result.error ?? "Erro ao salvar workspace");
      return;
    }
    onActiveChange(result.board.id);
    setDialogOpen(false);
    toast.success(editing ? "Workspace atualizado" : "Workspace criado");
  }

  async function remove() {
    if (!editing || editing.is_default) return;
    setSaving(true);
    const result = await boardsHook.deleteBoard(editing.id);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.fallbackBoardId) onActiveChange(result.fallbackBoardId);
    setDialogOpen(false);
    toast.success("Workspace removido; as tarefas foram movidas para Geral");
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl border px-3 py-3 sm:px-4"
        style={{
          background: "var(--glass-bg-soft)",
          borderColor: activeBoard ? `${activeBoard.color}55` : "var(--glass-border)",
          boxShadow: activeBoard ? `inset 0 1px 0 ${activeBoard.color}25, 0 12px 36px ${activeBoard.color}10` : undefined,
        }}
      >
        {activeBoard && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
            style={{ background: `linear-gradient(90deg, ${activeBoard.color}, transparent 80%)` }}
          />
        )}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            <span className="flex shrink-0 items-center gap-2 pr-1 text-xs font-semibold text-[var(--muted-foreground)]">
              <FolderKanban size={15} />
              <span className="hidden sm:inline">Workspaces</span>
            </span>
            {boardsHook.isLoading ? (
              <div className="h-8 w-44 animate-pulse rounded-xl bg-[var(--hover)]" />
            ) : boardsHook.boards.map((board) => {
              const selected = board.id === activeBoard?.id;
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => onActiveChange(board.id)}
                  className="flex h-8 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all"
                  style={{
                    background: selected ? `${board.color}18` : "transparent",
                    borderColor: selected ? `${board.color}60` : "var(--glass-border)",
                    color: selected ? "var(--text-title)" : "var(--muted-foreground)",
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: board.color, boxShadow: selected ? `0 0 12px ${board.color}` : undefined }} />
                  {board.name}
                </button>
              );
            })}
          </div>

          {boardsHook.canManage && (
            <div className="flex shrink-0 items-center gap-1">
              {activeBoard && (
                <Button variant="ghost" size="icon-sm" onClick={openEdit} aria-label="Editar workspace">
                  <Pencil />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus />
                <span className="hidden sm:inline">Novo workspace</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Configurar workspace" : "Novo workspace"}</DialogTitle>
            <DialogDescription>
              Cada workspace possui o mesmo fluxo de etapas e organiza as tarefas de um projeto específico.
            </DialogDescription>
          </DialogHeader>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoFocus
              placeholder="Ex.: Lançamento novo site"
              className="h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-title)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">Cor do tema</p>
            <div className="flex flex-wrap gap-2">
              {WORKSPACE_BOARD_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`Usar cor ${option}`}
                  className="h-8 w-8 rounded-full transition-transform"
                  style={{
                    background: option,
                    transform: color === option ? "scale(1.12)" : undefined,
                    boxShadow: color === option ? `0 0 0 2px var(--bg-modal), 0 0 0 4px ${option}` : undefined,
                  }}
                />
              ))}
              <label
                className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[var(--glass-border)]"
                title="Escolher outra cor"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="absolute inset-[-8px] h-12 w-12 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border p-3" style={{ borderColor: `${color}55`, background: `${color}12` }}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 14px ${color}` }} />
              <span className="truncate text-sm font-semibold text-[var(--text-title)]">{name.trim() || "Nome do workspace"}</span>
            </div>
          </div>

          {editing && !editing.is_default && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              {confirmDelete ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-red-400">As tarefas serão preservadas e movidas para o workspace Geral.</p>
                  <Button variant="danger" size="sm" onClick={() => void remove()} loading={saving}>Confirmar exclusão</Button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-xs font-semibold text-red-400">
                  <Trash2 size={14} />
                  Excluir workspace
                </button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={!name.trim()} loading={saving}>
              {editing ? "Salvar alterações" : "Criar workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
