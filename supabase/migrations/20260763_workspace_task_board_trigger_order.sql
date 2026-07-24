-- Workspace / Tarefas — torna a associação ao quadro independente da ordem
-- dos triggers BEFORE INSERT.
--
-- PostgreSQL executa triggers do mesmo tipo em ordem alfabética. O trigger
-- trg_assign_workspace_task_board podia executar antes de
-- trg_auto_owner_workspace_tasks e receber NEW.user_id ainda nulo.

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
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

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
