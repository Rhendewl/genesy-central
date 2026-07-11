-- ═══════════════════════════════════════════════════════════════════════════════
-- Bucket "onboarding-documents" — anexos de tarefas e documentos de projeto do
-- Onboarding.
--
-- Diferente do bucket "criativos" (compartilhado entre vários módulos, criado
-- manualmente sem RLS versionada), este bucket nasce com policies migration-
-- tracked desde o início — mesmo molde de "user-avatars" (20260727).
--
-- Path usado pelo servidor: "onboarding/<project_id>/<...>". Acesso é decidido
-- por can_access_onboarding_project(), lendo o project_id do primeiro segmento
-- de pasta do objeto.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-documents', 'onboarding-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "onboarding_documents_insert" ON storage.objects;
CREATE POLICY "onboarding_documents_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'onboarding-documents'
    AND public.can_access_onboarding_project(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "onboarding_documents_update" ON storage.objects;
CREATE POLICY "onboarding_documents_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'onboarding-documents'
    AND public.can_access_onboarding_project(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "onboarding_documents_delete" ON storage.objects;
CREATE POLICY "onboarding_documents_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'onboarding-documents'
    AND public.can_access_onboarding_project(((storage.foldername(name))[2])::uuid)
  );

-- Leitura: bucket público (getPublicUrl, mesmo padrão de user-avatars) — SELECT
-- em storage.objects ainda passa por RLS para operações autenticadas.
DROP POLICY IF EXISTS "onboarding_documents_select" ON storage.objects;
CREATE POLICY "onboarding_documents_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'onboarding-documents');
