"use client";
import { useEffect, useState } from "react";
import { useWorkspaceTaskBoards } from "@/hooks/useWorkspaceTaskBoards";
import { getSupabaseClient } from "@/lib/supabase";
import { toast } from "sonner";
export function TaskDestinationPicker({
  value,
  onChange,
  remember,
  onRememberChange,
}: {
  value: string | null | undefined;
  onChange: (id: string) => void;
  remember?: boolean;
  onRememberChange?: (v: boolean) => void;
}) {
  const { boards, isLoading, error } = useWorkspaceTaskBoards();
  const [preference, setPreference] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false),
    [preferenceError, setPreferenceError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await getSupabaseClient()
          .from("workspace_bsc_preferences")
          .select("default_board_id")
          .maybeSingle();
        if (active) {
          if (r.error) setPreferenceError(r.error.message);
          else setPreference(r.data?.default_board_id ?? null);
        }
      } catch {
        if (active)
          setPreferenceError("Não foi possível consultar o destino padrão");
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const suggested =
    boards.find((b) => b.id === preference) ?? boards.find((b) => b.is_default);
  useEffect(() => {
    if (loaded && !isLoading && !value && suggested) onChange(suggested.id);
  }, [loaded, isLoading, value, suggested, onChange]);
  return (
    <div className="space-y-3">
      <label className="block text-xs text-[var(--muted-foreground)]">
        Workspace de destino das novas tarefas
        <select
          aria-label="Workspace de destino das tarefas"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--text-title)]"
          disabled={isLoading}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {isLoading ? "Carregando workspaces…" : "Escolha um workspace"}
          </option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[var(--muted-foreground)]">
        Tarefas existentes permanecem no workspace atual. Este destino vale para
        as novas tarefas do objetivo.
      </p>
      {onRememberChange ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember ?? false}
            onChange={(e) => onRememberChange(e.target.checked)}
          />
          Usar como padrão nos próximos objetivos
        </label>
      ) : (
        <button
          type="button"
          disabled={!value || busy}
          className="text-xs underline"
          onClick={async () => {
            const board = boards.find((b) => b.id === value);
            if (!board) return;
            setBusy(true);
            try {
              const db = getSupabaseClient();
              const {
                data: { user },
              } = await db.auth.getUser();
              if (!user) throw new Error("Sessão expirada");
              const r = await db.from("workspace_bsc_preferences").upsert({
                user_id: user.id,
                workspace_owner_id: board.user_id,
                default_board_id: board.id,
              });
              if (r.error) throw new Error(r.error.message);
              setPreference(board.id);
              toast.success(
                "Destino padrão salvo para suas futuras tarefas de Objetivos",
              );
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Erro ao salvar padrão",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Salvar como destino padrão
        </button>
      )}
      {(error || preferenceError) && (
        <p role="alert" className="text-xs text-red-400">
          {error || preferenceError}
        </p>
      )}
    </div>
  );
}
