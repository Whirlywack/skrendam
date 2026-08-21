from skrendam.config import Settings


def test_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", "sqlite:///x.db")
    s = Settings()
    assert s.database_url == "sqlite:///x.db"
    assert s.min_call_interval_seconds >= 1.0  # default pacing
    assert s.scanner_version  # non-empty
