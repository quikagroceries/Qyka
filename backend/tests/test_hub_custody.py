"""Hub custody: agent drops at a hub, the shopkeeper confirms what arrived,
then marks it ready. Nothing here ever shows the shopkeeper money."""

import uuid
from decimal import Decimal

import pytest
from app.core.enums import AdminLevel
from sqlalchemy import select

from tests.conftest import make_hub, pay_deposit

PHONE_CUST = "+2348010000101"
PHONE_AGENT = "+2348020000102"
OURS = "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/hub/received.jpg"


async def _login(client, phone):
    r = await client.post("/auth/request-otp", json={"identifier": phone})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": phone, "code": code})
    return r.json()["access_token"]


async def _paid_order(client, db_session_factory, monkeypatch, descriptions=("pepper", "rice"), stop_after_start=False,
                      cust_phone=PHONE_CUST, agent_phone=PHONE_AGENT):
    """An order taken all the way to PAID. Returns (oid, market_id, agent_h, admin_h, item_ids)."""
    from app.auth.models import User
    from app.core.enums import LedgerDirection, UserRole
    from app.float import service as float_service
    from app.payments import transfers

    async def fake_send(*, account_number, bank_code, amount_naira, reference, reason="x"):
        return {"reference": reference, "status": "success", "fee": 0}
    monkeypatch.setattr(transfers, "send_transfer", fake_send)

    cust_token = await _login(client, cust_phone)
    agent_token = await _login(client, agent_phone)
    async with db_session_factory() as s:
        agent = (await s.execute(select(User).where(User.phone == agent_phone))).scalar_one()
        agent.role = UserRole.AGENT
        cust = (await s.execute(select(User).where(User.phone == cust_phone))).scalar_one()
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
        "market_id": str(market_id), "listed_items_total": "2000.00",
        "items": [{"description": d} for d in descriptions]})
    oid = r.json()["id"]
    await pay_deposit(client, admin_h, oid)
    await client.post(f"/orders/{oid}/assign-agent", headers=admin_h, json={"agent_id": str(agent_id)})
    r = await client.post(f"/orders/{oid}/start-shopping", headers=agent_h)
    item_ids = [i["id"] for i in r.json()["items"]]
    if stop_after_start:
        return oid, market_id, agent_h, admin_h, item_ids
    await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992", "photo_ref": OURS,
        "items": [{"item_id": i, "price": "500.00"} for i in item_ids]})
    await client.post(f"/orders/{oid}/finish-shopping", headers=agent_h)
    await client.post("/wallet/fund", headers=admin_h, json={"amount": "20000.00"})
    r = await client.post(f"/payments/orders/{oid}/pay-from-wallet", headers=admin_h)
    assert r.status_code == 200, r.text
    return oid, market_id, agent_h, admin_h, item_ids


@pytest.mark.asyncio
async def test_hub_custody_happy_path_and_no_money_visible(client, db_session_factory, monkeypatch):
    oid, market_id, agent_h, admin_h, item_ids = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h, hub_id = await make_hub(client, db_session_factory, market_id)

    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "dropped_at_hub" and r.json()["hub_id"] == str(hub_id)

    # The shopkeeper was told, and sees the items - with no prices or address.
    r = await client.get("/notifications", headers=hub_h)
    assert any(n["kind"] == "hub_drop" for n in r.json()), r.text
    [row] = (await client.get("/hubs/orders", headers=hub_h)).json()
    assert row["id"] == oid and row["status"] == "dropped_at_hub"
    assert sorted(i["description"] for i in row["items"]) == ["pepper", "rice"]
    leaked = {"items_total", "grand_total", "delivery_address", "agent_share", "customer_id", "handover_code"}
    assert not leaked & set(row), leaked & set(row)
    assert not leaked & set(row["items"][0])

    # Can't be marked ready before it's been received.
    r = await client.post(f"/hubs/orders/{oid}/ready", headers=hub_h)
    assert r.status_code == 409

    r = await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h, json={"photos": [OURS]})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "received_by_hub" and r.json()["hub_missing_item_ids"] == []
    assert OURS in r.json()["packing_photos"]
    # Receipt is once only.
    r = await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h, json={})
    assert r.status_code == 409

    r = await client.post(f"/hubs/orders/{oid}/ready", headers=hub_h)
    assert r.status_code == 200 and r.json()["status"] == "ready_for_pickup"
    r = await client.get(f"/orders/{oid}", headers=admin_h)
    body = r.json()
    assert body["status"] == "ready_for_pickup"
    assert body["packed_at"] and body["dropped_at_hub_at"] and body["hub_received_at"]


@pytest.mark.asyncio
async def test_receipt_records_missing_items_but_needs_a_note(client, db_session_factory, monkeypatch):
    oid, market_id, agent_h, _, item_ids = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h, _ = await make_hub(client, db_session_factory, market_id)
    await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)

    r = await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h,
                          json={"received_item_ids": item_ids[:1]})
    assert r.status_code == 422                       # missing an item, no note
    r = await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h,
                          json={"received_item_ids": [str(uuid.uuid4())], "note": "x"})
    assert r.status_code == 422                       # not this order's item
    r = await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h,
                          json={"received_item_ids": item_ids[:1], "note": "No rice in the bag"})
    assert r.status_code == 200, r.text
    assert r.json()["hub_missing_item_ids"] == item_ids[1:]
    assert r.json()["hub_receipt_note"] == "No rice in the bag"      # recorded, not blocking


@pytest.mark.asyncio
async def test_a_shopkeeper_only_sees_their_own_hubs_orders(client, db_session_factory, monkeypatch):
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h, _ = await make_hub(client, db_session_factory, market_id)
    other_h, _ = await make_hub(client, db_session_factory, market_id, phone="+2348055500002")
    await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h,
                      json={"hub_id": str((await client.get("/hubs/me", headers=hub_h)).json()["id"])})

    assert (await client.get("/hubs/orders", headers=other_h)).json() == []
    for method, path in (("get", ""), ("post", "/receive"), ("post", "/ready")):
        r = await getattr(client, method)(f"/hubs/orders/{oid}{path}", headers=other_h,
                                          **({"json": {}} if path == "/receive" else {}))
        assert r.status_code == 404, (path, r.text)
    # And not for the agent, who isn't a shopkeeper.
    assert (await client.get("/hubs/orders", headers=agent_h)).status_code == 403


@pytest.mark.asyncio
async def test_hub_choice_with_several_hubs(client, db_session_factory, monkeypatch):
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_a_h, hub_a = await make_hub(client, db_session_factory, market_id)
    _, hub_b = await make_hub(client, db_session_factory, market_id, phone="+2348055500002")
    _, elsewhere = await make_hub(client, db_session_factory, uuid.uuid4(), phone="+2348055500003")

    hubs = (await client.get(f"/hubs?market_id={market_id}", headers=agent_h)).json()
    assert {h["id"] for h in hubs} == {str(hub_a), str(hub_b)}

    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)
    assert r.status_code == 422                       # several hubs - pick one
    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h,
                          json={"hub_id": str(elsewhere)})
    assert r.status_code == 404                       # another market's hub
    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h,
                          json={"hub_id": str(hub_a)})
    assert r.status_code == 200 and r.json()["hub_id"] == str(hub_a)
    assert len((await client.get("/hubs/orders", headers=hub_a_h)).json()) == 1


@pytest.mark.asyncio
async def test_only_the_assigned_agent_can_drop(client, db_session_factory, monkeypatch):
    from app.auth.models import User
    from app.core.enums import UserRole

    oid, market_id, _, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    await make_hub(client, db_session_factory, market_id)
    other_token = await _login(client, "+2348020000199")
    async with db_session_factory() as s:
        other = (await s.execute(select(User).where(User.phone == "+2348020000199"))).scalar_one()
        other.role = UserRole.AGENT
        await s.commit()
    r = await client.post(f"/delivery/orders/{oid}/drop-at-hub",
                          headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403
