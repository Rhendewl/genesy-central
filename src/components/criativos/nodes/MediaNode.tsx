"use client";

import { memo, useRef, useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X, Upload, Loader2, Link2, ImageIcon } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { MediaNodeData } from "@/lib/workflow/types";

const C   = "#F59E0B";
const DIM = "rgba(245,158,11,0.6)";
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
    if (!projectId || !file.type.startsWith("image/")) return;
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
    e.preventDefault(); e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(false);
  }, []);

  return (
    <div
      className="relative group"
      style={{
        minWidth: 230,
        background: "rgba(14, 10, 4, 0.58)",
        backdropFilter: "blur(28px) saturate(1.8)",
        WebkitBackdropFilter: "blur(28px) saturate(1.8)",
        border: `1px solid ${selected ? "rgba(245,158,11,0.55)" : "rgba(245,158,11,0.14)"}`,
        borderRadius: 16,
        boxShadow: selected
          ? `0 0 0 1px rgba(245,158,11,0.18), 0 0 40px rgba(245,158,11,0.1), 0 28px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)`
          : `0 0 0 1px rgba(245,158,11,0.05), 0 0 24px rgba(245,158,11,0.04), 0 20px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); removeNode(id); }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center
                   opacity-0 group-hover:opacity-100 z-10"
        style={{
          background: "rgba(239,68,68,0.85)",
          border: "1px solid rgba(239,68,68,0.4)",
          boxShadow: "0 0 10px rgba(239,68,68,0.4)",
          transition: "opacity 0.15s ease",
        }}
      >
        <X size={9} className="text-white" />
      </button>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 pt-3 pb-2"
        style={{ borderBottom: "1px solid rgba(245,158,11,0.08)" }}
      >
        <div
          style={{
            width: 22, height: 22, borderRadius: 7,
            background: `${C}14`, border: `1px solid ${C}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 10px ${C}10`,
          }}
        >
          <ImageIcon size={10} style={{ color: DIM }} />
        </div>
        <input
          value={d.label ?? "Mídia"}
          onChange={e => updateNodeData(id, { label: e.target.value })}
          className="bg-transparent outline-none nodrag flex-1"
          style={{ color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}
        />
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: C, boxShadow: `0 0 6px ${C}`, opacity: 0.7 }} />
      </div>

      {/* Type pills */}
      <div className="px-3.5 pt-2.5 pb-2 flex gap-1 flex-wrap">
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => updateNodeData(id, { mediaType: t })}
            className="capitalize transition-all nodrag"
            style={{
              fontSize: 8.5,
              padding: "2.5px 9px",
              borderRadius: 20,
              fontWeight: 500,
              letterSpacing: "0.04em",
              background: d.mediaType === t ? `${C}16` : "rgba(255,255,255,0.03)",
              border: `1px solid ${d.mediaType === t ? `${C}50` : "rgba(255,255,255,0.06)"}`,
              color: d.mediaType === t ? C : "rgba(255,255,255,0.3)",
              boxShadow: d.mediaType === t ? `0 0 8px ${C}15` : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Image area */}
      <div className="px-3.5 pb-3.5">
        {hasImage ? (
          <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid rgba(245,158,11,0.15)` }}>
            <img src={d.fileUrl!} alt="" className="w-full object-cover" style={{ maxHeight: 100 }} />
            <button
              onClick={() => updateNodeData(id, { fileUrl: null })}
              className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center nodrag"
              style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <X size={9} className="text-white" />
            </button>
          </div>
        ) : uploading ? (
          <div
            className="flex items-center justify-center gap-2 py-6 rounded-xl"
            style={{ background: `${C}07`, border: `1px dashed ${C}30` }}
          >
            <Loader2 size={12} style={{ color: C }} className="animate-spin" />
            <span style={{ color: `${C}90`, fontSize: 10 }}>Enviando...</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl cursor-pointer nodrag"
              style={{
                background: dragging ? `${C}08` : "rgba(255,255,255,0.015)",
                border: `1px dashed ${dragging ? `${C}60` : "rgba(255,255,255,0.07)"}`,
                transition: "all 0.15s ease",
              }}
            >
              <Upload size={15} style={{ color: dragging ? C : "rgba(255,255,255,0.2)", filter: dragging ? `drop-shadow(0 0 6px ${C})` : "none" }} />
              <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 9.5, letterSpacing: "0.03em" }}>
                Arraste ou clique para enviar
              </span>
            </div>

            <button
              onClick={() => setUrlMode(v => !v)}
              className="flex items-center gap-1.5 nodrag transition-opacity hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.22)", fontSize: 9 }}
            >
              <Link2 size={8} />
              <span>Usar URL</span>
            </button>

            {urlMode && (
              <input
                value={d.fileUrl ?? ""}
                onChange={e => updateNodeData(id, { fileUrl: e.target.value })}
                placeholder="https://..."
                className="outline-none w-full rounded-xl px-3 py-2 nodrag"
                style={{
                  background: "rgba(245,158,11,0.04)",
                  border: "1px solid rgba(245,158,11,0.1)",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 10,
                  caretColor: C,
                  transition: "border-color 0.15s",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(245,158,11,0.35)")}
                onBlur={e => (e.target.style.borderColor = "rgba(245,158,11,0.1)")}
              />
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 9, height: 9,
          background: C,
          border: "2px solid rgba(14,10,4,0.9)",
          borderRadius: "50%",
          boxShadow: `0 0 10px ${C}, 0 0 4px ${C}`,
          right: -4.5,
        }}
      />
    </div>
  );
});
