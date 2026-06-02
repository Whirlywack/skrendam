"""Fare identity: a candidate is one real fare, independent of which template found it."""

import math
from datetime import date

PRICE_BAND_EUR = 5


def price_band(price: float) -> int:
    """Bucket a price to the nearest PRICE_BAND_EUR (rounding up) to absorb tiny moves."""
    return int(math.ceil(price / PRICE_BAND_EUR) * PRICE_BAND_EUR)


def deal_group_key(origin: str, destination: str, trip_type: str,
                   travel_date: date, return_date: date | None, price: float) -> str:
    parts = [origin, destination, trip_type, travel_date.isoformat()]
    if return_date is not None:
        parts.append(return_date.isoformat())
    parts.append(str(price_band(price)))
    return "|".join(parts)
