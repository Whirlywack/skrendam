import subprocess


def test_autogenerate_reports_no_diff(tmp_path, monkeypatch):
    """After the initial migration, autogenerate should detect no model drift."""
    db = tmp_path / "m.db"
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", f"sqlite+pysqlite:///{db}")
    up = subprocess.run(["uv", "run", "alembic", "upgrade", "head"],
                        capture_output=True, text=True)
    assert up.returncode == 0, up.stderr
    chk = subprocess.run(["uv", "run", "alembic", "check"], capture_output=True, text=True)
    assert chk.returncode == 0, chk.stdout + chk.stderr
