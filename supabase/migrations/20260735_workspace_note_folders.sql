-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — Pastas de Notas
--
-- Agrupa workspace_notes em pastas (por tipo de nota ou por cliente). Uma
-- pasta pode opcionalmente estar vinculada a um cliente real (agency_clients)
-- — não é obrigatório, então dá pra ter pastas por tipo (sem cliente) e
-- pastas de cliente (com cliente) lado a lado. Mesmo padrão de ownership
-- compartilhado, RLS e realtime já usado em workspace_notes (20260713).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_note_folders (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  uuid        NOT NULL REFERENCES auth.users(id),
  name        text        NOT NULL,
  color       text,
  tags        text[]      NOT NULL DEFAULT '{}',
  client_id   uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_note_folders_user_idx
  ON public.workspace_note_folders (user_id, order_index);

SELECT public.ensure_updated_at_trigger('workspace_note_folders');


-- Pasta excluída não apaga as notas — ON DELETE SET NULL move pra "sem pasta".
ALTER TABLE public.workspace_notes
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.workspace_note_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workspace_notes_folder_idx
  ON public.workspace_notes (user_id, folder_id);


-- ── Ownership trigger + RLS (mesmo padrão de 20260713) ────────────────────────

DROP TRIGGER IF EXISTS trg_auto_owner_workspace_note_folders ON public.workspace_note_folders;
CREATE TRIGGER trg_auto_owner_workspace_note_folders
  BEFORE INSERT ON public.workspace_note_folders
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.apply_standard_rls('workspace_note_folders');


-- ── Realtime ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_note_folders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
