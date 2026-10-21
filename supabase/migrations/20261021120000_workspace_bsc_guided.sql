BEGIN;
-- One logical BSC objective has four independently measurable perspectives.
-- Legacy objectives remain unchanged and can still be edited individually.
ALTER TABLE public.workspace_objectives ADD COLUMN bsc_group_id uuid;
CREATE UNIQUE INDEX workspace_objectives_bsc_group_area ON public.workspace_objectives(bsc_group_id,perspective) WHERE bsc_group_id IS NOT NULL;

CREATE FUNCTION public.create_workspace_bsc(p_group_id uuid, p_owner_id uuid, p_draft jsonb)
RETURNS SETOF public.workspace_objectives
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
 a jsonb; t text; person uuid; task_id uuid; objective_id uuid;
 people uuid[]; tag_ids text[]; area_ids text[];
BEGIN
 IF auth.uid() IS NULL OR p_group_id IS NULL OR p_owner_id IS NULL THEN RAISE EXCEPTION 'Sessão ou identificador inválido'; END IF;
 IF p_owner_id <> auth.uid() AND NOT public.is_admin_of_user(p_owner_id) THEN RAISE EXCEPTION 'Workspace indisponível'; END IF;
 -- Serialize retries of the same submission, without bypassing any RLS policy.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_group_id::text,0));
 IF EXISTS(SELECT 1 FROM workspace_objectives WHERE bsc_group_id=p_group_id) THEN
   IF (SELECT count(*) FROM workspace_objectives WHERE bsc_group_id=p_group_id AND user_id=p_owner_id AND created_by=auth.uid()) <> 4 THEN RAISE EXCEPTION 'Cadastro já utilizado ou incompleto'; END IF;
   RETURN QUERY SELECT * FROM workspace_objectives WHERE bsc_group_id=p_group_id AND user_id=p_owner_id;
   RETURN;
 END IF;
 IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR jsonb_typeof(p_draft->'areas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Cadastro inválido'; END IF;
 IF length(trim(coalesce(p_draft->>'title',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
 SELECT array_agg(DISTINCT x->>'perspective' ORDER BY x->>'perspective') INTO area_ids FROM jsonb_array_elements(p_draft->'areas') x;
 IF jsonb_array_length(p_draft->'areas')<>4 OR area_ids IS DISTINCT FROM ARRAY['aprendizado','clientes','financeira','processos'] THEN RAISE EXCEPTION 'Preencha as quatro áreas do BSC'; END IF;
 tag_ids := ARRAY(SELECT jsonb_array_elements_text(p_draft->'tags'));
 FOR a IN SELECT value FROM jsonb_array_elements(p_draft->'areas') LOOP
   people := ARRAY(SELECT jsonb_array_elements_text(a->'assignee_ids'))::uuid[];
   IF length(coalesce(a->>'description',''))>10000 OR length(trim(coalesce(a->>'unit',''))) NOT BETWEEN 1 AND 50 OR length(coalesce(a->>'tasks',''))>20000 THEN RAISE EXCEPTION 'Informações da área inválidas'; END IF;
   INSERT INTO workspace_objectives(user_id,created_by,title,description,perspective,bsc_group_id,horizon,priority,start_date,due_date,assignee_ids,tags)
   VALUES(p_owner_id,auth.uid(),trim(p_draft->>'title'),a->>'description',a->>'perspective',p_group_id,p_draft->>'horizon',p_draft->>'priority',nullif(p_draft->>'start_date','')::date,nullif(p_draft->>'due_date','')::date,people,tag_ids) RETURNING id INTO objective_id;
   INSERT INTO workspace_objective_metrics(objective_id,title,unit,baseline,target,current_value)
   VALUES(objective_id,trim(a->>'indicator'),a->>'unit',(a->>'baseline')::numeric,(a->>'target')::numeric,(a->>'current_value')::numeric);
   IF cardinality(string_to_array(a->>'tasks',E'\n'))>30 THEN RAISE EXCEPTION 'Máximo de 30 tarefas por área'; END IF;
   FOR t IN SELECT trim(value) FROM regexp_split_to_table(coalesce(a->>'tasks',''),E'\n') value WHERE trim(value)<>'' LOOP
     IF length(t)>500 THEN RAISE EXCEPTION 'Título de tarefa muito longo'; END IF;
     INSERT INTO workspace_tasks(user_id,created_by,title,priority,due_date,tags)
       VALUES(p_owner_id,auth.uid(),t,p_draft->>'priority',nullif(p_draft->>'due_date','')::date,tag_ids) RETURNING id INTO task_id;
     FOREACH person IN ARRAY people LOOP
       INSERT INTO workspace_task_assignees(task_id,assignee_id) VALUES(task_id,person);
     END LOOP;
     INSERT INTO workspace_objective_task_links(objective_id,task_id) VALUES(objective_id,task_id);
   END LOOP;
   FOR task_id IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(a->'task_ids') LOOP
     INSERT INTO workspace_objective_task_links(objective_id,task_id) VALUES(objective_id,task_id);
   END LOOP;
 END LOOP;
 RETURN QUERY SELECT * FROM workspace_objectives WHERE bsc_group_id=p_group_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_workspace_bsc(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_bsc(uuid,uuid,jsonb) TO authenticated;
COMMIT;
