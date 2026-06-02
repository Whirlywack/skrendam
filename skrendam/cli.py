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


def run_scan_command(session_factory=None, backend=None, today=None, seed=False) -> ScanSummary:
    settings = Settings()
    session = (session_factory or make_sessionmaker(settings))()
    backend = backend or _real_backend()
    today = today or date.today()
    bucket = TokenBucket(settings.min_call_interval_seconds, settings.pacing_jitter_seconds)
    adapter = FliAdapter(backend, pace=bucket.acquire)
    if seed:
        seed_all(session)
    return run_scan(session, today=today, adapter=adapter,
                    scanner_version=settings.scanner_version)


def main():
    parser = argparse.ArgumentParser(prog="skrendam")
    sub = parser.add_subparsers(dest="cmd", required=True)
    rs = sub.add_parser("run-scan")
    rs.add_argument("--seed", action="store_true")
    sub.add_parser("seed")
    sub.add_parser("calibrate")
    args = parser.parse_args()

    if args.cmd == "run-scan":
        s = run_scan_command(seed=args.seed)
        print(f"scan complete: {s.candidates_found} candidates, {s.matches_created} matches, "
              f"{s.errors} errors")
    elif args.cmd == "seed":
        session = make_sessionmaker()()
        seed_all(session)
        print("seeded")
    elif args.cmd == "calibrate":
        from skrendam.calibrate import calibrate
        calibrate()


if __name__ == "__main__":
    main()
