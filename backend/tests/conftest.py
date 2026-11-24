import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa: F401  (register all tables)
from app.main import app


@pytest.fixture(autouse=True)
def _no_otp_resend_cooldown(monkeypatch):
    """Most tests log in repeatedly as the same number within a second; the
    real resend cooldown (which the OTP-delivery tests set explicitly) would
    turn that into 429s. Also guarantees no test ever talks to a real SMS or
    email provider, whatever the developer's .env holds."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)
    monkeypatch.setattr(settings, "sms_api_key", "")
    monkeypatch.setattr(settings, "email_api_key", "")


@pytest.fixture(autouse=True)
def _market_clock_mid_morning(monkeypatch):
    """Orders are refused outside a market's opening hours (markets/hours.py),
    so pin the clock to 10:00 Lagos (09:00 UTC) today - otherwise the whole
    suite would fail whenever it happened to run at night. Tests of the hours
    rule itself re-pin it with set_clock_utc."""
    from datetime import datetime, timezone

    pinned = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
    monkeypatch.setattr("app.markets.hours.utc_now", lambda: pinned)


def set_clock_utc(monkeypatch, hour: int, minute: int = 0):
    """Pin the market-hours clock to HH:MM UTC today (Lagos is UTC+1)."""
    from datetime import datetime, timezone

    pinned = datetime.now(timezone.utc).replace(hour=hour, minute=minute, second=0, microsecond=0)
    monkeypatch.setattr("app.markets.hours.utc_now", lambda: pinned)


@pytest_asyncio.fixture
async def _engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session_factory(_engine):
    """Exposes a session factory so tests can seed/inspect the DB directly."""
    return async_sessionmaker(_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(_engine, db_session_factory):
    async def override_get_db():
        async with db_session_factory() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_float():
    """Placeholder hook; float is seeded inline in tests that need it."""
    return None


async def pay_deposit(client, headers, order_id):
    """Every order now takes a deposit before an agent can be accepted or
    shopping can start (orders.fees.required_deposit). Fund the customer's
    wallet with exactly the deposit and pay it, the way a real customer
    would - for tests whose subject is something later in the flow."""
    from decimal import Decimal

    r = await client.get(f"/orders/{order_id}", headers=headers)
    assert r.status_code == 200, r.text
    deposit = Decimal(r.json()["deposit_amount"])
    if deposit <= 0 or r.json().get("deposit_paid_at"):
        return
    r = await client.post("/wallet/fund", headers=headers, json={"amount": str(deposit)})
    assert r.status_code == 200, r.text
    r = await client.post(f"/payments/orders/{order_id}/deposit/pay-from-wallet", headers=headers)
    assert r.status_code == 200, r.text


async def make_hub(client, db_session_factory, market_id, phone="+2348055500001"):
    """A shopkeeper account with a hub in `market_id`; returns (headers, hub_id)."""
    from sqlalchemy import select

    from app.auth.models import User
    from app.core.enums import UserRole
    from app.hubs.models import Hub

    r = await client.post("/auth/request-otp", json={"identifier": phone})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": phone, "code": code})
    token = r.json()["access_token"]
    async with db_session_factory() as s:
        user = (await s.execute(select(User).where(User.phone == phone))).scalar_one()
        user.role = UserRole.SHOPKEEPER
        hub = Hub(market_id=market_id, user_id=user.id, name="Test Hub")
        s.add(hub)
        await s.commit()
        hub_id = hub.id
    return {"Authorization": f"Bearer {token}"}, hub_id


async def through_hub(client, db_session_factory, order_id, market_id, agent_h):
    """Take a PAID order through the hub: agent drops, shopkeeper receives,
    shopkeeper marks ready. Leaves it READY_FOR_PICKUP; returns hub headers."""
    hub_h, _ = await make_hub(client, db_session_factory, market_id)
    r = await client.post(f"/delivery/orders/{order_id}/drop-at-hub", headers=agent_h)
    assert r.status_code == 200, r.text
    r = await client.post(f"/hubs/orders/{order_id}/receive", headers=hub_h, json={})
    assert r.status_code == 200, r.text
    r = await client.post(f"/hubs/orders/{order_id}/ready", headers=hub_h)
    assert r.status_code == 200, r.text
    return hub_h


async def make_rider(client, db_session_factory, market_id=None, phone="+2348066600001"):
    """A rider login with an ACTIVE roster record; returns its headers."""
    from sqlalchemy import select

    from app.auth.models import User
    from app.core.enums import UserRole
    from app.riders.models import Rider

    r = await client.post("/auth/request-otp", json={"identifier": phone})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": phone, "code": code})
    token = r.json()["access_token"]
    async with db_session_factory() as s:
        user = (await s.execute(select(User).where(User.phone == phone))).scalar_one()
        user.role = UserRole.RIDER
        s.add(Rider(user_id=user.id, full_name="Test Rider", phone=phone, market_id=market_id))
        await s.commit()
    return {"Authorization": f"Bearer {token}"}


async def out_for_delivery(client, db_session_factory, order_id, market_id, agent_h,
                           rider_phone="+2348066600001"):
    """Take a PAID order all the way out: hub custody, a rider claims it, the
    shopkeeper releases it with the rider's code. Returns (hub_h, rider_h)."""
    hub_h = await through_hub(client, db_session_factory, order_id, market_id, agent_h)
    rider_h = await make_rider(client, db_session_factory, market_id, phone=rider_phone)
    r = await client.post(f"/riders/jobs/{order_id}/claim", headers=rider_h)
    assert r.status_code == 200, r.text
    r = await client.post(f"/hubs/orders/{order_id}/handover", headers=hub_h,
                          json={"code": r.json()["pickup_code"]})
    assert r.status_code == 200, r.text
    return hub_h, rider_h
