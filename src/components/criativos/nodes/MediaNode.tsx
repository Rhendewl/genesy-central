"use client";

import { memo, useRef, useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X, Upload, Loader2, Link2 } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { MediaNodeData } from "@/lib/workflow/types";

const C = "#F59E0B";
const TYPES: Array<MediaNodeData["mediaType"]> = ["logo", "fachada", "produto", "fundo", "pessoa"];

export const MediaNode = memo(function MediaNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNode     = useWorkflowStore((s) => s.removeNode);
  const projectId      = useWorkflowStore((s) => s.projectId);
  const d = data as MediaNodeData;

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const [urlMode, setUrlMode]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasImage = !!(d.fileUrl?.trim());

  const uploadFile = useCallback(async (file: File) => {
    if (!projectId) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const res = await fetch("/api/criativos/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto_id: projectId,
          tipo: d.mediaType ?? "logo",
          nome_arquivo: file.name,
          mime_type: file.type,
        }),
      });
      if (!res.ok) throw new Error();
      const { signed_url, public_url } = await res.json();
      await fetch(signed_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      updateNodeData(id, { fileUrl: public_url });
    } finally {
      setUploading(false);
    }
  }, [projectId, d.mediaType, id, updateNodeData]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }, [uploadFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  return (
    <div
      className="relative group"
      style={{
        minWidth: 220,
        background: "rgba(10,10,12,0.97)",
        border: `1px solid ${selected ? `${C}60` : "rgba(255,255,255,0.06)"}`,
        borderLeft: `2px solid ${selected ? C : `${C}80`}`,
        borderRadius: 10,
        boxShadow: selected
          ? `0 0 0 1px ${C}20, 0 8px 32px rgba(0,0,0,0.7)`
          : "0 2px 16px rgba(0,0,0,0.5)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); removeNode(id); }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{ background: "#EF4444" }}
      >
        <X size={8} className="text-white" />
      </button>

      {/* Label */}
      <div className="px-3 pt-2.5 pb-1.5">
        <input
          value={d.label ?? "Imagem"}
          onChange={e => updateNodeData(id, { label: e.target.value })}
          className="bg-transparent outline-none w-full uppercase tracking-widest nodrag"
          style={{ color: C, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em" }}
        />
      </div>

      {/* Type selector */}
      <div className="px-3 pb-2 flex gap-1 flex-wrap">
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => updateNodeData(id, { mediaType: t })}
            className="capitalize transition-all nodrag"
            style={{
              fontSize: 9,
              padding: "2px 8px",
              borderRadius: 20,
              background: d.mediaType === t ? `${C}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${d.mediaType === t ? `${C}60` : "rgba(255,255,255,0.06)"}`,
              color: d.mediaType === t ? C : "rgba(255,255,255,0.35)",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Image area */}
      <div className="px-3 pb-3">
        {hasImage ? (
          <div className="relative rounded-lg overflow-hidden">
            <img src={d.fileUrl!} alt="" className="w-full object-cover" style={{ maxHeight: 100 }} />
            <button
              onClick={() => updateNodeData(id, { fileUrl: null })}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center nodrag"
              style={{ background: "rgba(0,0,0,0.75)" }}
            >
              <X size={9} className="text-white" />
            </button>
          </div>
        ) : uploading ? (
          <div
            className="flex items-center justify-center gap-2 py-5 rounded-lg"
            style={{ background: `${C}08`, border: `1px dashed ${C}30` }}
          >
            <Loader2 size={12} style={{ color: C }} className="animate-spin" />
            <span style={{ color: `${C}90`, fontSize: 10 }}>Enviando...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg cursor-pointer nodrag transition-all"
              style={{
                background: dragging ? `${C}10` : "rgba(255,255,255,0.02)",
                border: `1px dashed ${dragging ? `${C}70` : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <Upload size={14} style={{ color: dragging ? C : "rgba(255,255,255,0.2)" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>
                Arraste ou clique para enviar
              </span>
            </div>

            {/* URL toggle */}
            <button
              onClick={() => setUrlMode(v => !v)}
              className="flex items-center gap-1 nodrag"
              style={{ color: "rgba(255,255,255,0.2)", fontSize: 9 }}
            >
              <Link2 size={8} />
              <span>Usar URL</span>
            </button>

            {urlMode && (
              <input
                value={d.fileUrl ?? ""}
                onChange={e => updateNodeData(id, { fileUrl: e.target.value })}
                placeholder="https://..."
                className="outline-none w-full rounded-md px-2 py-1.5 nodrag"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 10,
                  caretColor: C,
                }}
                onFocus={e => (e.target.style.borderColor = `${C}50`)}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.05)")}
              />
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: C, border: "2px solid rgba(10,10,12,0.97)", right: -4 }}
      />
    </div>
  );
});
