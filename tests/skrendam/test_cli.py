from datetime import date

from skrendam.cli import run_scan_command
from skrendam.db import models


class FakeBackend:
    def search_calendar(self, spec):
        return [(date(2026, 7, 29), None, 30.0)]
    def search_flights(self, o, d, td, rd, cabin):
        return [{"price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}}], "booking_url": "https://x"}]


def test_run_scan_command_seeds_and_scans(session):
    summary = run_scan_command(session_factory=lambda: session, backend=FakeBackend(),
                               today=date(2026, 6, 2), seed=True)
    assert summary.templates_scanned == 6
    assert session.query(models.Candidate).count() >= 1
