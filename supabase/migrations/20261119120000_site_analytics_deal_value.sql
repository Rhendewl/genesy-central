-- Valor do negócio aplicado aos leads que chegam pelo site institucional.
alter table public.site_analytics_settings
  add column if not exists deal_value numeric not null default 0
  check (deal_value >= 0);
