-- Enable the home-easter template (WP7 „Grįžtu namo" persona).
-- run 2027-01-07 — adds ~10 specs/day; check the next run's api_calls stays under ~950.
-- Seeded disabled on 2026-09-10 so the Christmas and Easter windows do not both spend
-- scan headroom from day one (ten HOME_VFR reverse routes × one template, ≈ +50–65
-- api_calls/day at the observed 5–6 calls/spec). Seeds are insert-only, so this flip
-- must be SQL (skrendam/seeds.py never re-enables a row).
BEGIN;
UPDATE deal_templates SET enabled = true, updated_at = now()
WHERE slug = 'home-easter';
COMMIT;
-- verify: SELECT slug, enabled, fixed_start_date, fixed_end_date FROM deal_templates
--         WHERE slug LIKE 'home-%' ORDER BY fixed_start_date;
