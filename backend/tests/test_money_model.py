"""Tests for the settled Qyka money model: fees, deposit, refunds, wallet."""

import uuid
from decimal import Decimal

import pytest
from app.core.enums import AdminLevel
from sqlalchemy import select
from tests.conftest import pay_deposit

PHONE_CUST = "+2348010000001"
PHONE_AGENT = "+2348020000002"


async def _login(client, phone):
    r = await client.post("/auth/request-otp", json={"identifier": phone})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": phone, "code": code})
    return r.json()["access_token"]


async def _setup(client, db_session_factory):
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
        agent_id, cust_id = agent.id, cust.id
        market_id = uuid.uuid4()
        await float_service.record_movement(
            s, direction=LedgerDirection.CREDIT, amount=Decimal("500000.00"),
            market_id=market_id, note="seed")
        await s.commit()
    return (
        {"Authorization": f"Bearer {cust_token}"},
        {"Authorization": f"Bearer {agent_token}"},
        agent_id, cust_id, market_id,
    )




async def _pay_deposit(client, db_session_factory, oid, cust_id, headers, deposit):
    """Fund the wallet and pay the order's deposit so shopping can start."""
    from app.wallet import service as wallet_service
    async with db_session_factory() as s:
        await wallet_service.credit(s, cust_id, deposit, note="test fund")
        await s.commit()
    r = await client.post(f"/payments/orders/{oid}/deposit/pay-from-wallet", headers=headers)
    assert r.status_code == 200, r.text


# ---------- Fee policy (pure functions) ----------

def test_service_fee_is_exactly_7_5_percent_of_goods():
    from app.orders.fees import service_fee
    assert service_fee(Decimal("10000.00")) == Decimal("750.00")
    assert service_fee(Decimal("5000.00")) == Decimal("375.00")
    assert service_fee(Decimal("450.00")) == Decimal("33.75")
    assert service_fee(Decimal("0.00")) == Decimal("0.00")


def test_customer_bill_does_not_change_with_shopping_time():
    """10-min and 90-min shops on the same order bill the customer identically -
    time only moves money between agent and company, never onto the bill."""
    from app.orders.fees import calculate_fees
    quick = calculate_fees(Decimal("20000.00"), 10 * 60)
    slow = calculate_fees(Decimal("20000.00"), 90 * 60)
    assert quick["combined_fee"] == slow["combined_fee"] == Decimal("1500.00")
    assert quick["grand_total"] == slow["grand_total"] == Decimal("23000.00")  # 20000 + 1500 + 1500
    assert slow["agent_share"] > quick["agent_share"]


def test_agent_share_rises_with_time_company_takes_the_rest():
    from app.orders.fees import split_fee
    goods = Decimal("40000.00")                      # fee 3000
    within = split_fee(goods, 25 * 60)
    assert within == {"total": Decimal("3000.00"), "agent": Decimal("1000.00"), "company": Decimal("2000.00")}
    exact = split_fee(goods, 30 * 60)                # the 30th minute is still included
    assert exact["agent"] == Decimal("1000.00")
    over = split_fee(goods, 45 * 60)                 # 15 min over -> +750
    assert over == {"total": Decimal("3000.00"), "agent": Decimal("1750.00"), "company": Decimal("1250.00")}


def test_company_share_goes_negative_and_agent_still_gets_full_time_share():
    """A long, cheap order: the agent is never capped, the company is never
    floored at zero - its share simply goes negative."""
    from app.orders.fees import split_fee
    sp = split_fee(Decimal("5000.00"), 60 * 60)      # fee 375; agent 1000 + 30*50
    assert sp["total"] == Decimal("375.00")
    assert sp["agent"] == Decimal("2500.00")
    assert sp["company"] == Decimal("-2125.00")
    # Even a quick cheap order: the agent's base alone exceeds a 7.5% fee under N13,333.
    quick = split_fee(Decimal("5000.00"), 20 * 60)
    assert quick["agent"] == Decimal("1000.00") and quick["company"] == Decimal("-625.00")


def test_agent_plus_company_always_equals_the_fee_exactly():
    from app.orders.fees import split_fee
    for goods in ["0.00", "333.33", "450.00", "5000.00", "13333.33", "78000.00", "1234567.89"]:
        for minutes in [0, 1, 29, 30, 31, 47, 90, 240]:
            sp = split_fee(Decimal(goods), minutes * 60)
            assert sp["agent"] + sp["company"] == sp["total"], (goods, minutes, sp)


def test_deposit_is_30_percent_of_goods_on_every_order():
    from app.orders.fees import estimate_order_value, required_deposit

    def dep(goods, must_prepay=False):
        g = Decimal(goods)
        return required_deposit(g, estimate_order_value(g), must_prepay=must_prepay)

    assert dep("5000.00") == Decimal("1500.00")       # small orders pay too now
    assert dep("2000.00") == Decimal("600.00")
    assert dep("80000.00") == Decimal("24000.00")
    assert dep("200000.00") == Decimal("60000.00")
    # must_prepay: 100% of the whole estimate (goods + delivery + 7.5% fee)
    assert dep("5000.00", must_prepay=True) == Decimal("6875.00")   # 5000 + 1500 + 375


def test_delivery_placeholder_and_add_item_fee():
    from app.orders.fees import ADD_ITEM_FEE, DELIVERY_FEE_FLAT, calculate_fees
    assert DELIVERY_FEE_FLAT == Decimal("1500.00")
    assert calculate_fees(Decimal("1000.00"))["delivery_fee"] == Decimal("1500.00")
    assert ADD_ITEM_FEE == Decimal("500.00")


@pytest.mark.asyncio
async def test_public_pricing_endpoint_matches_the_fee_rules(client):
    r = await client.get("/pricing")
    assert r.status_code == 200
    assert r.json() == {
        "service_fee_percent": "7.5",
        "delivery_fee": "1500.00",
        "delivery_fee_is_placeholder": True,
        "deposit_percent": "30",
        "add_item_fee": "500.00",
        "emtl_per_transfer": "50.00",
        "emtl_threshold": "10000.00",
    }


@pytest.mark.asyncio
async def test_overtime_shopping_raises_fee_and_agent_share(client, db_session_factory):
    """Integration-level check that test_combined_fee_time_based (a pure
    function test) doesn't cover: finish_shopping must measure REAL elapsed
    wall-clock time from shopping_started_at, not read as ~0 seconds because
    start and finish happen back-to-back in a test. Fakes shopping_started_at
    45 minutes in the past (15 min of billable overtime) and asserts the fee
    - and agent_share specifically, since that's what the agent actually
    gets paid - rises by exactly 15 * PER_MINUTE, while the customer's fee
    stays 7.5% of the goods.
    """
    from datetime import datetime, timedelta, timezone
    from app.orders.models import Order

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "500.00",
        "items": [{"description": "500 naira pepper"}],
    })
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    item_id = r.json()["items"][0]["id"]

    # Back-date shopping_started_at to land in the middle of minute 45 (44:30
    # elapsed, not exactly 45:00) - billable_minutes rounds UP
    # (math.ceil), so pinning to an exact minute boundary makes the test
    # flaky against ordinary test-execution jitter between here and
    # finish-shopping. 44:30 leaves ~30 seconds of margin either side while
    # still landing on the same billable_minutes=45 (15 min of overtime).
    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        o.shopping_started_at = datetime.now(timezone.utc) - timedelta(minutes=44, seconds=30)
        await s.commit()

    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": item_id, "price": "500.00"}]})
    r = await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    assert r.status_code == 200, r.text
    body = r.json()

    # The customer's fee is 7.5% of the goods no matter how long it took;
    # the 15 min of overtime (15 * 50 = 750) goes to the agent on top of the
    # 1000 base, and the company absorbs it - going negative on this cheap order.
    assert Decimal(body["combined_fee"]) == Decimal("37.50"), body
    assert Decimal(body["agent_share"]) == Decimal("1750.00"), body
    assert Decimal(body["company_share"]) == Decimal("-1712.50"), body
    assert Decimal(body["grand_total"]) == Decimal("2037.50"), body  # 500 + 37.50 + 1500

    print("Overtime raises only the agent's share, never the customer's bill.")


# ---------- Deposit on a large order ----------

@pytest.mark.asyncio
async def test_large_order_requires_deposit(client, db_session_factory):
    admin_h, agent_h, agent_id, _, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "delivery_address": "12 Aba Road, Port Harcourt",
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}],
    })
    assert r.status_code == 201, r.text
    order = r.json()
    # estimate = 78000 items + 1500 delivery + 5850 service fee (7.5%)
    assert Decimal(order["estimated_value"]) == Decimal("85350.00")
    assert Decimal(order["deposit_amount"]) == Decimal("23400.00")
    assert order["delivery_address"] == "12 Aba Road, Port Harcourt"


@pytest.mark.asyncio
async def test_small_order_also_needs_a_30_percent_deposit(client, db_session_factory):
    admin_h, _, _, _, market_id = await _setup(client, db_session_factory)
    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "3000.00",
        "items": [{"description": "500 naira pepper"}],
    })
    assert Decimal(r.json()["deposit_amount"]) == Decimal("900.00")


# ---------- Refund case B: nothing found ----------

@pytest.mark.asyncio
async def test_nothing_found_refunds_whole_deposit(client, db_session_factory):
    from app.core.enums import OrderStatus
    from app.orders.models import Order
    from app.wallet import service as wallet_service

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}],
    })
    oid = r.json()["id"]
    deposit = Decimal(r.json()["deposit_amount"])
    assert deposit == Decimal("23400.00")

    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, deposit)
    await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)

    # Agent confirms NOTHING — market had none of it
    r = await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    assert r.status_code == 200, r.text

    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert o.status is OrderStatus.CANCELLED
        balance = await wallet_service.get_balance(s, cust_id)
    assert balance == deposit, "whole deposit should be refunded to wallet"


# ---------- Customer cancellation before shopping (with refund) ----------

@pytest.mark.asyncio
async def test_customer_cancel_refunds_deposit_exactly_once(client, db_session_factory):
    """The cancel-before-shopping path delete_order's docstring pointed to
    but never existed - a paid deposit must come back to the wallet, and
    only ever once (no double-credit if the frontend retries the call)."""
    from app.core.enums import LedgerDirection, OrderStatus
    from app.orders.models import Order
    from app.wallet.models import WalletLedger
    from app.wallet import service as wallet_service

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}],
    })
    oid = r.json()["id"]
    deposit = Decimal(r.json()["deposit_amount"])
    assert deposit == Decimal("23400.00")

    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, deposit)

    # Balance after funding+paying the deposit is 0 (funded exactly `deposit`,
    # then spent it) - confirms the refund below is the ONLY credit in play.
    async with db_session_factory() as s:
        assert await wallet_service.get_balance(s, cust_id) == Decimal("0.00")

    r = await client.post(f"/orders/{oid}/cancel", headers=admin_h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"

    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert o.status is OrderStatus.CANCELLED
        balance = await wallet_service.get_balance(s, cust_id)
        assert balance == deposit, "the paid deposit should be refunded to the wallet"

        # Exactly one refund CREDIT landed - not zero, not double-credited.
        # (The order also carries the earlier deposit-payment DEBIT under the
        # same order_id - that's the expected paired entry, not the refund.)
        result = await s.execute(
            select(WalletLedger).where(
                WalletLedger.order_id == uuid.UUID(oid),
                WalletLedger.direction == LedgerDirection.CREDIT,
            )
        )
        entries = result.scalars().all()
        assert len(entries) == 1
        assert entries[0].amount == deposit

    # Retrying the (already-cancelled) order must not refund a second time.
    r = await client.post(f"/orders/{oid}/cancel", headers=admin_h)
    assert r.status_code == 409, "cancelling an already-cancelled order must be rejected"
    async with db_session_factory() as s:
        assert await wallet_service.get_balance(s, cust_id) == deposit, "no double refund on retry"

    print("Cancel-before-shopping refunds the deposit exactly once.")


@pytest.mark.asyncio
async def test_cannot_cancel_once_shopping_started(client, db_session_factory):
    """Once SHOPPING has opened a spending authorization the agent is
    committed - cancel-with-refund is no longer available (a lapsed payment
    from here on is must_prepay/loss territory, not a customer cancel)."""
    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}],
    })
    oid = r.json()["id"]
    deposit = Decimal(r.json()["deposit_amount"])

    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, deposit)
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    assert r.status_code == 200, r.text

    r = await client.post(f"/orders/{oid}/cancel", headers=admin_h)
    assert r.status_code == 409, "cannot cancel-with-refund once shopping has started"

    print("Cancellation correctly blocked once shopping has started.")


# ---------- Deposit forfeiture: lapsed balance payment (NOT a refund case) ----------

@pytest.mark.asyncio
async def test_lapsed_balance_payment_forfeits_deposit(client, db_session_factory):
    """The deposit is refunded ONLY on the two documented cases above
    (nothing found, bargained-total below the deposit) - never for a
    customer simply failing to pay the balance in time. A lapsed payment
    window is the customer's own non-payment after the agent already spent
    real money at the market; the company doesn't owe that back.
    """
    from datetime import datetime, timedelta, timezone
    from app.auth.models import User
    from app.core.enums import OrderStatus
    from app.orders.models import Order
    from app.payments import service as payments_service
    from app.wallet import service as wallet_service

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}],
    })
    oid = r.json()["id"]
    deposit = Decimal(r.json()["deposit_amount"])
    assert deposit == Decimal("23400.00")

    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, deposit)

    async with db_session_factory() as s:
        balance_after_deposit = await wallet_service.get_balance(s, cust_id)

    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    item_id = r.json()["items"][0]["id"]
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": item_id, "price": "78000.00"}]})
    r = await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "awaiting_payment"

    # Force the payment window into the past (same technique as
    # test_stale_order_auto_cancels in test_payments.py).
    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        o.payment_window_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await s.commit()

    async with db_session_factory() as s:
        count = await payments_service.expire_stale_orders(s)
        await s.commit()
    assert count == 1

    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert o.status is OrderStatus.CANCELLED_UNPAID
        assert o.deposit_amount == deposit, "deposit must stay recorded, not zeroed"
        assert o.deposit_paid_at is not None, "still recorded as paid, never rolled back"

        cust = (await s.execute(select(User).where(User.id == cust_id))).scalar_one()
        assert cust.must_prepay is True
        assert cust.non_payment_count == 1

        balance_after_expiry = await wallet_service.get_balance(s, cust_id)
    # The deposit is forfeited, not refunded - expire_stale_orders must NOT
    # have credited the wallet.
    assert balance_after_expiry == balance_after_deposit

    print("Lapsed balance payment correctly forfeits the deposit - no wallet credit.")


# ---------- Refund case A: total below deposit ----------

@pytest.mark.asyncio
async def test_partial_shortfall_credits_wallet(client, db_session_factory, monkeypatch):
    from app.wallet import service as wallet_service

    async def fake_send(*, account_number, bank_code, amount_naira, reference, reason="x"):
        return {"reference": reference, "status": "success", "fee": 0}
    monkeypatch.setattr("app.payments.transfers.send_transfer", fake_send)

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}, {"description": "yams"}],
    })
    oid = r.json()["id"]
    deposit = Decimal(r.json()["deposit_amount"])  # 23400

    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, deposit)
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    items = r.json()["items"]

    # Only ONE cheap item was actually available
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": items[0]["id"], "price": "2000.00"}]})
    r = await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    final = r.json()

    grand = Decimal(final["grand_total"])  # 2000 items + 150 fee + 1500 delivery = 3650
    assert grand == Decimal("3650.00")
    expected_refund = deposit - grand  # 23400 - 3650 = 19750

    async with db_session_factory() as s:
        balance = await wallet_service.get_balance(s, cust_id)
    assert balance == expected_refund, "difference should be refunded"


# ---------- Bargained list ----------

@pytest.mark.asyncio
async def test_bargained_list_shows_real_prices(client, db_session_factory, monkeypatch):
    async def fake_send(*, account_number, bank_code, amount_naira, reference, reason="x"):
        return {"reference": reference, "status": "success", "fee": 0}
    monkeypatch.setattr("app.payments.transfers.send_transfer", fake_send)

    admin_h, agent_h, agent_id, _, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "2000.00",
        "items": [{"description": "500 naira pepper"}, {"description": "rare spice"}],
    })
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    items = r.json()["items"]

    # agent bargained pepper down to 450; second item unavailable
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": items[0]["id"], "price": "450.00"}]})
    await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)

    r = await client.get(f"/orders/{oid}/bargained-list", headers=admin_h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert Decimal(data["items_total"]) == Decimal("450.00")
    assert Decimal(data["combined_fee"]) == Decimal("33.75")  # 7.5% of 450
    found = {i["description"]: i["found"] for i in data["items"]}
    assert found["500 naira pepper"] is True
    assert found["rare spice"] is False
    # the 600 deposit (30% of the 2000 listed) is already paid
    assert Decimal(data["amount_due"]) == Decimal(data["grand_total"]) - Decimal("600.00")


# ---------- Wallet as a payment option ----------

@pytest.mark.asyncio
async def test_pay_from_wallet(client, db_session_factory, monkeypatch):
    from app.core.enums import OrderStatus
    from app.orders.models import Order
    from app.wallet import service as wallet_service

    async def fake_send(*, account_number, bank_code, amount_naira, reference, reason="x"):
        return {"reference": reference, "status": "success", "fee": 0}
    monkeypatch.setattr("app.payments.transfers.send_transfer", fake_send)

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    # fund the wallet
    r = await client.post("/wallet/fund", headers=admin_h, json={"amount": "10000.00"})
    assert Decimal(r.json()["balance"]) == Decimal("10000.00")

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "1500.00",
        "items": [{"description": "500 naira pepper"}],
    })
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    items = r.json()["items"]
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": items[0]["id"], "price": "1500.00"}]})
    r = await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    grand = Decimal(r.json()["grand_total"])  # 1500 + 112.50 + 1500 = 3112.50
    deposit = Decimal(r.json()["deposit_amount"])  # 450, already paid

    r = await client.post(f"/payments/orders/{oid}/pay-from-wallet", headers=admin_h)
    assert r.status_code == 200, r.text

    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert o.status is OrderStatus.PAID
        balance = await wallet_service.get_balance(s, cust_id)
    assert balance == Decimal("10000.00") - (grand - deposit)


@pytest.mark.asyncio
async def test_wallet_insufficient_balance_rejected(client, db_session_factory, monkeypatch):
    async def fake_send(*, account_number, bank_code, amount_naira, reference, reason="x"):
        return {"reference": reference, "status": "success", "fee": 0}
    monkeypatch.setattr("app.payments.transfers.send_transfer", fake_send)

    admin_h, agent_h, agent_id, _, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "1500.00",
        "items": [{"description": "500 naira pepper"}],
    })
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    items = r.json()["items"]
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/receipt.jpg",
        "items": [{"item_id": items[0]["id"], "price": "1500.00"}]})
    await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)

    # wallet is empty -> must be told to top up or pay by bank
    r = await client.post(f"/payments/orders/{oid}/pay-from-wallet", headers=admin_h)
    assert r.status_code == 402, r.text


# ---------- The deposit-leak fix ----------

@pytest.mark.asyncio
async def test_shopping_blocked_until_deposit_paid(client, db_session_factory):
    """An order cannot start shopping until its deposit is collected."""
    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "bulk rice bags"}],
    })
    oid = r.json()["id"]
    assert Decimal(r.json()["deposit_amount"]) == Decimal("23400.00")

    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})

    # Without paying the deposit, shopping must be refused
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    assert r.status_code == 402, "shopping should be blocked until deposit paid"

    # Pay it, then shopping is allowed
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, Decimal("23400.00"))
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_deposit_credits_float_pool(client, db_session_factory):
    """A paid deposit is real money — it lands in the float pool."""
    from app.float import service as float_service

    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)

    async with db_session_factory() as s:
        pool_before = await float_service.get_pool_balance(s, market_id)

    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "78000.00",
        "items": [{"description": "rice"}],
    })
    oid = r.json()["id"]
    deposit = Decimal(r.json()["deposit_amount"])
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, deposit)

    async with db_session_factory() as s:
        pool_after = await float_service.get_pool_balance(s, market_id)
    assert pool_after - pool_before == deposit, "deposit should credit the pool"


@pytest.mark.asyncio
async def test_small_order_also_blocked_until_deposit_paid(client, db_session_factory):
    """No threshold any more: even a small order shops only after its 30%."""
    admin_h, agent_h, agent_id, cust_id, market_id = await _setup(client, db_session_factory)
    r = await client.post("/orders", headers=admin_h, json={
        "market_id": str(market_id),
        "listed_items_total": "3000.00",
        "items": [{"description": "pepper"}],
    })
    oid = r.json()["id"]
    assert Decimal(r.json()["deposit_amount"]) == Decimal("900.00")
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    assert r.status_code == 402, "a small order must not shop before its deposit"
    await _pay_deposit(client, db_session_factory, oid, cust_id, admin_h, Decimal("900.00"))
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    assert r.status_code == 200, r.text
