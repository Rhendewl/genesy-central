"use client";

import { useState, useEffect, useCallback } from "react";
import type { Portal, NewPortal, UpdatePortal } from "@/types";

interface UsePortaisReturn {
  portals: Portal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createPortal: (data: NewPortal) => Promise<{ error: string | null }>;
  updatePortal: (id: string, data: UpdatePortal) => Promise<{ error: string | null }>;
  deletePortal: (id: string) => Promise<{ error: string | null }>;
  toggleStatus: (id: string, status: "ativo" | "pausado") => Promise<{ error: string | null }>;
}

export function usePortais(): UsePortaisReturn {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/portais");
      if (!res.ok) throw new Error("Erro ao carregar portais");
      const json = await res.json();
      setPortals(json.portals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const createPortal = useCallback(async (data: NewPortal) => {
    try {
      const res = await fetch("/api/portais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao criar portal" };
      await refetch();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao criar portal" };
    }
  }, [refetch]);

  const updatePortal = useCallback(async (id: string, data: UpdatePortal) => {
    try {
      const res = await fetch(`/api/portais/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao atualizar portal" };
      await refetch();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao atualizar portal" };
    }
  }, [refetch]);

  const deletePortal = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/portais/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao excluir portal" };
      setPortals(prev => prev.filter(p => p.id !== id));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao excluir portal" };
    }
  }, []);

  const toggleStatus = useCallback(async (id: string, status: "ativo" | "pausado") => {
    try {
      const res = await fetch(`/api/portais/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Erro ao alterar status" };
      setPortals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao alterar status" };
    }
  }, []);

  return { portals, isLoading, error, refetch, createPortal, updatePortal, deletePortal, toggleStatus };
}
