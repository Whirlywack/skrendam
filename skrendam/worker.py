"""Cross-process request queue: the Next.js admin enqueues ScanRequest rows;
this worker (polled by the scheduler) executes them via the Python fli stack."""

from __future__ import annotations

import time
from datetime import date, datetime

from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.scanning.orchestrator import run_scan
from skrendam.verification import recheck_candidate


def process_pending_requests(
    session: Session, adapter, *, today: date, now: datetime,
    scanner_version: str = "0.1.0", limit: int = 5,
) -> int:
    """Claim up to `limit` queued scan_requests (oldest first) and execute each.

    Returns the number processed. A single request's error is recorded on the row
    (status="error") and never aborts the batch.
    """
    pending = (
        session.query(models.ScanRequest)
        .filter(models.ScanRequest.status == "queued")
        .order_by(models.ScanRequest.created_at)
        .limit(limit).all()
    )
    processed = 0
    for req in pending:
        req.status = "running"
        req.started_at = now
        session.commit()
        try:
            if req.kind == "recheck":
                cand = session.get(models.Candidate, req.candidate_id)
                if cand is None:
                    raise ValueError(f"candidate {req.candidate_id} not found")
                check = recheck_candidate(session, cand, adapter, now)
                req.result_summary = {"available": check.available, "price": check.price}
            elif req.kind == "full_scan":
                summary = run_scan(session, today=today, adapter=adapter, scanner_version=scanner_version)
                req.result_summary = {
                    "candidates_found": summary.candidates_found,
                    "matches_created": summary.matches_created,
                    "errors": summary.errors,
                }
            else:
                raise ValueError(f"unknown kind {req.kind!r}")
            req.status = "done"
        except Exception as exc:  # noqa: BLE001 — record and continue
            req.status = "error"
            req.error = str(exc)
        finally:
            req.finished_at = now
            session.commit()
        processed += 1
    return processed


def poll_loop(
    make_session, make_adapter, *, interval_seconds: float = 15.0,
    scanner_version: str = "0.1.0", now_fn=datetime.utcnow, today_fn=date.today, stop=None,
) -> None:
    """Run process_pending_requests forever (or until stop() is truthy)."""
    while not (stop and stop()):
        session = make_session()
        try:
            process_pending_requests(
                session, make_adapter(), today=today_fn(), now=now_fn(), scanner_version=scanner_version,
            )
        finally:
            session.close()
        if stop and stop():
            break
        time.sleep(interval_seconds)
