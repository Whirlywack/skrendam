"""Scan health: per-call outcome capture + a pure end-of-run verdict.

The adapter records one CallRecord per network call (cache hits excluded);
assess() turns the log + price-row counts into a HealthVerdict the
orchestrator stamps onto ScanRun. A degraded run keeps its data — the status
only says how much to trust the run as a picture of the market. Bars are
in-module constants (house style, like scorer bars), tunable after observation.
"""

from __future__ import annotations

from dataclasses import dataclass, field

EMPTY_RATIO_BAR = 0.5  # degraded when >= this fraction of calendar calls are empty...
MIN_CALENDAR_SAMPLE = 5  # ...given at least this many calendar calls
NO_DATA_MIN_CALLS = 10  # degraded when >= this many api calls produced exactly 0 price rows
CLIFF_PRIOR_MIN_ROWS = 100  # cliff fires only when the prior run logged at least this many rows
CLIFF_FRACTION = 0.10  # ...and this run logged under this fraction of it
ERROR_DETAIL_CAP = 20  # at most this many error records are persisted in the JSON
_ERROR_MSG_MAX = 300


@dataclass(frozen=True)
class CallRecord:
    """One recorded outcome from a single network call to the flights backend.

    Attributes:
        kind: Call category — ``"calendar"`` or ``"flights"``.
        route: IATA route string, e.g. ``"VNO-BCN"``.
        trip_type: ``"oneway"`` or ``"roundtrip"``.
        outcome: Result classification — ``"data"``, ``"empty"``, or ``"error"``.
        rows: Number of price rows returned (0 for empty/error outcomes).
        error_kind: Exception class name when outcome is ``"error"``, else ``None``.
        error_msg: Truncated exception message when outcome is ``"error"``, else ``None``.

    """

    kind: str
    route: str
    trip_type: str
    outcome: str
    rows: int = 0
    error_kind: str | None = None
    error_msg: str | None = None


@dataclass
class CallLog:
    """Accumulates one CallRecord per network call made during a scan run.

    Attributes:
        records: Ordered list of all recorded call outcomes.

    """

    records: list[CallRecord] = field(default_factory=list)

    def record(
        self,
        kind: str,
        route: str,
        trip_type: str,
        outcome: str,
        rows: int = 0,
        error_kind: str | None = None,
        error_msg: str | None = None,
    ) -> None:
        """Append one call outcome to the log.

        Args:
            kind: ``"calendar"`` or ``"flights"``.
            route: IATA route string, e.g. ``"VNO-BCN"``.
            trip_type: ``"oneway"`` or ``"roundtrip"``.
            outcome: ``"data"``, ``"empty"``, or ``"error"``.
            rows: Price rows returned (0 when not applicable).
            error_kind: Exception class name for error outcomes.
            error_msg: Exception message, truncated to _ERROR_MSG_MAX characters.

        """
        self.records.append(
            CallRecord(
                kind=kind,
                route=route,
                trip_type=trip_type,
                outcome=outcome,
                rows=rows,
                error_kind=error_kind,
                error_msg=str(error_msg)[:_ERROR_MSG_MAX] if error_msg else None,
            )
        )

    def count(self, kind: str, outcome: str | None = None) -> int:
        """Count records matching kind and optional outcome filter.

        Args:
            kind: ``"calendar"`` or ``"flights"``.
            outcome: If given, only count records with this outcome.

        Returns:
            Integer count of matching records.

        """
        return sum(
            1 for r in self.records if r.kind == kind and (outcome is None or r.outcome == outcome)
        )

    @property
    def errors(self) -> list[CallRecord]:
        """All records whose outcome is ``"error"``."""
        return [r for r in self.records if r.outcome == "error"]


@dataclass(frozen=True)
class HealthVerdict:
    """Immutable result of assess() for one scan run.

    Attributes:
        status: ``"healthy"`` or ``"degraded"``.
        reasons: Human-readable strings explaining each degradation signal.
        metrics: Raw counters used to derive the verdict.

    """

    status: str
    reasons: list[str]
    metrics: dict

    @property
    def degraded(self) -> bool:
        """True when status is ``"degraded"``."""
        return self.status == "degraded"


def assess(log: CallLog, price_rows: int, prior_price_rows: int | None = None) -> HealthVerdict:
    """Pure verdict over one run's call log + price-row counts.

    Three independent signals are checked; any hit marks the run degraded.

    Args:
        log: CallLog accumulated during the scan run.
        price_rows: Total price rows written to the DB in this run.
        prior_price_rows: Price rows from the previous run, used for cliff detection.

    Returns:
        A HealthVerdict with status, reasons, and metrics.

    """
    reasons: list[str] = []

    cal = log.count("calendar")
    cal_empty = log.count("calendar", "empty")

    # error-outcome calls stay in the denominator on purpose: heavy-error runs are
    # the circuit breaker's job ("failed"), not this ratio's.
    if cal >= MIN_CALENDAR_SAMPLE and cal_empty / cal >= EMPTY_RATIO_BAR:
        reasons.append(f"{cal_empty}/{cal} calendar searches returned no data")

    if len(log.records) >= NO_DATA_MIN_CALLS and price_rows == 0:
        reasons.append(f"{len(log.records)} api calls produced 0 price rows")

    if (
        prior_price_rows is not None
        and prior_price_rows >= CLIFF_PRIOR_MIN_ROWS
        and price_rows < prior_price_rows * CLIFF_FRACTION
    ):
        reasons.append(f"price rows fell off a cliff: {price_rows} vs {prior_price_rows} last run")

    metrics = {
        "calendar_calls": cal,
        "calendar_empty": cal_empty,
        "flights_calls": log.count("flights"),
        "flights_empty": log.count("flights", "empty"),
        "error_calls": len(log.errors),
        "price_rows": price_rows,
        "prior_price_rows": prior_price_rows,
    }
    return HealthVerdict(
        status="degraded" if reasons else "healthy",
        reasons=reasons,
        metrics=metrics,
    )


def health_json(verdict: HealthVerdict, log: CallLog, plan: dict | None = None) -> dict:
    """Serialise verdict + error detail to the dict persisted to scan_runs.health.

    Args:
        verdict: The HealthVerdict produced by assess().
        log: The CallLog from the same run (used for error detail).
        plan: Optional cohort-plan counters (``core``, ``tail``, ``specs_planned``).

    Returns:
        Dict with keys ``"plan"``, ``"reasons"``, ``"metrics"``, and ``"errors"``.

    """
    return {
        "plan": plan or {},
        "reasons": list(verdict.reasons),
        "metrics": dict(verdict.metrics),
        "errors": [
            {"kind": r.error_kind, "call": r.kind, "route": r.route, "msg": r.error_msg}
            for r in log.errors[:ERROR_DETAIL_CAP]
        ],
    }
