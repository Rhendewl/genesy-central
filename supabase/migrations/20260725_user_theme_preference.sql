-- Preferência de tema (dark/light) por usuário — segue a conta entre dispositivos.
-- Front-end aplica localStorage instantaneamente; este campo só corrige o
-- valor ao logar em um dispositivo/navegador novo.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark';

DO $$ BEGIN
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_theme_check CHECK (theme IN ('dark', 'light'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
