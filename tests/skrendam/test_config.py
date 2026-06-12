import pytest
from pydantic import ValidationError

from skrendam.config import Settings


def test_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", "sqlite:///x.db")
    monkeypatch.setenv("SKRENDAM_FLI_TIMEOUT", "25")
    s = Settings()
    assert s.database_url == "sqlite:///x.db"
    assert s.fli_timeout == 25.0
    assert s.min_call_interval_seconds >= 1.0  # default pacing
    assert s.scanner_version  # non-empty


def test_tail_rotation_days_default_and_env(monkeypatch):
    assert Settings().tail_rotation_days == 10
    monkeypatch.setenv("SKRENDAM_TAIL_ROTATION_DAYS", "3")
    assert Settings().tail_rotation_days == 3


@pytest.mark.parametrize("bad_value", ["0", "-1", "-10"])
def test_tail_rotation_days_rejects_zero_and_negative(monkeypatch, bad_value):
    monkeypatch.setenv("SKRENDAM_TAIL_ROTATION_DAYS", bad_value)
    with pytest.raises(ValidationError):
        Settings()
