"""Our own pacing on top of fli's built-in limiter — deliberately slower than 10/sec."""

import random
import time
from collections.abc import Callable


class TokenBucket:
    """Spaces calls at least `min_interval` seconds apart (+ optional jitter)."""

    def __init__(self, min_interval: float, jitter: float = 0.0,
                 now: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], None] = time.sleep):
        self.min_interval = min_interval
        self.jitter = jitter
        self._now = now
        self._sleep = sleep
        self._last: float | None = None

    def acquire(self) -> None:
        now = self._now()
        if self._last is not None:
            wait = self.min_interval - (now - self._last)
            if wait > 0:
                self._sleep(wait)
        extra = random.uniform(0, self.jitter) if self.jitter else 0.0
        if extra:
            self._sleep(extra)
        self._last = self._now()


class CircuitBreaker:
    """Trips open after `threshold` consecutive failures; any success resets it."""

    def __init__(self, threshold: int):
        self.threshold = threshold
        self._consecutive = 0

    def record_failure(self) -> None:
        self._consecutive += 1

    def record_success(self) -> None:
        self._consecutive = 0

    def is_open(self) -> bool:
        return self._consecutive >= self.threshold
