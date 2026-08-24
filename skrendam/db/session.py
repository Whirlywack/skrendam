from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from skrendam.config import Settings


def make_sessionmaker(settings: Settings | None = None):
    settings = settings or Settings()
    # pre_ping: Neon closes idle connections; a multi-hour scan then dies at the
    # first statement after an idle gap (2026-08-24 outage). Revalidate on every
    # checkout and retire pooled connections before Neon's idle timeout can.
    engine = create_engine(settings.database_url, future=True, pool_pre_ping=True, pool_recycle=240)
    return sessionmaker(bind=engine, future=True)
