"""Idempotent demo seed: insert ~2 live PublishedDeals from high-score candidates.

Run:
    uv run python scripts/seed_demo_published_deals.py
"""

import os
import sys
from datetime import datetime

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

# resolve import root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from skrendam.db.models import Candidate, CandidateTemplateMatch, PublishedDeal  # noqa: E402


def main() -> None:
    """Seed demo published_deals rows into the target database."""
    db_url = os.environ.get("SKRENDAM_DATABASE_URL")
    if not db_url:
        print("ERROR: SKRENDAM_DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    engine = create_engine(db_url)
    with Session(engine) as session:
        # --- idempotent guard ---------------------------------------------------
        live_count = session.scalar(
            select(func.count()).select_from(PublishedDeal).where(PublishedDeal.status == "live")
        )
        if live_count and live_count > 0:
            print(f"Already seeded — {live_count} live deal(s) exist, skipping.")
            return

        # --- find top-2 candidates from great-tier matches ---------------------
        threshold = 0.88
        rows = session.execute(
            select(Candidate, CandidateTemplateMatch)
            .join(
                CandidateTemplateMatch,
                CandidateTemplateMatch.candidate_id == Candidate.id,
            )
            .where(CandidateTemplateMatch.match_score >= threshold)
            .order_by(CandidateTemplateMatch.match_score.desc())
            .limit(20)  # fetch more to dedupe by candidate_id
        ).all()

        if not rows:
            # Lower threshold if no great-tier candidates exist
            threshold = 0.0
            print("No candidates at ≥0.88 — lowering threshold to 0.0 to find any match.")
            rows = session.execute(
                select(Candidate, CandidateTemplateMatch)
                .join(
                    CandidateTemplateMatch,
                    CandidateTemplateMatch.candidate_id == Candidate.id,
                )
                .order_by(CandidateTemplateMatch.match_score.desc())
                .limit(20)
            ).all()

        if not rows:
            print(
                "ERROR: No candidates with template matches found — cannot seed.", file=sys.stderr
            )
            sys.exit(1)

        # deduplicate by candidate_id, take top 2
        seen: set[int] = set()
        selected: list[tuple[Candidate, CandidateTemplateMatch]] = []
        for candidate, match in rows:
            if candidate.id not in seen:
                seen.add(candidate.id)
                selected.append((candidate, match))
            if len(selected) == 2:
                break

        if not selected:
            print("ERROR: No distinct candidates available — cannot seed.", file=sys.stderr)
            sys.exit(1)

        now = datetime.utcnow()
        seeded = 0

        for candidate, match in selected:
            # Build a simple headline
            city = candidate.destination  # IATA code as fallback; real city not in model
            price = candidate.price
            headline = f"{city} from €{price:.0f}"

            # booking_url: candidates don't store it; pull from itinerary_snapshot if present
            booking_url: str | None = None
            if candidate.itinerary_snapshot and isinstance(candidate.itinerary_snapshot, dict):
                booking_url = candidate.itinerary_snapshot.get("booking_url")
            if not booking_url:
                booking_url = "https://www.google.com/travel/flights"

            deal = PublishedDeal(
                candidate_id=candidate.id,
                deal_template_id=match.deal_template_id,
                content_draft_id=None,
                headline=headline,
                origin=candidate.origin,
                destination=candidate.destination,
                zone=candidate.zone,
                trip_type=candidate.trip_type,
                travel_date=candidate.travel_date,
                return_date=candidate.return_date,
                price=candidate.price,
                baseline_price=candidate.baseline_price,
                discount_pct=candidate.discount_pct,
                booking_url=booking_url,
                tier="free",
                status="live",
                valid_until=None,
                last_seen_at=now,
                published_at=now,
                going_fast=False,
            )
            session.add(deal)
            seeded += 1
            print(
                f"  Seeding: {headline}  |  {candidate.origin}→{candidate.destination}"
                f"  |  score={match.match_score:.3f}"
                f"  |  template_id={match.deal_template_id}"
            )

        session.commit()
        print(f"Done — seeded {seeded} live deal(s).")


if __name__ == "__main__":
    main()
