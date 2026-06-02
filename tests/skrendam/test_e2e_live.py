import os
from datetime import date, timedelta

import pytest

from skrendam.fli_adapter.live_backend import LiveFliBackend
from skrendam.scanning.types import SearchSpec

pytestmark = pytest.mark.skipif(os.getenv("FLI_E2E") != "1",
                                reason="live API test; set FLI_E2E=1 to run")


def test_live_calendar_returns_real_prices():
    backend = LiveFliBackend()
    start = date.today() + timedelta(days=30)
    spec = SearchSpec("VNO", "BCN", "oneway", start, start + timedelta(days=45), None, "ECONOMY")
    rows = backend.search_calendar(spec)
    assert rows and all(p > 0 for (_, _, p) in rows)
