-- ============================================================
-- Phase 1 Refactor: transactional move, updated_at triggers,
-- broader default-pipeline migration, team structure scaffold.
--
-- Additive only — safe to run after 20260629_crm_pipelines.sql.
-- Reuses public.set_updated_at() / public.ensure_updated_at_trigger()
-- defined in 20260426_complete_schema.sql.
-- ============================================================

-- ── 1. updated_at triggers (idempotent) ────────────────────────

SELECT public.ensure_updated_at_trigger('crm_pipelines');
SELECT public.ensure_updated_at_trigger('crm_stages');
SELECT public.ensure_updated_at_trigger('crm_stage_conversions');

-- crm_lead_stage_history has no updated_at column today (append-only log).

-- ── 2. crm_pipeline_members — team structure scaffold ──────────
-- Database structure only. No UI in this phase.

CREATE TABLE IF NOT EXISTS crm_pipeline_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid        NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
  permissions jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, user_id)
);

ALTER TABLE crm_pipeline_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_pipeline_members_owner" ON crm_pipeline_members;
CREATE POLICY "crm_pipeline_members_owner"
  ON crm_pipeline_members
  USING (
    EXISTS (
      SELECT 1 FROM crm_pipelines p
      WHERE p.id = crm_pipeline_members.pipeline_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_pipelines p
      WHERE p.id = crm_pipeline_members.pipeline_id
        AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS crm_pipeline_members_pipeline_idx ON crm_pipeline_members (pipeline_id);
CREATE INDEX IF NOT EXISTS crm_pipeline_members_user_idx     ON crm_pipeline_members (user_id);

SELECT public.ensure_updated_at_trigger('crm_pipeline_members');

-- Backfill: pipeline owners become an explicit 'owner' member row.
INSERT INTO crm_pipeline_members (pipeline_id, user_id, role)
SELECT p.id, p.user_id, 'owner'
FROM crm_pipelines p
WHERE NOT EXISTS (
  SELECT 1 FROM crm_pipeline_members m
  WHERE m.pipeline_id = p.id AND m.user_id = p.user_id
);

-- ── 3. Broaden default pipeline migration ──────────────────────
-- Also covers users with a CRM-enabled form but no leads yet.

INSERT INTO crm_pipelines (user_id, name, description, color, icon, order_index, is_active)
SELECT DISTINCT u.user_id,
  'CRM Principal',
  'Pipeline padrão criado automaticamente a partir do funil existente',
  '#4a8fd4',
  'kanban',
  0,
  true
FROM (
  SELECT user_id FROM leads
  UNION
  SELECT f.user_id
  FROM form_integrations fi
  JOIN forms f ON f.id = fi.form_id
  WHERE fi.adapter = 'crm' AND fi.enabled = true
) u
WHERE NOT EXISTS (
  SELECT 1 FROM crm_pipelines p WHERE p.user_id = u.user_id
);

-- Re-run stage seeding / lead mapping for any pipeline created above.

WITH stage_defs (name, color, order_index, legacy_column) AS (
  VALUES
    ('Novo Lead',            '#6366f1', 0, 'novo_lead'),
    ('Abordados',            '#7d99ad', 1, 'abordados'),
    ('Em Andamento',         '#5b87a0', 2, 'em_andamento'),
    ('Formulário Aplicado',  '#4a7a95', 3, 'formulario_aplicado'),
    ('Reunião Agendada',     '#3d6d88', 4, 'reuniao_agendada'),
    ('Reunião Realizada',    '#22c55e', 5, 'reuniao_realizada'),
    ('No-Show',              '#f59e0b', 6, 'no_show'),
    ('Venda Realizada',      '#10b981', 7, 'venda_realizada')
)
INSERT INTO crm_stages (
  pipeline_id, user_id, name, color, order_index,
  is_active, allow_free_move, require_note, require_attachment, allow_edit, legacy_column
)
SELECT
  p.id, p.user_id, sd.name, sd.color, sd.order_index,
  true, true, false, false, true, sd.legacy_column
FROM crm_pipelines p
CROSS JOIN stage_defs sd
WHERE NOT EXISTS (
  SELECT 1 FROM crm_stages s WHERE s.pipeline_id = p.id
);

UPDATE leads l
SET
  pipeline_id = p.id,
  stage_id    = s.id
FROM crm_pipelines p
JOIN crm_stages s ON s.pipeline_id = p.id
WHERE p.user_id        = l.user_id
  AND s.legacy_column  = l.kanban_column
  AND l.pipeline_id   IS NULL;

-- Backfill membership again in case new pipelines were created above.
INSERT INTO crm_pipeline_members (pipeline_id, user_id, role)
SELECT p.id, p.user_id, 'owner'
FROM crm_pipelines p
WHERE NOT EXISTS (
  SELECT 1 FROM crm_pipeline_members m
  WHERE m.pipeline_id = p.id AND m.user_id = p.user_id
);

-- ── 4. crm_move_lead ──────────────────────────────────────────
-- Versão final definida em 20260701_crm_phase1_fixes.sql
-- (search_path explícito, is_active check, sem require_note).
-- Nada a fazer aqui.
