-- Posts já publicados têm os arquivos removidos do storage (cleanupPublishedInstagramAssets),
-- o que deixa `paths` vazio. A regra antiga (1 a 10 arquivos) bloqueava essa limpeza e
-- derrubava a rota /api/cron/instagram-posts a cada minuto. Aplicada em produção em 20/11/2026.
ALTER TABLE public.marketing_instagram_scheduled_posts
  DROP CONSTRAINT IF EXISTS marketing_instagram_scheduled_posts_paths_check,
  ADD CONSTRAINT marketing_instagram_scheduled_posts_paths_check
    CHECK (cardinality(paths) <= 10 AND (cardinality(paths) >= 1 OR status = 'published'));
