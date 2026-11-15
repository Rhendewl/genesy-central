BEGIN;
-- Add without a default first: do not fabricate arrival times for older rows.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE public.leads ALTER COLUMN received_at SET DEFAULT now();
ALTER TABLE public.crm_lead_stage_history ADD COLUMN IF NOT EXISTS from_stage_id uuid REFERENCES public.crm_stages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS crm_history_pipeline_lead_time_idx ON public.crm_lead_stage_history(pipeline_id,lead_id,moved_at);
-- Recover only original timestamps actually supplied by Meta, not webhook retry times.
WITH original_events AS (
 SELECT user_id,leadgen_id,
 CASE WHEN jsonb_typeof(payload->'created_time')='number'
 THEN (payload->>'created_time')::double precision END AS original_epoch
 FROM public.meta_webhook_logs
), arrivals AS (
 SELECT user_id,leadgen_id,min(to_timestamp(original_epoch)) AS arrived
 FROM original_events
 WHERE original_epoch BETWEEN 946684800 AND extract(epoch from now())
 GROUP BY user_id,leadgen_id
)
UPDATE public.leads l SET received_at=a.arrived FROM arrivals a
WHERE l.user_id=a.user_id AND l.leadgen_id=a.leadgen_id AND l.received_at IS NULL;
-- Recover known consecutive source stages. Never guess the source of the first event.
WITH previous AS (
 SELECT id,lag(stage_id) OVER(PARTITION BY lead_id,pipeline_id ORDER BY moved_at,id) AS source
 FROM public.crm_lead_stage_history
)
UPDATE public.crm_lead_stage_history h SET from_stage_id=p.source
FROM previous p WHERE h.id=p.id AND h.from_stage_id IS NULL AND p.source IS NOT NULL;
CREATE OR REPLACE FUNCTION public.crm_move_lead(
  p_lead_id  uuid,
  p_stage_id uuid,
  p_note     text DEFAULT NULL,
  p_moved_by uuid DEFAULT NULL
)
RETURNS TABLE (
  lead_id       uuid,
  pipeline_id   uuid,
  stage_id      uuid,
  from_stage_id uuid,
  from_column   text,
  to_column     text
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from_stage_id uuid;
  v_from_column   text;
  v_pipeline_id   uuid;
  v_legacy_column text;
  v_owner_id      uuid := public.effective_owner_id();
BEGIN
  SELECT l.stage_id, l.kanban_column
    INTO v_from_stage_id, v_from_column
  FROM leads l
  WHERE l.id = p_lead_id AND l.user_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  SELECT s.pipeline_id, s.legacy_column
    INTO v_pipeline_id, v_legacy_column
  FROM crm_stages s
  WHERE s.id      = p_stage_id
    AND s.user_id = v_owner_id
    AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAGE_NOT_FOUND';
  END IF;

  UPDATE leads
  SET
    pipeline_id   = v_pipeline_id,
    stage_id      = p_stage_id,
    kanban_column = COALESCE(v_legacy_column, kanban_column),
    updated_at    = now()
  WHERE id = p_lead_id;

  INSERT INTO crm_lead_stage_history (
    lead_id, pipeline_id, stage_id, from_stage_id, from_column, to_column, moved_by, note
  )
  VALUES (
    p_lead_id, v_pipeline_id, p_stage_id, v_from_stage_id, v_from_column, v_legacy_column, p_moved_by, p_note
  );

  IF v_from_column IS NOT NULL
    AND v_legacy_column IS NOT NULL
    AND v_from_column <> v_legacy_column
  THEN
    INSERT INTO lead_movements (lead_id, from_column, to_column)
    VALUES (p_lead_id, v_from_column, v_legacy_column);
  END IF;

  RETURN QUERY
  SELECT p_lead_id, v_pipeline_id, p_stage_id, v_from_stage_id, v_from_column, v_legacy_column;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_move_lead(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_move_lead(uuid, uuid, text, uuid) TO authenticated;
COMMIT;
