create table if not exists public.site_analytics_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_key text not null,
  name text not null default 'Site Genesy',
  domain text not null,
  form_slug text,
  crm_pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  crm_stage_id uuid references public.crm_stages(id) on delete set null,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, site_key)
);

create table if not exists public.site_analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_key text not null,
  visitor_id text,
  landing_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  device text,
  browser text,
  language text,
  page_views integer not null default 1,
  active_seconds integer not null default 0,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.site_analytics_sessions(id) on delete cascade,
  event_type text not null,
  path text,
  section text,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.site_analytics_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_key text not null,
  session_id uuid references public.site_analytics_sessions(id) on delete set null,
  name text not null,
  phone text not null,
  profile text,
  monthly_vgv text,
  source text not null default 'site_genesy',
  crm_lead_id uuid references public.leads(id) on delete set null,
  crm_pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  crm_stage_id uuid references public.crm_stages(id) on delete set null,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed','disabled')),
  sync_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists site_sessions_user_started_idx on public.site_analytics_sessions(user_id, started_at desc);
create index if not exists site_events_session_created_idx on public.site_analytics_events(session_id, created_at);
create index if not exists site_events_user_type_idx on public.site_analytics_events(user_id, event_type, created_at desc);
create index if not exists site_leads_user_created_idx on public.site_analytics_leads(user_id, created_at desc);

alter table public.site_analytics_settings enable row level security;
alter table public.site_analytics_sessions enable row level security;
alter table public.site_analytics_events enable row level security;
alter table public.site_analytics_leads enable row level security;

drop policy if exists "site analytics owner settings" on public.site_analytics_settings;
create policy "site analytics owner settings" on public.site_analytics_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "site analytics owner sessions" on public.site_analytics_sessions;
create policy "site analytics owner sessions" on public.site_analytics_sessions
  for select using (user_id = auth.uid());

drop policy if exists "site analytics owner events" on public.site_analytics_events;
create policy "site analytics owner events" on public.site_analytics_events
  for select using (user_id = auth.uid());

drop policy if exists "site analytics owner leads" on public.site_analytics_leads;
create policy "site analytics owner leads" on public.site_analytics_leads
  for select using (user_id = auth.uid());

comment on table public.site_analytics_sessions is 'Sessões anônimas e tempo ativo dos sites conectados ao Genesy Dashboard.';
comment on table public.site_analytics_leads is 'Leads capturados em sites e estado de sincronização com o CRM.';
