"use client";

import { useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

export const WORKSPACE_TASK_TRASH_ID = "workspace-task-trash";

export function TaskTrashDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: WORKSPACE_TASK_TRASH_ID });

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.24, ease: "easeOut" }}
      className="flex h-32 w-72 flex-shrink-0 flex-col justify-center rounded-[20px] p-4 transition-all duration-200"
      style={{
        scrollSnapAlign: "start",
        background: isOver
          ? "linear-gradient(135deg, rgba(224,92,92,0.30), rgba(224,92,92,0.14))"
          : "linear-gradient(135deg, rgba(224,92,92,0.16), rgba(224,92,92,0.06))",
        border: isOver ? "1px solid rgba(255,107,107,0.68)" : "1px solid rgba(224,92,92,0.30)",
        boxShadow: isOver
          ? "0 18px 46px rgba(224,92,92,0.22), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 8px 26px rgba(224,92,92,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(14px) saturate(140%)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: isOver ? "rgba(255,107,107,0.22)" : "rgba(224,92,92,0.14)" }}
        >
          <Trash2 size={18} style={{ color: "#ff6b6b" }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#ff6b6b" }}>
            Descarte
          </p>
          <p className="mt-0.5 text-xs leading-snug" style={{ color: isOver ? "#ffb4b4" : "var(--muted-foreground)" }}>
            {isOver ? "Solte para apagar permanentemente" : "Arraste tarefas aqui para limpar a lista"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
