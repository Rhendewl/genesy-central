"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { CriativoJob, CriativoResultado } from "@/types";

interface UseCriativoJobReturn {
  job: CriativoJob | null;
  resultados: CriativoResultado[];
  isLoading: boolean;
}

export function useCriativoJob(jobId: string | null): UseCriativoJobReturn {
  const [job, setJob] = useState<CriativoJob | null>(null);
  const [resultados, setResultados] = useState<CriativoResultado[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("criativo_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (data) setJob(data as CriativoJob);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  const fetchResultados = useCallback(async () => {
    if (!jobId) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("criativo_resultados")
      .select("*")
      .eq("job_id", jobId)
      .order("variacao", { ascending: true });
    if (data) setResultados(data as CriativoResultado[]);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    fetchJob();
    fetchResultados();

    const supabase = getSupabaseClient();

    const jobChannel = supabase
      .channel(`criativo_job_${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "criativo_jobs", filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as CriativoJob)
      )
      .subscribe();

    const resultadosChannel = supabase
      .channel(`criativo_resultados_${jobId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "criativo_resultados", filter: `job_id=eq.${jobId}` },
        (payload) => setResultados(prev => [...prev, payload.new as CriativoResultado])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(resultadosChannel);
    };
  }, [jobId, fetchJob, fetchResultados]);

  return { job, resultados, isLoading };
}
