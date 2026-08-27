"""Checkpoint/resume: retries must not re-scan specs an earlier attempt finished."""

from datetime import date, datetime

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.scanning.checkpoint import ScanCheckpoint, spec_key
from skrendam.scanning.orchestrator import run_scan
from skrendam.scanning.types import SearchSpec
from tests.skrendam.test_orchestrator import FakeBackend, _seed

SPEC = SearchSpec(
    origin="VNO",
    destination="BCN",
    trip_type="oneway",
    window_start=date(2026, 7, 1),
    window_end=date(2026, 8, 31),
    duration_days=None,
)


def test_checkpoint_file_roundtrip_and_day_reset(tmp_path):
    path = str(tmp_path / "ck.json")
    ck = ScanCheckpoint(path, date(2026, 8, 27))
    assert not ck.is_done(SPEC)
    ck.mark(SPEC)
    assert ck.is_done(SPEC)

    # same day, new process → resumes
    again = ScanCheckpoint(path, date(2026, 8, 27))
    assert again.is_done(SPEC)

    # next day → clean slate
    tomorrow = ScanCheckpoint(path, date(2026, 8, 28))
    assert not tomorrow.is_done(SPEC)


def test_corrupt_checkpoint_never_blocks(tmp_path):
    path = tmp_path / "ck.json"
    path.write_text("{not json")
    ck = ScanCheckpoint(str(path), date(2026, 8, 27))
    assert not ck.is_done(SPEC)
    ck.mark(SPEC)  # must overwrite the corrupt file without raising
    assert ScanCheckpoint(str(path), date(2026, 8, 27)).is_done(SPEC)


class CountingBackend(FakeBackend):
    def __init__(self):
        """Count calendar searches so tests can assert what got skipped."""
        self.calendar_calls = 0

    def search_calendar(self, spec):
        self.calendar_calls += 1
        return super().search_calendar(spec)


def test_second_attempt_skips_committed_specs(tmp_path, session):
    """The BotGuard rule in code: attempt 2 must not re-search attempt 1's specs."""
    _seed(session)
    path = str(tmp_path / "ck.json")

    b1 = CountingBackend()
    s1 = run_scan(
        session,
        today=date(2026, 6, 2),
        adapter=FliAdapter(b1, pace=lambda: None),
        now=datetime(2026, 6, 2, 6, 0),
        checkpoint=ScanCheckpoint(path, date(2026, 6, 2)),
    )
    assert b1.calendar_calls == 1 and s1.candidates_found == 1

    # fresh checkpoint object simulates the wrapper's retry (new process)
    b2 = CountingBackend()
    s2 = run_scan(
        session,
        today=date(2026, 6, 2),
        adapter=FliAdapter(b2, pace=lambda: None),
        now=datetime(2026, 6, 2, 7, 0),
        checkpoint=ScanCheckpoint(path, date(2026, 6, 2)),
    )
    assert b2.calendar_calls == 0  # nothing re-searched
    assert s2.routes_scanned == 0
    # both runs completed; candidate count unchanged (no duplicates)
    assert session.query(models.Candidate).count() == 1
    runs = session.query(models.ScanRun).order_by(models.ScanRun.id).all()
    assert [r.status for r in runs] == ["completed", "completed"]
    assert (runs[1].health or {}).get("plan", {}).get("resumed_from_checkpoint") == 1


def test_no_checkpoint_keeps_old_behavior(session):
    _seed(session)
    b = CountingBackend()
    run_scan(session, today=date(2026, 6, 2), adapter=FliAdapter(b, pace=lambda: None))
    b2 = CountingBackend()
    run_scan(session, today=date(2026, 6, 2), adapter=FliAdapter(b2, pace=lambda: None))
    assert b.calendar_calls == 1 and b2.calendar_calls == 1  # both scan fully


def test_spec_key_distinguishes_windows_and_trip_types():
    other_window = SearchSpec(
        origin="VNO",
        destination="BCN",
        trip_type="oneway",
        window_start=date(2026, 9, 1),
        window_end=date(2026, 10, 31),
        duration_days=None,
    )
    roundtrip = SearchSpec(
        origin="VNO",
        destination="BCN",
        trip_type="roundtrip",
        window_start=date(2026, 7, 1),
        window_end=date(2026, 8, 31),
        duration_days=7,
    )
    assert len({spec_key(SPEC), spec_key(other_window), spec_key(roundtrip)}) == 3
