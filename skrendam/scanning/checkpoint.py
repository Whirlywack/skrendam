"""Daily scan checkpoint: lets a retry skip work an earlier attempt finished.

Closed-lid mornings kill the scan mid-run (connection death on re-sleep); the
wrapper then retries, and before this module every retry re-scanned the WHOLE
network. Google's BotGuard punishes exactly that repetition (2026-08-26/27:
multi-pass mornings degraded, single-pass mornings healthy).

The checkpoint is a small JSON file, keyed by scan date: after each spec is
fully processed AND committed, its key is appended. A later attempt the same
day skips those specs, so a morning of N attempts costs ~1 pass of Google
load. A new day (or a missing/corrupt file) starts clean.

File, not DB, on purpose: the scan runs on one machine, the file needs no
migration, and a checkpoint must survive the very DB-connection deaths that
trigger retries.
"""

import json
import os
import tempfile
from datetime import date

from skrendam.scanning.types import SearchSpec


def spec_key(spec: SearchSpec) -> str:
    """Stable identity of one search spec within a day."""
    return "|".join(
        [
            spec.origin,
            spec.destination,
            spec.trip_type,
            spec.window_start.isoformat(),
            spec.window_end.isoformat(),
            str(spec.duration_days or 0),
            spec.cabin,
        ]
    )


class ScanCheckpoint:
    """Per-day done-set persisted to `path`. Pass path=None to disable."""

    def __init__(self, path: str | None, today: date):
        self.path = path
        self.today = today.isoformat()
        self.done: set[str] = set()
        if not path:
            return
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            if data.get("date") == self.today:
                self.done = set(data.get("done", []))
        except (OSError, ValueError):
            # Missing or corrupt checkpoint must never block a scan.
            self.done = set()

    def is_done(self, spec: SearchSpec) -> bool:
        return spec_key(spec) in self.done

    def mark(self, spec: SearchSpec) -> None:
        """Record a spec as finished. Call AFTER its DB work is committed."""
        self.done.add(spec_key(spec))
        if not self.path:
            return
        try:
            d = os.path.dirname(self.path) or "."
            os.makedirs(d, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=d, prefix=".scan-checkpoint-")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump({"date": self.today, "done": sorted(self.done)}, f)
            os.replace(tmp, self.path)  # atomic: a crash mid-write keeps the old file
        except OSError:
            pass  # a checkpoint write failure must never abort the scan
