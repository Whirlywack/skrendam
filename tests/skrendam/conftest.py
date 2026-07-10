import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def session():
    # Imported INSIDE the fixture so this conftest doesn't break collection before
    # skrendam.db exists (Task 2). Tests that don't use `session` stay green.
    from skrendam.db import models  # noqa: F401 — register all tables on Base.metadata
    from skrendam.db.base import Base

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    try:
        yield s
    finally:
        s.close()
