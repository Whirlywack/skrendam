"""Entrypoints: run-scan, calibrate, seed. Backend/session injectable for tests."""

import argparse
from datetime import date

from skrendam.config import Settings
from skrendam.db.session import make_sessionmaker
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.pacing import TokenBucket
from skrendam.scanning.orchestrator import ScanSummary, run_scan
from skrendam.seeds import seed_all


def _real_backend():
    from skrendam.fli_adapter.live_backend import LiveFliBackend

    return LiveFliBackend()


def worker_command() -> None:
    """Run the request-queue poller (blocks). Used by the always-on worker host."""
    from skrendam.worker import poll_loop

    settings = Settings()
    make_session = make_sessionmaker(settings)
    backend = _real_backend()

    bucket = TokenBucket(settings.min_call_interval_seconds, settings.pacing_jitter_seconds)

    def make_adapter():
        # fresh adapter per request (CallLog/cache isolation) — but ONE shared bucket,
        # so pacing holds across the whole batch
        return FliAdapter(backend, pace=bucket.acquire)

    poll_loop(
        make_session,
        make_adapter,
        scanner_version=settings.scanner_version,
        tail_rotation_days=settings.tail_rotation_days,
    )


def run_scan_command(
    session_factory=None, backend=None, today=None, seed=False, all_routes=False
) -> ScanSummary:
    settings = Settings()
    session = (session_factory or make_sessionmaker(settings))()
    backend = backend or _real_backend()
    today = today or date.today()
    bucket = TokenBucket(settings.min_call_interval_seconds, settings.pacing_jitter_seconds)
    adapter = FliAdapter(backend, pace=bucket.acquire)
    if seed:
        seed_all(session)
    return run_scan(
        session,
        today=today,
        adapter=adapter,
        scanner_version=settings.scanner_version,
        tail_rotation_days=settings.tail_rotation_days,
        all_routes=all_routes,
    )


def main():
    parser = argparse.ArgumentParser(prog="skrendam")
    sub = parser.add_subparsers(dest="cmd", required=True)
    rs = sub.add_parser("run-scan")
    rs.add_argument("--seed", action="store_true")
    rs.add_argument(
        "--all-routes", action="store_true", help="scan the full network, ignoring cohort rotation"
    )
    sub.add_parser("seed")
    sub.add_parser("calibrate")
    sub.add_parser("worker")
    sub.add_parser("analyze")
    args = parser.parse_args()

    if args.cmd == "run-scan":
        s = run_scan_command(seed=args.seed, all_routes=args.all_routes)
        print(
            f"scan complete: {s.candidates_found} candidates, {s.matches_created} matches, "
            f"{s.errors} errors"
        )
        if s.aborted:
            print("WARNING: scan FAILED — the circuit breaker aborted the run partway.")
            if s.health is not None:
                for reason in s.health.reasons:
                    print(f"  - {reason}")
            raise SystemExit(2)
        if s.health is not None and s.health.degraded:
            print("WARNING: scan DEGRADED — results are not a trustworthy picture of the market:")
            for reason in s.health.reasons:
                print(f"  - {reason}")
            raise SystemExit(2)
    elif args.cmd == "seed":
        session = make_sessionmaker()()
        seed_all(session)
        print("seeded")
    elif args.cmd == "calibrate":
        from skrendam.calibrate import calibrate

        calibrate()
    elif args.cmd == "worker":
        worker_command()
    elif args.cmd == "analyze":
        from skrendam import analyze

        session = make_sessionmaker()()
        print(analyze.format_report(analyze.analyze(session)))


if __name__ == "__main__":
    main()
