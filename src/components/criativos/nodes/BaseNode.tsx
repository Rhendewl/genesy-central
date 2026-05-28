"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { CATEGORY_COLORS, NODE_META_MAP } from "./nodeRegistry";
import { useWorkflowStore } from "@/store/workflow";
import type { WorkflowNodeType, NodeExecutionStatus } from "@/lib/workflow/types";

// ── Ícone dinâmico do Lucide ──────────────────────────────────────────────────

function DynamicIcon({ name, size = 13 }: { name: string; size?: number }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

// ── Indicador de status de execução ──────────────────────────────────────────

function ExecutionBadge({ status }: { status: NodeExecutionStatus }) {
  if (status === "idle") return null;
  return (
    <div className="absolute -top-1.5 -right-1.5 rounded-full w-4 h-4 flex items-center justify-center"
      style={{
        background: status === "running" ? "#3B82F6"
          : status === "success" ? "#10B981"
          : status === "error" ? "#EF4444"
          : "#6B7280",
      }}
    >
      {status === "running"  && <Loader2 size={10} className="animate-spin text-white" />}
      {status === "success"  && <CheckCircle2 size={10} className="text-white" />}
      {status === "error"    && <AlertCircle size={10} className="text-white" />}
    </div>
  );
}

// ── BaseNode ──────────────────────────────────────────────────────────────────

interface BaseNodeProps {
  id: string;
  type: WorkflowNodeType;
  selected?: boolean;
  children?: ReactNode;
  minWidth?: number;
}

export const BaseNode = memo(function BaseNode({
  id,
  type,
  selected,
  children,
  minWidth = 220,
}: BaseNodeProps) {
  const meta = NODE_META_MAP[type];
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const nodes = useWorkflowStore((s) => s.nodes);
  const node = nodes.find(n => n.id === id);
  const executionStatus: NodeExecutionStatus = (node?.data?.executionStatus as NodeExecutionStatus) ?? "idle";

  if (!meta) return null;

  const colors = CATEGORY_COLORS[meta.category];
  const hasInputHandle = meta.inputs > 0;
  const hasOutputHandle = meta.outputs > 0;
  const multipleOutputs = meta.outputs > 1;

  return (
    <div
      className="relative rounded-xl overflow-visible group"
      style={{
        minWidth,
        background: "rgba(10,10,12,0.92)",
        border: `1px solid ${selected ? colors.primary : "rgba(255,255,255,0.08)"}`,
        boxShadow: selected
          ? `0 0 0 1px ${colors.primary}40, 0 8px 32px rgba(0,0,0,0.6)`
          : "0 4px 24px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Execution status badge */}
      <ExecutionBadge status={executionStatus} />

      {/* Delete button (hover) */}
      <button
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{ background: "#EF4444", border: "1.5px solid rgba(255,255,255,0.1)" }}
      >
        <X size={10} className="text-white" />
      </button>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          background: colors.bg,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
          style={{ background: colors.primary + "30", color: colors.primary }}
        >
          <DynamicIcon name={meta.icon} size={11} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-none" style={{ color: colors.text }}>
            {meta.label}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
            {meta.description}
          </p>
        </div>
      </div>

      {/* Body */}
      {children && (
        <div className="px-3 py-2.5 space-y-2">
          {children}
        </div>
      )}

      {/* Input handle (left) */}
      {hasInputHandle && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: 10,
            height: 10,
            background: colors.primary,
            border: "2px solid rgba(10,10,12,0.9)",
            left: -5,
          }}
        />
      )}

      {/* Output handle(s) (right) */}
      {hasOutputHandle && !multipleOutputs && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 10,
            height: 10,
            background: colors.primary,
            border: "2px solid rgba(10,10,12,0.9)",
            right: -5,
          }}
        />
      )}

      {/* Multiple output handles */}
      {multipleOutputs && Array.from({ length: meta.outputs }, (_, i) => (
        <Handle
          key={i}
          id={`output-${i}`}
          type="source"
          position={Position.Right}
          style={{
            width: 10,
            height: 10,
            background: colors.primary,
            border: "2px solid rgba(10,10,12,0.9)",
            right: -5,
            top: `${((i + 1) / (meta.outputs + 1)) * 100}%`,
          }}
        />
      ))}
    </div>
  );
});

// ── Campo de texto reutilizável dentro de nodes ───────────────────────────────

export function NodeField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export function NodeTextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md px-2 py-1.5 text-xs resize-none outline-none focus:ring-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.85)",
        lineHeight: 1.5,
      }}
    />
  );
}

export function NodeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: "#0a0a0c" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
