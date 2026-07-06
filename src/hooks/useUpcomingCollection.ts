"use client";

import { useEffect, useState } from "react";
import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { getSupabaseClient } from "@/lib/supabase";
import type { Collection } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// useUpcomingCollection — a próxima cobrança a vencer (não em atraso).
// Reaproveita a mesma tabela/join já usados por useInadimplencia.ts, só com o
// filtro invertido: aqui queremos due_date >= hoje, não < hoje.
// ─────────────────────────────────────────────────────────────────────────────

export interface UpcomingCollection {
  clientName: string;
  dueInDays:  number;
}

export function useUpcomingCollection() {
  const [collection, setCollection] = useState<UpcomingCollection | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      const todayStr = new Date().toISOString().slice(0, 10);

      const { data } = await supabase
        .from("collections")
        .select("*, client:agency_clients(id, name)")
        .not("status", "in", '("pago","perdido")')
        .gte("due_date", todayStr)
        .order("due_date", { ascending: true })
        .limit(1);

      if (cancelled) return;

      const row = (data ?? [])[0] as Collection | undefined;
      if (row?.client?.name) {
        const dueInDays = differenceInDays(startOfDay(parseISO(row.due_date)), startOfDay(new Date()));
        setCollection({ clientName: row.client.name, dueInDays });
      } else {
        setCollection(null);
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { collection, isLoading };
}
