BEGIN;
CREATE TABLE public.workspace_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) > 0),
 color text NOT NULL DEFAULT '#4a8fd4' CHECK(color ~ '^#[0-9A-Fa-f]{6}$'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,name)
);
-- Copy only tags already used in Workspace; retain IDs so existing arrays stay valid.
INSERT INTO public.workspace_tags(id,user_id,name,color,created_at)
SELECT t.id,t.user_id,t.name,CASE WHEN t.color ~ '^#[0-9A-Fa-f]{6}$' THEN t.color ELSE '#4a8fd4' END,t.created_at FROM public.tags t
WHERE EXISTS (SELECT 1 FROM public.workspace_tasks w WHERE t.id::text=ANY(w.tags) AND t.user_id=public.owner_id_of(w.user_id))
OR EXISTS (SELECT 1 FROM public.workspace_objectives o WHERE t.id::text=ANY(o.tags) AND t.user_id=public.owner_id_of(o.user_id));
CREATE TRIGGER trg_auto_owner_workspace_tags BEFORE INSERT ON public.workspace_tags FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();
SELECT public.apply_standard_rls('workspace_tags');
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workspace_tags TO authenticated;

ALTER TABLE public.workspace_objectives
  ADD COLUMN horizon text NOT NULL DEFAULT 'medio' CHECK (horizon IN ('curto','medio','longo')),
  ADD COLUMN status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','em_andamento','pausado','concluido','cancelado')),
  ADD COLUMN start_date date,
  ADD COLUMN parent_id uuid REFERENCES public.workspace_objectives(id) ON DELETE SET NULL,
  ADD COLUMN assignee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT objective_dates CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);
UPDATE public.workspace_objectives SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL;
ALTER TABLE public.workspace_objectives ADD CONSTRAINT workspace_objective_title_nonempty CHECK(length(trim(title)) > 0) NOT VALID;
CREATE INDEX workspace_objectives_parent_idx ON public.workspace_objectives(parent_id);
CREATE INDEX workspace_objectives_assignees_idx ON public.workspace_objectives USING gin(assignee_ids);

CREATE OR REPLACE FUNCTION public.can_access_workspace_objective(p_objective_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM workspace_objectives o WHERE o.id=p_objective_id AND
 (o.user_id=auth.uid() OR is_admin_of_user(o.user_id) OR EXISTS
 (SELECT 1 FROM user_profiles p WHERE p.auth_user_id=auth.uid() AND p.is_active AND p.id=ANY(o.assignee_ids))));
$$;
DROP POLICY workspace_objectives_select ON public.workspace_objectives;
DROP POLICY workspace_objectives_update ON public.workspace_objectives;
CREATE POLICY workspace_objectives_select ON public.workspace_objectives FOR SELECT TO authenticated USING (
 user_id=auth.uid() OR public.is_admin_of_user(user_id) OR EXISTS
 (SELECT 1 FROM public.user_profiles p WHERE p.auth_user_id=auth.uid() AND p.is_active AND p.id=ANY(assignee_ids))
);
CREATE POLICY workspace_objectives_update ON public.workspace_objectives FOR UPDATE TO authenticated USING (public.can_access_workspace_objective(id)) WITH CHECK (public.can_access_workspace_objective(id));

CREATE FUNCTION public.validate_workspace_objective() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 -- Serialize tree changes; each subsequent query gets the committed tree under READ COMMITTED.
 PERFORM pg_advisory_xact_lock(17102026);
 IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.created_by<>OLD.created_by) THEN
   RAISE EXCEPTION 'O proprietário do objetivo não pode ser alterado';
 END IF;
 IF NEW.parent_id IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM workspace_objectives WHERE id=NEW.parent_id AND user_id=NEW.user_id) THEN
     RAISE EXCEPTION 'Objetivo pai inválido ou de outro workspace';
   END IF;
   IF EXISTS (WITH RECURSIVE ancestors AS (
     SELECT id,parent_id FROM workspace_objectives WHERE id=NEW.parent_id
     UNION SELECT o.id,o.parent_id FROM workspace_objectives o JOIN ancestors a ON o.id=a.parent_id
   ) SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE EXCEPTION 'Hierarquia cíclica não permitida'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM unnest(NEW.assignee_ids) a WHERE NOT EXISTS
   (SELECT 1 FROM user_profiles p WHERE p.id=a AND p.is_active AND p.owner_id=owner_id_of(NEW.user_id))) THEN
   RAISE EXCEPTION 'Responsável inválido para este workspace';
 END IF;
 NEW.assignee_id := NEW.assignee_ids[1];
 RETURN NEW;
END; $$;
CREATE TRIGGER zz_validate_workspace_objective BEFORE INSERT OR UPDATE ON public.workspace_objectives FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_objective();

CREATE TABLE public.workspace_objective_blocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), objective_id uuid NOT NULL REFERENCES public.workspace_objectives(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200), position integer NOT NULL DEFAULT 0,
 UNIQUE(id,objective_id)
);
CREATE TABLE public.workspace_objective_task_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), objective_id uuid NOT NULL REFERENCES public.workspace_objectives(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
 block_id uuid, UNIQUE(objective_id,task_id),
 FOREIGN KEY(block_id,objective_id) REFERENCES public.workspace_objective_blocks(id,objective_id) ON DELETE SET NULL (block_id)
);
CREATE TABLE public.workspace_objective_metrics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), objective_id uuid NOT NULL REFERENCES public.workspace_objectives(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200), unit text NOT NULL DEFAULT '',
 baseline numeric NOT NULL DEFAULT 0, target numeric NOT NULL, current_value numeric NOT NULL DEFAULT 0,
 CHECK(target <> baseline), CHECK(baseline::text NOT IN ('NaN','Infinity','-Infinity')),
 CHECK(target::text NOT IN ('NaN','Infinity','-Infinity')), CHECK(current_value::text NOT IN ('NaN','Infinity','-Infinity'))
);
CREATE INDEX objective_links_task_idx ON public.workspace_objective_task_links(task_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['workspace_objective_blocks','workspace_objective_task_links','workspace_objective_metrics'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY access ON public.%I FOR ALL TO authenticated USING (public.can_access_workspace_objective(objective_id)) WITH CHECK (public.can_access_workspace_objective(objective_id))',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE FUNCTION public.validate_objective_task_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM workspace_tasks t JOIN workspace_objectives o ON o.id=NEW.objective_id
   WHERE t.id=NEW.task_id AND owner_id_of(t.user_id)=owner_id_of(o.user_id)) THEN
   RAISE EXCEPTION 'Tarefa inválida ou indisponível neste workspace';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_objective_task_link BEFORE INSERT OR UPDATE ON public.workspace_objective_task_links FOR EACH ROW EXECUTE FUNCTION public.validate_objective_task_link();
-- Tag IDs remain in the existing arrays: no destructive conversion of legacy records.
CREATE FUNCTION public.validate_workspace_tags() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.tags IS NOT DISTINCT FROM OLD.tags THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM unnest(NEW.tags) tag_id WHERE NOT EXISTS
 (SELECT 1 FROM workspace_tags t WHERE t.id::text=tag_id AND t.user_id=owner_id_of(NEW.user_id))) THEN
   RAISE EXCEPTION 'Etiqueta inválida para este workspace';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_validate_workspace_tags BEFORE INSERT OR UPDATE OF tags ON public.workspace_tasks FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_tags();
CREATE TRIGGER zz_validate_workspace_tags BEFORE INSERT OR UPDATE OF tags ON public.workspace_objectives FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_tags();
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['workspace_objective_blocks','workspace_objective_task_links','workspace_objective_metrics','workspace_tags'] LOOP
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END LOOP;
 END IF;
END $$;
-- Preserve completed tasks supporting objectives; ordinary Kanban retention is unchanged.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('workspace-completed-task-cleanup','*/15 * * * *',
   $job$DELETE FROM public.workspace_tasks t WHERE status='concluido'
    AND COALESCE(completed_at,updated_at,created_at)<=now()-interval '24 hours'
    AND NOT EXISTS(SELECT 1 FROM public.workspace_objective_task_links l WHERE l.task_id=t.id);$job$);
 END IF;
END $$;
COMMIT;
