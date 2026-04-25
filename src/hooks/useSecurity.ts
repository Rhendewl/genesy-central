"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SecuritySettings {
  id: string;
  user_id: string;
  notify_new_login: boolean;
  notify_suspicious: boolean;
  require_strong_password: boolean;
  auto_logout: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecurityLog {
  id: string;
  user_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  last_seen: string;
  is_current: boolean;
}

type SettingsPatch = Partial<Pick<
  SecuritySettings,
  "notify_new_login" | "notify_suspicious" | "require_strong_password" | "auto_logout"
>>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectSession(accessToken: string | undefined): ActiveSession {
  const ua      = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser = ua.includes("Edg")     ? "Edge"
    : ua.includes("Chrome")  ? "Chrome"
    : ua.includes("Firefox") ? "Firefox"
    : ua.includes("Safari")  ? "Safari"
    : "Navegador";
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? "Mobile" : "Desktop";

  return {
    id:         accessToken?.slice(-8) ?? "current",
    device,
    browser,
    location:   "Brasil",
    last_seen:  new Date().toISOString(),
    is_current: true,
  };
}

async function writeLog(
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("security_logs").insert({
    user_id: userId,
    action,
    metadata,
  });
  if (error) console.warn("[security_logs] insert error:", error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSecurity() {
  const [settings,       setSettings]       = useState<SecuritySettings | null>(null);
  const [logs,           setLogs]           = useState<SecurityLog[]>([]);
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [lastLogin,      setLastLogin]      = useState<string | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const supabase = getSupabaseClient();

      // getUser() validates JWT server-side; getSession() gives access_token
      const [{ data: { user }, error: userErr }, { data: { session } }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (userErr || !user) {
        setLoadError("Não foi possível carregar dados do usuário.");
        return;
      }

      setLastLogin(user.last_sign_in_at ?? null);
      setCurrentSession(detectSession(session?.access_token));

      // settings — upsert garante que sempre existe uma linha
      const { data: settingsData, error: settingsErr } = await supabase
        .from("security_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsErr) throw settingsErr;

      if (settingsData) {
        setSettings(settingsData);
      } else {
        const { data: created, error: insertErr } = await supabase
          .from("security_settings")
          .insert({
            user_id:                user.id,
            notify_new_login:       true,
            notify_suspicious:      true,
            require_strong_password: true,
            auto_logout:            false,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;
        setSettings(created);
      }

      // logs
      const { data: logsData, error: logsErr } = await supabase
        .from("security_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);

      if (logsErr) throw logsErr;
      setLogs(logsData ?? []);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar segurança";
      setLoadError(msg);
      console.error("[useSecurity] fetchAll:", msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── updatePassword ─────────────────────────────────────────────────────────

  const updatePassword = useCallback(async (
    currentPassword: string,
    newPassword:     string,
  ): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) return { error: "Não autenticado" };

      // Verifica senha atual tentando re-autenticar
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    user.email!,
        password: currentPassword,
      });
      if (signInErr) return { error: "Senha atual incorreta" };

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      await writeLog(user.id, "password_changed", {
        at: new Date().toISOString(),
      });

      // Recarrega logs
      const { data: logsData } = await supabase
        .from("security_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);
      setLogs(logsData ?? []);

      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao atualizar senha" };
    }
  }, []);

  // ── updateSettings ─────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (
    patch: SettingsPatch,
  ): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) return { error: "Não autenticado" };

      const { data, error } = await supabase
        .from("security_settings")
        .update(patch)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      setSettings(data);

      await writeLog(user.id, "settings_changed", {
        changed: Object.keys(patch),
        at:      new Date().toISOString(),
      });

      // Atualiza logs na UI
      const { data: logsData } = await supabase
        .from("security_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);
      setLogs(logsData ?? []);

      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao salvar preferências" };
    }
  }, []);

  // ── signOutOtherSessions ───────────────────────────────────────────────────

  const signOutOtherSessions = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();

      // scope: 'others' encerra todas as sessões exceto a atual
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await writeLog(user.id, "sessions_terminated", {
          scope: "others",
          at:    new Date().toISOString(),
        });

        const { data: logsData } = await supabase
          .from("security_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25);
        setLogs(logsData ?? []);
      }

      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao encerrar sessões" };
    }
  }, []);

  // ── return ─────────────────────────────────────────────────────────────────

  return {
    settings,
    logs,
    currentSession,
    lastLogin,
    isLoading,
    loadError,
    updatePassword,
    updateSettings,
    signOutOtherSessions,
    refetch: fetchAll,
  };
}
