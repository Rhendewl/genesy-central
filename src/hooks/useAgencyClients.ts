"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {CLIENTS_CHANGED,notifyClientsChanged,clientError} from "@/lib/client-events";
import { getSupabaseClient } from "@/lib/supabase";
import type { AgencyClient, NewAgencyClient, UpdateAgencyClient } from "@/types";

interface UseAgencyClientsReturn {
  clients: AgencyClient[];
  assignableClients: AgencyClient[];
  isLoading: boolean;
  error: string | null;
  createClient: (data: NewAgencyClient) => Promise<{ error: string | null; id?: string }>;
  updateClient: (id: string, data: UpdateAgencyClient) => Promise<{ error: string | null }>;
  deleteClient: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useAgencyClients(): UseAgencyClientsReturn {
  const revision=useRef(0);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (quiet=false) => {
    const request=++revision.current;
    try {
      if(!quiet)setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from("agency_clients")
        .select("*")
        .order("name");
      if (err) throw err;
      if(request===revision.current)setClients(data ?? []);
    } catch (e: unknown) {
      if(request===revision.current)setError(clientError(e,"Erro ao buscar clientes"));
    } finally {
      if(request===revision.current)setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    const refresh=(event:Event)=>{const {id,kind}=(event as CustomEvent).detail;revision.current++;if(kind==='deleted')setClients(rows=>rows.filter(c=>c.id!==id));void fetch(true);};
    window.addEventListener(CLIENTS_CHANGED,refresh);
    const requests=revision; // Stable counter object; invalidate pending requests on cleanup.
    return ()=>{requests.current++;window.removeEventListener(CLIENTS_CHANGED,refresh);};
  }, [fetch]);

  const createClient = useCallback(
    async (data: NewAgencyClient): Promise<{ error: string | null; id?: string }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("[useAgencyClients] createClient: usuário não autenticado");
          return { error: "Não autenticado" };
        }

        const payload = { ...data, user_id: user.id };
        console.log("[useAgencyClients] createClient payload:", payload);

        const { data: inserted, error: err } = await supabase
          .from("agency_clients")
          .insert(payload)
          .select()
          .single();

        if (err) {
          console.error("[useAgencyClients] createClient Supabase error:", err);
          throw err;
        }

        console.log("[useAgencyClients] createClient sucesso:", inserted);
        await fetch();
        if(inserted?.id)notifyClientsChanged(inserted.id,'created');
        return { error: null, id: inserted?.id };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao criar cliente";
        console.error("[useAgencyClients] createClient exception:", e);
        return { error: msg };
      }
    },
    [fetch]
  );

  const updateClient = useCallback(
    async (id: string, data: UpdateAgencyClient): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data:changed,error: err } = await supabase
          .from("agency_clients")
          .update(data)
          .eq("id", id).select("id");
        if (err) throw err;

        if(!changed?.length)throw new Error("Cliente não encontrado ou sem permissão para atualizar");
        revision.current++;
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
        notifyClientsChanged(id,'updated');
        return { error: null };
      } catch (e: unknown) {
        return { error: clientError(e,"Erro ao atualizar cliente") };
      }
    },
    []
  );

  const deleteClient = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data:removed,error: err } = await supabase
          .from("agency_clients")
          .delete()
          .eq("id", id).select("id");
        if (err) throw err;

        if(!removed?.length)throw new Error("Cliente não encontrado ou sem permissão para excluir");
        revision.current++;
        setClients((prev) => prev.filter((c) => c.id !== id));
        notifyClientsChanged(id,'deleted');
        return { error: null };
      } catch (e: unknown) {
        return { error: clientError(e,"Erro ao excluir cliente") };
      }
    },
    []
  );

  const assignableClients = useMemo(
    () => clients.filter((client) => client.status !== "churned"),
    [clients]
  );

  return { clients, assignableClients, isLoading, error, createClient, updateClient, deleteClient, refetch: fetch };
}
