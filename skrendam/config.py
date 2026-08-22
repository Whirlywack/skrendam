"""Runtime configuration, read from SKRENDAM_-prefixed environment variables."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SKRENDAM_", extra="ignore")

    database_url: str = "sqlite+pysqlite:///:memory:"
    # Pacing: our own ceiling, far below fli's 10/sec built-in limit.
    min_call_interval_seconds: float = 1.5
    pacing_jitter_seconds: float = 0.5
    circuit_breaker_threshold: int = 5  # consecutive failures before pausing a run
    # Tail-cohort rotation width in days: core routes scan daily, every other enabled
    # route scans when route.id % N == today.toordinal() % N. Start 10 (inside the
    # observed ~40-60 specs/run gating budget); tighten toward 3 as health data allows.
    tail_rotation_days: int = Field(10, ge=1)
    scanner_version: str = "0.1.0"
    currency: str = "EUR"
    language: str = "lt"
    country: str = "LT"
