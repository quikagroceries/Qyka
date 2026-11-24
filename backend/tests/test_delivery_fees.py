"""Admin-set rider/hub pay: snapshotted per order, paid out on delivery."""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from tests.conftest import out_for_delivery
from tests.test_hub_custody import _paid_order
from tests.test_admin import _login_admin


async def _seed_global(db_session_factory, rider, hub):
    from app.orders.fee_settings import FeeSetting

    async with db_session_factory() as s:
        s.add(FeeSetting(market_id=None, rider_fee=Decimal(rider), hub_fee=Decimal(hub)))
        await s.commit()


async def _admin_h(client, db_session_factory, email="fees-admin@qyka.com"):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, email)}"}


async def _order_fees(db_session_factory, oid):
    from app.orders.models import Order

    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        return o.rider_fee, o.hub_fee


@pytest.mark.asyncio
async def test_built_in_defaults_then_global_then_market_override(client, db_session_factory):
    admin_h = await _admin_h(client, db_session_factory)
    r = await client.get("/admin/fees", headers=admin_h)
    body = r.json()
    assert body["default"]["is_built_in"] is True
    assert (body["default"]["rider_fee"], body["default"]["hub_fee"]) == ("1000.00", "500.00")
    assert body["default"]["delivery_margin"] == "0.00"

    r = await client.put("/admin/fees", headers=admin_h, json={"rider_fee": "800", "hub_fee": "300"})
    assert r.status_code == 200 and r.json()["delivery_margin"] == "400.00"
    r = await client.put("/admin/fees", headers=admin_h, json={"rider_fee": "900", "hub_fee": "300"})
    assert (await client.get("/admin/fees", headers=admin_h)).json()["default"]["rider_fee"] == "900.00"

    from app.markets.models import Market
    async with db_session_factory() as s:
        m = Market(name="Override Market", city="Ibadan", state="Oyo")
        s.add(m)
        await s.commit()
        mid = str(m.id)
    r = await client.put(f"/admin/fees/markets/{mid}", headers=admin_h,
                         json={"rider_fee": "1200", "hub_fee": "100"})
    assert r.status_code == 200 and r.json()["market_name"] == "Override Market"
    body = (await client.get("/admin/fees", headers=admin_h)).json()
    assert [(m["market_id"], m["rider_fee"]) for m in body["markets"]] == [(mid, "1200.00")]

    # What a new order in each market would copy:
    from app.orders import fee_settings
    async with db_session_factory() as s:
        assert await fee_settings.resolve(s, uuid.UUID(mid)) == (Decimal("1200.00"), Decimal("100.00"))
        assert await fee_settings.resolve(s, uuid.uuid4()) == (Decimal("900.00"), Decimal("300.00"))
    assert (await client.delete(f"/admin/fees/markets/{mid}", headers=admin_h)).status_code == 204
    async with db_session_factory() as s:
        assert await fee_settings.resolve(s, uuid.UUID(mid)) == (Decimal("900.00"), Decimal("300.00"))


@pytest.mark.asyncio
async def test_fee_settings_validation_and_access(client, db_session_factory):
    admin_h = await _admin_h(client, db_session_factory, "fees-admin2@qyka.com")
    for bad in ({"rider_fee": "-1", "hub_fee": "500"}, {"rider_fee": "1000", "hub_fee": "9999999"},
                {"rider_fee": "1000"}):
        assert (await client.put("/admin/fees", headers=admin_h, json=bad)).status_code == 422
    assert (await client.put(f"/admin/fees/markets/{uuid.uuid4()}", headers=admin_h,
                             json={"rider_fee": "1", "hub_fee": "1"})).status_code == 404

    r = await client.post("/auth/request-otp", json={"identifier": "+2348070000001"})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": "+2348070000001", "code": code})
    user_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert (await client.get("/admin/fees", headers=user_h)).status_code == 403
    assert (await client.put("/admin/fees", headers=user_h,
                             json={"rider_fee": "1", "hub_fee": "1"})).status_code == 403


@pytest.mark.asyncio
async def test_order_snapshots_fees_and_pays_them_on_delivery(client, db_session_factory, monkeypatch):
    from app.core.enums import LedgerDirection
    from app.float.models import FloatLedger

    await _seed_global(db_session_factory, "800", "300")
    oid, market_id, agent_h, cust_h, _ = await _paid_order(client, db_session_factory, monkeypatch)
    assert await _order_fees(db_session_factory, oid) == (Decimal("800.00"), Decimal("300.00"))

    # Changing the settings now must not touch an order that already exists.
    r = await client.put("/admin/fees", headers=cust_h, json={"rider_fee": "5000", "hub_fee": "5000"})
    assert r.status_code == 200
    assert await _order_fees(db_session_factory, oid) == (Decimal("800.00"), Decimal("300.00"))

    hub_h, rider_h = await out_for_delivery(client, db_session_factory, oid, market_id, agent_h)
    # Nothing earned until the customer confirms.
    assert (await client.get("/riders/earnings", headers=rider_h)).json()["earnings_total"] == "0.00"

    r = await client.post(f"/delivery/orders/{oid}/confirm-delivery", headers=cust_h)
    assert r.status_code == 200, r.text
    split = r.json()
    assert (split["rider_payout"], split["hub_payout"], split["courier_cost"]) == ("800.00", "300.00", "0.00")

    # company keeps the service-fee margin plus the 400 the delivery fee leaves.
    from app.orders.models import Order
    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert Decimal(split["company_retained"]) == o.company_share + o.delivery_fee - Decimal("1100.00")
        debits = {
            row.note: row.amount for row in (await s.execute(
                select(FloatLedger).where(FloatLedger.order_id == o.id,
                                          FloatLedger.direction == LedgerDirection.DEBIT)
            )).scalars().all()
        }
    assert debits["Rider payout"] == Decimal("800.00")
    assert debits["Hub payout"] == Decimal("300.00")
    assert "Courier delivery cost" not in debits

    rider = (await client.get("/riders/earnings", headers=rider_h)).json()
    assert (rider["earnings_total"], rider["earnings_today"], rider["completed_count"]) == ("800.00", "800.00", 1)
    assert rider["recent"][0]["order_id"] == oid and rider["recent"][0]["amount"] == "800.00"
    hub = (await client.get("/hubs/earnings", headers=hub_h)).json()
    assert (hub["earnings_total"], hub["completed_count"]) == ("300.00", 1)
    # And each only sees their own.
    assert (await client.get("/hubs/earnings", headers=rider_h)).status_code == 403
    assert (await client.get("/riders/earnings", headers=hub_h)).status_code == 403


def test_orders_from_before_riders_keep_the_old_courier_split():
    from app.delivery.payouts import compute_split
    from app.orders.models import Order

    legacy = Order(
        delivery_fee=Decimal("1500.00"), agent_share=Decimal("1000.00"),
        company_share=Decimal("200.00"), grand_total=Decimal("9999.00"),
        rider_fee=Decimal("0.00"), hub_fee=Decimal("0.00"),
    )  # no rider, no hub
    s = compute_split(legacy)
    assert (s["courier_cost"], s["rider_payout"], s["hub_payout"]) == ("1500.00", "0.00", "0.00")
    assert s["company_retained"] == "200.00"
