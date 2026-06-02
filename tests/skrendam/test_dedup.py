from datetime import date

from skrendam.scanning.dedup import deal_group_key, price_band


def test_price_band_buckets_by_5_eur():
    assert price_band(29) == price_band(30) == 30   # rounds up to nearest 5
    assert price_band(31) == 35


def test_oneway_key_is_stable_and_excludes_template():
    k1 = deal_group_key("VNO", "BCN", "oneway", date(2026, 7, 29), None, 30.0)
    k2 = deal_group_key("VNO", "BCN", "oneway", date(2026, 7, 29), None, 29.0)  # same band (29 → ceil(29/5)*5=30)
    assert k1 == k2 == "VNO|BCN|oneway|2026-07-29|30"


def test_roundtrip_key_includes_return_date():
    k = deal_group_key("VNO", "BCN", "roundtrip", date(2026, 7, 10), date(2026, 7, 14), 120.0)
    assert k == "VNO|BCN|roundtrip|2026-07-10|2026-07-14|120"
