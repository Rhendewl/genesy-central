-- ============================================================
-- Phase 1: CRM Pipelines, Stages & Conversions
-- ============================================================

-- ── crm_pipelines ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_pipelines (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  color       text        NOT NULL DEFAULT '#4a8fd4',
  icon        text        NOT NULL DEFAULT 'kanban',
  order_index integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_pipelines_owner" ON crm_pipelines;
CREATE POLICY "crm_pipelines_owner"
  ON crm_pipelines
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── crm_stages ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_stages (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id        uuid        NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  name               text        NOT NULL,
  description        text,
  color              text        NOT NULL DEFAULT '#4a8fd4',
  icon               text,
  order_index        integer     NOT NULL DEFAULT 0,
  is_active          boolean     NOT NULL DEFAULT true,
  allow_free_move    boolean     NOT NULL DEFAULT true,
  require_note       boolean     NOT NULL DEFAULT false,
  require_attachment boolean     NOT NULL DEFAULT false,
  allow_edit         boolean     NOT NULL DEFAULT true,
  legacy_column      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_stages_owner" ON crm_stages;
CREATE POLICY "crm_stages_owner"
  ON crm_stages
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS crm_stages_pipeline_idx ON crm_stages (pipeline_id);

-- ── crm_stage_conversions (Conversion Engine — Phase 4) ────────

CREATE TABLE IF NOT EXISTS crm_stage_conversions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id   uuid        NOT NULL REFERENCES crm_stages(id)       ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  platform   text        NOT NULL,
  enabled    boolean     NOT NULL DEFAULT false,
  settings   jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, platform)
);

ALTER TABLE crm_stage_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_stage_conversions_owner" ON crm_stage_conversions;
CREATE POLICY "crm_stage_conversions_owner"
  ON crm_stage_conversions
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── crm_lead_stage_history ────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_lead_stage_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid        NOT NULL REFERENCES leads(id)           ON DELETE CASCADE,
  pipeline_id uuid        REFERENCES crm_pipelines(id)            ON DELETE SET NULL,
  stage_id    uuid        REFERENCES crm_stages(id)               ON DELETE SET NULL,
  from_column text,
  to_column   text,
  moved_by    uuid        REFERENCES auth.users(id)               ON DELETE SET NULL,
  moved_at    timestamptz NOT NULL DEFAULT now(),
  note        text
);

ALTER TABLE crm_lead_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_lead_stage_history_owner" ON crm_lead_stage_history;
CREATE POLICY "crm_lead_stage_history_owner"
  ON crm_lead_stage_history
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = crm_lead_stage_history.lead_id
        AND leads.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS crm_lead_stage_history_lead_idx ON crm_lead_stage_history (lead_id);

-- ── Extend leads & forms ──────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id    uuid REFERENCES crm_stages(id)    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_pipeline_id_idx ON leads (pipeline_id);
CREATE INDEX IF NOT EXISTS leads_stage_id_idx    ON leads (stage_id);

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS pipeline_id      uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initial_stage_id uuid REFERENCES crm_stages(id)    ON DELETE SET NULL;

-- ============================================================
-- Data Migration: default pipeline per user → 8 stages → map leads
-- ============================================================

-- 1. Create "CRM Principal" for each user who has leads but no pipeline yet
INSERT INTO crm_pipelines (user_id, name, description, color, icon, order_index, is_active)
SELECT DISTINCT
  l.user_id,
  'CRM Principal',
  'Pipeline padrão criado automaticamente a partir do funil existente',
  '#4a8fd4',
  'kanban',
  0,
  true
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM crm_pipelines p WHERE p.user_id = l.user_id
);

-- 2. Create 8 stages for each pipeline that has no stages yet
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
  p.id,
  p.user_id,
  sd.name,
  sd.color,
  sd.order_index,
  true, true, false, false, true,
  sd.legacy_column
FROM crm_pipelines p
CROSS JOIN stage_defs sd
WHERE NOT EXISTS (
  SELECT 1 FROM crm_stages s WHERE s.pipeline_id = p.id
);

-- 3. Map existing leads to their pipeline + stage (only unmigrated)
UPDATE leads l
SET
  pipeline_id = p.id,
  stage_id    = s.id
FROM crm_pipelines p
JOIN crm_stages s ON s.pipeline_id = p.id
WHERE p.user_id        = l.user_id
  AND s.legacy_column  = l.kanban_column
  AND l.pipeline_id   IS NULL;
