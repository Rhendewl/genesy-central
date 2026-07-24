-- Formulários — separa formulários comuns/NPS e adiciona organização por pastas.

CREATE TABLE IF NOT EXISTS public.form_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  client_id  uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_folders_user_position_idx
  ON public.form_folders (user_id, position, name);
CREATE UNIQUE INDEX IF NOT EXISTS form_folders_user_client_uidx
  ON public.form_folders (user_id, client_id)
  WHERE client_id IS NOT NULL;

DROP TRIGGER IF EXISTS form_folders_updated_at ON public.form_folders;
CREATE TRIGGER form_folders_updated_at
  BEFORE UPDATE ON public.form_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.form_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_folders_select_owner" ON public.form_folders;
DROP POLICY IF EXISTS "form_folders_insert_owner" ON public.form_folders;
DROP POLICY IF EXISTS "form_folders_update_owner" ON public.form_folders;
DROP POLICY IF EXISTS "form_folders_delete_owner" ON public.form_folders;

CREATE POLICY "form_folders_select_owner" ON public.form_folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "form_folders_insert_owner" ON public.form_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "form_folders_update_owner" ON public.form_folders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "form_folders_delete_owner" ON public.form_folders
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.form_folders(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.forms
    ADD CONSTRAINT forms_origin_check CHECK (origin IN ('standard', 'nps'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS forms_user_origin_idx
  ON public.forms (user_id, origin, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS forms_folder_idx
  ON public.forms (folder_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS forms_client_idx
  ON public.forms (client_id) WHERE client_id IS NOT NULL;

-- Identifica NPS existentes a partir da integração que já era a fonte de verdade.
UPDATE public.forms AS f
SET
  origin = 'nps',
  client_id = ac.id
FROM public.form_integrations AS fi
LEFT JOIN public.agency_clients AS ac
  ON ac.id = CASE
    WHEN fi.settings->>'client_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (fi.settings->>'client_id')::uuid
    ELSE NULL
  END
WHERE fi.form_id = f.id
  AND fi.adapter = 'nps';

-- Cada cliente que já possui NPS ganha automaticamente uma pasta.
INSERT INTO public.form_folders (user_id, created_by, name, client_id)
SELECT DISTINCT
  f.user_id,
  f.user_id,
  COALESCE(ac.name, NULLIF(fi.settings->>'client_name', ''), 'Cliente'),
  f.client_id
FROM public.forms AS f
JOIN public.form_integrations AS fi ON fi.form_id = f.id AND fi.adapter = 'nps'
LEFT JOIN public.agency_clients AS ac ON ac.id = f.client_id
WHERE f.origin = 'nps'
  AND f.client_id IS NOT NULL
ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING;

UPDATE public.forms AS f
SET folder_id = ff.id
FROM public.form_folders AS ff
WHERE f.origin = 'nps'
  AND f.client_id IS NOT NULL
  AND ff.user_id = f.user_id
  AND ff.client_id = f.client_id
  AND f.folder_id IS NULL;

COMMENT ON COLUMN public.forms.origin IS
  'Origem funcional do formulário: standard ou nps.';
COMMENT ON COLUMN public.forms.folder_id IS
  'Pasta organizacional; não altera slug, publicação ou link público.';
COMMENT ON COLUMN public.form_folders.client_id IS
  'Quando preenchido, identifica uma pasta criada para um cliente.';
