-- Dias da semana permitidos para o envio automático da análise comercial.
-- PostgreSQL/JavaScript: 0 = domingo, 1 = segunda, ... 6 = sábado.

ALTER TABLE public.commercial_intelligence_settings
  ADD COLUMN IF NOT EXISTS send_weekdays integer[] NOT NULL DEFAULT '{1}';

ALTER TABLE public.commercial_intelligence_settings
  DROP CONSTRAINT IF EXISTS commercial_intelligence_settings_send_weekdays_check;

ALTER TABLE public.commercial_intelligence_settings
  ADD CONSTRAINT commercial_intelligence_settings_send_weekdays_check
  CHECK (
    cardinality(send_weekdays) BETWEEN 1 AND 7
    AND send_weekdays <@ ARRAY[0,1,2,3,4,5,6]::integer[]
  );

COMMENT ON COLUMN public.commercial_intelligence_settings.send_weekdays IS
  'Dias da semana em que uma coleta elegível pode ser criada e enviada (0=domingo, 6=sábado).';
