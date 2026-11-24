"""Admin levels (owner/support) and the audit log."""

import uuid

import pytest
from sqlalchemy import select

from app.admin.audit import AdminAuditLog
from app.auth.models import User
from app.core.enums import AdminLevel, UserRole, UserStatus
from app.core.security import hash_password
from app.main import app
from tests.test_admin import _ADMIN_PASSWORD, _login_admin


async def _owner(client, db_session_factory, email="owner@qyka.com"):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, email)}"}


async def _support(client, db_session_factory, email="support@qyka.com"):
    async with db_session_factory() as s:
        s.add(User(email=email, password_hash=hash_password(_ADMIN_PASSWORD), role=UserRole.ADMIN,
                   admin_level=AdminLevel.SUPPORT, status=UserStatus.ACTIVE, is_email_verified=True))
        await s.commit()
    r = await client.post("/admin/login", json={"email": email, "password": _ADMIN_PASSWORD})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _customer(db_session_factory, phone="+2348090000011"):
    async with db_session_factory() as s:
        u = User(phone=phone, role=UserRole.CUSTOMER, status=UserStatus.ACTIVE)
        s.add(u)
        await s.commit()
        return str(u.id)


async def _entries(db_session_factory, action=None):
    async with db_session_factory() as s:
        rows = (await s.execute(select(AdminAuditLog).order_by(AdminAuditLog.created_at))).scalars().all()
    return [r for r in rows if action is None or r.action == action]


def _guarded_routes():
    """(route, guard) for every route whose top-level dependency is an admin guard."""
    for route in app.routes:
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        for dep in dependant.dependencies:
            if getattr(dep.call, "is_admin_guard", False):
                yield route, dep.call


def test_every_state_changing_admin_route_is_audited():
    """The guarantee the audit log rests on: a route that changes anything
    and is open to admins must declare an action (so the guard logs it), and
    nobody may guard an admin route with the bare role check that skips it."""
    guarded = list(_guarded_routes())
    assert len(guarded) > 30, "found suspiciously few admin routes - has the guard changed shape?"

    unlogged = [
        f"{sorted(r.methods)} {r.path}" for r, g in guarded
        if (r.methods - {"GET", "HEAD", "OPTIONS"}) and not g.audit_action
    ]
    assert not unlogged, f"state-changing admin routes with no audit action: {unlogged}"

    bare = []
    for route in app.routes:
        dependant = getattr(route, "dependant", None)
        if dependant is None or not (route.methods - {"GET", "HEAD", "OPTIONS"}):
            continue
        for dep in dependant.dependencies:
            roles = getattr(dep.call, "roles", ())
            if UserRole.ADMIN in roles and not getattr(dep.call, "is_admin_guard", False):
                bare.append(f"{sorted(route.methods)} {route.path}")
    assert not bare, f"admin routes using the bare role check (not audited): {bare}"


@pytest.mark.asyncio
async def test_an_action_is_logged_with_who_what_and_target(client, db_session_factory):
    owner_h = await _owner(client, db_session_factory)
    uid = await _customer(db_session_factory)

    r = await client.post(f"/admin/users/{uid}/suspend", headers=owner_h)
    assert r.status_code == 200, r.text
    [entry] = await _entries(db_session_factory, "user.suspend")
    assert entry.admin_email == "owner@qyka.com" and entry.admin_level == "owner"
    assert entry.target == {"user_id": uid}
    assert entry.method == "POST" and entry.path == f"/admin/users/{uid}/suspend"

    # A request that fails changes nothing and logs nothing; neither does a read.
    before = len(await _entries(db_session_factory))
    assert (await client.post(f"/admin/users/{uuid.uuid4()}/suspend", headers=owner_h)).status_code == 404
    assert (await client.get("/admin/users", headers=owner_h)).status_code == 200
    assert len(await _entries(db_session_factory)) == before


@pytest.mark.asyncio
async def test_sign_ins_and_failed_attempts_are_logged(client, db_session_factory):
    await _owner(client, db_session_factory, "login-owner@qyka.com")
    assert [e.action for e in await _entries(db_session_factory)] == ["admin.login"]

    bad = await client.post("/admin/login", json={"email": "login-owner@qyka.com", "password": "wrong-password"})
    assert bad.status_code in (401, 403)
    # Strangers guessing addresses don't get to write to the log.
    await client.post("/admin/login", json={"email": "nobody@nowhere.com", "password": "x"})
    actions = [(e.action, e.admin_email) for e in await _entries(db_session_factory)]
    assert actions == [("admin.login", "login-owner@qyka.com"), ("admin.login_failed", "login-owner@qyka.com")]


@pytest.mark.asyncio
async def test_support_can_run_operations_but_not_money_or_admins(client, db_session_factory):
    support_h = await _support(client, db_session_factory)
    uid = await _customer(db_session_factory)

    # Day-to-day operations are open to support.
    assert (await client.post(f"/admin/users/{uid}/suspend", headers=support_h)).status_code == 200
    assert (await client.post(f"/admin/users/{uid}/reactivate", headers=support_h)).status_code == 200
    assert (await client.get("/admin/hubs", headers=support_h)).status_code == 200
    assert [e.admin_level for e in await _entries(db_session_factory, "user.suspend")] == ["support"]

    # Money rules, wallets, other admins and the audit log are owner-only.
    for method, path, body in (
        ("put", "/admin/fees", {"rider_fee": "1", "hub_fee": "1"}),
        ("post", f"/admin/users/{uid}/wallet/adjust", {"direction": "credit", "amount": "10", "note": "x"}),
        ("post", "/admin/admins", {"email": "x@y.com", "temporary_password": "longenough1"}),
        ("get", "/admin/audit", None),
        ("post", f"/admin/orders/{uuid.uuid4()}/cancel", {"refund_amount": "0", "note": "x"}),
    ):
        r = await getattr(client, method)(path, headers=support_h, **({"json": body} if body else {}))
        assert r.status_code == 403 and "owner" in r.text.lower(), (path, r.status_code, r.text)


@pytest.mark.asyncio
async def test_owner_reads_the_audit_log_with_filters(client, db_session_factory):
    owner_h = await _owner(client, db_session_factory)
    a, b = await _customer(db_session_factory), await _customer(db_session_factory, "+2348090000012")
    await client.post(f"/admin/users/{a}/suspend", headers=owner_h)
    await client.post(f"/admin/users/{b}/suspend", headers=owner_h)
    await client.put("/admin/fees", headers=owner_h, json={"rider_fee": "900", "hub_fee": "400"})

    body = (await client.get("/admin/audit", headers=owner_h)).json()
    actions = [e["action"] for e in body["entries"]]
    assert actions[:3] == ["fees.set_default", "user.suspend", "user.suspend"]   # newest first
    assert body["total"] == len(actions)

    only = (await client.get("/admin/audit?action=user.suspend", headers=owner_h)).json()
    assert only["total"] == 2
    group = (await client.get("/admin/audit?action=fees.", headers=owner_h)).json()
    assert [e["action"] for e in group["entries"]] == ["fees.set_default"]
    me = (await client.get("/auth/me", headers=owner_h)).json()
    mine = (await client.get(f"/admin/audit?admin_id={me['id']}&limit=1", headers=owner_h)).json()
    assert len(mine["entries"]) == 1 and mine["total"] >= 3
    assert me["admin_level"] == "owner"


@pytest.mark.asyncio
async def test_admin_levels_are_managed_safely(client, db_session_factory):
    owner_h = await _owner(client, db_session_factory)
    me = (await client.get("/auth/me", headers=owner_h)).json()["id"]

    r = await client.post("/admin/admins", headers=owner_h,
                          json={"email": "new@qyka.com", "temporary_password": "longenough1"})
    assert r.status_code == 201 and r.json()["level"] == "support"        # least privilege by default
    support_id = r.json()["id"]
    r = await client.post("/admin/admins", headers=owner_h,
                          json={"email": "boss@qyka.com", "temporary_password": "longenough1", "level": "owner"})
    owner2_id = r.json()["id"]
    assert r.json()["level"] == "owner"

    # Promote, then you can't change your own level or remove the last owner.
    assert (await client.patch(f"/admin/admins/{support_id}", headers=owner_h, json={"level": "owner"})).json()["level"] == "owner"
    assert (await client.patch(f"/admin/admins/{me}", headers=owner_h, json={"level": "support"})).status_code == 400
    assert (await client.patch(f"/admin/admins/{support_id}", headers=owner_h, json={"level": "support"})).status_code == 200
    assert (await client.patch(f"/admin/admins/{owner2_id}", headers=owner_h, json={"level": "support"})).status_code == 200
    # Only one owner left (me): nobody may remove or demote them.
    async with db_session_factory() as s:
        all_owners = [u for u in (await s.execute(select(User).where(User.role == UserRole.ADMIN))).scalars() if u.admin_level is AdminLevel.OWNER]
    assert len(all_owners) == 1
    r = await client.patch(f"/admin/admins/{owner2_id}", headers=owner_h, json={"level": "owner"})
    assert r.status_code == 200
    assert (await client.delete(f"/admin/admins/{support_id}", headers=owner_h)).status_code == 204

    actions = [e.action for e in await _entries(db_session_factory)]
    assert {"admins.create", "admins.set_level", "admins.remove"} <= set(actions)
