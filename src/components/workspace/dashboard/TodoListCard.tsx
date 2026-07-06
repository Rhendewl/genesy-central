"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ListTodo, Plus } from "lucide-react";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";

const MAX_VISIBLE = 6;

interface TodoListCardProps {
  tasksHook: ReturnType<typeof useWorkspaceTasks>;
  delay?:    number;
}

export function TodoListCard({ tasksHook, delay = 0 }: TodoListCardProps) {
  const [newTitle,   setNewTitle]   = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const pending = tasksHook.tasks.filter((t) => t.status !== "concluido");
  const visible = pending.slice(0, MAX_VISIBLE);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    await tasksHook.createTask({ title });
  }

  return (
    <motion.div
      className="lc-card p-6"
      style={{ background: "rgba(0,0,0,0.31)" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <ListTodo size={17} style={{ color: "#ffffff" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>To-do List</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">{pending.length} pendente{pending.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Link href="/workspace/kanban" className="text-[var(--muted-foreground)] hover:text-white/80">
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Plus size={14} style={{ color: "var(--muted-foreground)" }} />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
          placeholder="Adicionar tarefa..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          style={{ color: "var(--text-title)" }}
        />
      </div>

      <div className="flex flex-col gap-1">
        {visible.length === 0 && (
          <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            Nenhuma tarefa pendente
          </p>
        )}
        {visible.map((task) => (
          <div key={task.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/[0.03]">
            <button
              onClick={() => tasksHook.toggleComplete(task.id)}
              className="flex flex-shrink-0 items-center justify-center rounded-full border transition-colors"
              style={{ width: "16px", height: "16px", borderColor: "rgba(255,255,255,0.25)", background: "transparent" }}
              aria-label="Marcar como concluída"
            />
            <button
              onClick={() => { setOpenTaskId(task.id); setIsPanelOpen(true); }}
              className="flex-1 truncate text-left text-sm"
              style={{ color: "var(--text-title)" }}
            >
              {task.title}
            </button>
          </div>
        ))}
      </div>

      {pending.length > MAX_VISIBLE && (
        <Link href="/workspace/kanban" className="mt-3 block text-center text-xs" style={{ color: "var(--primary)" }}>
          Ver todas ({pending.length})
        </Link>
      )}

      <AnimatePresence>
        {isPanelOpen && (
          <TaskDetailPanel taskId={openTaskId} tasksHook={tasksHook} onClose={() => { setIsPanelOpen(false); setOpenTaskId(null); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
