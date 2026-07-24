import type { WorkspaceTaskBoard } from "@/types/workspace";

export const WORKSPACE_BOARD_COLORS = [
  "#4a8fd4",
  "#6b9b6f",
  "#e0a344",
  "#e05c5c",
  "#9b7fe0",
  "#27a3ff",
  "#d06f9a",
  "#7c878e",
] as const;

export function normalizeWorkspaceBoardColor(value: unknown) {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : WORKSPACE_BOARD_COLORS[0];
}

export function normalizeWorkspaceBoardName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export function selectWorkspaceTaskBoard(
  boards: WorkspaceTaskBoard[],
  preferredId?: string | null,
) {
  return boards.find((board) => board.id === preferredId)
    ?? boards.find((board) => board.is_default)
    ?? boards[0]
    ?? null;
}
