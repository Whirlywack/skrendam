-- Enable the home-summer template (WP7 „Grįžtu namo" persona). Run 2027-03-01.
-- Seeded disabled on 2026-09-10 because its fixed window (2027-06-20 → 2027-07-05)
-- was nine months out; enabling adds ~10 specs/day (ten HOME_VFR reverse routes × one
-- template, ≈ +50–65 api_calls/day at the observed 5.2–6.5 calls/spec). Seeds are
-- insert-only, so this flip must be SQL (skrendam/seeds.py never re-enables a row).
BEGIN;
UPDATE deal_templates SET enabled = true, updated_at = now()
WHERE slug = 'home-summer';
COMMIT;
-- verify: SELECT slug, enabled, fixed_start_date, fixed_end_date FROM deal_templates
--         WHERE slug LIKE 'home-%' ORDER BY fixed_start_date;
