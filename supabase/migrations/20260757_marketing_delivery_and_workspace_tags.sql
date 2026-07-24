-- Marketing: separa a data de postagem da data de entrega e mantém as
-- etiquetas compartilhadas que serão replicadas na tarefa do Workspace.

ALTER TABLE public.marketing_contents
  ADD COLUMN IF NOT EXISTS delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS workspace_tag_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS marketing_contents_org_delivery_idx
  ON public.marketing_contents (organization_id, delivery_at)
  WHERE archived_at IS NULL AND delivery_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_contents_workspace_tags_idx
  ON public.marketing_contents USING gin (workspace_tag_ids);
