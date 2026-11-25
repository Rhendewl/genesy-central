-- =============================================================================
-- Biblioteca de criativos (conector MCP da plataforma)
--
-- Os criativos aprovados pelos agentes (Alfred) ou pelos projetos do Claude
-- ficam aqui, por cliente, com o arquivo no bucket público "criativos"
-- (pasta biblioteca/). A URL pública serve direto para Meta Ads e Instagram.
--
-- Escrita só pelo servidor (service role, via /api/mcp). Leitura: dono da conta
-- ou admin (esteira_pode_ver, criada na migração da Esteira).
-- Sem funções nem blocos com cifrão duplo, para rodar no SQL Editor self-hosted.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.criativos_biblioteca (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id        uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  cliente_nome      text CHECK (cliente_nome IS NULL OR char_length(cliente_nome) <= 120),
  titulo            text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
  formato           text NOT NULL DEFAULT 'feed' CHECK (formato IN ('feed','stories','reels','carrossel','outro')),
  status            text NOT NULL DEFAULT 'aprovado' CHECK (status IN ('rascunho','aprovado','em_campanha','arquivado')),
  storage_path      text NOT NULL,
  url               text NOT NULL,
  mime              text NOT NULL,
  tamanho_bytes     integer,
  origem            text NOT NULL DEFAULT 'claude' CHECK (origem IN ('alfred','bruce','claude','equipe')),
  meta_campanha_id  text CHECK (meta_campanha_id IS NULL OR char_length(meta_campanha_id) <= 60),
  notas             text CHECK (notas IS NULL OR char_length(notas) <= 1000),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS criativos_biblioteca_user_cliente_idx ON public.criativos_biblioteca (user_id, cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS criativos_biblioteca_user_status_idx ON public.criativos_biblioteca (user_id, status, created_at DESC);

ALTER TABLE public.criativos_biblioteca ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.criativos_biblioteca FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.criativos_biblioteca FROM authenticated;
GRANT SELECT ON public.criativos_biblioteca TO authenticated;
GRANT ALL ON public.criativos_biblioteca TO service_role;

DROP POLICY IF EXISTS "criativos_biblioteca_select" ON public.criativos_biblioteca;
CREATE POLICY "criativos_biblioteca_select" ON public.criativos_biblioteca
  FOR SELECT USING (public.esteira_pode_ver(user_id));

COMMENT ON TABLE public.criativos_biblioteca IS 'Criativos aprovados por cliente, salvos pelo conector MCP (Alfred, Bruce e projetos do Claude).';
