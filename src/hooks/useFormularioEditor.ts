"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Form, UpdateForm, FormStep, LogicRule, FormWelcomeScreen, FormEnding, FormTheme, FormSettings } from "@/types";

interface UseFormularioEditorReturn {
  form: Form | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  updateSteps: (steps: FormStep[]) => void;
  updateLogic: (rules: LogicRule[]) => void;
  updateWelcome: (welcome: FormWelcomeScreen) => void;
  updateEndings: (endings: FormEnding[]) => void;
  updateTheme: (theme: Partial<FormTheme>) => void;
  updateSettings: (settings: Partial<FormSettings>) => void;
  updateMeta: (data: Pick<UpdateForm, "name" | "description" | "slug">) => void;
  save: () => Promise<void>;
}

export function useFormularioEditor(formId: string): UseFormularioEditorReturn {
  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const pendingRef = useRef<Partial<UpdateForm>>({});

  // Carrega o formulário
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetch(`/api/formularios/${formId}`)
      .then(r => r.json())
      .then(json => {
        if (mounted && json.formulario) {
          setForm(json.formulario);
        }
      })
      .catch(() => toast.error("Erro ao carregar formulário"))
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [formId]);

  // Acumula mudanças pendentes e marca como dirty
  const stage = useCallback((patch: Partial<UpdateForm>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    setForm(prev => prev ? { ...prev, ...patch } as Form : prev);
    setIsDirty(true);
  }, []);

  const updateSteps    = useCallback((steps: FormStep[])              => stage({ steps }),        [stage]);
  const updateLogic    = useCallback((logic_rules: LogicRule[])       => stage({ logic_rules }),  [stage]);
  const updateWelcome  = useCallback((welcome_screen: FormWelcomeScreen) => stage({ welcome_screen }), [stage]);
  const updateEndings  = useCallback((endings: FormEnding[])          => stage({ endings }),      [stage]);
  const updateTheme    = useCallback((t: Partial<FormTheme>) => {
    setForm(prev => {
      if (!prev) return prev;
      const merged = { ...prev.theme, ...t };
      pendingRef.current = { ...pendingRef.current, theme: merged };
      setIsDirty(true);
      return { ...prev, theme: merged };
    });
  }, []);
  const updateSettings = useCallback((s: Partial<FormSettings>) => {
    setForm(prev => {
      if (!prev) return prev;
      const merged = { ...prev.settings, ...s };
      pendingRef.current = { ...pendingRef.current, settings: merged };
      setIsDirty(true);
      return { ...prev, settings: merged };
    });
  }, []);
  const updateMeta = useCallback((data: Pick<UpdateForm, "name" | "description" | "slug">) => stage(data), [stage]);

  // Salva todas as mudanças acumuladas.
  // Snapshot antes do await: mutações que chegam durante a requisição
  // são preservadas em pendingRef e enviadas no próximo save.
  const save = useCallback(async () => {
    if (Object.keys(pendingRef.current).length === 0) return;
    const toSend = { ...pendingRef.current };
    pendingRef.current = {}; // limpa antes do await — nova chamada concorrente vê objeto vazio e retorna
    setIsSaving(true);
    try {
      const res = await fetch(`/api/formularios/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSend),
      });
      const json = await res.json();
      if (!res.ok) {
        // Restaura: layers toSend sob mutações que chegaram durante o await
        pendingRef.current = { ...toSend, ...pendingRef.current };
        toast.error("Erro ao salvar", { description: json.error });
        return;
      }
      if (Object.keys(pendingRef.current).length === 0) setIsDirty(false);
    } catch {
      pendingRef.current = { ...toSend, ...pendingRef.current };
      toast.error("Erro ao salvar formulário");
    } finally {
      setIsSaving(false);
    }
  }, [formId]);

  return { form, isLoading, isSaving, isDirty, updateSteps, updateLogic, updateWelcome, updateEndings, updateTheme, updateSettings, updateMeta, save };
}
