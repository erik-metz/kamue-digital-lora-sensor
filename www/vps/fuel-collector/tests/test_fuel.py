import asyncio
from copy import deepcopy
from unittest.mock import AsyncMock

import httpx
import pytest
from config import Settings
from normalize import normalize, price
from source import fetch

KEY = "00000000-0000-0000-0000-000000000001"


def sample():
    return {"ok": True, "stations": [{"id": KEY, "name": "Test", "lat": 49.6,
        "lng": 8.5, "isOpen": True, "e5": 1.789, "e10": False, "diesel": 1.659}]}


def test_prices_and_missing():
    station = normalize(sample())[0]
    assert station["e5"] == 1789
    assert station["e10"] is None
    assert price(1.7) == 1700
    for value in (True, 0, -1, float("nan"), "1.7", 1.2345):
        with pytest.raises(ValueError):
            price(value)


def test_complete_and_unique():
    for payload in ({"ok": False}, {"ok": True}, {"ok": True, "stations": None}):
        with pytest.raises(ValueError):
            normalize(payload)
    data = sample()
    data["stations"].append(deepcopy(data["stations"][0]))
    with pytest.raises(ValueError):
        normalize(data)
    assert normalize({"ok": True, "stations": []}) == []


def test_config_limits(monkeypatch):
    monkeypatch.setenv("TANKERKOENIG_API_KEY", KEY)
    settings = Settings.from_env()
    assert settings.poll_seconds == 300
    assert KEY not in repr(settings)
    monkeypatch.setenv("FUEL_RADIUS_KM", "26")
    with pytest.raises(ValueError):
        Settings.from_env()
    monkeypatch.setenv("FUEL_RADIUS_KM", "25")
    monkeypatch.setenv("FUEL_POLL_SECONDS", "59")
    with pytest.raises(ValueError):
        Settings.from_env()


def test_transport_redacts_secret(monkeypatch):
    monkeypatch.setenv("TANKERKOENIG_API_KEY", KEY)
    settings = Settings.from_env()
    def handler(request):
        assert request.url.params["type"] == "all"
        return httpx.Response(403)
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with pytest.raises(RuntimeError) as error:
                await fetch(client, settings)
            assert KEY not in str(error.value)
            assert error.value.__cause__ is None
    asyncio.run(run())


def test_failed_snapshot_never_connects(monkeypatch):
    import main
    monkeypatch.setenv("TANKERKOENIG_API_KEY", KEY)
    connect = AsyncMock()
    monkeypatch.setattr(main.psycopg.AsyncConnection, "connect", connect)
    with pytest.raises(ValueError):
        asyncio.run(main.poll_cycle(None, Settings.from_env(), raw={"ok": False}))
    connect.assert_not_called()


def test_dry_run_never_connects(monkeypatch):
    import main
    monkeypatch.setenv("TANKERKOENIG_API_KEY", KEY)
    connect = AsyncMock()
    monkeypatch.setattr(main.psycopg.AsyncConnection, "connect", connect)
    result = asyncio.run(main.poll_cycle(None, Settings.from_env(), raw=sample(), dry_run=True))
    assert result["accepted"] == 1
    connect.assert_not_called()
