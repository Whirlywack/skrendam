from skrendam.fli_adapter.pacing import CircuitBreaker, TokenBucket


def test_token_bucket_waits_until_interval(monkeypatch):
    clock = {"t": 0.0}
    sleeps = []
    bucket = TokenBucket(
        min_interval=1.5,
        jitter=0.0,
        now=lambda: clock["t"],
        sleep=lambda s: (sleeps.append(s), clock.__setitem__("t", clock["t"] + s)),
    )
    bucket.acquire()  # first call: no wait
    bucket.acquire()  # immediately after: must wait ~1.5s
    assert sleeps and abs(sleeps[-1] - 1.5) < 1e-6


def test_circuit_breaker_trips_after_threshold():
    cb = CircuitBreaker(threshold=3)
    for _ in range(2):
        cb.record_failure()
    assert not cb.is_open()
    cb.record_failure()
    assert cb.is_open()
    cb.record_success()
    assert not cb.is_open()  # success resets the streak
