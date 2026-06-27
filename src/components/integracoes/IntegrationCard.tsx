"use client";

import { motion } from "framer-motion";
import {
  Target, BarChart3, Webhook, Users,
  CheckCircle2, XCircle, Clock, AlertCircle,
  Zap, Shield, Activity,
} from "lucide-react";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";
import type { FormIntegrationRow } from "@/hooks/useFormularioIntegracoes";

const ADAPTER_ICONS: Record<string, React.ElementType> = {
  "meta-pixel": Target,
  "ga4":        BarChart3,
  "webhook":    Webhook,
  "crm":        Users,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Marketing": "#f59e0b",
  "Analytics": "#3b82f6",
  "Automação": "#8b5cf6",
  "CRM":       "#22c55e",
};

const AUTH_LABEL: Record<string, string> = {
  apiKey: "API Key",
  hmac:   "HMAC",
  oauth:  "OAuth",
  none:   "Público",
};

type CardStatus = "connected" | "disconnected" | "error" | "pending";

function getStatus(row: FormIntegrationRow | undefined): CardStatus {
  if (!row) return "disconnected";
  if (!row.enabled) return "disconnected";
  return "connected";
}

function StatusBadge({ status }: { status: CardStatus }) {
  const config = {
    connected:    { label: "Conectado",    color: "#22c55e", bg: "#22c55e15" },
    disconnected: { label: "Desconectado", color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.06)" },
    error:        { label: "Erro",         color: "#ef4444", bg: "#ef444415" },
    pending:      { label: "Pendente",     color: "#f59e0b", bg: "#f59e0b15" },
  }[status];

  return (
    <span
      className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: config.color, background: config.bg }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
}

interface IntegrationCardProps {
  definition: IntegrationDefinition;
  row?:       FormIntegrationRow;
  index?:     number;
  onClick:    () => void;
}

export function IntegrationCard({ definition, row, index = 0, onClick }: IntegrationCardProps) {
  const Icon   = ADAPTER_ICONS[definition.adapterName] ?? Zap;
  const status = getStatus(row);
  const catColor = CATEGORY_COLORS[definition.category] ?? "var(--primary)";
  const eventCount = definition.supportedEvents.includes("*")
    ? "Todos os eventos"
    : `${definition.supportedEvents.length} evento${definition.supportedEvents.length !== 1 ? "s" : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="relative group rounded-xl border p-4 cursor-pointer transition-all"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Topo */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className="p-2.5 rounded-lg"
          style={{ background: `${catColor}18` }}
        >
          <Icon size={16} style={{ color: catColor }} />
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Título e versão */}
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="font-semibold text-sm" style={{ color: "var(--text-title)" }}>
          {definition.displayName}
        </h3>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          v{definition.version}
        </span>
      </div>

      {/* Descrição */}
      <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--muted-foreground)" }}>
        {definition.description}
      </p>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3 gap-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: `${catColor}15`, color: catColor }}
          >
            {definition.category}
          </span>
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Shield size={10} />
            {AUTH_LABEL[definition.authType]}
          </span>
        </div>
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Activity size={10} />
          {eventCount}
        </span>
      </div>
    </motion.div>
  );
}
