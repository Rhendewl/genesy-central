export function buildWorkspaceTaskActionUrl(taskId: string, boardId?: string | null): string {
  const params = new URLSearchParams();
  if (boardId) params.set("board", boardId);
  params.set("task", taskId);
  return `/workspace/kanban?${params.toString()}`;
}
