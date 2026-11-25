"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { EsteiraSnapshot } from "@/types/esteira";

// ─────────────────────────────────────────────────────────────────────────────
// useEsteira
//
//  - Carrega a esteira pelo GET /api/esteira (owner/admin).
//  - Realtime: qualquer mudança em itens, eventos ou aprendizados (gravada
//    pelos agentes ou por outra pessoa no painel) dispara um novo carregamento,
//    agrupado em 250 ms para não recarregar a cada linha.
//  - "agora" avança a cada 30 s para os tempos relativos ("há 4 min").
// ─────────────────────────────────────────────────────────────────────────────

const VAZIO: EsteiraSnapshot = { itens: [], eventos: [], aprendizados: [] };

export function useEsteira(enabled: boolean) {
  const [data, setData] = useState<EsteiraSnapshot>(VAZIO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    try {
      const res = await fetch("/api/esteira", { cache: "no-store" });
      const json = (await res.json()) as Partial<EsteiraSnapshot> & { error?: string };
      if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
      if (!res.ok) { setError(json.error ?? "Não foi possível carregar a esteira."); return; }
      setError(null);
      setData({ itens: json.itens ?? [], eventos: json.eventos ?? [], aprendizados: json.aprendizados ?? [] });
    } catch {
      if (mountedRef.current && fetchId === fetchIdRef.current) setError("Sem conexão com a plataforma.");
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) setIsLoading(false);
    }
  }, []);

  const agendarRecarga = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; void carregar(); }, 250);
  }, [carregar]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return () => { mountedRef.current = false; };
    void carregar();
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`esteira-ia-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "esteira_itens" }, agendarRecarga)
      .on("postgres_changes", { event: "*", schema: "public", table: "esteira_eventos" }, agendarRecarga)
      .on("postgres_changes", { event: "*", schema: "public", table: "esteira_aprendizados" }, agendarRecarga)
      .subscribe((status) => {
        if (!mountedRef.current) return;
        setConectado(status === "SUBSCRIBED");
        // Ao reconectar, busca de novo o que pode ter mudado no intervalo.
        if (status === "SUBSCRIBED") agendarRecarga();
      });
    const relogio = setInterval(() => setAgora(Date.now()), 30_000);
    // Rede de segurança caso o Realtime caia sem avisar.
    const reserva = setInterval(() => { if (document.visibilityState === "visible") void carregar(); }, 60_000);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(relogio);
      clearInterval(reserva);
      supabase.removeChannel(channel);
    };
  }, [enabled, carregar, agendarRecarga]);

  const decidirItem = useCallback(async (id: string, decisao: "aprovado" | "ajuste", nota?: string) => {
    const res = await fetch(`/api/esteira/itens/${id}/decisao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisao, nota: nota ?? null }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    await carregar();
    if (!res.ok) throw new Error(json.error ?? "Não foi possível registrar a decisão.");
  }, [carregar]);

  const decidirProposta = useCallback(async (id: string, decisao: "aceita" | "descartada") => {
    const res = await fetch(`/api/esteira/aprendizados/${id}/decisao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisao }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    await carregar();
    if (!res.ok) throw new Error(json.error ?? "Não foi possível registrar a decisão.");
  }, [carregar]);

  return { ...data, isLoading, error, conectado, agora, recarregar: carregar, decidirItem, decidirProposta };
}
