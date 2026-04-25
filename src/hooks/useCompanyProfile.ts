"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  trade_name: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  timezone: string;
  currency: string;
  language: string;
  date_format: string;
  created_at: string;
  updated_at: string;
}

export type CompanyProfilePayload = Omit<CompanyProfile, "id" | "user_id" | "created_at" | "updated_at">;

const DEFAULTS: CompanyProfilePayload = {
  company_name: null,
  trade_name: null,
  logo_url: null,
  website: null,
  description: null,
  cnpj: null,
  email: null,
  phone: null,
  whatsapp: null,
  address: null,
  city: null,
  state: null,
  zip_code: null,
  country: "Brasil",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  language: "pt-BR",
  date_format: "DD/MM/YYYY",
};

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data, error: err } = await supabase
        .from("company_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (err) throw err;
      setProfile(data ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar perfil");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(
    async (payload: CompanyProfilePayload): Promise<{ error: string | null }> => {
      try {
        setIsSaving(true);
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { data, error: err } = await supabase
          .from("company_profile")
          .upsert({ ...payload, user_id: user.id }, { onConflict: "user_id" })
          .select()
          .single();

        if (err) throw err;
        setProfile(data);
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao salvar perfil" };
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<{ url: string | null; error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { url: null, error: "Não autenticado" };

        const ext = file.name.split(".").pop() ?? "png";
        const path = `${user.id}/logo.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("company-logos")
          .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("company-logos")
          .getPublicUrl(path);

        return { url: urlData.publicUrl, error: null };
      } catch (e: unknown) {
        return { url: null, error: e instanceof Error ? e.message : "Erro ao enviar logo" };
      }
    },
    []
  );

  const uploadAndSaveLogo = useCallback(
    async (file: File): Promise<{ url: string | null; error: string | null }> => {
      const { url, error: uploadError } = await uploadLogo(file);
      if (uploadError || !url) return { url: null, error: uploadError };

      // Immediately persist logo_url so it survives page refresh
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { url, error: null };

      await supabase
        .from("company_profile")
        .upsert({ logo_url: url, user_id: user.id }, { onConflict: "user_id" })
        .select()
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });

      return { url, error: null };
    },
    [uploadLogo]
  );

  return {
    profile,
    isLoading,
    isSaving,
    error,
    defaults: DEFAULTS,
    save,
    uploadLogo,
    uploadAndSaveLogo,
    refetch: fetch,
  };
}
