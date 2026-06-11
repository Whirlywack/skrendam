"""Cross-process request queue: the Next.js admin enqueues ScanRequest rows;
this worker (polled by the scheduler) executes them via the Python fli stack.
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.scanning.orchestrator import run_scan
from skrendam.verification import recheck_candidate

_log = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Naive UTC, matching the rest of the schema, without deprecated utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def process_pending_requests(
    session: Session,
    make_adapter,
    *,
    today: date,
    now: datetime,
    scanner_version: str = "0.1.0",
    limit: int = 5,
) -> int:
    """Claim up to `limit` queued scan_requests (oldest first) and execute each.

    Returns the number processed. A single request's error is recorded on the row
    (status="error") and never aborts the batch.

    Args:
        session: SQLAlchemy session.
        make_adapter: Zero-argument callable that returns a fresh FliAdapter.  A new
            adapter is created per request so that per-run CallLog/cache does not leak
            across requests.
        today: The current date (injected for testability).
        now: The current datetime (injected for testability).
        scanner_version: Version string stamped onto scan_runs rows.
        limit: Maximum number of queued requests to claim in one batch.

    V1 assumes a SINGLE worker process: the claim (SELECT queued -> UPDATE running)
    is not atomic, so concurrent workers could double-claim, and a crash mid-batch
    leaves a row stuck in "running" with no auto-recovery. A future version should
    use SELECT ... FOR UPDATE SKIP LOCKED and/or a requeue-stuck sweep.

    """
    pending = (
        session.query(models.ScanRequest)
        .filter(models.ScanRequest.status == "queued")
        .order_by(models.ScanRequest.created_at)
        .limit(limit)
        .all()
    )
    processed = 0
    for req in pending:
        req.status = "running"
        req.started_at = now
        session.commit()
        try:
            # fresh adapter per request: per-run CallLog/cache must not leak across requests
            adapter = make_adapter()
            if req.kind == "recheck":
                cand = session.get(models.Candidate, req.candidate_id)
                if cand is None:
                    raise ValueError(f"candidate {req.candidate_id} not found")
                check = recheck_candidate(session, cand, adapter, now)
                req.result_summary = {"available": check.available, "price": check.price}
            elif req.kind == "full_scan":
                summary = run_scan(
                    session, today=today, adapter=adapter, scanner_version=scanner_version
                )
                req.result_summary = {
                    "candidates_found": summary.candidates_found,
                    "matches_created": summary.matches_created,
                    "errors": summary.errors,
                    "health": summary.health.status if summary.health else "unknown",
                    "health_reasons": summary.health.reasons if summary.health else [],
                    "aborted": summary.aborted,
                }
            else:
                raise ValueError(f"unknown kind {req.kind!r}")
            req.status = "done"
        except Exception as exc:  # noqa: BLE001 — record and continue
            req.status = "error"
            req.error = str(exc)
        finally:
            req.finished_at = _utcnow()
            session.commit()
        processed += 1
    return processed


def poll_loop(
    make_session,
    make_adapter,
    *,
    interval_seconds: float = 15.0,
    scanner_version: str = "0.1.0",
    now_fn=_utcnow,
    today_fn=date.today,
    stop=None,
) -> None:
    """Run process_pending_requests forever (or until stop() is truthy)."""
    while not (stop and stop()):
        try:
            session = make_session()
            try:
                process_pending_requests(
                    session,
                    make_adapter,
                    today=today_fn(),
                    now=now_fn(),
                    scanner_version=scanner_version,
                )
            finally:
                session.close()
        except Exception as exc:  # noqa: BLE001 — transient DB/network; log and keep polling
            _log.warning("poll iteration failed: %s", exc)
        if stop and stop():
            break
        time.sleep(interval_seconds)
