-- Workspace / Tarefas — múltiplos quadros por projeto

CREATE TABLE IF NOT EXISTS public.workspace_task_boards (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  color       text        NOT NULL DEFAULT '#4a8fd4'
                          CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_default  boolean     NOT NULL DEFAULT false,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_task_boards_default_owner_idx
  ON public.workspace_task_boards (user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS workspace_task_boards_owner_position_idx
  ON public.workspace_task_boards (user_id, position, created_at);

SELECT public.ensure_updated_at_trigger('workspace_task_boards');

ALTER TABLE public.workspace_task_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_task_boards_select" ON public.workspace_task_boards;
DROP POLICY IF EXISTS "workspace_task_boards_insert" ON public.workspace_task_boards;
DROP POLICY IF EXISTS "workspace_task_boards_update" ON public.workspace_task_boards;
DROP POLICY IF EXISTS "workspace_task_boards_delete" ON public.workspace_task_boards;

CREATE POLICY "workspace_task_boards_select"
ON public.workspace_task_boards FOR SELECT
USING (public.effective_owner_id() = user_id);

CREATE POLICY "workspace_task_boards_insert"
ON public.workspace_task_boards FOR INSERT
WITH CHECK (
  public.effective_owner_id() = user_id
  AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  AND created_by = auth.uid()
);

CREATE POLICY "workspace_task_boards_update"
ON public.workspace_task_boards FOR UPDATE
USING (
  public.effective_owner_id() = user_id
  AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
)
WITH CHECK (
  public.effective_owner_id() = user_id
  AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
);

CREATE POLICY "workspace_task_boards_delete"
ON public.workspace_task_boards FOR DELETE
USING (
  NOT is_default
  AND public.effective_owner_id() = user_id
  AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
);

-- Um quadro "Geral" por organização já existente.
INSERT INTO public.workspace_task_boards (user_id, created_by, name, color, is_default, position)
SELECT DISTINCT up.owner_id, up.owner_id, 'Geral', '#4a8fd4', true, 0
FROM public.user_profiles up
WHERE up.owner_id IS NOT NULL
ON CONFLICT (user_id) WHERE is_default DO NOTHING;

INSERT INTO public.workspace_task_boards (user_id, created_by, name, color, is_default, position)
SELECT DISTINCT public.owner_id_of(wt.user_id), public.owner_id_of(wt.user_id), 'Geral', '#4a8fd4', true, 0
FROM public.workspace_tasks wt
ON CONFLICT (user_id) WHERE is_default DO NOTHING;

ALTER TABLE public.workspace_tasks
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.workspace_task_boards(id) ON DELETE RESTRICT;

UPDATE public.workspace_tasks wt
SET board_id = board.id
FROM public.workspace_task_boards board
WHERE board.user_id = public.owner_id_of(wt.user_id)
  AND board.is_default
  AND wt.board_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_workspace_task_board()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_board_id uuid;
BEGIN
  v_owner_id := public.owner_id_of(NEW.user_id);

  IF NEW.board_id IS NULL THEN
    INSERT INTO public.workspace_task_boards
      (user_id, created_by, name, color, is_default, position)
    VALUES
      (v_owner_id, v_owner_id, 'Geral', '#4a8fd4', true, 0)
    ON CONFLICT (user_id) WHERE is_default DO NOTHING;

    SELECT id INTO v_board_id
    FROM public.workspace_task_boards
    WHERE user_id = v_owner_id AND is_default
    LIMIT 1;
    NEW.board_id := v_board_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_task_boards board
    WHERE board.id = NEW.board_id
      AND board.user_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'O quadro da tarefa pertence a outro workspace';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_workspace_task_board ON public.workspace_tasks;
CREATE TRIGGER trg_assign_workspace_task_board
BEFORE INSERT OR UPDATE OF user_id, board_id ON public.workspace_tasks
FOR EACH ROW EXECUTE FUNCTION public.assign_workspace_task_board();

ALTER TABLE public.workspace_tasks
  ALTER COLUMN board_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_tasks_board_status_position_idx
  ON public.workspace_tasks (board_id, status, position);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspace_task_boards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_task_boards;
  END IF;
END;
$$;
