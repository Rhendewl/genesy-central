-- Banner de visualização do link (og:image) escolhido no módulo Site Genesy, por site/página.
alter table public.site_analytics_settings
  add column if not exists og_image_url text;

comment on column public.site_analytics_settings.og_image_url is
  'Imagem que aparece ao compartilhar o link (WhatsApp, Instagram, Facebook). Vazio = imagem padrão do site.';

-- Pasta pública para os banners (o envio é feito pelo servidor do dashboard).
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update set public = true;
