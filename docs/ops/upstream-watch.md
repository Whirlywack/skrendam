# Upstream fli watch (weekly scheduled agent)

`fli/` is a vendored fork of `punitarani/fli`. When Google changes their private API, the fix
usually lands upstream first. A weekly scheduled cloud agent keeps that visible without
unvendoring.

## The routine

Create with `/schedule` (cron: Mondays 09:00 Europe/Vilnius). Agent prompt:

> Check https://github.com/punitarani/fli for commits newer than the last report (use the repo's
> commit list; no clone needed). If there are new commits, summarize each one-line and flag any
> that touch `fli/search/` (especially `_wire.py`, `_decoders.py`, `_proto.py`, `client.py`,
> `dates.py`, `flights.py`) or `fli/models/` — those are the files that break when Google changes
> the API format. Compare against our vendored copy at Whirlywack/skrendam `fli/` only for flagged
> files, and end with a one-line verdict: NOTHING RELEVANT / WORTH REVIEWING (list files) /
> URGENT (decoder/format change). Keep the report under 30 lines.

## Why not unvendor

We keep the fork patchable (e.g. a future HTML fetch path needs `impersonate=` on GET, which
upstream's `client.get()` does not pass). The watch keeps the cost of vendoring — drift — visible.

## When the agent flags a decoder change

Port upstream commits onto `fli/` in a feature branch (the vendored copy shares no git
history with upstream, so it is a file-level port, not `git cherry-pick`), run `uv run pytest -q`
(tests/search is skipped by default), and ship through the normal PR gate. **No live probe** —
interactive probes heat BotGuard for the daily scan; the next 06:00 run's health JSON is the
verification.
