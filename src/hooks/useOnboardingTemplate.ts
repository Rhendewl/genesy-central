"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OnboardingTemplateDetail, UpdateOnboardingTemplate,
  NewOnboardingTemplateStage, UpdateOnboardingTemplateStage,
  NewOnboardingTemplateTask, UpdateOnboardingTemplateTask,
} from "@/types/onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// useOnboardingTemplate — construtor de um template (etapas → tarefas →
// dependências). É uma tela de configuração de baixa
// frequência (admin montando o processo), não um board em tempo real — por
// isso cada mutação simplesmente reconsulta o detalhe completo em vez de
// cirurgia de estado otimista (mais simples e sempre correto após reordenação).
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingTemplate(templateId: string | null) {
  const [detail,    setDetail]    = useState<OnboardingTemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasDetailRef = useRef(false);

  const fetchDetail = useCallback(async () => {
    if (!templateId) return;
    const shouldShowLoading = !hasDetailRef.current;
    if (shouldShowLoading) setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}`);
      const json = await res.json() as { template?: OnboardingTemplateDetail; error?: string };
      if (!mountedRef.current) return;
      if (!res.ok || !json.template) throw new Error(json.error ?? "Erro ao carregar template");
      hasDetailRef.current = true;
      setDetail(json.template);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (mountedRef.current && shouldShowLoading) setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    mountedRef.current = true;
    hasDetailRef.current = false;
    setDetail(null);
    if (templateId) void fetchDetail();
    return () => { mountedRef.current = false; };
  }, [templateId, fetchDetail]);

  async function updateTemplate(patch: UpdateOnboardingTemplate) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function addStage(data: NewOnboardingTemplateStage) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}/stages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function updateStage(stageId: string, patch: UpdateOnboardingTemplateStage) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}/stages/${stageId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function deleteStage(stageId: string) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}/stages/${stageId}`, { method: "DELETE" });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function addTask(stageId: string, data: NewOnboardingTemplateTask) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}/stages/${stageId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function updateTask(taskId: string, patch: UpdateOnboardingTemplateTask) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function deleteTask(taskId: string) {
    if (!templateId) return { error: "Sem template" };
    const res  = await fetch(`/api/workspace/onboarding/templates/${templateId}/tasks/${taskId}`, { method: "DELETE" });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  return {
    detail, isLoading, error, refetch: fetchDetail,
    updateTemplate,
    addStage, updateStage, deleteStage,
    addTask, updateTask, deleteTask,
  };
}
