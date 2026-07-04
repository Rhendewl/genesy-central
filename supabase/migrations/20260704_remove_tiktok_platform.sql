-- ============================================================
-- Remove tiktok_pixel from appointment_conversions.platform
--
-- Platform scope: Meta Pixel / Meta CAPI and Google Ads only.
-- TikTok was never shipped (no provider, no UI, no data).
--
-- Safe: drops and recreates the CHECK constraint.
-- Idempotent: the DO block finds the constraint by content,
-- not by auto-generated name, and only drops if it exists.
-- ============================================================

DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM   pg_constraint
  WHERE  conrelid = 'appointment_conversions'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%platform%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE appointment_conversions DROP CONSTRAINT %I', c_name);
  END IF;
END;
$$;

ALTER TABLE appointment_conversions
  ADD CONSTRAINT appointment_conversions_platform_check
  CHECK (platform IN ('meta_pixel', 'google_ads'));
