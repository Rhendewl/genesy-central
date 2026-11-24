-- Site Genesy com várias páginas: cada site ou landing page é uma linha de
-- site_analytics_settings (site_key próprio), com pipeline do CRM e Pixel independentes.

-- 1) E-mail do lead (as landing pages pedem e-mail além do WhatsApp).
alter table public.site_analytics_leads
  add column if not exists email text;

-- 2) Eventos passam a saber de qual página vieram (antes só pela sessão).
alter table public.site_analytics_events
  add column if not exists site_key text;

update public.site_analytics_events e
   set site_key = s.site_key
  from public.site_analytics_sessions s
 where e.session_id = s.id
   and e.site_key is null;

create index if not exists site_events_user_site_created_idx
  on public.site_analytics_events(user_id, site_key, created_at desc);
create index if not exists site_sessions_user_site_started_idx
  on public.site_analytics_sessions(user_id, site_key, started_at desc);
create index if not exists site_leads_user_site_created_idx
  on public.site_analytics_leads(user_id, site_key, created_at desc);

-- 3) Ordem das abas no módulo.
alter table public.site_analytics_settings
  add column if not exists sort_order integer not null default 0;

update public.site_analytics_settings set sort_order = 0 where site_key = 'genesycompany';

-- 4) Landing page "Scripts Imobiliários" (genesycompany.com/scripts).
--    Mesmo dono e mesmo Pixel do site institucional. Os leads entram na pipeline
--    "Genesy CRM" (primeira etapa ativa); se ela não existir, usa a pipeline do site.
insert into public.site_analytics_settings (
  user_id, site_key, name, domain, sort_order,
  crm_pipeline_id, crm_stage_id, assigned_to, deal_value,
  meta_pixel_enabled, meta_pixel_id, meta_capi_token_encrypted
)
select
  base.user_id, 'scripts-imobiliarios', 'Scripts Imobiliários', 'genesycompany.com/scripts', 10,
  coalesce(genesy.pipeline_id, base.crm_pipeline_id),
  coalesce(genesy.stage_id, base.crm_stage_id),
  base.assigned_to, base.deal_value,
  base.meta_pixel_enabled, base.meta_pixel_id, base.meta_capi_token_encrypted
from public.site_analytics_settings base
left join lateral (
  select p.id as pipeline_id,
         (select st.id from public.crm_stages st
           where st.pipeline_id = p.id and st.is_active
           order by st.order_index limit 1) as stage_id
    from public.crm_pipelines p
   where p.user_id = base.user_id
     and p.is_active
     and lower(p.name) like '%genesy crm%'
   order by p.created_at
   limit 1
) genesy on true
where base.site_key = 'genesycompany'
on conflict (user_id, site_key) do nothing;
