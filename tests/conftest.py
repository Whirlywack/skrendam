import pytest


def pytest_addoption(parser) -> None:
    """Add options to pytest."""
    parser.addoption("--fuzz", action="store_true", help="Run fuzz tests")
    parser.addoption("--mcp", action="store_true", help="Run MCP tests")
    parser.addoption("--all", action="store_true", help="Run all tests")
    parser.addoption(
        "--live",
        action="store_true",
        help="Run tests/search (hits Google Flights LIVE — heats BotGuard for the daily scan)",
    )


def pytest_runtest_setup(item) -> None:
    """Skip fuzz tests unless --fuzz or --all; skip live tests unless --live or --all.

    tests/search talks to Google Flights for real. Running it from the scan laptop
    burns the daily scan's BotGuard budget (two DEGRADED runs on 2026-09-09/10 after
    review agents ran whole-repo pytest), so it is opt-in.
    """
    if "tests/search/" in item.nodeid or item.nodeid.startswith("tests/search"):
        if not item.config.getoption("--live") and not item.config.getoption("--all"):
            pytest.skip("live Google Flights test — pass --live (never from the scan laptop)")
    fuzz_marker = item.get_closest_marker("fuzz")
    if fuzz_marker is not None:
        if not item.config.getoption("--fuzz") and not item.config.getoption("--all"):
            pytest.skip("need --fuzz or --all option to run this test")


def pytest_collection_modifyitems(config, items) -> None:
    """Modify collection based on custom flags."""
    if config.getoption("--mcp"):
        # Only keep MCP tests when --mcp flag is used
        items[:] = [item for item in items if "mcp" in item.nodeid]
    elif config.getoption("--fuzz"):
        # Only keep fuzz tests when --fuzz flag is used (and not --all)
        if not config.getoption("--all"):
            items[:] = [item for item in items if item.get_closest_marker("fuzz")]
    elif not config.getoption("--all"):
        # Remove fuzz tests from normal runs
        items[:] = [item for item in items if not item.get_closest_marker("fuzz")]
