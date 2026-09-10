-- One-off (spec 2026-09-10 WP6.4): pre-existing early opt-ins get the
-- founding-interest flag so the nurture letter can address them as such.
-- Postgres only (jsonb). Run once against Neon after 0014 is applied; idempotent.
BEGIN;
UPDATE subscribers
SET prefs = (coalesce(prefs::jsonb, '{}'::jsonb) || '{"founding_interest": true}'::jsonb)::json
WHERE early_alerts = true
  AND coalesce(prefs::jsonb->>'founding_interest', '') <> 'true';
COMMIT;
-- verify: SELECT count(*) FROM subscribers WHERE prefs::jsonb->>'founding_interest' = 'true';
