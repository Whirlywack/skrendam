from datetime import date, timedelta

import pytest

from skrendam.cli import run_scan_command
from skrendam.db import models
from skrendam.fli_adapter.health import HealthVerdict
from skrendam.scanning.orchestrator import ScanSummary


class FakeBackend:
    def search_calendar(self, spec):
        # Return 5 near-price dates so min_departure_dates=5 gate is satisfied.
        # All at the same price so the baseline median equals the fare price,
        # keeping s_anom via the under_price/under_psych path (same as the
        # original single-point backend did on main).
        base = date(2026, 7, 29)
        return [(base + timedelta(days=i), None, 30.0) for i in range(5)]

    def search_flights(self, o, d, td, rd, cabin):
        return [
            {
                "price": 30.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}}],
                "booking_url": "https://x",
            }
        ]


def test_run_scan_command_seeds_and_scans(session, monkeypatch):
    # Zero the token-bucket pacing: at the Phase A seed (159 routes, 10 templates)
    # real 1.5s inter-call sleeps would make this offline test take ~10 minutes.
    monkeypatch.setenv("SKRENDAM_MIN_CALL_INTERVAL_SECONDS", "0")
    monkeypatch.setenv("SKRENDAM_PACING_JITTER_SECONDS", "0")
    summary = run_scan_command(
        session_factory=lambda: session, backend=FakeBackend(), today=date(2026, 6, 2), seed=True
    )
    assert summary.templates_scanned == 10
    assert session.query(models.Candidate).count() >= 1


def test_run_scan_cli_exits_2_on_degraded(monkeypatch, capsys):
    import skrendam.cli as cli

    summary = ScanSummary()
    summary.health = HealthVerdict(
        status="degraded", reasons=["6/6 calendar searches returned no data"], metrics={}
    )
    monkeypatch.setattr(cli, "run_scan_command", lambda seed=False, all_routes=False: summary)
    monkeypatch.setattr("sys.argv", ["skrendam", "run-scan"])
    with pytest.raises(SystemExit) as ei:
        cli.main()
    assert ei.value.code == 2
    out = capsys.readouterr().out
    assert "DEGRADED" in out and "6/6 calendar searches" in out


def test_run_scan_cli_exits_2_on_breaker_abort(monkeypatch, capsys):
    import skrendam.cli as cli

    summary = ScanSummary()
    summary.aborted = True
    summary.health = HealthVerdict(status="healthy", reasons=[], metrics={})
    monkeypatch.setattr(cli, "run_scan_command", lambda seed=False, all_routes=False: summary)
    monkeypatch.setattr("sys.argv", ["skrendam", "run-scan"])
    with pytest.raises(SystemExit) as ei:
        cli.main()
    assert ei.value.code == 2
    assert "FAILED" in capsys.readouterr().out


def test_run_scan_cli_exits_normally_when_healthy(monkeypatch, capsys):
    import skrendam.cli as cli

    summary = ScanSummary()
    summary.health = HealthVerdict(status="healthy", reasons=[], metrics={})
    monkeypatch.setattr(cli, "run_scan_command", lambda seed=False, all_routes=False: summary)
    monkeypatch.setattr("sys.argv", ["skrendam", "run-scan"])
    cli.main()  # must not raise SystemExit
    assert "scan complete" in capsys.readouterr().out
