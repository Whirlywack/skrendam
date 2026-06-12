"""One-off: set routes.core=True for the workstream-A core picks on a live DB.

Seeds are insert-only by design (founder edits are never clobbered), so existing
rows need this explicit, reviewable backfill. Idempotent; only ever sets `core`.
Run once after migration 0008:  uv run python scripts/backfill_core_routes.py
"""

from sqlalchemy import select

from skrendam.config import Settings
from skrendam.db import models
from skrendam.db.session import make_sessionmaker
from skrendam.seeds import ROUTES

CORE_PAIRS = sorted({(o, d) for o, d, _z, core in ROUTES if core})


def main() -> None:
    """Set core=True on existing routes matching the seed's core picks."""
    session = make_sessionmaker(Settings())()
    try:
        changed = 0
        for origin, destination in CORE_PAIRS:
            route = session.scalar(
                select(models.Route).filter_by(origin=origin, destination=destination)
            )
            if route is not None and not route.core:
                route.core = True
                changed += 1
        session.commit()
        print(f"core backfill: {changed} routes updated, {len(CORE_PAIRS)} core pairs total")
    finally:
        session.close()


if __name__ == "__main__":
    main()
