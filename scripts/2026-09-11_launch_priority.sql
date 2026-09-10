-- Launch priority (spec 2026-09-10 WP2.10): desk Today defaults to priority >= 100.
BEGIN;
UPDATE deal_templates SET priority = 100, updated_at = now()
WHERE slug IN ('family-autumn-sun','family-feb-sun','family-easter-sun','family-xmas-sun',
               'plan-ahead-summer','last-minute-weekends','christmas-markets',
               'last-warm-days-november','winter-sun-escape');
COMMIT;
-- verify: SELECT slug, priority FROM deal_templates ORDER BY priority DESC, slug;
