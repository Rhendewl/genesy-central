"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { Upload, Image, FileImage } from "lucide-react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { AssetUploadNodeData } from "@/lib/workflow/types";

const TYPE_OPTIONS = [
  { value: "logo",   label: "Logo" },
  { value: "imagem", label: "Imagem" },
  { value: "fundo",  label: "Fundo" },
];

export const AssetUploadNode = memo(function AssetUploadNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as AssetUploadNodeData;

  return (
    <BaseNode id={id} type="asset-upload" selected={selected} minWidth={200}>
      <NodeField label="TIPO">
        <NodeSelect
          value={d.asset_type ?? "logo"}
          onChange={(v) => updateNodeData(id, { asset_type: v })}
          options={TYPE_OPTIONS}
        />
      </NodeField>
      <NodeField label="ARQUIVO">
        {d.file_url ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <FileImage size={12} style={{ color: "rgba(255,255,255,0.5)" }} />
            <span className="text-xs truncate max-w-[130px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {d.file_name ?? "Arquivo carregado"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-3 rounded-md cursor-pointer hover:bg-white/5 transition-colors"
            style={{ border: "1px dashed rgba(255,255,255,0.12)" }}>
            <Upload size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
              Clique para fazer upload
            </span>
          </div>
        )}
      </NodeField>
    </BaseNode>
  );
});
