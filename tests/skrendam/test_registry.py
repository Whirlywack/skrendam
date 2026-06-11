from skrendam.scanning.scoring.base import Score
from skrendam.scanning.scoring.registry import pick_headline


def _s(scorer, s100):
    return Score(
        scorer=scorer,
        value=s100 / 100,
        score_0_100=s100,
        quality_tier=None,
        reason_text="r",
        signals={},
    )


def test_pick_headline_prefers_primary_when_it_fired():
    scores = [_s("weighted", 60), _s("drop", 90)]
    assert pick_headline(scores, "drop").scorer == "drop"


def test_pick_headline_falls_back_to_best_when_primary_absent():
    # primary 'weighted' did not fire -> the highest-scoring strategy headlines.
    scores = [_s("drop", 70), _s("error_fare", 95)]
    assert pick_headline(scores, "weighted").scorer == "error_fare"


def test_pick_headline_defaults_primary_to_weighted():
    scores = [_s("weighted", 50), _s("rarity", 99)]
    assert pick_headline(scores, None).scorer == "weighted"
