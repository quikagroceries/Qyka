"""Admin side of the hub flow: hub roster, releasing a stuck rider claim,
giving old riders a login, stuck-order timing."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from tests.conftest import make_hub, make_rider, through_hub
from tests.test_admin import _login_admin
from tests.test_hub_custody import _paid_order


async def _admin(client, db_session_factory, email):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, email)}"}


@pytest.mark.asyncio
async def test_hub_roster_rename_and_switch_off(client, db_session_factory, monkeypatch):
    admin_h = await _admin(client, db_session_factory, "hubs-admin@qyka.com")
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h, hub_id = await make_hub(client, db_session_factory, market_id)
    await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)

    [row] = (await client.get("/admin/hubs", headers=admin_h)).json()
    assert (row["id"], row["name"], row["is_active"], row["orders_at_hub"]) == (str(hub_id), "Test Hub", True, 1)
    assert row["shopkeeper_phone"] == "+2348055500001"

    r = await client.patch(f"/admin/hubs/{hub_id}", headers=admin_h, json={"name": "  Gate Hub  "})
    assert r.status_code == 200 and r.json()["name"] == "Gate Hub"
    assert (await client.patch(f"/admin/hubs/{hub_id}", headers=admin_h, json={"name": "  "})).status_code == 422
    assert (await client.patch(f"/admin/hubs/{uuid.uuid4()}", headers=admin_h, json={"name": "x"})).status_code == 404

    # Switched off: gone from what agents can pick, but the order already there carries on.
    r = await client.patch(f"/admin/hubs/{hub_id}", headers=admin_h, json={"is_active": False})
    assert r.json()["is_active"] is False
    assert (await client.get(f"/hubs?market_id={market_id}", headers=agent_h)).json() == []
    assert (await client.post(f"/hubs/orders/{oid}/receive", headers=hub_h, json={})).status_code == 200

    # Admin-only.
    assert (await client.get("/admin/hubs", headers=agent_h)).status_code == 403
    assert (await client.patch(f"/admin/hubs/{hub_id}", headers=agent_h, json={"name": "x"})).status_code == 403


@pytest.mark.asyncio
async def test_release_a_claim_nobody_collected(client, db_session_factory, monkeypatch):
    admin_h = await _admin(client, db_session_factory, "release-admin@qyka.com")
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    hub_h = await through_hub(client, db_session_factory, oid, market_id, agent_h)
    rider_h = await make_rider(client, db_session_factory, market_id)
    other_h = await make_rider(client, db_session_factory, market_id, phone="+2348066600002")

    # Nothing claimed yet -> nothing to release.
    assert (await client.post(f"/admin/orders/{oid}/release-rider", headers=admin_h)).status_code == 409
    code = (await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)).json()["pickup_code"]
    assert (await client.get("/riders/jobs", headers=other_h)).json() == []

    r = await client.post(f"/admin/orders/{oid}/release-rider", headers=admin_h)
    assert r.status_code == 200 and r.json()["rider_id"] is None
    assert len((await client.get("/riders/jobs", headers=other_h)).json()) == 1      # back in the pool
    assert (await client.get("/riders/jobs/mine", headers=rider_h)).json() == []
    # The old rider's code no longer works at the hub.
    r = await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": code})
    assert r.status_code == 409

    # Once it's out for delivery it can't be released.
    code = (await client.post(f"/riders/jobs/{oid}/claim", headers=other_h)).json()["pickup_code"]
    await client.post(f"/hubs/orders/{oid}/handover", headers=hub_h, json={"code": code})
    assert (await client.post(f"/admin/orders/{oid}/release-rider", headers=admin_h)).status_code == 409
    assert (await client.post(f"/admin/orders/{oid}/release-rider", headers=agent_h)).status_code == 403


@pytest.mark.asyncio
async def test_give_an_old_rider_a_login(client, db_session_factory):
    from app.core.enums import UserRole
    from app.auth.models import User
    from app.riders.models import Rider

    admin_h = await _admin(client, db_session_factory, "link-admin@qyka.com")
    async with db_session_factory() as s:
        old = Rider(full_name="Old Rider", phone="+2348077700001")          # approved before logins existed
        taken = Rider(full_name="Agent Phone", phone="+2348077700002")
        s.add_all([old, taken, User(phone="+2348077700002", role=UserRole.AGENT)])
        await s.commit()
        old_id, taken_id = str(old.id), str(taken.id)

    riders = {r["id"]: r for r in (await client.get("/admin/riders", headers=admin_h)).json()}
    assert riders[old_id]["has_login"] is False

    r = await client.post(f"/admin/riders/{old_id}/link-account", headers=admin_h)
    assert r.status_code == 200 and r.json()["has_login"] is True
    assert (await client.post(f"/admin/riders/{old_id}/link-account", headers=admin_h)).status_code == 409

    # They can now sign in as a rider.
    rr = await client.post("/auth/request-otp", json={"identifier": "+2348077700001"})
    v = await client.post("/auth/verify-otp", json={"identifier": "+2348077700001", "code": rr.json()["dev_otp"]})
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {v.json()['access_token']}"})
    assert me.json()["role"] == "rider"
    assert (await client.get("/riders/jobs", headers={"Authorization": f"Bearer {v.json()['access_token']}"})).status_code == 200

    # A number that's already someone else's staff account is refused.
    assert (await client.post(f"/admin/riders/{taken_id}/link-account", headers=admin_h)).status_code == 409
    assert (await client.post(f"/admin/riders/{uuid.uuid4()}/link-account", headers=admin_h)).status_code == 404


@pytest.mark.asyncio
async def test_in_flight_orders_carry_hub_and_stage_timing(client, db_session_factory, monkeypatch):
    admin_h = await _admin(client, db_session_factory, "flight-admin@qyka.com")
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)

    def row(body):
        return next(o for o in body["orders"] if o["id"] == oid)

    r = row((await client.get("/admin/orders/in-flight", headers=admin_h)).json())
    assert r["status"] == "paid" and r["stage_started_at"] and r["hub_id"] is None

    hub_h = await through_hub(client, db_session_factory, oid, market_id, agent_h)
    r = row((await client.get("/admin/orders/in-flight", headers=admin_h)).json())
    assert r["status"] == "ready_for_pickup" and r["hub_id"] and r["rider_id"] is None
    waiting_since = r["stage_started_at"]

    rider_h = await make_rider(client, db_session_factory, market_id)
    await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)
    r = row((await client.get("/admin/orders/in-flight", headers=admin_h)).json())
    assert r["rider_id"] and r["stage_started_at"] >= waiting_since     # a claim restarts the clock
