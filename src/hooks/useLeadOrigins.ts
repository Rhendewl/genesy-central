"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { LeadOrigin, NewLeadOrigin } from "@/types";

let cache: LeadOrigin[] | null = null;
let pending: Promise<LeadOrigin[]> | null = null;
const listeners = new Set<(origins: LeadOrigin[]) => void>();

function publish(origins: LeadOrigin[]) {
  cache = origins;
  listeners.forEach(listener => listener(origins));
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 72) || "origem";
}

export function useLeadOrigins() {
  const supabase = getSupabaseClient();
  const mounted = useRef(true);
  const [origins, setOrigins] = useState<LeadOrigin[]>(cache ?? []);
  const [isLoading, setIsLoading] = useState(cache === null);

  const refetch = useCallback(async () => {
    if (!pending) {
      pending = new Promise<LeadOrigin[]>(resolve => {
        supabase.from("crm_lead_origins").select("*").order("name").then(({ data }) => {
          const next = (data as LeadOrigin[]) ?? [];
          publish(next);
          pending = null;
          resolve(next);
        });
      });
    }
    const next = await pending;
    if (mounted.current) { setOrigins(next); setIsLoading(false); }
    return next;
  }, [supabase]);

  useEffect(() => {
    mounted.current = true;
    const listener = (next: LeadOrigin[]) => mounted.current && setOrigins(next);
    listeners.add(listener);
    if (cache) { setOrigins(cache); setIsLoading(false); } else void refetch();
    return () => { mounted.current = false; listeners.delete(listener); };
  }, [refetch]);

  async function createOrigin(input: NewLeadOrigin) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { origin: null, error: "Não autenticado." };
    const name = input.name.trim().slice(0, 60);
    const { data, error } = await supabase.from("crm_lead_origins").insert({
      user_id: user.id, name, slug: slugify(name), color: input.color,
    }).select("*").single();
    if (error) return { origin: null, error: error.code === "23505" ? "Já existe uma origem com esse nome." : error.message };
    cache = null;
    const next = await refetch();
    return { origin: next.find(item => item.id === data.id) ?? data as LeadOrigin, error: null };
  }

  async function deleteOrigin(id: string) {
    const { error } = await supabase.from("crm_lead_origins").delete().eq("id", id);
    if (error) return { error: error.message };
    cache = null;
    await refetch();
    return { error: null };
  }

  return { origins, isLoading, createOrigin, deleteOrigin, refetch };
}
