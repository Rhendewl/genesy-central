-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Workflow Engine (Automações) — Fase 1
--
-- Motor de automação genérico (gatilho → espera → condições → ações), com
-- jobs agendados e cancelamento automático. Nasce dentro do CRM mas o núcleo
-- (workflow_jobs/workflow_execution_log, tipos de trigger/condition/action)
-- é agnóstico de domínio — outros módulos poderão reutilizá-lo depois só
-- registrando seus próprios tipos, sem alterar este schema.
--
-- Duas lacunas de schema corrigidas aqui porque bloqueiam 3 dos 10 gatilhos
-- pedidos: (1) não existe conceito de "venda ganha/perdida" em crm_stages;
-- (2) ver 20260726_workflow_tag_route (rota de tags) para o gatilho de tag.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0. crm_stages: venda ganha/perdida ───────────────────────────────────────

ALTER TABLE public.crm_stages
  ADD COLUMN IF NOT EXISTS is_won  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lost boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.crm_stages
    ADD CONSTRAINT crm_stages_won_lost_exclusive CHECK (NOT (is_won AND is_lost));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: só a etapa de venda realizada tem equivalente legado. Não existe
-- equivalente para "perdida" (no_show não é a mesma coisa — lead pode ser
-- reengajado), por isso nada é retroativamente marcado como is_lost.
UPDATE public.crm_stages SET is_won = true
WHERE legacy_column = 'venda_realizada' AND is_won = false;

-- ── 1. workflow_automations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_automations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  pipeline_id    uuid        NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  status         text        NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada')),
  -- trigger_type/delay_type/condition_type/action_type (nas tabelas abaixo)
  -- são texto livre de propósito — a validade é conferida pela camada de
  -- serviço (WorkflowService) contra os registries em código, não por CHECK
  -- aqui. Isso é o que permite adicionar tipos novos sem migration.
  trigger_type   text        NOT NULL,
  trigger_config jsonb       NOT NULL DEFAULT '{}',
  delay_type     text        NOT NULL DEFAULT 'immediate'
                 CHECK (delay_type IN (
                   'immediate', 'after_minutes', 'after_hours', 'after_days',
                   'tomorrow', 'specific_time', 'next_business_day'
                 )),
  delay_config   jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_automations_pipeline_idx ON public.workflow_automations (pipeline_id);
CREATE INDEX IF NOT EXISTS workflow_automations_user_idx     ON public.workflow_automations (user_id);
CREATE INDEX IF NOT EXISTS workflow_automations_status_idx   ON public.workflow_automations (status) WHERE status = 'ativa';

DROP TRIGGER IF EXISTS trg_auto_owner_workflow_automations ON public.workflow_automations;
CREATE TRIGGER trg_auto_owner_workflow_automations
  BEFORE INSERT ON public.workflow_automations
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.apply_standard_rls('workflow_automations');
SELECT public.ensure_updated_at_trigger('workflow_automations');

-- ── 2. workflow_conditions (0..N por automação) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_conditions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id    uuid        NOT NULL REFERENCES public.workflow_automations(id) ON DELETE CASCADE,
  condition_type   text        NOT NULL,
  condition_config jsonb       NOT NULL DEFAULT '{}',
  order_index      integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_conditions_automation_idx ON public.workflow_conditions (automation_id, order_index);

DROP TRIGGER IF EXISTS trg_auto_owner_workflow_conditions ON public.workflow_conditions;
CREATE TRIGGER trg_auto_owner_workflow_conditions
  BEFORE INSERT ON public.workflow_conditions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.apply_standard_rls('workflow_conditions');
SELECT public.ensure_updated_at_trigger('workflow_conditions');

-- ── 3. workflow_actions (1..N por automação) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid        NOT NULL REFERENCES public.workflow_automations(id) ON DELETE CASCADE,
  action_type   text        NOT NULL,
  action_config jsonb       NOT NULL DEFAULT '{}',
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_actions_automation_idx ON public.workflow_actions (automation_id, order_index);

DROP TRIGGER IF EXISTS trg_auto_owner_workflow_actions ON public.workflow_actions;
CREATE TRIGGER trg_auto_owner_workflow_actions
  BEFORE INSERT ON public.workflow_actions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.apply_standard_rls('workflow_actions');
SELECT public.ensure_updated_at_trigger('workflow_actions');

-- ── 4. workflow_jobs — fila de execução agendada ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id    uuid        NOT NULL REFERENCES public.workflow_automations(id) ON DELETE CASCADE,
  lead_id          uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'executed', 'cancelled', 'failed')),
  scheduled_for    timestamptz NOT NULL,
  -- Captura imutável do contexto no momento do gatilho (ex: stage_id,
  -- assigned_to) — usada para saber CONTRA O QUE re-checar as condições
  -- depois (ex: "ainda na mesma etapa" = etapa atual == snapshot.stageId).
  trigger_snapshot jsonb       NOT NULL DEFAULT '{}',
  attempts         integer     NOT NULL DEFAULT 0,
  max_attempts     integer     NOT NULL DEFAULT 3,
  last_error       text,
  cancelled_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  executed_at      timestamptz
);

-- Query principal do worker: WHERE status='pending' AND scheduled_for <= now()
-- ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT N.
CREATE INDEX IF NOT EXISTS workflow_jobs_worker_idx
  ON public.workflow_jobs (scheduled_for) WHERE status = 'pending';

-- Lookup do JobCanceller: "todo job ainda pendente deste lead".
CREATE INDEX IF NOT EXISTS workflow_jobs_lead_pending_idx
  ON public.workflow_jobs (lead_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS workflow_jobs_automation_idx ON public.workflow_jobs (automation_id);

-- SEM trigger auto_set_owner_id aqui de propósito: workflow_jobs só é escrita
-- pelo consumer do EventBus / JobExecutor, que rodam com o client de
-- service-role (sem sessão de auth.uid()) — o trigger sobrescreveria
-- user_id com NULL. O código já grava user_id explicitamente (o dono da
-- automação). RLS (apply_standard_rls) segue valendo para leitura pelo
-- usuário autenticado (dashboard/histórico); INSERT via service-role já
-- ignora RLS por padrão.
SELECT public.apply_standard_rls('workflow_jobs');
SELECT public.ensure_updated_at_trigger('workflow_jobs');

-- ── 5. workflow_execution_log — histórico, append-only ───────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_execution_log (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id                   uuid        NOT NULL REFERENCES public.workflow_jobs(id) ON DELETE CASCADE,
  automation_id            uuid        NOT NULL REFERENCES public.workflow_automations(id) ON DELETE CASCADE,
  lead_id                  uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status                   text        NOT NULL CHECK (status IN ('executada', 'cancelada', 'falhou')),
  reason                   text,
  -- Cópia auditável do conteúdo realmente renderizado/enviado, pra o
  -- histórico continuar legível mesmo se a automação for editada depois.
  rendered_action_snapshot jsonb,
  executed_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_execution_log_automation_idx ON public.workflow_execution_log (automation_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS workflow_execution_log_lead_idx        ON public.workflow_execution_log (lead_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS workflow_execution_log_status_day_idx  ON public.workflow_execution_log (status, executed_at);

-- Sem auto_set_owner_id pelo mesmo motivo de workflow_jobs — escrita só via
-- service-role (JobExecutor/JobCanceller), user_id gravado explicitamente.
SELECT public.apply_standard_rls('workflow_execution_log');

-- ── 6. workflow_notifications — registro in-app da ação "Criar Notificação" ──
-- Não existe nenhuma tabela de notificações persistidas hoje na plataforma
-- (o sino no header é só decorativo). Esta é intencionalmente escopada pro
-- motor de automação, não uma inbox genérica — evita inventar uma estrutura
-- especulativa antes de outros módulos precisarem da mesma coisa.

CREATE TABLE IF NOT EXISTS public.workflow_notifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  recipient_user_id uuid        NOT NULL REFERENCES public.user_profiles(id)  ON DELETE CASCADE,
  job_id            uuid        REFERENCES public.workflow_jobs(id)          ON DELETE SET NULL,
  automation_id     uuid        REFERENCES public.workflow_automations(id)   ON DELETE SET NULL,
  lead_id           uuid        REFERENCES public.leads(id)                  ON DELETE SET NULL,
  title             text        NOT NULL,
  body              text        NOT NULL,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_notifications_recipient_idx
  ON public.workflow_notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_notifications_unread_idx
  ON public.workflow_notifications (recipient_user_id) WHERE read_at IS NULL;

-- Sem auto_set_owner_id pelo mesmo motivo — escrita só via NotificationAction
-- (service-role), user_id gravado explicitamente como o dono da automação.
SELECT public.apply_standard_rls('workflow_notifications');

-- ── 7. leads.tags mutation via servidor precisa de RLS que já existe ────────
-- (leads já está em apply_standard_rls desde 20260723 — nenhuma mudança de
-- RLS necessária aqui, só a rota de API nova em /api/crm/leads/[id]/tags).
