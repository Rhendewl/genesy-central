-- =============================================================================
-- Perfil do lead: Corretor, Imobiliária ou Construtora/Incorporadora
--
-- Campo próprio (não tag): vale para todas as pipelines, tem um único valor por
-- lead e alimenta busca, filtros e métricas por perfil.
--
-- Preenchimento automático (trigger), para qualquer caminho de entrada (landing
-- pages do site, formulários Genesy, Meta Lead Ads, roleta, cópia entre
-- pipelines), a partir da pergunta de perfil:
--   * meta_form_answers: pergunta cujo nome começa com "Você é", "Perfil",
--     "Qual seu perfil" ou "Você atua como";
--   * integration_notes: linha "Perfil: …" ou "Você é: …" (é como o site e os
--     formulários Genesy gravam a resposta).
-- Sem essa pergunta o perfil fica vazio, então formulários de imóveis dos
-- clientes não são classificados por engano.
--
-- perfil_manual = true quando alguém escolheu (ou limpou) o perfil no CRM: a
-- classificação automática não mexe mais nesse lead.
-- =============================================================================
BEGIN;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS perfil text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS perfil_manual boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_perfil_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_perfil_check
  CHECK (perfil IS NULL OR perfil IN ('corretor', 'imobiliaria', 'construtora'));
CREATE INDEX IF NOT EXISTS leads_user_perfil_idx ON public.leads (user_id, perfil) WHERE perfil IS NOT NULL;

-- Resposta → perfil. Corretor vem antes de imobiliária: "Corretor de imobiliária"
-- é um corretor.
CREATE OR REPLACE FUNCTION public.crm_perfil_from_answer(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_value IS NULL OR btrim(p_value) = '' THEN NULL
    WHEN p_value ~* '(construtor|incorporador)' THEN 'construtora'
    WHEN p_value ~* '(corretor|aut[oô]nom)' THEN 'corretor'
    WHEN p_value ~* 'imobili' THEN 'imobiliaria'
  END
$$;

-- A pergunta é a de perfil? Aceita rótulos humanos ("Você é:") e nomes de campo
-- da Meta ("você_é_corretor,_imobiliária_ou_construtora?").
CREATE OR REPLACE FUNCTION public.crm_is_perfil_question(p_label text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    btrim(translate(p_label, '_?', '  ')) ~* '^(voc[eê]|vc) +[eé]( |$)|^(qual( [eé])? (o )?)?seu perfil|^(tipo de )?perfil|^(voc[eê] )?atua como',
    false)
$$;

CREATE OR REPLACE FUNCTION public.crm_lead_perfil_detect(p_notes text, p_meta jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    (SELECT public.crm_perfil_from_answer(v.value)
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_meta) = 'array' THEN p_meta ELSE '[]'::jsonb END)
            WITH ORDINALITY a(item, ord)
       CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(a.item -> 'values') = 'array' THEN a.item -> 'values' ELSE '[]'::jsonb END) v(value)
      WHERE public.crm_is_perfil_question(a.item ->> 'name')
        AND public.crm_perfil_from_answer(v.value) IS NOT NULL
      ORDER BY a.ord LIMIT 1),
    (SELECT public.crm_perfil_from_answer(m[2])
       FROM regexp_split_to_table(coalesce(p_notes, ''), E'\n') WITH ORDINALITY l(line, ord)
       CROSS JOIN LATERAL regexp_match(l.line, '^\s*([^:]*[^:\s])\s*:+\s*(.*)$') m
      WHERE public.crm_is_perfil_question(m[1])
        AND public.crm_perfil_from_answer(m[2]) IS NOT NULL
      ORDER BY l.ord LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.crm_set_lead_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_perfil text;
  v_manual boolean;
BEGIN
  IF NEW.perfil_manual THEN RETURN NEW; END IF;
  IF NEW.perfil IS NOT NULL THEN RETURN NEW; END IF;

  -- Cópia para outra pipeline herda o perfil do lead de origem.
  IF TG_OP = 'INSERT' AND NEW.copied_from_lead_id IS NOT NULL THEN
    SELECT perfil, perfil_manual INTO v_perfil, v_manual
      FROM public.leads WHERE id = NEW.copied_from_lead_id AND user_id = NEW.user_id;
    IF FOUND AND (v_perfil IS NOT NULL OR v_manual) THEN
      NEW.perfil := v_perfil;
      NEW.perfil_manual := v_manual;
      RETURN NEW;
    END IF;
  END IF;

  NEW.perfil := public.crm_lead_perfil_detect(NEW.integration_notes, NEW.meta_form_answers);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.crm_set_lead_perfil() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_set_lead_perfil ON public.leads;
CREATE TRIGGER crm_set_lead_perfil
  BEFORE INSERT OR UPDATE OF perfil, perfil_manual, integration_notes, meta_form_answers ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_lead_perfil();

-- Leads atuais. O backfill não mexe em updated_at para não reordenar o Kanban.
ALTER TABLE public.leads DISABLE TRIGGER USER;

UPDATE public.leads l
   SET perfil = public.crm_lead_perfil_detect(l.integration_notes, l.meta_form_answers)
 WHERE l.perfil IS NULL AND NOT l.perfil_manual
   AND public.crm_lead_perfil_detect(l.integration_notes, l.meta_form_answers) IS NOT NULL;

-- Quem já foi marcado com uma tag de perfil (ex.: "CORRETOR(A)").
UPDATE public.leads l
   SET perfil = found.perfil
  FROM (
    SELECT DISTINCT ON (le.id) le.id, public.crm_perfil_from_answer(t.name) AS perfil
      FROM public.leads le
      CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(to_jsonb(le.tags), '[]'::jsonb)) tag_id
      JOIN public.crm_pipeline_tags t ON t.id::text = tag_id AND t.pipeline_id = le.pipeline_id
     WHERE le.perfil IS NULL AND NOT le.perfil_manual
       AND t.name ~* '^\s*(corretor|imobili|construtor|incorporador)'
     ORDER BY le.id, t.created_at
  ) found
 WHERE l.id = found.id AND found.perfil IS NOT NULL;

-- Cópias entre pipelines seguem o lead original.
UPDATE public.leads c
   SET perfil = o.perfil
  FROM public.leads o
 WHERE c.copied_from_lead_id = o.id AND c.user_id = o.user_id
   AND c.perfil IS NULL AND NOT c.perfil_manual AND o.perfil IS NOT NULL;

ALTER TABLE public.leads ENABLE TRIGGER USER;

COMMIT;
