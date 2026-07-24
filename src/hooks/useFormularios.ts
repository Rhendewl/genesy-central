"use client";

import { useState, useEffect, useCallback } from "react";
import type { Form, FormFolder, NewForm, UpdateForm, FormStatus } from "@/types";

interface UseFormulariosReturn {
  formularios: Form[];
  folders: FormFolder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createFormulario: (data: NewForm) => Promise<{ data: Form | null; error: string | null }>;
  updateFormulario: (id: string, data: UpdateForm) => Promise<{ error: string | null }>;
  deleteFormulario: (id: string) => Promise<{ error: string | null }>;
  updateStatus: (id: string, status: FormStatus) => Promise<{ error: string | null }>;
  publicarFormulario: (id: string) => Promise<{ error: string | null; version?: number }>;
  duplicarFormulario: (id: string) => Promise<{ data: Form | null; error: string | null }>;
  moveFormulario: (id: string, folderId: string | null) => Promise<{ error: string | null }>;
  createFolder: (name: string, color: string) => Promise<{ data: FormFolder | null; error: string | null }>;
  renameFolder: (id: string, name: string, color: string) => Promise<{ error: string | null }>;
  deleteFolder: (id: string) => Promise<{ error: string | null }>;
}

export function useFormularios(): UseFormulariosReturn {
  const [formularios, setFormularios] = useState<Form[]>([]);
  const [folders, setFolders] = useState<FormFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [formsRes, foldersRes] = await Promise.all([
        fetch("/api/formularios"),
        fetch("/api/formularios/folders"),
      ]);
      if (!formsRes.ok || !foldersRes.ok) throw new Error("Erro ao carregar formulários");
      const [formsJson, foldersJson] = await Promise.all([formsRes.json(), foldersRes.json()]);
      setFormularios(formsJson.formularios ?? []);
      setFolders(foldersJson.folders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const createFormulario = useCallback(async (data: NewForm) => {
    try {
      const res = await fetch("/api/formularios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error ?? "Erro ao criar formulário" };
      await refetch();
      return { data: json.formulario as Form, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Erro ao criar formulário" };
    }
  }, [refetch]);

  const updateFormulario = useCallback(async (id: string, data: UpdateForm) => {
    try {
      const res = await fetch(`/api/formularios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao atualizar formulário" };
      await refetch();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao atualizar formulário" };
    }
  }, [refetch]);

  const deleteFormulario = useCallback(async (id: string) => {
    try {
      // Optimistic: remove da lista imediatamente
      setFormularios(prev => prev.filter(f => f.id !== id));
      const res = await fetch(`/api/formularios/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        await refetch(); // reverte
        return { error: json.error ?? "Erro ao excluir formulário" };
      }
      return { error: null };
    } catch (e) {
      await refetch();
      return { error: e instanceof Error ? e.message : "Erro ao excluir formulário" };
    }
  }, [refetch]);

  const updateStatus = useCallback(async (id: string, status: FormStatus) => {
    try {
      const res = await fetch(`/api/formularios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao atualizar status" };
      setFormularios(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao atualizar status" };
    }
  }, []);

  const publicarFormulario = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/formularios/${id}/publicar`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao publicar formulário" };
      setFormularios(prev => prev.map(f =>
        f.id === id ? { ...f, status: "published", published_at: json.published_at } : f
      ));
      return { error: null, version: json.version };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao publicar formulário" };
    }
  }, []);

  const duplicarFormulario = useCallback(async (id: string) => {
    const original = formularios.find(f => f.id === id);
    if (!original) return { data: null, error: "Formulário não encontrado" };

    return createFormulario({
      name: `${original.name} (cópia)`,
      slug: "",
      description: original.description ?? null,
      folder_id: original.folder_id,
    });
  }, [formularios, createFormulario]);

  const moveFormulario = useCallback(async (id: string, folderId: string | null) => {
    const previous = formularios.find((form) => form.id === id)?.folder_id ?? null;
    setFormularios((current) => current.map((form) => form.id === id ? { ...form, folder_id: folderId } : form));
    try {
      const res = await fetch(`/api/formularios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormularios((current) => current.map((form) => form.id === id ? { ...form, folder_id: previous } : form));
        return { error: json.error ?? "Erro ao mover formulário" };
      }
      return { error: null };
    } catch (error) {
      setFormularios((current) => current.map((form) => form.id === id ? { ...form, folder_id: previous } : form));
      return { error: error instanceof Error ? error.message : "Erro ao mover formulário" };
    }
  }, [formularios]);

  const createFolder = useCallback(async (name: string, color: string) => {
    try {
      const res = await fetch("/api/formularios/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error ?? "Erro ao criar pasta" };
      setFolders((current) => [...current, json.folder as FormFolder].sort((a, b) => a.name.localeCompare(b.name)));
      return { data: json.folder as FormFolder, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "Erro ao criar pasta" };
    }
  }, []);

  const renameFolder = useCallback(async (id: string, name: string, color: string) => {
    try {
      const res = await fetch(`/api/formularios/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao renomear pasta" };
      setFolders((current) => current.map((folder) => folder.id === id ? json.folder as FormFolder : folder));
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Erro ao renomear pasta" };
    }
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/formularios/folders/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { error: json.error ?? "Erro ao excluir pasta" };
      setFolders((current) => current.filter((folder) => folder.id !== id));
      setFormularios((current) => current.map((form) => form.folder_id === id ? { ...form, folder_id: null } : form));
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Erro ao excluir pasta" };
    }
  }, []);

  return {
    formularios,
    folders,
    isLoading,
    error,
    refetch,
    createFormulario,
    updateFormulario,
    deleteFormulario,
    updateStatus,
    publicarFormulario,
    duplicarFormulario,
    moveFormulario,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}
