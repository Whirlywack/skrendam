"""Yip patch in SearchDates.search: a gated chunk keeps the other chunks' prices."""

from unittest.mock import MagicMock

import pytest

from fli.search.dates import SearchDates
from fli.search.exceptions import SearchRejectedError


def _search(chunk_outcomes):
    sd = SearchDates.__new__(SearchDates)
    filters = MagicMock(from_date="2026-10-01", to_date="2026-12-31")
    sd._build_chunk_filters = lambda *a: list(range(len(chunk_outcomes)))

    def chunk(cf, **kw):
        o = chunk_outcomes[cf]
        if isinstance(o, Exception):
            raise o
        return o

    sd._search_chunk = chunk
    return sd, filters


def test_partial_rejection_keeps_loaded_chunks():
    sd, filters = _search([["a"], SearchRejectedError(13), ["b"]])
    assert sorted(sd.search(filters)) == ["a", "b"]


def test_full_rejection_raises():
    sd, filters = _search([SearchRejectedError(13), SearchRejectedError(13)])
    with pytest.raises(SearchRejectedError):
        sd.search(filters)
