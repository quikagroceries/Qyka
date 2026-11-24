"""Owner-editable business rules: validation, audit, snapshotting, and that
each setting really changes the behaviour it claims to."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.admin.audit import AdminAuditLog
from app.core.enums import AdminLevel
from tests.conftest import make_rider, through_hub
from tests.test_admin import _login_admin
from tests.test_admin_audit import _entries, _support
from tests.test_hub_custody import _paid_order


async def _owner(client, db_session_factory, email="settings-owner@qyka.com"):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, email)}"}


async def _set(client, h, key, value):
    return await client.put(f"/admin/platform-settings/{key}", headers=h, json={"value": value})


@pytest.mark.asyncio
async def test_settings_list_validate_audit_and_reset(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    rows = {s["key"]: s for s in (await client.get("/admin/platform-settings", headers=h)).json()}
    assert rows["service_fee_percent"]["value"] == "7.50" and rows["service_fee_percent"]["is_default"] is True
    assert rows["service_fee_percent"]["scope"] == "new_orders" and rows["payment_window_minutes"]["scope"] == "immediately"
    assert {r["group"] for r in rows.values()} >= {"Pricing", "Safety limits", "Sign-in codes", "Emergency"}

    r = await _set(client, h, "service_fee_percent", "9")
    assert r.status_code == 200 and r.json()[0]["value"] == "9.00" and r.json()[0]["is_default"] is False
    [entry] = await _entries(db_session_factory, "settings.update")
    assert entry.target == {"key": "service_fee_percent"}
    assert entry.detail == {"key": "service_fee_percent", "old": "7.50", "new": "9.00"}

    # Bounds and types are enforced.
    assert (await _set(client, h, "service_fee_percent", "-1")).status_code == 422
    assert (await _set(client, h, "service_fee_percent", "95")).status_code == 422
    assert (await _set(client, h, "service_fee_percent", "lots")).status_code == 422
    assert (await _set(client, h, "payment_window_minutes", "45.5")).status_code == 422     # whole numbers only
    assert (await _set(client, h, "payment_window_minutes", "2")).status_code == 422        # below the minimum
    assert (await _set(client, h, "orders_paused", "maybe")).status_code == 422
    assert (await _set(client, h, "no_such_setting", "1")).status_code == 404
    assert (await _set(client, h, "orders_paused_message", "x" * 300)).status_code == 422

    assert (await client.delete("/admin/platform-settings/service_fee_percent", headers=h)).status_code == 204
    rows = {s["key"]: s for s in (await client.get("/admin/platform-settings", headers=h)).json()}
    assert rows["service_fee_percent"]["is_default"] is True and rows["service_fee_percent"]["value"] == "7.50"
    assert [e.action for e in await _entries(db_session_factory) if e.action.startswith("settings.")] == ["settings.update", "settings.reset"]

    # Owners only.
    support_h = await _support(client, db_session_factory)
    assert (await client.get("/admin/platform-settings", headers=support_h)).status_code == 403
    assert (await _set(client, support_h, "service_fee_percent", "1")).status_code == 403


@pytest.mark.asyncio
async def test_pricing_is_snapshotted_per_order_and_drives_the_bill(client, db_session_factory, monkeypatch):
    owner_h = await _owner(client, db_session_factory, "snap-owner@qyka.com")
    oid_a, _, _, h, _ = await _paid_order(client, db_session_factory, monkeypatch)
    a = (await client.get(f"/orders/{oid_a}", headers=h)).json()
    # 1000 of goods: 7.5% service fee (75) + the default 1500 delivery.
    assert (a["items_total"], a["combined_fee"], a["delivery_fee"], a["grand_total"]) == ("1000.00", "75.00", "1500.00", "2575.00")

    assert (await _set(client, h, "service_fee_percent", "10")).status_code == 200
    assert (await _set(client, h, "delivery_fee", "2000")).status_code == 200
    assert (await _set(client, h, "payment_window_minutes", "10")).status_code == 200
    pub = (await client.get("/pricing")).json()
    assert (pub["service_fee_percent"], pub["delivery_fee"]) == ("10.0", "2000.00")

    # The order that already exists is untouched...
    assert (await client.get(f"/orders/{oid_a}", headers=h)).json()["grand_total"] == "2575.00"
    # ...and a new one is priced by the new rules, with a 10-minute payment window.
    # (A second customer and agent: signing the same phone in twice within one
    # second makes the test database's timestamps ambiguous.)
    oid_b, _, _, _, _ = await _paid_order(
        client, db_session_factory, monkeypatch,
        cust_phone="+2348010000201", agent_phone="+2348020000202",
    )
    b = (await client.get(f"/orders/{oid_b}", headers=h)).json()
    assert (b["combined_fee"], b["delivery_fee"], b["grand_total"]) == ("100.00", "2000.00", "3100.00")
    from app.orders.models import Order
    async with db_session_factory() as s:
        ob = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid_b)))).scalar_one()
        oa = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid_a)))).scalar_one()
    assert Decimal(ob.pricing["service_fee_rate"]) == Decimal("0.1")
    assert Decimal(oa.pricing["service_fee_rate"]) == Decimal("0.075")


@pytest.mark.asyncio
async def test_payment_window_follows_the_setting(client, db_session_factory, monkeypatch):
    from app.orders.models import Order

    h = await _owner(client, db_session_factory, "window-owner@qyka.com")
    await _set(client, h, "payment_window_minutes", "10")
    oid, *_ = await _paid_order(client, db_session_factory, monkeypatch)
    async with db_session_factory() as s:
        o = (await s.execute(select(Order).where(Order.id == uuid.UUID(oid)))).scalar_one()
    expires = o.payment_window_expires_at if o.payment_window_expires_at.tzinfo else o.payment_window_expires_at.replace(tzinfo=timezone.utc)
    remaining = (expires - datetime.now(timezone.utc)).total_seconds()
    assert 0 < remaining <= 10 * 60            # not the default 45 minutes


@pytest.mark.asyncio
async def test_pausing_orders_stops_new_ones_only(client, db_session_factory, monkeypatch):
    oid, market_id, agent_h, h, _ = await _paid_order(client, db_session_factory, monkeypatch)
    assert (await client.get("/status")).json() == {"orders_paused": False, "message": None}

    await _set(client, h, "orders_paused", True)
    await _set(client, h, "orders_paused_message", "Back at 9am.")
    assert (await client.get("/status")).json() == {"orders_paused": True, "message": "Back at 9am."}
    r = await client.post("/orders", headers=h, json={"market_id": str(uuid.uuid4()), "items": [{"description": "rice"}]})
    assert r.status_code == 503 and "Back at 9am." in r.text

    # An order already in progress carries on through the pause.
    assert (await client.post(f"/delivery/orders/{oid}/drop-at-hub", headers=agent_h)).status_code != 503

    await client.delete("/admin/platform-settings/orders_paused", headers=h)
    assert (await client.get("/status")).json()["orders_paused"] is False


@pytest.mark.asyncio
async def test_new_customer_cap_otp_and_rider_limits_follow_settings(client, db_session_factory, monkeypatch):
    h = await _owner(client, db_session_factory, "limits-owner@qyka.com")

    # New customers start with the configured cap.
    await _set(client, h, "default_basket_cap_naira", "7000")
    r = await client.post("/auth/request-otp", json={"identifier": "+2348091110001"})
    v = await client.post("/auth/verify-otp", json={"identifier": "+2348091110001", "code": r.json()["dev_otp"]})
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {v.json()['access_token']}"})
    assert me.json()["basket_cap_kobo"] == 700_000

    # Sign-in code limits: two an hour, then refused.
    await _set(client, h, "otp_max_requests_per_hour", "2")
    await _set(client, h, "otp_resend_cooldown_seconds", "0")
    statuses = [(await client.post("/auth/request-otp", json={"identifier": "+2348091110002"})).status_code for _ in range(3)]
    assert statuses == [200, 200, 429]
    await _set(client, h, "otp_expire_minutes", "5")
    r = await client.post("/auth/request-otp", json={"identifier": "+2348091110003"})
    assert r.json()["expires_in_seconds"] == 300

    # A rider may hold two jobs once the limit is raised to two.
    from tests.test_rider_jobs import _bare_ready_order
    oid, market_id, agent_h, _, _ = await _paid_order(client, db_session_factory, monkeypatch)
    await through_hub(client, db_session_factory, oid, market_id, agent_h)
    rider_h = await make_rider(client, db_session_factory, market_id)
    other = await _bare_ready_order(db_session_factory, market_id)
    assert (await client.post(f"/riders/jobs/{oid}/claim", headers=rider_h)).status_code == 200
    assert (await client.post(f"/riders/jobs/{other}/claim", headers=rider_h)).status_code == 409
    await _set(client, h, "rider_max_active_jobs", "2")
    assert (await client.post(f"/riders/jobs/{other}/claim", headers=rider_h)).status_code == 200


@pytest.mark.asyncio
async def test_vendor_transfer_ceiling_follows_the_setting(client, db_session_factory, monkeypatch):
    oid, _, agent_h, h, item_ids = await _paid_order(client, db_session_factory, monkeypatch, stop_after_start=True)
    await _set(client, h, "max_transfer_naira", "1000")
    r = await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json={
        "account_number": "9012345678", "bank_code": "999992",
        "photo_ref": "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/receipts/r.jpg",
        "items": [{"item_id": item_ids[0], "price": "1500.00"}]})
    assert r.status_code == 400 and "1000" in r.text


@pytest.mark.asyncio
async def test_system_status_reports_without_leaking_secrets(client, db_session_factory):
    h = await _owner(client, db_session_factory, "sys-owner@qyka.com")
    body = (await client.get("/admin/system", headers=h)).json()
    checks = {c["key"]: c for c in body["checks"]}
    assert checks["database"]["status"] == "ok"
    assert {"payments", "sms", "email", "jwt", "calls"} <= set(checks)
    assert all(c["status"] in ("ok", "warn", "off") for c in checks.values())
    blob = str(body).lower()
    assert "sk_" not in blob and "secret_key" not in blob
    assert (await client.get("/admin/system", headers=await _support(client, db_session_factory, "sys-support@qyka.com"))).status_code == 403
