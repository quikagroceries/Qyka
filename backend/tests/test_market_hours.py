"""Per-market opening hours: orders are refused outside them, before any
money moves, and "now" is always judged in the market's own timezone."""

from datetime import datetime, time, timezone

import pytest
from sqlalchemy import func, select

from app.auth.models import User
from app.core.enums import UserRole, UserStatus
from app.markets.models import Agent, Market
from app.orders.models import Order
from app.wallet.models import WalletLedger
from tests.conftest import set_clock_utc
from tests.test_admin import _login, _login_admin

CLOSED = "This market is closed. It opens at 08:00."


async def _market_with_free_agent(db_session_factory):
    """A market (default 08:00-20:00 Lagos) with an on-duty agent, so an
    order placed while it's open would immediately get an agent proposed."""
    async with db_session_factory() as s:
        market = Market(name="Bodija", city="Ibadan", state="Oyo")
        agent_user = User(phone="+2348050000001", full_name="Ade", role=UserRole.AGENT, status=UserStatus.ACTIVE)
        s.add_all([market, agent_user])
        await s.flush()
        s.add(Agent(user_id=agent_user.id, assigned_market_id=market.id, is_available=True, on_duty=True))
        await s.commit()
        return market.id


def _order_body(market_id):
    return {"market_id": str(market_id), "listed_items_total": "5000.00", "items": [{"description": "rice"}]}


async def _nothing_happened(db_session_factory):
    async with db_session_factory() as s:
        assert (await s.execute(select(func.count()).select_from(Order))).scalar_one() == 0
        assert (await s.execute(select(func.count()).select_from(WalletLedger))).scalar_one() == 0
        agent = (await s.execute(select(Agent))).scalar_one()
        assert agent.is_available is True


@pytest.mark.asyncio
async def test_order_inside_hours_succeeds(client, db_session_factory, monkeypatch):
    market_id = await _market_with_free_agent(db_session_factory)
    set_clock_utc(monkeypatch, 9)                                 # 10:00 Lagos
    h = {"Authorization": f"Bearer {await _login(client, '08051110001')}"}
    r = await client.post("/orders", headers=h, json=_order_body(market_id))
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "proposed"                       # agent found as normal


@pytest.mark.asyncio
async def test_order_outside_hours_is_refused_before_any_money_or_agent(client, db_session_factory, monkeypatch):
    market_id = await _market_with_free_agent(db_session_factory)
    set_clock_utc(monkeypatch, 1)                                 # 02:00 Lagos
    h = {"Authorization": f"Bearer {await _login(client, '08051110002')}"}
    r = await client.post("/orders", headers=h, json=_order_body(market_id))
    assert r.status_code == 409
    assert r.json()["detail"] == CLOSED
    await _nothing_happened(db_session_factory)                   # no order, no deposit/wallet move, agent untouched


@pytest.mark.asyncio
@pytest.mark.parametrize("utc_hour, utc_minute, allowed", [
    (6, 59, False),   # 07:59 Lagos - not yet open
    (7, 0, True),     # 08:00 Lagos exactly - open (opening time is inclusive)
    (18, 59, True),   # 19:59 Lagos - still open
    (19, 0, False),   # 20:00 Lagos exactly - closed (closing time is exclusive)
    (19, 30, False),  # 20:30 Lagos - closed
])
async def test_boundaries(client, db_session_factory, monkeypatch, utc_hour, utc_minute, allowed):
    market_id = await _market_with_free_agent(db_session_factory)
    set_clock_utc(monkeypatch, utc_hour, utc_minute)
    h = {"Authorization": f"Bearer {await _login(client, '08051110003')}"}
    r = await client.post("/orders", headers=h, json=_order_body(market_id))
    assert r.status_code == (201 if allowed else 409), r.text


@pytest.mark.asyncio
async def test_check_uses_the_markets_timezone_not_utc(client, db_session_factory, monkeypatch):
    """Lagos is UTC+1. At 19:30 UTC the raw UTC hour (19) is inside 08-20, but
    it's 20:30 in Lagos - closed. At 07:30 UTC the UTC hour is before 08:00,
    but it's 08:30 in Lagos - open. A UTC-based check would get both wrong."""
    market_id = await _market_with_free_agent(db_session_factory)
    h = {"Authorization": f"Bearer {await _login(client, '08051110004')}"}

    set_clock_utc(monkeypatch, 19, 30)
    r = await client.post("/orders", headers=h, json=_order_body(market_id))
    assert r.status_code == 409 and r.json()["detail"] == CLOSED

    set_clock_utc(monkeypatch, 1)                                 # 02:00 Lagos
    r = await client.post("/orders", headers=h, json=_order_body(market_id))
    assert r.status_code == 409

    set_clock_utc(monkeypatch, 7, 30)
    r = await client.post("/orders", headers=h, json=_order_body(market_id))
    assert r.status_code == 201, r.text


def test_is_open_handles_other_timezones_and_overnight_windows():
    from app.markets.hours import is_open
    noon_utc = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
    assert is_open(time(8), time(20), "Africa/Lagos", noon_utc)           # 13:00 Lagos
    assert not is_open(time(8), time(12), "Africa/Lagos", noon_utc)       # 13:00 > 12:00
    # Same instant, different market timezone: 12:00 UTC is 07:00 in New York (UTC-5 in January).
    assert not is_open(time(8), time(12), "America/New_York", noon_utc)
    assert is_open(time(8), time(12), "America/New_York", datetime(2026, 1, 15, 14, 0, tzinfo=timezone.utc))  # 09:00 NY
    # Overnight window 18:00-02:00 Lagos
    assert is_open(time(18), time(2), "Africa/Lagos", datetime(2026, 1, 15, 0, 30, tzinfo=timezone.utc))   # 01:30 Lagos
    assert not is_open(time(18), time(2), "Africa/Lagos", datetime(2026, 1, 15, 9, 0, tzinfo=timezone.utc))  # 10:00 Lagos


@pytest.mark.asyncio
async def test_market_api_returns_hours_and_admin_can_set_them(client, db_session_factory):
    admin_h = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'hours@qyka.com')}"}

    r = await client.post("/markets", headers=admin_h, json={"name": "Oja Oba", "city": "Ibadan", "state": "Oyo"})
    assert r.status_code == 201, r.text
    assert (r.json()["opening_time"], r.json()["closing_time"], r.json()["timezone"]) == ("08:00:00", "20:00:00", "Africa/Lagos")
    market_id = r.json()["id"]

    r = await client.patch(f"/markets/{market_id}", headers=admin_h, json={"opening_time": "07:30", "closing_time": "18:00"})
    assert r.status_code == 200, r.text
    assert (r.json()["opening_time"], r.json()["closing_time"]) == ("07:30:00", "18:00:00")

    r = await client.patch(f"/markets/{market_id}", headers=admin_h, json={"timezone": "Mars/Olympus"})
    assert r.status_code == 422

    [m] = [m for m in (await client.get("/markets")).json() if m["id"] == market_id]
    assert (m["opening_time"], m["closing_time"], m["timezone"]) == ("07:30:00", "18:00:00", "Africa/Lagos")
