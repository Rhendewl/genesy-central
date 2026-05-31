-- Armazena a URL do thumbnail de criativo por campanha,
-- preenchida durante o sync com a Meta API.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
