-- Peak-window start alignment (2026-09-11) - one-off config update for the LIVE
-- DB (Neon `yip`). The peak_windows rows were already seeded from the WP2 branch
-- with the school-break START dates (the first school-free day); seeds.py is
-- insert-only, so the four UPDATEs below must be applied by hand.
--
-- Why: the four school-break windows pair with fixed-window family templates whose
-- departure window opens on the FRIDAY BEFORE the break (a family flying out on
-- Friday evening starts the break at the destination). With the window opening on
-- the break's first school-free day, exactly the departure date the template
-- searches for fell OUTSIDE its own peak window and scored date_fit 1.0 instead of
-- 1.25. Starts now match the templates' fixed_start_date; ends are unchanged
-- (SMSM break end).
--
--   rudens-2026     Oct 31 -> Oct 30  (family-autumn-sun)
--   kaledos-2026    Dec 21 -> Dec 18  (family-xmas-sun)
--   ziemos-2027     Feb 15 -> Feb 12  (family-feb-sun)
--   pavasario-2027  Mar 22 -> Mar 19  (family-easter-sun)
--
-- Apply with: psql "$DATABASE_URL" -f scripts/2026-09-11_peak_window_starts.sql

BEGIN;

UPDATE peak_windows SET start_date = '2026-10-30'
WHERE slug = 'rudens-2026';

UPDATE peak_windows SET start_date = '2026-12-18'
WHERE slug = 'kaledos-2026';

UPDATE peak_windows SET start_date = '2027-02-12'
WHERE slug = 'ziemos-2027';

UPDATE peak_windows SET start_date = '2027-03-19'
WHERE slug = 'pavasario-2027';

-- Verify (expected 4 rows, each start_date equal to the paired template's
-- fixed_start_date; end_date untouched):
--
--   SELECT w.slug, w.start_date, w.end_date, t.slug AS template, t.fixed_start_date
--   FROM peak_windows w
--   JOIN deal_templates t ON t.slug = CASE w.slug
--     WHEN 'rudens-2026'    THEN 'family-autumn-sun'
--     WHEN 'kaledos-2026'   THEN 'family-xmas-sun'
--     WHEN 'ziemos-2027'    THEN 'family-feb-sun'
--     WHEN 'pavasario-2027' THEN 'family-easter-sun'
--   END
--   WHERE w.slug IN ('rudens-2026','kaledos-2026','ziemos-2027','pavasario-2027');

COMMIT;
