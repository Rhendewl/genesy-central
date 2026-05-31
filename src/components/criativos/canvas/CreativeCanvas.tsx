"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { toast } from "sonner";
import { useWorkflowStore } from "@/store/workflow";
import type { WorkflowNodeType, WorkflowJSON } from "@/lib/workflow/types";
import type { ExecutionEvent } from "@/lib/workflow/executor";

import { TextNode }   from "../nodes/TextNode";
import { MediaNode }  from "../nodes/MediaNode";
import { EngineNode } from "../nodes/EngineNode";
import { ResultNode } from "../nodes/ResultNode";

import { BottomBar }      from "./BottomBar";
import { CanvasToolbar }  from "./CanvasToolbar";

// ── Node type map ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_TYPES: NodeTypes = {
  text:   TextNode   as React.ComponentType<any>,
  media:  MediaNode  as React.ComponentType<any>,
  engine: EngineNode as React.ComponentType<any>,
  result: ResultNode as React.ComponentType<any>,
};

// ── Inner canvas ──────────────────────────────────────────────────────────────

function CanvasInner({
  onSave,
  onRun,
}: {
  onSave: () => Promise<void>;
  onRun: () => void;
}) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, setSelectedNodeId,
  } = useWorkflowStore();

  const { screenToFlowPosition, getViewport } = useReactFlow();

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/workflow-node-type") as WorkflowNodeType;
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(type, position);
  }, [screenToFlowPosition, addNode]);

  // Adiciona node no centro do viewport atual
  const addNodeAtCenter = useCallback((type: WorkflowNodeType) => {
    const { x: vx, y: vy, zoom } = getViewport();
    // Centro da tela em coordenadas de canvas
    const cx = (window.innerWidth / 2 - vx) / zoom;
    const cy = (window.innerHeight / 2 - vy) / zoom;
    const spread = 60;
    addNode(type, {
      x: cx + (Math.random() * spread - spread / 2),
      y: cy + (Math.random() * spread - spread / 2),
    });
  }, [getViewport, addNode]);

  return (
    <div className="flex flex-col w-full h-full">
      <CanvasToolbar onSave={onSave} onRun={onRun} />
      <div className="flex-1 relative overflow-hidden">
        {/* Premium ambient background layers — pointer-events none so they don't block canvas */}
        <div className="canvas-ambient-top"    aria-hidden />
        <div className="canvas-ambient-horizon" aria-hidden />
        <div className="canvas-vignette"       aria-hidden />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={NODE_TYPES}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          deleteKeyCode={["Backspace", "Delete"]}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
        >
          {/* Premium dot grid — white, subtle, follows pan/zoom */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.4}
            color="rgba(255,255,255,0.28)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Floating bottom bar */}
        <BottomBar onAdd={addNodeAtCenter} />
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface CreativeCanvasProps {
  projectId: string;
  projectName: string;
  initialWorkflow?: WorkflowJSON | null;
  onSaveWorkflow: (json: WorkflowJSON) => Promise<void>;
}

export function CreativeCanvas({
  projectId,
  projectName,
  initialWorkflow,
  onSaveWorkflow,
}: CreativeCanvasProps) {
  const {
    setProject, loadFromJSON, loadStarter, toJSON,
    isDirty, setIsSaving, markClean, reset,
    executionState, setExecutionState,
    setNodeExecutionStatus, resetExecutionStatus,
    runTrigger, runTargetResultId,
  } = useWorkflowStore();

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    reset();
    setProject(projectId, projectName);
    if (initialWorkflow && initialWorkflow.nodes.length > 0) {
      loadFromJSON(initialWorkflow);
    } else {
      loadStarter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-save: 3s debounce
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { handleSave(); }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveWorkflow(toJSON());
      markClean();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (executionState === "running") return;

    // Captura o alvo antes de salvar (evita race condition com re-render)
    const targetResultId = runTargetResultId;

    await handleSave();
    setExecutionState("running");

    if (targetResultId) {
      // Execução isolada: mantém estados dos outros nodes intactos
      setNodeExecutionStatus(targetResultId, "idle");
    } else {
      // Execução completa: reseta todos os nodes
      resetExecutionStatus();
    }

    try {
      const res = await fetch("/api/criativos/executar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto_id:     projectId,
          result_node_id: targetResultId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erro ao iniciar execução." }));
        toast.error(err.error ?? "Erro ao iniciar execução.");
        setExecutionState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event: ExecutionEvent = JSON.parse(line.slice(6));
            switch (event.type) {
              case "node_start":
                setNodeExecutionStatus(event.nodeId, "running");
                break;
              case "node_complete":
                setNodeExecutionStatus(event.nodeId, "success", event.output);
                break;
              case "node_error":
                setNodeExecutionStatus(event.nodeId, "error", undefined, event.error);
                toast.error(`Erro ao gerar: ${event.error}`);
                break;
              case "workflow_complete": {
                setExecutionState("completed");
                // Verifica se há conteúdo real antes de mostrar sucesso
                const outputs = Object.values(event.outputs);
                const hasImage = outputs.some(o => !!(o.generated_image_url as string | undefined)?.trim());
                const hasText  = outputs.some(o => !!(o.generated_text  as string | undefined)?.trim());
                if (hasImage || hasText) {
                  toast.success(hasImage ? "Imagem gerada com sucesso!" : "Copy gerado com sucesso!");
                } else {
                  toast.warning("Workflow concluído, mas nenhum conteúdo foi gerado.");
                }
                break;
              }
              case "workflow_error":
                setExecutionState("error");
                toast.error(event.error);
                break;
            }
          } catch { /* ignora evento malformado */ }
        }
      }
    } catch {
      setExecutionState("error");
      toast.error("Erro de conexão.");
    }
  };

  // Regenerar disparado pelo ResultNode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (runTrigger > 0) handleRun(); }, [runTrigger]);

  return (
    <div
      className="w-full h-full"
      style={{
        background: "#050505",
      }}
    >
      <CanvasInner onSave={handleSave} onRun={handleRun} />
    </div>
  );
}
