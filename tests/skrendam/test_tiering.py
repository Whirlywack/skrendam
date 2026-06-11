from skrendam.scanning.scoring import tiering


def test_to_score_100_rounds_and_clamps():
    assert tiering.to_score_100(0.881) == 88
    assert tiering.to_score_100(1.5) == 100
    assert tiering.to_score_100(-0.2) == 0


def test_quality_tier_bands():
    assert tiering.quality_tier(95) == "rare"
    assert tiering.quality_tier(94) == "rare"
    assert tiering.quality_tier(88) == "great"
    assert tiering.quality_tier(87) is None
