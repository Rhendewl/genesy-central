-- Origem do acesso quando o link não tem UTM: códigos de clique de anúncios
-- (gclid, ttclid, msclkid, fbclid) ou navegador interno do Instagram/Facebook.
alter table public.site_analytics_sessions
  add column if not exists click_source text;

comment on column public.site_analytics_sessions.click_source is
  'Origem detectada sem UTM: google_ads, tiktok_ads, bing_ads, instagram, facebook ou meta (fbclid).';
