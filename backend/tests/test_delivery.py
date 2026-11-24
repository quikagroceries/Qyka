import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import pytest
from app.core.enums import AdminLevel
from sqlalchemy import select

from app.core.config import settings
from tests.conftest import make_hub, out_for_delivery, pay_deposit, through_hub

PHONE_CUST = "+2348010000001"
PHONE_AGENT = "+2348020000002"
PHONE_RIDER = "+2348030000003"


async def _login(client, phone):
    r = await client.post("/auth/request-otp", json={"identifier": phone})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": phone, "code": code})
    return r.json()["access_token"]


def _sign(body: bytes) -> str:
    return hmac.new(settings.paystack_secret_key.encode(), body, hashlib.sha512).hexdigest()


@pytest.mark.asyncio
async def test_full_delivery_and_payout(client, db_session_factory, monkeypatch):
    from app.auth.models import User
    from app.core.enums import LedgerDirection, OrderStatus, UserRole
    from app.float import service as float_service
    from app.orders.models import Order

    async def fake_init(*, email, amount_naira, reference, callback_url=None):
        return {"authorization_url": f"https://paystack.test/{reference}", "reference": reference}
    monkeypatch.setattr("app.payments.paystack.initialize_transaction", fake_init)
    settings.paystack_secret_key = "sk_test_dummy"

    async def fake_send(*, account_number, bank_code, amount_naira, reference, reason="x"):
        return {"reference": reference, "status": "success", "fee": 0}
    monkeypatch.setattr("app.payments.transfers.send_transfer", fake_send)

    # --- set up customer(admin), agent, rider ---
    cust_token = await _login(client, PHONE_CUST)
    agent_token = await _login(client, PHONE_AGENT)
    rider_token = await _login(client, PHONE_RIDER)

    async with db_session_factory() as s:
        agent = (await s.execute(select(User).where(User.phone == PHONE_AGENT))).scalar_one()
        agent.role = UserRole.AGENT
        rider = (await s.execute(select(User).where(User.phone == PHONE_RIDER))).scalar_one()
        rider.role = UserRole.RIDER
        cust = (await s.execute(select(User).where(User.phone == PHONE_CUST))).scalar_one()
        cust.role = UserRole.ADMIN
        cust.admin_level = AdminLevel.OWNER
        await s.commit()
        agent_id, rider_id = agent.id, rider.id
        market_id = uuid.uuid4()
        await float_service.record_movement(
            s, direction=LedgerDirection.CREDIT, amount=Decimal("100000.00"),
            market_id=market_id, note="seed")
        await s.commit()

    admin_h = {"Authorization": f"Bearer {cust_token}"}
    agent_h = {"Authorization": f"Bearer {agent_token}"}
    rider_h = {"Authorization": f"Bearer {rider_token}"}

    # --- order through to PAID ---
    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id), "listed_items_total": "2000.00",
        "items": [{"description": "500 naira pepper"}, {"description": "1000 naira rice"}]})
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    items = r.json()["items"]
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": items[0]["id"], "price": "500.00"}]})
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": items[1]["id"], "price": "1000.00"}]})
    r = await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    final = r.json()
    grand_total = Decimal(final["grand_total"])   # 1500 + 112.50 + 1500 = 3112.50
    agent_share = Decimal(final["agent_share"])   # 1000
    company_share = Decimal(final["company_share"])  # 112.50 - 1000 = -887.50
    delivery_fee = Decimal(final["delivery_fee"]) # 1500

    # pay via webhook
    r = await client.post(f"/payments/orders/{oid}/checkout", headers=admin_h)
    ref = r.json()["reference"]
    body = json.dumps({"event": "charge.success", "data": {"reference": ref}}).encode()
    await client.post("/payments/webhook", content=body, headers={"x-paystack-signature": _sign(body)})

    async with db_session_factory() as s:
        pool_after_payment = await float_service.get_pool_balance(s, market_id)

    # --- delivery arc ---
    # can't drop at a hub as the wrong role
    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=rider_h)
    assert r.status_code == 403

    # No hub in the market yet -> nowhere to drop.
    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)
    assert r.status_code == 409

    hub_h = await through_hub(client, db_session_factory, oid, market_id, agent_h)
    r = await client.get(f"/orders/{oid}", headers=admin_h)
    assert r.json()["status"] == "ready_for_pickup"

    # A rider claims it from the pool; the shopkeeper releases it with the
    # rider's code, which is what sends it out and issues the customer's PIN.
    from tests.conftest import make_rider
    rider_h = await make_rider(client, db_session_factory, market_id, phone=PHONE_RIDER)
    r = await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)
    assert r.status_code == 200, r.text
    pickup_code = r.json()["pickup_code"]
    r = await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": pickup_code})
    assert r.status_code == 200 and r.json()["status"] == "out_for_delivery"
    r = await client.get(f"/orders/{oid}", headers=admin_h)
    assert r.json()["status"] == "out_for_delivery" and r.json()["handover_code"]

    # --- customer confirms delivery -> payout split ---
    r = await client.post(f"/delivery/orders/{oid}/confirm-delivery", headers=admin_h)
    assert r.status_code == 200, r.text
    split = r.json()
    assert Decimal(split["agent_payout"]) == agent_share
    # The delivery fee pays the rider and the hub (1000 + 500 by default),
    # not a courier, so nothing is left over for the company here.
    assert Decimal(split["rider_payout"]) == Decimal("1000.00")
    assert Decimal(split["hub_payout"]) == Decimal("500.00")
    assert Decimal(split["courier_cost"]) == 0
    assert Decimal(split["company_retained"]) == company_share + delivery_fee - Decimal("1500.00")

    # order closed
    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert o.status is OrderStatus.CLOSED
        pool_final = await float_service.get_pool_balance(s, market_id)

        # Status-timeline fields: each stamped exactly once, in the order the
        # customer's tracking screen expects to display them.
        assert o.agent_assigned_at is not None
        assert o.paid_at is not None
        assert o.packed_at is not None
        assert o.dispatched_at is not None
        assert o.delivered_at is not None
        assert (
            o.agent_assigned_at <= o.paid_at <= o.packed_at
            <= o.dispatched_at <= o.delivered_at
        ), "timeline timestamps must be chronological"
        # 4-digit handover PIN, generated at dispatch.
        assert o.handover_code is not None and len(o.handover_code) == 4
        assert o.handover_code.isdigit()

    # pool should have dropped by agent_share + delivery_fee (payouts released)
    assert pool_after_payment - pool_final == agent_share + delivery_fee

    print("Delivery arc + payout split + pool release all correct.")


@pytest.mark.asyncio
async def test_cannot_pack_unpaid_order(client, db_session_factory):
    """The gate: an order that isn't paid cannot enter delivery."""
    from app.auth.models import User
    from app.core.enums import LedgerDirection, UserRole
    from app.float import service as float_service

    cust_token = await _login(client, PHONE_CUST)
    agent_token = await _login(client, PHONE_AGENT)
    async with db_session_factory() as s:
        agent = (await s.execute(select(User).where(User.phone == PHONE_AGENT))).scalar_one()
        agent.role = UserRole.AGENT
        cust = (await s.execute(select(User).where(User.phone == PHONE_CUST))).scalar_one()
        cust.role = UserRole.ADMIN
        cust.admin_level = AdminLevel.OWNER
        await s.commit()
        agent_id = agent.id
        market_id = uuid.uuid4()
        await float_service.record_movement(
            s, direction=LedgerDirection.CREDIT, amount=Decimal("100000.00"),
            market_id=market_id, note="seed")
        await s.commit()

    admin_h = {"Authorization": f"Bearer {cust_token}"}
    agent_h = {"Authorization": f"Bearer {agent_token}"}

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id), "items": [{"description": "500 naira pepper"}]})
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    # order is in SHOPPING, never paid — dropping at a hub must fail
    await make_hub(client, db_session_factory, market_id)
    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)
    assert r.status_code == 409, "unpaid order should not be droppable at a hub"
    print("Unpaid order correctly blocked from delivery.")
