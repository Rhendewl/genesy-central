"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  CriativoProjeto,
  NewCriativoProjeto,
  UpdateCriativoProjeto,
  CriativoAsset,
  CriativoResultado,
} from "@/types";

interface UseProjetosCriativosReturn {
  projetos: CriativoProjeto[];
  isLoading: boolean;
  error: string | null;
  createProjeto: (data: NewCriativoProjeto) => Promise<{ data: CriativoProjeto | null; error: string | null }>;
  updateProjeto: (id: string, data: UpdateCriativoProjeto) => Promise<{ error: string | null }>;
  deleteProjeto: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

interface UseProjetoAssetsReturn {
  assets: CriativoAsset[];
  isLoading: boolean;
  deleteAsset: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

interface UseProjetoResultadosReturn {
  resultados: CriativoResultado[];
  isLoading: boolean;
  toggleFavorito: (id: string, favorito: boolean) => Promise<{ error: string | null }>;
  setAvaliacao: (id: string, avaliacao: number) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useProjetosCriativos(): UseProjetosCriativosReturn {
  const [projetos, setProjetos] = useState<CriativoProjeto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      const { data, error: err } = await supabase
        .from("criativo_projetos")
        .select("*, agency_clients(name)")
        .order("created_at", { ascending: false });

      if (err) throw err;
      setProjetos((data ?? []) as CriativoProjeto[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar projetos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createProjeto = useCallback(
    async (data: NewCriativoProjeto): Promise<{ data: CriativoProjeto | null; error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: "Não autenticado" };

        const { data: created, error: err } = await supabase
          .from("criativo_projetos")
          .insert({ ...data, user_id: user.id })
          .select()
          .single();

        if (err) throw err;
        await fetch();
        return { data: created as CriativoProjeto, error: null };
      } catch (e: unknown) {
        return { data: null, error: e instanceof Error ? e.message : "Erro ao criar projeto" };
      }
    },
    [fetch]
  );

  const updateProjeto = useCallback(
    async (id: string, data: UpdateCriativoProjeto): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("criativo_projetos")
          .update(data)
          .eq("id", id);
        if (err) throw err;
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao atualizar projeto" };
      }
    },
    [fetch]
  );

  const deleteProjeto = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("criativo_projetos")
          .delete()
          .eq("id", id);
        if (err) throw err;
        setProjetos(prev => prev.filter(p => p.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir projeto" };
      }
    },
    []
  );

  return { projetos, isLoading, error, createProjeto, updateProjeto, deleteProjeto, refetch: fetch };
}

export function useProjetoAssets(projetoId: string): UseProjetoAssetsReturn {
  const [assets, setAssets] = useState<CriativoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!projetoId) return;
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from("criativo_assets")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: true });
      if (err) throw err;
      setAssets((data ?? []) as CriativoAsset[]);
    } finally {
      setIsLoading(false);
    }
  }, [projetoId]);

  useEffect(() => { fetch(); }, [fetch]);

  const deleteAsset = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const asset = assets.find(a => a.id === id);
        if (asset?.storage_path) {
          await supabase.storage.from("criativos").remove([asset.storage_path]);
        }
        const { error: err } = await supabase.from("criativo_assets").delete().eq("id", id);
        if (err) throw err;
        setAssets(prev => prev.filter(a => a.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao remover asset" };
      }
    },
    [assets]
  );

  return { assets, isLoading, deleteAsset, refetch: fetch };
}

export function useProjetoResultados(projetoId: string): UseProjetoResultadosReturn {
  const [resultados, setResultados] = useState<CriativoResultado[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!projetoId) return;
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from("criativo_resultados")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("variacao", { ascending: true });
      if (err) throw err;
      setResultados((data ?? []) as CriativoResultado[]);
    } finally {
      setIsLoading(false);
    }
  }, [projetoId]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleFavorito = useCallback(
    async (id: string, favorito: boolean): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("criativo_resultados")
          .update({ favorito })
          .eq("id", id);
        if (err) throw err;
        setResultados(prev => prev.map(r => r.id === id ? { ...r, favorito } : r));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao atualizar favorito" };
      }
    },
    []
  );

  const setAvaliacao = useCallback(
    async (id: string, avaliacao: number): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("criativo_resultados")
          .update({ avaliacao })
          .eq("id", id);
        if (err) throw err;
        setResultados(prev => prev.map(r => r.id === id ? { ...r, avaliacao } : r));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao avaliar criativo" };
      }
    },
    []
  );

  return { resultados, isLoading, toggleFavorito, setAvaliacao, refetch: fetch };
}
