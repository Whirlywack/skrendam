-- Reconcile scan_runs left in status='running' by interrupted runs (laptop
-- sleep / killed process) — desk journey review 2026-09-11, blocker 1.
-- Written, NOT run: apply by hand on the dev branch (11 rows on 2026-09-11)
-- and on production once. From this commit on, run_scan() does the same
-- UPDATE at the start of every run (skrendam/scanning/orchestrator.py,
-- _fail_orphaned_runs), so this is a one-off catch-up.
--
-- Timestamps in scan_runs are naive UTC (the engine writes utcnow()), hence
-- the `at time zone 'utc'` on both sides. The 6-hour cutoff matches
-- ORPHAN_RUN_AFTER and never touches a run that is genuinely in progress.

BEGIN;

SELECT id, started_at, status
  FROM scan_runs
 WHERE status = 'running'
   AND started_at < (now() AT TIME ZONE 'utc') - INTERVAL '6 hours'
 ORDER BY started_at;

UPDATE scan_runs
   SET status = 'failed',
       finished_at = now() AT TIME ZONE 'utc',
       health = '{"reasons": ["orphaned: never finished"]}'::json
 WHERE status = 'running'
   AND started_at < (now() AT TIME ZONE 'utc') - INTERVAL '6 hours';

COMMIT;
