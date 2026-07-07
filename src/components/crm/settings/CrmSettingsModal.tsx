"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { CrmStage } from "@/types/crm";
import { useCrmSettings } from "@/hooks/useCrmSettings";
import { EtapasTab } from "./EtapasTab";
import { OrigensTab } from "./OrigensTab";

type TabId = "origens" | "etapas";

interface Props {
  pipelineId:   string;
  pipelineName: string;
  stages:       CrmStage[];
  onClose:      () => void;
}

export function CrmSettingsModal({ pipelineId, pipelineName, stages, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("origens");
  const settings = useCrmSettings(pipelineId, stages);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lc-scrim"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--card)",
          border:     "1px solid var(--border)",
          maxHeight:  "90vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
              Configurações do CRM
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {pipelineName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 px-5 py-2 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--hover)" }}
        >
          {(["origens", "etapas"] as TabId[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={activeTab === tab ? {
                background: "var(--border-card-hover)",
                color:      "var(--text-title)",
              } : {
                color: "var(--muted-foreground)",
              }}
            >
              {tab === "origens" ? "Origens" : "Etapas"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {settings.isLoading ? (
            <div className="flex items-center gap-2 p-8" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">Carregando configurações…</span>
            </div>
          ) : settings.error ? (
            <div className="flex items-center gap-2 p-8" style={{ color: "#ef4444" }}>
              <AlertCircle size={15} />
              <span className="text-sm">{settings.error}</span>
            </div>
          ) : (
            <>
              {activeTab === "origens" && (
                <OrigensTab
                  pipelineId={pipelineId}
                  sources={settings.sources}
                  onCreate={settings.createSource}
                  onUpdate={settings.updateSource}
                  onDelete={settings.deleteSource}
                />
              )}
              {activeTab === "etapas" && (
                <EtapasTab
                  stages={stages}
                  sources={settings.sources}
                  stageConversions={settings.stageConversions}
                  onUpsert={settings.upsertStageConversion}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
