-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — Fase 2: Notas (editor estilo Notion)
--
-- Design decisions:
--   • content é jsonb (documento TipTap), não HTML — notas são documentos reais
--     (tabelas, checklists, blocos), JSON é a representação nativa.
--   • Mesmo padrão de ownership compartilhado da Fase 1 (effective_owner_id).
--   • workspace_note_revisions fica reservada (estrutura preparada, sem escrita
--     nesta fase) — atende o pedido de "histórico de edição futuro" sem
--     implementar a funcionalidade ainda.
--   • Sem tabela de anexos: imagens/anexos viram nodes dentro do próprio
--     content; limpeza de storage é por prefixo (workspace-notes/{user}/{note}),
--     não por linha rastreada.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid        NOT NULL REFERENCES auth.users(id),
  title      text        NOT NULL DEFAULT 'Nota sem título',
  content    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  cover_url  text,
  color      text,
  tags       text[]      NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_notes_user_updated_idx
  ON public.workspace_notes (user_id, updated_at DESC);

SELECT public.ensure_updated_at_trigger('workspace_notes');


-- Reservada para o futuro recurso de histórico de edição — nada escreve
-- nesta tabela ainda nesta fase.
CREATE TABLE IF NOT EXISTS public.workspace_note_revisions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id    uuid        NOT NULL REFERENCES public.workspace_notes(id) ON DELETE CASCADE,
  content    jsonb       NOT NULL,
  created_by uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_note_revisions_note_idx
  ON public.workspace_note_revisions (note_id, created_at DESC);


-- ── Ownership trigger + RLS (mesmo padrão de 20260712) ────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['workspace_notes','workspace_note_revisions'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_owner_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_owner_%I
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

SELECT public.apply_standard_rls('workspace_notes');
SELECT public.apply_standard_rls('workspace_note_revisions');


-- ── Realtime (só a tabela de notas — revisões não têm leitor ao vivo ainda) ───

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_notes;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
