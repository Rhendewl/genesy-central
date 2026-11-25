-- =============================================================================
-- Esteira das IAs (Alfred e Bruce)
--
-- Mostra em tempo real o que os agentes do Telegram estão fazendo, do pedido
-- até o que está no ar, e permite aprovar ou pedir ajuste pela plataforma.
--
-- Escrita: só pelo servidor (service role), via /api/esteira/agente/* (bots,
-- autenticados por segredo) e /api/esteira/* (painel, sessão de owner/admin).
-- Leitura: owner e admins da conta, por RLS — é o que o Realtime usa.
-- Idempotente: pode ser aplicada mais de uma vez.
-- =============================================================================

-- ── 1. Itens da esteira (cada trabalho de um agente) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.esteira_itens (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agente               text NOT NULL CHECK (agente IN ('alfred','bruce')),
  ref                  text NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 120),
  cliente              text CHECK (cliente IS NULL OR char_length(cliente) <= 120),
  titulo               text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
  detalhe              text CHECK (detalhe IS NULL OR char_length(detalhe) <= 600),
  etapa                text NOT NULL DEFAULT 'pedido'
                         CHECK (etapa IN ('pedido','produzindo','esperando','aprovado','no_ar','concluido','cancelado')),
  etapa_desde          timestamptz NOT NULL DEFAULT now(),
  progresso            integer CHECK (progresso IS NULL OR progresso BETWEEN 0 AND 100),
  passo_atual          text CHECK (passo_atual IS NULL OR char_length(passo_atual) <= 200),
  links                jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisao              text CHECK (decisao IS NULL OR decisao IN ('aprovado','ajuste')),
  decisao_nota         text CHECK (decisao_nota IS NULL OR char_length(decisao_nota) <= 1000),
  decidido_por         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em          timestamptz,
  decisao_entregue_em  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agente, ref)
);

CREATE INDEX IF NOT EXISTS esteira_itens_user_etapa_idx
  ON public.esteira_itens (user_id, etapa, updated_at DESC);
CREATE INDEX IF NOT EXISTS esteira_itens_decisao_pendente_idx
  ON public.esteira_itens (user_id, agente)
  WHERE decisao IS NOT NULL AND decisao_entregue_em IS NULL;

-- ── 2. Eventos (o feed "Acontecendo agora") ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.esteira_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES public.esteira_itens(id) ON DELETE CASCADE,
  agente      text CHECK (agente IS NULL OR agente IN ('alfred','bruce')),
  tipo        text NOT NULL DEFAULT 'mensagem'
                CHECK (tipo IN ('etapa','passo','mensagem','decisao','aprendizado','proposta')),
  texto       text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 400),
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS esteira_eventos_user_created_idx
  ON public.esteira_eventos (user_id, created_at DESC);

-- ── 3. Aprendizados (regras salvas e propostas para aprovar) ─────────────────
CREATE TABLE IF NOT EXISTS public.esteira_aprendizados (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agente               text NOT NULL CHECK (agente IN ('alfred','bruce')),
  ref                  text CHECK (ref IS NULL OR char_length(ref) <= 120),
  tipo                 text NOT NULL CHECK (tipo IN ('regra','proposta')),
  escopo               text CHECK (escopo IS NULL OR char_length(escopo) <= 120),
  texto                text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 600),
  status               text NOT NULL DEFAULT 'salva'
                         CHECK (status IN ('salva','pendente','aceita','descartada')),
  decidido_por         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em          timestamptz,
  decisao_entregue_em  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agente, ref)
);

CREATE INDEX IF NOT EXISTS esteira_aprendizados_user_created_idx
  ON public.esteira_aprendizados (user_id, created_at DESC);

-- ── 4. Segurança: leitura para owner/admin da conta; escrita só service role ─
ALTER TABLE public.esteira_itens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esteira_eventos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esteira_aprendizados ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.esteira_itens, public.esteira_eventos, public.esteira_aprendizados FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.esteira_itens, public.esteira_eventos, public.esteira_aprendizados FROM authenticated;
GRANT SELECT ON public.esteira_itens, public.esteira_eventos, public.esteira_aprendizados TO authenticated;
GRANT ALL ON public.esteira_itens, public.esteira_eventos, public.esteira_aprendizados TO service_role;

DROP POLICY IF EXISTS "esteira_itens_select" ON public.esteira_itens;
CREATE POLICY "esteira_itens_select" ON public.esteira_itens FOR SELECT USING (
  user_id = public.effective_owner_id()
  AND (user_id = auth.uid() OR public.current_member_is_admin())
);

DROP POLICY IF EXISTS "esteira_eventos_select" ON public.esteira_eventos;
CREATE POLICY "esteira_eventos_select" ON public.esteira_eventos FOR SELECT USING (
  user_id = public.effective_owner_id()
  AND (user_id = auth.uid() OR public.current_member_is_admin())
);

DROP POLICY IF EXISTS "esteira_aprendizados_select" ON public.esteira_aprendizados;
CREATE POLICY "esteira_aprendizados_select" ON public.esteira_aprendizados FOR SELECT USING (
  user_id = public.effective_owner_id()
  AND (user_id = auth.uid() OR public.current_member_is_admin())
);

-- ── 5. Entrega das decisões aos agentes (sem corrida entre duas consultas) ───
CREATE OR REPLACE FUNCTION public.esteira_claim_decisoes(p_owner uuid, p_agente text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_itens jsonb;
  v_aprendizados jsonb;
BEGIN
  WITH claimed AS (
    UPDATE esteira_itens SET decisao_entregue_em = now()
    WHERE id IN (
      SELECT id FROM esteira_itens
      WHERE user_id = p_owner AND agente = p_agente
        AND decisao IS NOT NULL AND decisao_entregue_em IS NULL
      ORDER BY decidido_em
      FOR UPDATE SKIP LOCKED
      LIMIT 20
    )
    RETURNING ref, titulo, cliente, decisao, decisao_nota, decidido_em
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(claimed) ORDER BY decidido_em), '[]'::jsonb) INTO v_itens FROM claimed;

  WITH claimed AS (
    UPDATE esteira_aprendizados SET decisao_entregue_em = now()
    WHERE id IN (
      SELECT id FROM esteira_aprendizados
      WHERE user_id = p_owner AND agente = p_agente AND tipo = 'proposta'
        AND status IN ('aceita','descartada') AND decisao_entregue_em IS NULL
      ORDER BY decidido_em
      FOR UPDATE SKIP LOCKED
      LIMIT 20
    )
    RETURNING ref, escopo, texto, status, decidido_em
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(claimed) ORDER BY decidido_em), '[]'::jsonb) INTO v_aprendizados FROM claimed;

  RETURN jsonb_build_object('itens', v_itens, 'aprendizados', v_aprendizados);
END;
$$;
REVOKE ALL ON FUNCTION public.esteira_claim_decisoes(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.esteira_claim_decisoes(uuid, text) TO service_role;

-- ── 6. Realtime ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.esteira_itens;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.esteira_eventos;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.esteira_aprendizados;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.esteira_itens IS 'Trabalhos dos agentes de IA (Alfred, Bruce) e a etapa de cada um na esteira.';
COMMENT ON TABLE public.esteira_eventos IS 'Linha do tempo da esteira das IAs (feed em tempo real).';
COMMENT ON TABLE public.esteira_aprendizados IS 'Regras aprendidas pelos agentes e propostas aguardando aprovação.';
