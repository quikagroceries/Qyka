"""Rider side of delivery: claim from the pool, collect from the hub with a
code the shopkeeper enters, confirm drop-off with the customer's PIN."""

import uuid

import pytest
from sqlalchemy import select

from tests.conftest import make_hub, make_rider, through_hub
from tests.test_hub_custody import _paid_order


async def _ready_order(client, db_session_factory, monkeypatch):
    """A real order sitting READY_FOR_PICKUP at a hub. Returns
    (oid, market_id, agent_h, admin_h, hub_h)."""
    oid, market_id, agent_h, admin_h, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h = await through_hub(client, db_session_factory, oid, market_id, agent_h)
    return oid, market_id, agent_h, admin_h, hub_h


async def _bare_ready_order(db_session_factory, market_id, *, hub_id=None):
    """An extra READY_FOR_PICKUP order, inserted directly (for pool tests)."""
    from app.core.enums import OrderStatus
    from app.orders.models import Order

    async with db_session_factory() as s:
        order = Order(customer_id=uuid.uuid4(), market_id=market_id,
                      status=OrderStatus.READY_FOR_PICKUP, hub_id=hub_id)
        s.add(order)
        await s.commit()
        return str(order.id)


@pytest.mark.asyncio
async def test_pool_is_per_market_and_hides_customer_details(client, db_session_factory, monkeypatch):
    oid, market_id, _, _, _ = await _ready_order(client, db_session_factory, monkeypatch)
    here = await make_rider(client, db_session_factory, market_id, phone="+2348066600001")
    elsewhere = await make_rider(client, db_session_factory, uuid.uuid4(), phone="+2348066600002")
    anywhere = await make_rider(client, db_session_factory, None, phone="+2348066600003")

    [job] = (await client.get("/riders/jobs", headers=here)).json()
    assert job["id"] == oid and job["hub_name"] == "Test Hub" and job["item_count"] == 2
    for hidden in ("pickup_code", "customer_name", "customer_phone", "delivery_address"):
        assert job[hidden] is None, hidden
    assert (await client.get("/riders/jobs", headers=elsewhere)).json() == []
    assert len((await client.get("/riders/jobs", headers=anywhere)).json()) == 1   # no market = all
    # A rider from another market can't claim it by id either.
    assert (await client.post(f"/riders/jobs/{oid}/claim", headers=elsewhere)).status_code == 404


@pytest.mark.asyncio
async def test_claim_is_first_come_and_one_job_at_a_time(client, db_session_factory, monkeypatch):
    oid, market_id, _, _, _ = await _ready_order(client, db_session_factory, monkeypatch)
    first = await make_rider(client, db_session_factory, market_id, phone="+2348066600001")
    second = await make_rider(client, db_session_factory, market_id, phone="+2348066600002")

    r = await client.post(f"/riders/jobs/{oid}/claim", headers=first)
    assert r.status_code == 200, r.text
    job = r.json()
    assert len(job["pickup_code"]) == 4 and job["customer_phone"]    # revealed to the claimer

    assert (await client.post(f"/riders/jobs/{oid}/claim", headers=second)).status_code == 409
    assert (await client.get("/riders/jobs", headers=second)).json() == []   # gone from the pool
    [mine] = (await client.get("/riders/jobs/mine", headers=first)).json()
    assert mine["id"] == oid

    # One job at a time: a second ready order can't be taken on top.
    other = await _bare_ready_order(db_session_factory, market_id)
    assert (await client.post(f"/riders/jobs/{other}/claim", headers=first)).status_code == 409
    assert (await client.post(f"/riders/jobs/{other}/claim", headers=second)).status_code == 200


@pytest.mark.asyncio
async def test_release_returns_the_job_to_the_pool(client, db_session_factory, monkeypatch):
    oid, market_id, _, _, hub_h = await _ready_order(client, db_session_factory, monkeypatch)
    rider = await make_rider(client, db_session_factory, market_id, phone="+2348066600001")
    other = await make_rider(client, db_session_factory, market_id, phone="+2348066600002")
    await client.post(f"/riders/jobs/{oid}/claim", headers=rider)

    assert (await client.post(f"/riders/jobs/{oid}/release", headers=other)).status_code == 404
    r = await client.post(f"/riders/jobs/{oid}/release", headers=rider)
    assert r.status_code == 200 and r.json()["pickup_code"] is None
    assert len((await client.get("/riders/jobs", headers=other)).json()) == 1
    # The old code is gone: the hub sees no rider waiting.
    [row] = (await client.get("/hubs/orders", headers=hub_h)).json()
    assert row["rider_waiting"] is False and row["rider_name"] is None


@pytest.mark.asyncio
async def test_hub_releases_only_with_the_riders_code(client, db_session_factory, monkeypatch):
    oid, market_id, _, admin_h, hub_h = await _ready_order(client, db_session_factory, monkeypatch)
    rider = await make_rider(client, db_session_factory, market_id, phone="+2348066600001")

    # Nobody has claimed it yet.
    r = await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": "0000"})
    assert r.status_code == 409
    code = (await client.post(f"/riders/jobs/{oid}/claim", headers=rider)).json()["pickup_code"]
    [row] = (await client.get("/hubs/orders", headers=hub_h)).json()
    assert row["rider_waiting"] is True

    wrong = "0000" if code != "0000" else "1111"
    r = await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": wrong})
    assert r.status_code == 422
    assert (await client.get(f"/orders/{oid}", headers=admin_h)).json()["status"] == "ready_for_pickup"

    r = await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": code})
    assert r.status_code == 200 and r.json()["status"] == "out_for_delivery"
    body = (await client.get(f"/orders/{oid}", headers=admin_h)).json()
    assert body["status"] == "out_for_delivery" and body["handover_code"] and body["dispatched_at"]
    # Too late to release it now.
    assert (await client.post(f"/riders/jobs/{oid}/release", headers=rider)).status_code == 409


@pytest.mark.asyncio
async def test_drop_off_needs_the_customers_pin_and_the_customer_still_closes(client, db_session_factory, monkeypatch):
    oid, market_id, agent_h, admin_h, hub_h = await _ready_order(client, db_session_factory, monkeypatch)
    rider = await make_rider(client, db_session_factory, market_id, phone="+2348066600001")
    other = await make_rider(client, db_session_factory, market_id, phone="+2348066600002")
    code = (await client.post(f"/riders/jobs/{oid}/claim", headers=rider)).json()["pickup_code"]

    # Not out yet -> can't confirm drop-off.
    assert (await client.post(f"/riders/jobs/{oid}/deliver", headers=rider, json={"code": "1234"})).status_code == 409
    await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": code})
    pin = (await client.get(f"/orders/{oid}", headers=admin_h)).json()["handover_code"]

    wrong = "0000" if pin != "0000" else "1111"
    assert (await client.post(f"/riders/jobs/{oid}/deliver", headers=rider, json={"code": wrong})).status_code == 422
    assert (await client.post(f"/riders/jobs/{oid}/deliver", headers=other, json={"code": pin})).status_code == 404

    r = await client.post(f"/riders/jobs/{oid}/deliver", headers=rider, json={"code": pin})
    assert r.status_code == 200 and r.json()["delivered_at"]
    assert (await client.post(f"/riders/jobs/{oid}/deliver", headers=rider, json={"code": pin})).status_code == 409

    # The rider's word doesn't end the order - the customer's confirmation does.
    body = (await client.get(f"/orders/{oid}", headers=admin_h)).json()
    assert body["status"] == "out_for_delivery" and body["rider_delivered_at"]
    notes = (await client.get("/notifications", headers=admin_h)).json()
    assert any(n["kind"] == "rider_delivered" for n in notes)


@pytest.mark.asyncio
async def test_suspended_or_unlinked_riders_cannot_work(client, db_session_factory, monkeypatch):
    from app.auth.models import User
    from app.core.enums import RiderStatus, UserRole
    from app.riders.models import Rider

    oid, market_id, agent_h, _, _ = await _ready_order(client, db_session_factory, monkeypatch)
    rider = await make_rider(client, db_session_factory, market_id, phone="+2348066600001")
    async with db_session_factory() as s:
        r = (await s.execute(select(Rider).where(Rider.phone == "+2348066600001"))).scalar_one()
        r.status = RiderStatus.SUSPENDED
        await s.commit()
    assert (await client.get("/riders/jobs", headers=rider)).status_code == 403
    assert (await client.get("/riders/jobs/mine", headers=rider)).status_code == 403
    assert (await client.post(f"/riders/jobs/{oid}/claim", headers=rider)).status_code == 403

    # A RIDER-role account with no roster record (e.g. approved before riders
    # could sign in) is refused, and so is anyone who isn't a rider at all.
    ghost = await make_rider(client, db_session_factory, market_id, phone="+2348066600002")
    async with db_session_factory() as s:
        g = (await s.execute(select(Rider).where(Rider.phone == "+2348066600002"))).scalar_one()
        await s.delete(g)
        await s.commit()
    assert (await client.get("/riders/jobs", headers=ghost)).status_code == 403
    assert (await client.get("/riders/jobs", headers=agent_h)).status_code == 403
