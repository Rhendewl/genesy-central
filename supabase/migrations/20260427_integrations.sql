-- ─────────────────────────────────────────────────────────────────────────────
-- integrations — stores encrypted third-party API credentials per user
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists integrations (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  provider          text        not null,                          -- 'asaas' | 'stripe' | ...
  api_key_encrypted text        not null,                          -- AES-256-GCM (same format as meta_tokens)
  environment       text        not null default 'sandbox'
                                check (environment in ('sandbox', 'production')),
  status            text        not null default 'connected'
                                check (status in ('connected', 'error', 'disconnected')),
  last_sync_at      timestamptz,
  metadata          jsonb       default '{}'::jsonb,               -- e.g. { accountName, walletId }
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- one active integration per provider per user
  unique (user_id, provider)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists integrations_user_id_idx      on integrations (user_id);
create index if not exists integrations_user_provider_idx on integrations (user_id, provider);

-- ── Auto-updated timestamp ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists integrations_updated_at on integrations;
create trigger integrations_updated_at
  before update on integrations
  for each row execute function set_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table integrations enable row level security;

-- Users can only see and modify their own rows
create policy "owner_all" on integrations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
