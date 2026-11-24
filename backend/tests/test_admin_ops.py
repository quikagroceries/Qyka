"""Hands-on admin actions: admin-created hubs, stepping in on orders, and
managing people - each audited, each refusing states it would corrupt."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.auth.models import User
from app.core.enums import OrderStatus, UserRole, UserStatus
from app.hubs.models import Hub
from app.markets.models import Agent, Market
from app.orders.models import Order
from tests.conftest import make_hub, make_rider, out_for_delivery, through_hub
from tests.test_admin_audit import _entries, _support
from tests.test_admin import _login_admin
from tests.test_hub_custody import _paid_order


async def _owner(client, db_session_factory, email="ops-owner@qyka.com"):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, email)}"}


async def _market(db_session_factory, name="Ops Market"):
    async with db_session_factory() as s:
        m = Market(name=name, city="Ibadan", state="Oyo")
        s.add(m)
        await s.commit()
        return m.id


async def _sign_in(client, phone):
    r = await client.post("/auth/request-otp", json={"identifier": phone})
    v = await client.post("/auth/verify-otp", json={"identifier": phone, "code": r.json()["dev_otp"]})
    return {"Authorization": f"Bearer {v.json()['access_token']}"}


@pytest.mark.asyncio
async def test_admin_creates_a_hub_and_its_shopkeeper(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    market_id = await _market(db_session_factory)

    r = await client.post("/admin/hubs", headers=h, json={
        "full_name": "Mama Tunde", "phone": "0803 555 0001", "market_id": str(market_id)})
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Ops Market Hub" and r.json()["shopkeeper_phone"] == "+2348035550001"

    # The shopkeeper signs in with a code to that number and lands on their hub.
    sk = await _sign_in(client, "+2348035550001")
    assert (await client.get("/auth/me", headers=sk)).json()["role"] == "shopkeeper"
    assert (await client.get("/hubs/me", headers=sk)).json()["name"] == "Ops Market Hub"
    assert [e.action for e in await _entries(db_session_factory, "hub.create")] == ["hub.create"]

    # One hub per shopkeeper; a custom name; and numbers that belong to other roles are refused.
    assert (await client.post("/admin/hubs", headers=h, json={
        "full_name": "Mama Tunde", "phone": "+2348035550001", "market_id": str(market_id)})).status_code == 409
    r = await client.post("/admin/hubs", headers=h, json={
        "full_name": "Baba Dayo", "phone": "+2348035550002", "market_id": str(market_id), "hub_name": "Main Gate"})
    assert r.json()["name"] == "Main Gate"
    async with db_session_factory() as s:
        s.add(User(phone="+2348035550003", role=UserRole.AGENT, status=UserStatus.ACTIVE))
        await s.commit()
    assert (await client.post("/admin/hubs", headers=h, json={
        "full_name": "An Agent", "phone": "+2348035550003", "market_id": str(market_id)})).status_code == 409
    assert (await client.post("/admin/hubs", headers=h, json={
        "full_name": "Nobody", "phone": "not a number", "market_id": str(market_id)})).status_code == 422
    assert (await client.post("/admin/hubs", headers=h, json={
        "full_name": "Lost", "phone": "+2348035550004", "market_id": str(uuid.uuid4())})).status_code == 404

    # An existing customer can be made a shopkeeper and keeps their account.
    async with db_session_factory() as s:
        s.add(User(phone="+2348035550005", full_name="Existing Customer", role=UserRole.CUSTOMER, status=UserStatus.ACTIVE))
        await s.commit()
    assert (await client.post("/admin/hubs", headers=h, json={
        "full_name": "Ignored Name", "phone": "+2348035550005", "market_id": str(market_id)})).status_code == 201

    # Owner-only.
    support_h = await _support(client, db_session_factory)
    assert (await client.post("/admin/hubs", headers=support_h, json={
        "full_name": "X Y", "phone": "+2348035550006", "market_id": str(market_id)})).status_code == 403


@pytest.mark.asyncio
async def test_replacing_a_shopkeeper_only_when_the_hub_is_empty(client, db_session_factory, monkeypatch):
    h = await _owner(client, db_session_factory)
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h, hub_id = await make_hub(client, db_session_factory, market_id)
    await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)

    body = {"full_name": "New Keeper", "phone": "+2348036660001"}
    assert (await client.post(f"/admin/hubs/{hub_id}/replace-shopkeeper", headers=h, json=body)).status_code == 409

    await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h, json={})
    await client.post(f"/hubs/orders/{oid}/ready", headers=hub_h)
    rider_h = await make_rider(client, db_session_factory, market_id)
    code = (await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)).json()["pickup_code"]
    await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": code})   # gone from the hub

    r = await client.post(f"/admin/hubs/{hub_id}/replace-shopkeeper", headers=h, json=body)
    assert r.status_code == 200 and r.json()["shopkeeper_phone"] == "+2348036660001"
    new = await _sign_in(client, "+2348036660001")
    assert (await client.get("/hubs/me", headers=new)).status_code == 200
    # The previous shopkeeper is an ordinary customer now.
    assert (await client.get("/hubs/me", headers=hub_h)).status_code == 403
    assert (await client.post(f"/admin/hubs/{hub_id}/replace-shopkeeper", headers=h, json=body)).status_code == 409


@pytest.mark.asyncio
async def test_reassigning_an_agent_mid_shopping(client, db_session_factory, monkeypatch):
    support_h = await _support(client, db_session_factory)
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch, stop_after_start=True)
    async with db_session_factory() as s:
        # (the helper makes the first agent a user only; give them the agent record too)
        first = (await s.execute(select(User).where(User.phone == "+2348020000102"))).scalar_one()
        s.add(Agent(user_id=first.id, assigned_market_id=market_id, is_available=False))
        spare = User(phone="+2348037770001", full_name="Spare Agent", role=UserRole.AGENT, status=UserStatus.ACTIVE)
        s.add(spare)
        await s.flush()
        s.add(Agent(user_id=spare.id, assigned_market_id=market_id, is_available=True))
        await s.commit()
        spare_id = str(spare.id)

    url = f"/admin/orders/{oid}/reassign-agent"
    assert (await client.post(url, headers=support_h, json={"agent_id": spare_id})).status_code == 422        # needs a reason
    assert (await client.post(url, headers=support_h, json={"agent_id": str(uuid.uuid4()), "note": "gone"})).status_code == 404
    r = await client.post(url, headers=support_h, json={"agent_id": spare_id, "note": "first agent unreachable"})
    assert r.status_code == 200 and r.json()["agent_id"] == spare_id

    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        assert str(o.agent_id) == spare_id
        agents = {str(a.user_id): a for a in (await s.execute(select(Agent))).scalars()}
        assert agents[spare_id].is_available is False                 # busy: it's mid-shopping
        old = [a for uid, a in agents.items() if uid != spare_id][0]
        assert old.is_available is True                               # freed
    assert (await client.post(url, headers=support_h, json={"agent_id": spare_id, "note": "again"})).status_code == 409
    [e] = await _entries(db_session_factory, "order.reassign_agent")
    assert e.detail["note"] == "first agent unreachable" and e.admin_level == "support"


@pytest.mark.asyncio
async def test_correcting_the_hub_stage_and_confirming_for_the_customer(client, db_session_factory, monkeypatch):
    h = await _owner(client, db_session_factory)
    support_h = await _support(client, db_session_factory)
    oid, market_id, agent_h, cust_h, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h = await through_hub(client, db_session_factory, oid, market_id, agent_h)
    rider_h = await make_rider(client, db_session_factory, market_id)
    await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)

    url = f"/admin/orders/{oid}/set-hub-stage"
    assert (await client.post(url, headers=support_h, json={"stage": "received_by_hub", "note": "wrong tap"})).status_code == 403
    assert (await client.post(url, headers=h, json={"stage": "received_by_hub"})).status_code == 422          # reason required
    assert (await client.post(url, headers=h, json={"stage": "paid", "note": "nope"})).status_code == 422
    r = await client.post(url, headers=h, json={"stage": "received_by_hub", "note": "marked ready by mistake"})
    assert r.status_code == 200 and r.json()["status"] == "received_by_hub"
    # Rewinding put it back in the shopkeeper's hands and cancelled the rider's claim.
    assert (await client.get("/riders/jobs/mine", headers=rider_h)).json() == []
    [row] = (await client.get("/hubs/orders", headers=hub_h)).json()
    assert row["status"] == "received_by_hub" and row["rider_waiting"] is False
    assert (await client.post(url, headers=h, json={"stage": "received_by_hub", "note": "same"})).status_code == 409
    assert (await client.post(url, headers=h, json={"stage": "ready_for_pickup", "note": "fixed it"})).json()["status"] == "ready_for_pickup"

    # Out with a rider: no longer the hub's to fix, but the goods arrived - confirm for the customer.
    code = (await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)).json()["pickup_code"]
    await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": code})
    assert (await client.post(url, headers=h, json={"stage": "received_by_hub", "note": "too late"})).status_code == 409
    confirm = f"/admin/orders/{oid}/confirm-delivery"
    assert (await client.post(confirm, headers=support_h, json={"note": "customer rang"})).status_code == 403
    assert (await client.post(confirm, headers=h, json={})).status_code == 422
    r = await client.post(confirm, headers=h, json={"note": "customer rang to say it arrived"})
    assert r.status_code == 200, r.text
    assert r.json()["rider_payout"] == "1000.00" and r.json()["hub_payout"] == "500.00"
    assert (await client.get("/riders/earnings", headers=rider_h)).json()["earnings_total"] == "1000.00"
    assert (await client.post(confirm, headers=h, json={"note": "twice"})).status_code == 409


@pytest.mark.asyncio
async def test_moving_ending_and_editing_people(client, db_session_factory, monkeypatch):
    h = await _owner(client, db_session_factory)
    support_h = await _support(client, db_session_factory)
    oid, market_id, agent_h, cust_h, _ = await _paid_order(client, db_session_factory, monkeypatch, stop_after_start=True)
    other_market = await _market(db_session_factory, "Second Market")
    async with db_session_factory() as s:
        agent = (await s.execute(select(User).where(User.phone == "+2348020000102"))).scalar_one()
        s.add(Agent(user_id=agent.id, assigned_market_id=market_id, is_available=False))
        await s.commit()
        agent_id = str(agent.id)

    # Busy agents can't be moved or stood down.
    move = f"/admin/agents/{agent_id}/move-market"
    assert (await client.post(move, headers=support_h, json={"market_id": str(other_market)})).status_code == 409
    assert (await client.post(f"/admin/users/{agent_id}/end-role", headers=h, json={"note": "left the job"})).status_code == 409

    # Idle agent: moves, then stood down to an ordinary customer.
    async with db_session_factory() as s:
        spare = User(phone="+2348038880001", full_name="Idle Agent", role=UserRole.AGENT, status=UserStatus.ACTIVE, has_customer_side=False)
        s.add(spare)
        await s.flush()
        s.add(Agent(user_id=spare.id, assigned_market_id=market_id))
        await s.commit()
        spare_id = str(spare.id)
    assert (await client.post(f"/admin/agents/{spare_id}/move-market", headers=support_h, json={"market_id": str(other_market)})).status_code == 200
    assert (await client.post(f"/admin/agents/{spare_id}/move-market", headers=support_h, json={"market_id": str(uuid.uuid4())})).status_code == 404
    assert (await client.post(f"/admin/users/{spare_id}/end-role", headers=support_h, json={"note": "x y z"})).status_code == 403
    r = await client.post(f"/admin/users/{spare_id}/end-role", headers=h, json={"note": "stopped working with us"})
    assert r.status_code == 200 and r.json()["role"] == "customer"
    async with db_session_factory() as s:
        a = (await s.execute(select(Agent).where(Agent.user_id == uuid.UUID(spare_id)))).scalar_one()
        assert a.is_available is False and a.on_duty is False
        assert (await s.execute(select(User).where(User.id == uuid.UUID(spare_id)))).scalar_one().has_customer_side is True
    assert (await client.post(f"/admin/users/{spare_id}/end-role", headers=h, json={"note": "again again"})).status_code == 409   # nothing to end

    # A shopkeeper with orders at the hub can't be removed; a rider holding a job can't either.
    oid2, m2, agent2_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch, cust_phone="+2348010000301", agent_phone="+2348020000302")
    hub_h, hub_id = await make_hub(client, db_session_factory, m2)
    await client.post(f"/delivery/orders/{oid2}/drop-at-hub", headers=agent2_h)
    async with db_session_factory() as s:
        keeper = (await s.execute(select(Hub).where(Hub.id == hub_id))).scalar_one().user_id
    assert (await client.post(f"/admin/users/{keeper}/end-role", headers=h, json={"note": "closing it"})).status_code == 409

    # Editing details: phone stays unique, the cap is in naira.
    cust_id = str((await client.get("/auth/me", headers=cust_h)).json()["id"])
    r = await client.patch(f"/admin/users/{spare_id}", headers=h, json={"full_name": "Renamed", "phone": "0803 888 0002", "basket_cap_naira": 12000})
    assert r.status_code == 200 and r.json()["phone"] == "+2348038880002" and r.json()["basket_cap_kobo"] == 1_200_000
    assert (await client.patch(f"/admin/users/{spare_id}", headers=h, json={"phone": "+2348020000102"})).status_code == 409
    assert (await client.patch(f"/admin/users/{cust_id}", headers=h, json={"phone": "bad"})).status_code == 409      # an admin account
    assert (await client.patch(f"/admin/users/{spare_id}", headers=support_h, json={"full_name": "x"})).status_code == 403
    [e] = await _entries(db_session_factory, "user.edit")
    assert e.detail == {"fields": ["basket_cap_naira", "full_name", "phone"]}


@pytest.mark.asyncio
async def test_stuck_orders_follow_the_owners_thresholds(client, db_session_factory, monkeypatch):
    h = await _owner(client, db_session_factory)
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    await through_hub(client, db_session_factory, oid, market_id, agent_h)
    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
        o.packed_at = datetime.now(timezone.utc) - timedelta(minutes=12)
        await s.commit()

    def row(body):
        return next(x for x in body["orders"] if x["id"] == oid)

    body = (await client.get("/admin/orders/in-flight", headers=h)).json()
    assert row(body)["stuck"] is False and body["stuck"] == 0            # 12 min is fine against the default 30
    await client.put("/admin/platform-settings/stuck_ready_minutes", headers=h, json={"value": "5"})
    body = (await client.get("/admin/orders/in-flight", headers=h)).json()
    assert row(body)["stuck"] is True and body["stuck"] == 1
