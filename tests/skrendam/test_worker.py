import pytest
from sqlalchemy.exc import IntegrityError

from skrendam.db import models


def test_scan_request_defaults(session):
    req = models.ScanRequest(kind="full_scan")
    session.add(req)
    session.commit()
    assert req.id is not None
    assert req.status == "queued"
    assert req.requested_by == "curator"
    assert req.created_at is not None
    assert req.candidate_id is None


def test_scan_request_requires_kind(session):
    session.add(models.ScanRequest())
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
