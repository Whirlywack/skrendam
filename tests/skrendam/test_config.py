from skrendam.config import Settings


def test_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", "sqlite:///x.db")
    monkeypatch.setenv("SKRENDAM_FLI_TIMEOUT", "25")
    s = Settings()
    assert s.database_url == "sqlite:///x.db"
    assert s.fli_timeout == 25.0
    assert s.min_call_interval_seconds >= 1.0  # default pacing
    assert s.scanner_version  # non-empty
