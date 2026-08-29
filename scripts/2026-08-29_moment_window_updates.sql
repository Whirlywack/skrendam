-- Moment-structure audit fixes (2026-08-29) - one-off config update for the
-- LIVE DB (Neon `yip`, dev branch). seeds.py is insert-only, so the six
-- UPDATEs below must be applied by hand; the four INSERTs mirror the new
-- seeds.py templates exactly and are safe to skip on a DB where `seed_all`
-- has already run with the new code (ON CONFLICT guards them).
--
-- Apply with: psql "$DATABASE_URL" -f scripts/2026-08-29_moment_window_updates.sql

BEGIN;

-- 1. plan-ahead-summer: seasonal Jun-Aug with a 60-day booking lead.
--    (Was relative 60-180d: scanned in autumn it pointed at Oct-Feb - 733
--    mislabeled candidates on 2026-08-29.)
UPDATE deal_templates SET
  date_window_type = 'seasonal',
  season_start_mmdd = '06-01',
  season_end_mmdd = '08-31',
  rel_offset_start_days = 60,
  rel_offset_end_days = NULL,
  updated_at = now()
WHERE slug = 'plan-ahead-summer';

-- 2. last-warm-days ends Oct 31; November moves to the verified-warm template.
UPDATE deal_templates SET
  season_end_mmdd = '10-31',
  name = 'Last warm days (October)',
  updated_at = now()
WHERE slug = 'last-warm-days';

-- 3. winter-sun cedes November to last-warm-days.
UPDATE deal_templates SET season_start_mmdd = '12-01', updated_at = now()
WHERE slug = 'winter-sun-escape';

-- 4. Christmas markets open ~Nov 20-25; catch the pre-Advent weekends.
UPDATE deal_templates SET season_start_mmdd = '11-20', updated_at = now()
WHERE slug = 'christmas-markets';

-- 5. last-minute-weekends: 24d covers three full weekends whatever day the scan runs.
UPDATE deal_templates SET rel_offset_end_days = 24, updated_at = now()
WHERE slug = 'last-minute-weekends';

-- 6. ski-alps: drop SZG (no seeded route - dead entry).
UPDATE deal_templates SET
  included_destinations = '["GVA","GNB","TRN","ZRH","MUC"]'::json,
  updated_at = now()
WHERE slug = 'ski-alps';

-- 7-10. New templates (mirror seeds.py; November warm set + LT school breaks
--       2026-27 per SMSM: autumn Nov 2-8, Feb 15-21, spring Mar 22 - Apr 4).
INSERT INTO deal_templates (
  slug, name, enabled, audience_segment_id, travel_moment_id, priority,
  trip_type, nearby_origins_allowed, date_window_type,
  season_start_mmdd, season_end_mmdd, fixed_start_date, fixed_end_date,
  included_destinations, trip_len_min_days, trip_len_max_days, max_stops,
  max_price_eur, min_discount_pct, allow_smaller_discount_if_under_price,
  cabin, allow_overnight_layover, allow_airport_change, allow_self_transfer,
  allow_mixed_cabin, prefer_direct, family_friendly_times_only,
  public_label, newsletter_tag, content_angle, publish_channel_default,
  created_at, updated_at
) VALUES
  ('last-warm-days-november', 'Last warm days (November, verified-warm set)', true,
   (SELECT id FROM audience_segments WHERE slug = 'flexible_adults'),
   (SELECT id FROM travel_moments WHERE slug = 'last_warm_days'), 0,
   'roundtrip', false, 'seasonal', '11-01', '11-30', NULL, NULL,
   '["LCA","PFO","AYT","MLA","TFS","LPA","FNC","RAK","HRG","SSH"]'::json,
   3, 10, 1, 150, 25, false, 'ECONOMY', true, true, true, true, false, false,
   'Last warm days', 'last_warm',
   'One last sun trip before winter - where it is actually still warm',
   'public', now(), now()),
  ('family-autumn-sun', 'Family autumn-break sun', true,
   (SELECT id FROM audience_segments WHERE slug = 'families'),
   (SELECT id FROM travel_moments WHERE slug = 'school_holidays'), 0,
   'roundtrip', false, 'fixed', NULL, NULL, '2026-10-30', '2026-11-04',
   '["LCA","PFO","AYT","MLA","TFS","LPA","FNC","RAK","HRG","SSH"]'::json,
   4, 9, 1, 300, 25, false, 'ECONOMY', false, false, true, true, false, true,
   'Family sun', 'family_sun',
   'Autumn-break sun (Nov 2-8) without package prices', 'public', now(), now()),
  ('family-feb-sun', 'Family February-break sun', true,
   (SELECT id FROM audience_segments WHERE slug = 'families'),
   (SELECT id FROM travel_moments WHERE slug = 'school_holidays'), 0,
   'roundtrip', false, 'fixed', NULL, NULL, '2027-02-12', '2027-02-17',
   '["TFS","LPA","HRG","SSH","DXB","RAK"]'::json,
   4, 9, 1, 350, 25, false, 'ECONOMY', false, false, true, true, false, true,
   'Family sun', 'family_sun',
   'February-break warmth (Feb 15-21) - real sun only', 'public', now(), now()),
  ('family-easter-sun', 'Family Easter-break sun', true,
   (SELECT id FROM audience_segments WHERE slug = 'families'),
   (SELECT id FROM travel_moments WHERE slug = 'school_holidays'), 0,
   'roundtrip', false, 'fixed', NULL, NULL, '2027-03-19', '2027-03-31',
   '["TFS","LPA","FNC","HRG","SSH","RAK","DXB","LCA","PFO"]'::json,
   4, 9, 1, 350, 25, false, 'ECONOMY', false, false, true, true, false, true,
   'Family sun', 'family_sun',
   'Easter-break sun (Mar 22 - Apr 4)', 'public', now(), now())
ON CONFLICT (slug) DO NOTHING;

COMMIT;
