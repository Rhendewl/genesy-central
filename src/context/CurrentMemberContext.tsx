"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { deferAuthStateWork } from "@/lib/auth/defer-auth-state-work";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberProfile {
  id: string;
  owner_id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: string;
  job_title: string | null;
  crm_pipeline_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
  permissions: string[];
  theme: "dark" | "light";
}

interface CurrentMemberContextValue {
  member: MemberProfile | null; // linha de user_profiles do usuário logado (dono ou convidado)
  isOwner: boolean | null;      // null → ainda carregando
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const CurrentMemberContext = createContext<CurrentMemberContextValue>({
  member: null,
  isOwner: null,
  isLoading: true,
  refetch: async () => {},
});

export function CurrentMemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (background = false) => {
    const requestId = ++loadRequestRef.current;
    if (!background || !hasLoadedRef.current) setIsLoading(true);

    const supabase = getSupabaseClient();

    // Redes móveis frequentemente oscilam justamente quando um PWA volta do
    // segundo plano. Tentativas curtas evitam transformar essa oscilação em
    // "perfil ausente" e, principalmente, preservam o último estado válido.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        // No browser, getSession lê a sessão persistida e a renova quando
        // necessário. Autorização real continua protegida por RLS/API server.
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (requestId !== loadRequestRef.current) return;

        if (!session) {
          setMember(null);
          setIsOwner(null);
          hasLoadedRef.current = true;
          setIsLoading(false);
          return;
        }

        // Desde a migration 20260719_owner_self_profile, todo usuário tem uma
        // linha em user_profiles. RLS limita esta leitura ao perfil permitido.
        const { data: profiles, error: profileError } = await supabase
          .from("user_profiles")
          .select(
            "id, owner_id, auth_user_id, full_name, email, role, job_title, crm_pipeline_id, is_active, avatar_url, permissions, theme"
          )
          .eq("auth_user_id", session.user.id);

        if (profileError) throw profileError;
        if (requestId !== loadRequestRef.current) return;

        // Prefere o perfil de membro a uma eventual linha self legada.
        const activeProfiles = (profiles ?? []).filter(profile => profile.is_active);
        const data = activeProfiles.find(profile => profile.owner_id !== session.user.id)
          ?? activeProfiles[0]
          ?? null;

        if (data) {
          setMember({
            ...data,
            permissions: Array.isArray(data.permissions) ? data.permissions : [],
          });
          setIsOwner(data.auth_user_id === data.owner_id);
        } else {
          // Ausência de perfil nunca concede privilégios de owner.
          setMember(null);
          setIsOwner(false);
        }

        hasLoadedRef.current = true;
        setIsLoading(false);
        return;
      } catch {
        if (attempt < 2) {
          await new Promise(resolve => window.setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }

        // Não apaga member/isOwner em erro transitório. Assim uma renovação de
        // token ou troca momentânea de rede não esvazia menus e dashboards.
        if (requestId === loadRequestRef.current) setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let scheduledLoad: number | null = null;

    const scheduleLoad = (background: boolean) => {
      if (scheduledLoad) window.clearTimeout(scheduledLoad);
      // Supabase não permite iniciar outra chamada assíncrona dentro do
      // callback de onAuthStateChange: isso pode bloquear o cliente inteiro.
      // O próximo macrotask executa a consulta depois que o callback liberou
      // o lock interno de autenticação.
      scheduledLoad = deferAuthStateWork(() => {
        scheduledLoad = null;
        if (!disposed) void load(background);
      });
    };

    void load();

    // Atualiza quando a sessão muda (login/logout)
    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        loadRequestRef.current += 1;
        hasLoadedRef.current = true;
        setMember(null);
        setIsOwner(null);
        setIsLoading(false);
        return;
      }

      // A carga inicial acima já cobre INITIAL_SESSION. Renovações acontecem
      // em background para não esconder uma interface que já estava válida.
      if (event !== "INITIAL_SESSION") {
        scheduleLoad(event === "TOKEN_REFRESHED");
      }
    });

    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") scheduleLoad(true);
    };
    const recoverWhenOnline = () => scheduleLoad(true);
    document.addEventListener("visibilitychange", recoverWhenVisible);
    window.addEventListener("online", recoverWhenOnline);

    return () => {
      disposed = true;
      if (scheduledLoad) window.clearTimeout(scheduledLoad);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", recoverWhenVisible);
      window.removeEventListener("online", recoverWhenOnline);
    };
  }, [load]);

  const refetch = useCallback(async () => {
    await load(false);
  }, [load]);

  return (
    <CurrentMemberContext.Provider value={{ member, isOwner, isLoading, refetch }}>
      {children}
    </CurrentMemberContext.Provider>
  );
}

export function useCurrentMember() {
  return useContext(CurrentMemberContext);
}
