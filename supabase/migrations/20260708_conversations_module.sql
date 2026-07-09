-- ═══════════════════════════════════════════════════════════════════════════════
-- Conversas — WhatsApp QR, Inbox e Fluxos
--
-- Fase 1: schema normalizado e RLS própria. O módulo não depende da Cloud API
-- oficial e não acopla a UI a uma biblioteca específica de WhatsApp Web.
-- user_id = organização/dono da conta; owner_profile_id = colaborador dono da
-- conta/conversa. Admins veem a organização; colaboradores veem apenas o que é
-- deles.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Helpers de perfil/permissão ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_member_is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((
    SELECT role = 'admin'
    FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_profile_scope(profile_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.current_member_is_admin()
    OR profile_id = public.current_profile_id();
$$;

-- ── WhatsApp accounts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversation_whatsapp_accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_profile_id   uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  provider           text        NOT NULL DEFAULT 'qr_code',
  session_name       text        NOT NULL,
  phone              text,
  display_name       text,
  status             text        NOT NULL DEFAULT 'disconnected'
                              CHECK (status IN (
                                'connected','awaiting_qr','connecting','disconnected',
                                'error','expired','reconnect'
                              )),
  qr_code_payload    text,
  last_sync_at       timestamptz,
  last_connected_at  timestamptz,
  last_error         text,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_whatsapp_accounts_user_idx
  ON public.conversation_whatsapp_accounts (user_id, status);
CREATE INDEX IF NOT EXISTS conversation_whatsapp_accounts_owner_profile_idx
  ON public.conversation_whatsapp_accounts (owner_profile_id, status);

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_whatsapp_accounts ON public.conversation_whatsapp_accounts;
CREATE TRIGGER trg_auto_owner_conversation_whatsapp_accounts
  BEFORE INSERT ON public.conversation_whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('conversation_whatsapp_accounts');

-- ── Contacts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversation_contacts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id          uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  name             text,
  phone            text        NOT NULL,
  email            text,
  company          text,
  avatar_url       text,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

CREATE INDEX IF NOT EXISTS conversation_contacts_user_phone_idx
  ON public.conversation_contacts (user_id, phone);
CREATE INDEX IF NOT EXISTS conversation_contacts_lead_idx
  ON public.conversation_contacts (lead_id);

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_contacts ON public.conversation_contacts;
CREATE TRIGGER trg_auto_owner_conversation_contacts
  BEFORE INSERT ON public.conversation_contacts
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('conversation_contacts');

-- ── Threads / Inbox ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_account_id    uuid        REFERENCES public.conversation_whatsapp_accounts(id) ON DELETE SET NULL,
  contact_id             uuid        NOT NULL REFERENCES public.conversation_contacts(id) ON DELETE CASCADE,
  owner_profile_id       uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  lead_id                uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  status                 text        NOT NULL DEFAULT 'open'
                                      CHECK (status IN ('open','pending','closed','archived')),
  last_message_preview   text,
  last_message_at        timestamptz,
  last_inbound_at        timestamptz,
  last_outbound_at       timestamptz,
  unread_count           integer     NOT NULL DEFAULT 0,
  needs_response         boolean     NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_threads_user_last_idx
  ON public.conversation_threads (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversation_threads_owner_last_idx
  ON public.conversation_threads (owner_profile_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversation_threads_account_idx
  ON public.conversation_threads (whatsapp_account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversation_threads_status_idx
  ON public.conversation_threads (user_id, status);

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_threads ON public.conversation_threads;
CREATE TRIGGER trg_auto_owner_conversation_threads
  BEFORE INSERT ON public.conversation_threads
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('conversation_threads');

-- ── Messages ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id           uuid        NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  whatsapp_account_id uuid        REFERENCES public.conversation_whatsapp_accounts(id) ON DELETE SET NULL,
  contact_id          uuid        NOT NULL REFERENCES public.conversation_contacts(id) ON DELETE CASCADE,
  owner_profile_id    uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  lead_id             uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  direction           text        NOT NULL CHECK (direction IN ('inbound','outbound')),
  source              text        NOT NULL DEFAULT 'manual'
                                      CHECK (source IN ('manual','automation','system')),
  body                text        NOT NULL,
  status              text        NOT NULL DEFAULT 'sent'
                                      CHECK (status IN ('queued','sent','delivered','read','received','failed')),
  provider_message_id text,
  flow_id             uuid,
  flow_job_id         uuid,
  error               text,
  sent_at             timestamptz,
  received_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_thread_idx
  ON public.conversation_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS conversation_messages_owner_created_idx
  ON public.conversation_messages (owner_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_source_idx
  ON public.conversation_messages (user_id, source, created_at DESC);

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_messages ON public.conversation_messages;
CREATE TRIGGER trg_auto_owner_conversation_messages
  BEFORE INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

-- ── Flows ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversation_flows (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_profile_id uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  name             text        NOT NULL,
  description      text,
  status           text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  trigger_type     text        NOT NULL,
  trigger_config   jsonb       NOT NULL DEFAULT '{}',
  scope            text        NOT NULL DEFAULT 'team' CHECK (scope IN ('team','personal')),
  viewport         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_flows_user_status_idx
  ON public.conversation_flows (user_id, status);
CREATE INDEX IF NOT EXISTS conversation_flows_trigger_idx
  ON public.conversation_flows (user_id, trigger_type) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_flows ON public.conversation_flows;
CREATE TRIGGER trg_auto_owner_conversation_flows
  BEFORE INSERT ON public.conversation_flows
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('conversation_flows');

CREATE TABLE IF NOT EXISTS public.conversation_flow_nodes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id     uuid        NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  node_key    text        NOT NULL,
  node_type   text        NOT NULL CHECK (node_type IN ('trigger','condition','wait','action','end')),
  label       text        NOT NULL,
  config      jsonb       NOT NULL DEFAULT '{}',
  position    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, node_key)
);

CREATE INDEX IF NOT EXISTS conversation_flow_nodes_flow_idx
  ON public.conversation_flow_nodes (flow_id);

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_flow_nodes ON public.conversation_flow_nodes;
CREATE TRIGGER trg_auto_owner_conversation_flow_nodes
  BEFORE INSERT ON public.conversation_flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.ensure_updated_at_trigger('conversation_flow_nodes');

CREATE TABLE IF NOT EXISTS public.conversation_flow_edges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id     uuid        NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  source_key  text        NOT NULL,
  target_key  text        NOT NULL,
  label       text,
  config      jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_flow_edges_flow_idx
  ON public.conversation_flow_edges (flow_id);

DROP TRIGGER IF EXISTS trg_auto_owner_conversation_flow_edges ON public.conversation_flow_edges;
CREATE TRIGGER trg_auto_owner_conversation_flow_edges
  BEFORE INSERT ON public.conversation_flow_edges
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

CREATE TABLE IF NOT EXISTS public.conversation_flow_jobs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id               uuid        NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  node_id               uuid        REFERENCES public.conversation_flow_nodes(id) ON DELETE SET NULL,
  lead_id               uuid        REFERENCES public.leads(id) ON DELETE CASCADE,
  thread_id             uuid        REFERENCES public.conversation_threads(id) ON DELETE SET NULL,
  whatsapp_account_id   uuid        REFERENCES public.conversation_whatsapp_accounts(id) ON DELETE SET NULL,
  owner_profile_id      uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status                text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','processing','executed','cancelled','failed','paused')),
  scheduled_for         timestamptz NOT NULL,
  trigger_event_type    text        NOT NULL,
  trigger_snapshot      jsonb       NOT NULL DEFAULT '{}',
  attempts              integer     NOT NULL DEFAULT 0,
  max_attempts          integer     NOT NULL DEFAULT 3,
  cancelled_reason      text,
  last_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  executed_at           timestamptz
);

CREATE INDEX IF NOT EXISTS conversation_flow_jobs_worker_idx
  ON public.conversation_flow_jobs (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS conversation_flow_jobs_lead_pending_idx
  ON public.conversation_flow_jobs (lead_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS conversation_flow_jobs_owner_idx
  ON public.conversation_flow_jobs (owner_profile_id, status);

SELECT public.ensure_updated_at_trigger('conversation_flow_jobs');

CREATE TABLE IF NOT EXISTS public.conversation_flow_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id         uuid        NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  job_id          uuid        REFERENCES public.conversation_flow_jobs(id) ON DELETE SET NULL,
  lead_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  thread_id       uuid        REFERENCES public.conversation_threads(id) ON DELETE SET NULL,
  status          text        NOT NULL CHECK (status IN ('executed','cancelled','failed')),
  reason          text,
  snapshot        jsonb       NOT NULL DEFAULT '{}',
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE INDEX IF NOT EXISTS conversation_flow_runs_flow_idx
  ON public.conversation_flow_runs (flow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_flow_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id     uuid        REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  job_id      uuid        REFERENCES public.conversation_flow_jobs(id) ON DELETE SET NULL,
  run_id      uuid        REFERENCES public.conversation_flow_runs(id) ON DELETE SET NULL,
  level       text        NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','error')),
  message     text        NOT NULL,
  context     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_flow_logs_flow_idx
  ON public.conversation_flow_logs (flow_id, created_at DESC);

-- ── Foreign keys delayed until both tables exist ─────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.conversation_messages
    ADD CONSTRAINT conversation_messages_flow_fk
    FOREIGN KEY (flow_id) REFERENCES public.conversation_flows(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.conversation_messages
    ADD CONSTRAINT conversation_messages_flow_job_fk
    FOREIGN KEY (flow_job_id) REFERENCES public.conversation_flow_jobs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.conversation_whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_flows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_flow_nodes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_flow_edges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_flow_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_flow_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_flow_logs         ENABLE ROW LEVEL SECURITY;

-- Drop policies idempotently.
DO $$
DECLARE
  tbl text;
  pol text;
  tbls text[] := ARRAY[
    'conversation_whatsapp_accounts','conversation_contacts','conversation_threads',
    'conversation_messages','conversation_flows','conversation_flow_nodes',
    'conversation_flow_edges','conversation_flow_jobs','conversation_flow_runs',
    'conversation_flow_logs'
  ];
  pols text[] := ARRAY['select','insert','update','delete'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    FOREACH pol IN ARRAY pols LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_' || pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Accounts: admin sees org; member sees own account.
CREATE POLICY conversation_whatsapp_accounts_select ON public.conversation_whatsapp_accounts
  FOR SELECT USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));
CREATE POLICY conversation_whatsapp_accounts_insert ON public.conversation_whatsapp_accounts
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id AND owner_profile_id = public.current_profile_id());
CREATE POLICY conversation_whatsapp_accounts_update ON public.conversation_whatsapp_accounts
  FOR UPDATE USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));
CREATE POLICY conversation_whatsapp_accounts_delete ON public.conversation_whatsapp_accounts
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));

-- Contacts are organization data; conversation visibility is enforced at thread/message layer.
CREATE POLICY conversation_contacts_select ON public.conversation_contacts
  FOR SELECT USING (public.effective_owner_id() = user_id);
CREATE POLICY conversation_contacts_insert ON public.conversation_contacts
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY conversation_contacts_update ON public.conversation_contacts
  FOR UPDATE USING (public.effective_owner_id() = user_id);
CREATE POLICY conversation_contacts_delete ON public.conversation_contacts
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());

-- Threads/messages: admin sees org; member sees own owner_profile_id.
CREATE POLICY conversation_threads_select ON public.conversation_threads
  FOR SELECT USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));
CREATE POLICY conversation_threads_insert ON public.conversation_threads
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id AND owner_profile_id = public.current_profile_id());
CREATE POLICY conversation_threads_update ON public.conversation_threads
  FOR UPDATE USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));
CREATE POLICY conversation_threads_delete ON public.conversation_threads
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));

CREATE POLICY conversation_messages_select ON public.conversation_messages
  FOR SELECT USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));
CREATE POLICY conversation_messages_insert ON public.conversation_messages
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id AND owner_profile_id = public.current_profile_id());
CREATE POLICY conversation_messages_update ON public.conversation_messages
  FOR UPDATE USING (public.effective_owner_id() = user_id AND public.can_access_profile_scope(owner_profile_id));
CREATE POLICY conversation_messages_delete ON public.conversation_messages
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());

-- Flows: team flows are admin-managed; personal flows belong to owner_profile_id.
CREATE POLICY conversation_flows_select ON public.conversation_flows
  FOR SELECT USING (
    public.effective_owner_id() = user_id
    AND (scope = 'team' OR public.can_access_profile_scope(owner_profile_id))
  );
CREATE POLICY conversation_flows_insert ON public.conversation_flows
  FOR INSERT WITH CHECK (
    public.effective_owner_id() = user_id
    AND (scope = 'personal' OR public.current_member_is_admin())
  );
CREATE POLICY conversation_flows_update ON public.conversation_flows
  FOR UPDATE USING (
    public.effective_owner_id() = user_id
    AND (public.current_member_is_admin() OR owner_profile_id = public.current_profile_id())
  );
CREATE POLICY conversation_flows_delete ON public.conversation_flows
  FOR DELETE USING (
    public.effective_owner_id() = user_id
    AND (public.current_member_is_admin() OR owner_profile_id = public.current_profile_id())
  );

-- Child flow tables inherit via conversation_flows.
CREATE POLICY conversation_flow_nodes_select ON public.conversation_flow_nodes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (f.scope = 'team' OR public.can_access_profile_scope(f.owner_profile_id))
  )
);
CREATE POLICY conversation_flow_nodes_insert ON public.conversation_flow_nodes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (public.current_member_is_admin() OR f.owner_profile_id = public.current_profile_id())
  )
);
CREATE POLICY conversation_flow_nodes_update ON public.conversation_flow_nodes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (public.current_member_is_admin() OR f.owner_profile_id = public.current_profile_id())
  )
);
CREATE POLICY conversation_flow_nodes_delete ON public.conversation_flow_nodes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (public.current_member_is_admin() OR f.owner_profile_id = public.current_profile_id())
  )
);

CREATE POLICY conversation_flow_edges_select ON public.conversation_flow_edges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (f.scope = 'team' OR public.can_access_profile_scope(f.owner_profile_id))
  )
);
CREATE POLICY conversation_flow_edges_insert ON public.conversation_flow_edges FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (public.current_member_is_admin() OR f.owner_profile_id = public.current_profile_id())
  )
);
CREATE POLICY conversation_flow_edges_update ON public.conversation_flow_edges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (public.current_member_is_admin() OR f.owner_profile_id = public.current_profile_id())
  )
);
CREATE POLICY conversation_flow_edges_delete ON public.conversation_flow_edges FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_id
      AND f.user_id = public.effective_owner_id()
      AND (public.current_member_is_admin() OR f.owner_profile_id = public.current_profile_id())
  )
);

-- Runtime tables: service-role writes; authenticated users read scoped rows.
CREATE POLICY conversation_flow_jobs_select ON public.conversation_flow_jobs
  FOR SELECT USING (public.effective_owner_id() = user_id AND (owner_profile_id IS NULL OR public.can_access_profile_scope(owner_profile_id)));
CREATE POLICY conversation_flow_jobs_insert ON public.conversation_flow_jobs
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY conversation_flow_jobs_update ON public.conversation_flow_jobs
  FOR UPDATE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());
CREATE POLICY conversation_flow_jobs_delete ON public.conversation_flow_jobs
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());

CREATE POLICY conversation_flow_runs_select ON public.conversation_flow_runs
  FOR SELECT USING (
    public.effective_owner_id() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_flows f
      WHERE f.id = flow_id
        AND f.user_id = public.effective_owner_id()
        AND (f.scope = 'team' OR public.can_access_profile_scope(f.owner_profile_id))
    )
  );
CREATE POLICY conversation_flow_runs_insert ON public.conversation_flow_runs
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY conversation_flow_runs_update ON public.conversation_flow_runs
  FOR UPDATE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());
CREATE POLICY conversation_flow_runs_delete ON public.conversation_flow_runs
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());

CREATE POLICY conversation_flow_logs_select ON public.conversation_flow_logs
  FOR SELECT USING (
    public.effective_owner_id() = user_id
    AND (
      flow_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversation_flows f
        WHERE f.id = flow_id
          AND f.user_id = public.effective_owner_id()
          AND (f.scope = 'team' OR public.can_access_profile_scope(f.owner_profile_id))
      )
    )
  );
CREATE POLICY conversation_flow_logs_insert ON public.conversation_flow_logs
  FOR INSERT WITH CHECK (public.effective_owner_id() = user_id);
CREATE POLICY conversation_flow_logs_update ON public.conversation_flow_logs
  FOR UPDATE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());
CREATE POLICY conversation_flow_logs_delete ON public.conversation_flow_logs
  FOR DELETE USING (public.effective_owner_id() = user_id AND public.current_member_is_admin());
