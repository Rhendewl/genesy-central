-- ═══════════════════════════════════════════════════════════════════════════════
-- Bucket "user-avatars" — upload de foto de perfil (Meu Perfil)
--
-- Bug: upload falha com "new row violates row-level security policy". Nenhuma
-- migration anterior criava este bucket nem suas policies (foi criado à mão
-- em algum momento, sem RLS de INSERT/UPDATE/DELETE para o dono do arquivo).
--
-- Caminho usado pelo client (src/hooks/useMyProfile.ts): "<auth.uid()>/avatar.<ext>"
-- — por isso a policy compara o primeiro segmento do path com auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "user_avatars_insert_own" ON storage.objects;
CREATE POLICY "user_avatars_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "user_avatars_update_own" ON storage.objects;
CREATE POLICY "user_avatars_update_own" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "user_avatars_delete_own" ON storage.objects;
CREATE POLICY "user_avatars_delete_own" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura: bucket é público (usado via getPublicUrl para exibir o avatar em
-- qualquer lugar da plataforma/equipe), mas o SELECT em storage.objects
-- ainda passa por RLS para operações autenticadas (listagem, etc).
DROP POLICY IF EXISTS "user_avatars_select_all" ON storage.objects;
CREATE POLICY "user_avatars_select_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');
