from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from skrendam.config import Settings


def make_sessionmaker(settings: Settings | None = None):
    settings = settings or Settings()
    engine = create_engine(settings.database_url, future=True)
    return sessionmaker(bind=engine, future=True)
