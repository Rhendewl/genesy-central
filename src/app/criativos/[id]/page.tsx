"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { useGlobalStore } from "@/store";
import { CreativeCanvas } from "@/components/criativos/canvas/CreativeCanvas";
import type { WorkflowJSON } from "@/lib/workflow/types";

interface ProjectData {
  id: string;
  nome: string;
  workflow_json: WorkflowJSON | null;
}

export default function CanvasEditorPage() {
  const params = useParams<{ id: string }>();
  const setCanvasMode = useGlobalStore((s) => s.setCanvasMode);

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enter canvas mode — hides the Dock
  useEffect(() => {
    setCanvasMode(true);
    return () => setCanvasMode(false);
  }, [setCanvasMode]);

  // Load project
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/criativos/projetos/${params.id}`);
        if (!res.ok) throw new Error("Projeto não encontrado");
        const data = await res.json();
        setProject(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar projeto");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleSaveWorkflow = async (json: WorkflowJSON) => {
    await fetch(`/api/criativos/projetos/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_json: json }),
    });
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: "#060608" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: "#060608" }}>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          {error ?? "Projeto não encontrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-dvh overflow-hidden">
      <ReactFlowProvider>
        <CreativeCanvas
          projectId={project.id}
          projectName={project.nome}
          initialWorkflow={project.workflow_json}
          onSaveWorkflow={handleSaveWorkflow}
        />
      </ReactFlowProvider>
    </div>
  );
}
