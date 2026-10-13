BEGIN;

-- Calculator public links. Tables are service-role only; all management APIs
-- verify active workspace membership and calculadora + CRM permissions.
CREATE TABLE public.calculator_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id),
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.calculator_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.calculator_shares(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  profile text NOT NULL CHECK (profile IN ('corretor','imobiliaria','construtora')),
  creci text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(share_id, phone)
);
CREATE INDEX calculator_captures_owner_date ON public.calculator_captures(user_id, created_at DESC);
CREATE TABLE public.calculator_access_limits (
  key text PRIMARY KEY,
  window_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX calculator_access_limits_window ON public.calculator_access_limits(window_at);
ALTER TABLE public.calculator_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculator_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculator_access_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calculator_shares, public.calculator_captures, public.calculator_access_limits FROM anon, authenticated;
GRANT ALL ON public.calculator_shares, public.calculator_captures, public.calculator_access_limits TO service_role;

CREATE FUNCTION public.calculator_take_attempt(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hits integer;
BEGIN
  INSERT INTO calculator_access_limits(key, attempts) VALUES(p_key, 1)
  ON CONFLICT(key) DO UPDATE SET
    attempts = CASE WHEN calculator_access_limits.window_at < now() - interval '15 minutes' THEN 1 ELSE calculator_access_limits.attempts + 1 END,
    window_at = CASE WHEN calculator_access_limits.window_at < now() - interval '15 minutes' THEN now() ELSE calculator_access_limits.window_at END
  RETURNING attempts INTO hits;
  DELETE FROM calculator_access_limits WHERE window_at < now() - interval '1 day';
  RETURN hits <= 20;
END $$;
REVOKE ALL ON FUNCTION public.calculator_take_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculator_take_attempt(text) TO service_role;

-- One transaction: duplicate requests cannot create orphan or duplicate leads.
CREATE FUNCTION public.calculator_register(p_slug text, p_name text, p_email text, p_phone text, p_profile text, p_creci text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s calculator_shares%ROWTYPE; st crm_stages%ROWTYPE; c calculator_captures%ROWTYPE;
  lid uuid; stage_count integer; made boolean := false; inserted_owner uuid;
  previous_subject text := current_setting('request.jwt.claim.sub', true);
BEGIN
  SELECT * INTO s FROM calculator_shares WHERE slug = p_slug AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
  SELECT * INTO st FROM crm_stages WHERE id = s.stage_id AND pipeline_id = s.pipeline_id AND user_id = s.user_id AND is_active;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM crm_pipelines WHERE id = s.pipeline_id AND user_id = s.user_id AND is_active) THEN RAISE EXCEPTION 'DESTINATION_UNAVAILABLE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(s.user_id::text || s.pipeline_id::text || p_phone, 0));
  SELECT * INTO c FROM calculator_captures WHERE share_id = s.id AND phone = p_phone;
  IF FOUND THEN RETURN jsonb_build_object('lead_id', c.lead_id, 'created', false); END IF;
  SELECT id INTO lid FROM leads WHERE user_id = s.user_id AND pipeline_id = s.pipeline_id AND contact = p_phone ORDER BY created_at LIMIT 1;
  IF lid IS NULL THEN
    SELECT count(*) INTO stage_count FROM crm_stages WHERE pipeline_id = s.pipeline_id AND is_active;
    -- Existing CRM insert triggers resolve ownership from auth.uid(). Scope
    -- that context to the server-owned link for this insert only; never trust
    -- an owner identifier from the visitor and never alter shared triggers.
    PERFORM set_config('request.jwt.claim.sub', s.user_id::text, true);
    INSERT INTO leads(user_id,name,contact,email,source,pipeline_id,stage_id,kanban_column,integration_notes,ie_score)
      VALUES(s.user_id,p_name,p_phone,p_email,'calculadora',s.pipeline_id,s.stage_id,coalesce(st.legacy_column,'abordados'),
        'Captura via calculadora: ' || s.title || E'\nPerfil: ' || p_profile || coalesce(E'\nCRECI: ' || nullif(p_creci,''), ''),
        least(100, greatest(0, round((st.order_index+1)::numeric / greatest(stage_count,1) * 100)))) RETURNING id,user_id INTO lid,inserted_owner;
    IF inserted_owner IS DISTINCT FROM s.user_id THEN RAISE EXCEPTION 'OWNER_MISMATCH'; END IF;
    PERFORM set_config('request.jwt.claim.sub', coalesce(previous_subject,''), true);
    INSERT INTO crm_lead_stage_history(lead_id,pipeline_id,stage_id,to_column,note)
      VALUES(lid,s.pipeline_id,s.stage_id,coalesce(st.legacy_column,'abordados'),'Cadastro pela calculadora pública');
    made := true;
  END IF;
  INSERT INTO calculator_captures(share_id,user_id,lead_id,pipeline_id,name,email,phone,profile,creci)
    VALUES(s.id,s.user_id,lid,s.pipeline_id,p_name,p_email,p_phone,p_profile,nullif(p_creci,''));
  RETURN jsonb_build_object('lead_id',lid,'created',made,'user_id',s.user_id,'pipeline_id',s.pipeline_id,'stage_id',s.stage_id);
END $$;
REVOKE ALL ON FUNCTION public.calculator_register(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculator_register(text,text,text,text,text,text) TO service_role;

COMMIT;
