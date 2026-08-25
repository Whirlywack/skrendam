from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from skrendam.config import Settings


def make_sessionmaker(settings: Settings | None = None):
    settings = settings or Settings()
    # pre_ping: Neon closes idle connections; a multi-hour scan then dies at the
    # first statement after an idle gap (2026-08-24 outage). Revalidate on every
    # checkout and retire pooled connections before Neon's idle timeout can.
    #
    # keepalives + connect_timeout (libpq): a scan frozen by clamshell sleep thaws
    # holding sockets that died hours ago; without these it can block on a dead
    # read indefinitely (2026-08-25: 0.5s of CPU in 3h49m, killed by hand). With
    # them the thawed process errors out within ~a minute, exits 1, and the
    # daily-scan.sh connection-shaped retry relaunches it — so on an undocked
    # laptop the scan self-heals minutes after the lid opens.
    connect_args = {}
    if settings.database_url.startswith(("postgresql", "postgres")):
        connect_args = {
            "connect_timeout": 30,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 3,
        }
    engine = create_engine(
        settings.database_url,
        future=True,
        pool_pre_ping=True,
        pool_recycle=240,
        connect_args=connect_args,
    )
    return sessionmaker(bind=engine, future=True)
