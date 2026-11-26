"""Withdrawals of earnings: balance, limits, review holds, idempotent sending."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app.core.enums import OrderStatus
from app.orders.models import Order
from app.payments import transfers
from app.payouts.models import Payout
from tests.conftest import make_rider
from tests.test_admin import _login_admin

BANK = {"bank_code": "058", "account_number": "0123456789"}


@pytest.fixture
def sent(monkeypatch):
    """Records every transfer the rail is asked to make."""
    calls = []

    async def fake(**kw):
        calls.append(kw)
        return {"status": "success"}

    monkeypatch.setattr(transfers, "send_transfer", fake)
    return calls


async def _rider_with_earnings(client, db_session_factory, amounts, phone="+2348066600001"):
    h = await make_rider(client, db_session_factory, phone=phone)
    uid = (await client.get("/auth/me", headers=h)).json()["id"]
    async with db_session_factory() as s:
        for a in amounts:
            s.add(Order(customer_id=uuid.uuid4(), market_id=uuid.uuid4(), rider_id=uuid.UUID(uid),
                        status=OrderStatus.CLOSED, delivered_at=datetime.now(timezone.utc),
                        rider_fee=Decimal(a)))
        await s.commit()
    return h


async def _ready(client, db_session_factory, amounts=("1000",), **kw):
    h = await _rider_with_earnings(client, db_session_factory, amounts, **kw)
    r = await client.put("/payouts/account", headers=h, json=BANK)
    assert r.status_code == 200, r.text
    return h


@pytest.mark.asyncio
async def test_balance_is_earned_minus_withdrawals(client, db_session_factory, sent):
    h = await _ready(client, db_session_factory, ["30000", "30000"])
    s = (await client.get("/payouts/summary", headers=h)).json()
    assert Decimal(s["earned"]) == 60000 and Decimal(s["available"]) == 60000
    assert s["account"]["account_name"].startswith("TEST ACCOUNT")

    # First withdrawal is held for review, and still counts against the balance.
    r = await client.post("/payouts", headers=h, json={"amount": "1000"})
    assert r.json()["status"] == "pending_review" and r.json()["hold_reason"] == "First withdrawal"
    assert sent == []
    s = (await client.get("/payouts/summary", headers=h)).json()
    assert Decimal(s["available"]) == 59000 and Decimal(s["in_review"]) == 1000


@pytest.mark.asyncio
async def test_approved_first_withdrawal_then_automatic(client, db_session_factory, sent):
    h = await _ready(client, db_session_factory, ["40000"])
    admin = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'a@qyka.com')}"}
    first = (await client.post("/payouts", headers=h, json={"amount": "1000"})).json()

    queue = (await client.get("/admin/payouts", headers=admin)).json()
    assert [q["id"] for q in queue] == [first["id"]]
    r = await client.post(f"/admin/payouts/{first['id']}/approve", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "paid"
    assert len(sent) == 1 and sent[0]["amount_naira"] == Decimal("1000.00")
    # approving twice never sends twice
    assert (await client.post(f"/admin/payouts/{first['id']}/approve", headers=admin)).status_code == 409
    assert len(sent) == 1

    # Next small one goes straight out.
    r = await client.post("/payouts", headers=h, json={"amount": "2000"})
    assert r.json()["status"] == "paid" and len(sent) == 2
    # A large one is held again.
    r = await client.post("/payouts", headers=h, json={"amount": "25000"})
    assert r.json()["status"] == "pending_review" and r.json()["hold_reason"] == "Large withdrawal"


@pytest.mark.asyncio
async def test_rejected_withdrawal_frees_the_money(client, db_session_factory, sent):
    h = await _ready(client, db_session_factory, ["5000"])
    admin = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'a@qyka.com')}"}
    p = (await client.post("/payouts", headers=h, json={"amount": "5000"})).json()
    r = await client.post(f"/admin/payouts/{p['id']}/reject", headers=admin, json={"reason": "Mismatch"})
    assert r.json()["status"] == "rejected"
    assert Decimal((await client.get("/payouts/summary", headers=h)).json()["available"]) == 5000
    assert sent == []


@pytest.mark.asyncio
async def test_limits_and_validation(client, db_session_factory, sent):
    h = await _ready(client, db_session_factory, ["200000"])
    post = lambda amt: client.post("/payouts", headers=h, json={"amount": amt})  # noqa: E731
    assert (await post("100")).status_code == 400          # below minimum
    assert (await post("60000")).status_code == 400        # above per-withdrawal cap
    assert (await post("999999")).status_code == 400       # more than balance
    # Daily cap is 100k: two 50k are fine (held, but count), the third is refused.
    assert (await post("50000")).status_code == 200
    assert (await post("50000")).status_code == 200
    r = await post("1000")
    assert r.status_code == 400 and "today" in r.json()["detail"]


@pytest.mark.asyncio
async def test_needs_an_account_and_a_valid_one(client, db_session_factory, sent):
    h = await _rider_with_earnings(client, db_session_factory, ["5000"])
    r = await client.post("/payouts", headers=h, json={"amount": "1000"})
    assert r.status_code == 400 and "bank account" in r.json()["detail"]
    assert (await client.put("/payouts/account", headers=h, json={"bank_code": "000", "account_number": "0123456789"})).status_code == 400
    assert (await client.put("/payouts/account", headers=h, json={"bank_code": "058", "account_number": "12"})).status_code == 400


@pytest.mark.asyncio
async def test_unclear_outcome_stays_processing_and_is_not_resent(client, db_session_factory, monkeypatch):
    h = await _ready(client, db_session_factory, ["10000"])
    admin = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'a@qyka.com')}"}
    calls = []

    async def timeout(**kw):
        calls.append(kw)
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(transfers, "send_transfer", timeout)
    p = (await client.post("/payouts", headers=h, json={"amount": "1000"})).json()
    r = await client.post(f"/admin/payouts/{p['id']}/approve", headers=admin)
    assert r.json()["status"] == "processing"
    # money stays reserved; it can't be approved again
    assert Decimal((await client.get("/payouts/summary", headers=h)).json()["available"]) == 9000
    assert (await client.post(f"/admin/payouts/{p['id']}/approve", headers=admin)).status_code == 409
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_rail_refusal_returns_the_money(client, db_session_factory, monkeypatch):
    h = await _ready(client, db_session_factory, ["10000"])
    admin = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'a@qyka.com')}"}

    async def refuse(**kw):
        req = httpx.Request("POST", "http://x")
        raise httpx.HTTPStatusError("no", request=req, response=httpx.Response(400, request=req))

    monkeypatch.setattr(transfers, "send_transfer", refuse)
    p = (await client.post("/payouts", headers=h, json={"amount": "1000"})).json()
    r = await client.post(f"/admin/payouts/{p['id']}/approve", headers=admin)
    assert r.json()["status"] == "failed"
    assert Decimal((await client.get("/payouts/summary", headers=h)).json()["available"]) == 10000


@pytest.mark.asyncio
async def test_only_earners_can_use_it_and_only_see_their_own(client, db_session_factory, sent):
    from tests.test_agent_dashboard import _login
    cust = {"Authorization": f"Bearer {await _login(client, '+2348050009999')}"}
    assert (await client.get("/payouts/summary", headers=cust)).status_code == 403
    a = await _ready(client, db_session_factory, ["5000"], phone="+2348066600001")
    b = await _ready(client, db_session_factory, ["5000"], phone="+2348066600002")
    await client.post("/payouts", headers=a, json={"amount": "1000"})
    assert len((await client.get("/payouts", headers=a)).json()) == 1
    assert (await client.get("/payouts", headers=b)).json() == []
    async with db_session_factory() as s:
        assert len((await s.execute(select(Payout))).scalars().all()) == 1
