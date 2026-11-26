-- Landing page "Guia do Impulsionar" (genesycompany.com/impulsionar) no módulo Site Genesy.
-- Mesmo dono, pipeline, etapa, responsável, valor e Pixel da página "Scripts Imobiliários":
-- os leads entram no mesmo lugar e o Pixel é o mesmo. Tudo pode ser trocado depois na aba da página.
insert into public.site_analytics_settings (
  user_id, site_key, name, domain, sort_order,
  crm_pipeline_id, crm_stage_id, assigned_to, deal_value,
  meta_pixel_enabled, meta_pixel_id, meta_capi_token_encrypted
)
select
  base.user_id, 'guia-impulsionar', 'Guia do Impulsionar', 'genesycompany.com/impulsionar', 20,
  base.crm_pipeline_id, base.crm_stage_id, base.assigned_to, base.deal_value,
  base.meta_pixel_enabled, base.meta_pixel_id, base.meta_capi_token_encrypted
from public.site_analytics_settings base
where base.site_key = 'scripts-imobiliarios'
on conflict (user_id, site_key) do nothing;
