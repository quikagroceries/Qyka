"""Notification preferences (backend-stored, respected) and tiered delivery:
everything in-app; payment_due / out_for_delivery also by email + SMS,
whatever the user's toggles say."""

import json
import uuid

import httpx
import pytest
from sqlalchemy import func, select

from app.auth.models import User
from app.core.config import settings
from app.core.enums import OrderStatus, UserRole, UserStatus
from app.notifications import delivery
from app.notifications import service as notif_service
from app.notifications.models import Notification
from tests.test_admin import _login

ALL_ON = {"order_updates": True, "agent_messages": True, "payment_reminders": True, "offers": True}


@pytest.fixture
def providers(monkeypatch):
    """Capture every off-app request (Resend + Termii) instead of sending it."""
    sent = []

    def handler(request):
        sent.append((str(request.url), json.loads(request.content)))
        return httpx.Response(200, json={"id": "msg_1"})

    monkeypatch.setattr(delivery, "_transport", httpx.MockTransport(handler))
    return sent


def _emails(sent):
    return [body for url, body in sent if url.endswith("/emails")]


def _sms(sent):
    return [body for url, body in sent if url.endswith("/api/sms/send")]


async def _user(db_session_factory, **prefs):
    async with db_session_factory() as s:
        u = User(phone=f"+23480{uuid.uuid4().int % 10**8:08d}", email=f"{uuid.uuid4().hex[:8]}@example.com",
                 full_name="Ada", role=UserRole.CUSTOMER, status=UserStatus.ACTIVE, **prefs)
        s.add(u)
        await s.commit()
        return u.id


async def _send(db_session_factory, user_id, kind):
    async with db_session_factory() as s:
        note = await notif_service.send(s, user_id=user_id, kind=kind, message=f"test {kind}")
        await s.commit()
        count = (await s.execute(select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id, Notification.kind == kind))).scalar_one()
    return note, count


# ---------- Part A: preferences ----------

@pytest.mark.asyncio
async def test_preferences_default_all_on_and_persist_via_the_api(client):
    h = {"Authorization": f"Bearer {await _login(client, '08071110001')}"}
    assert (await client.get("/auth/me", headers=h)).json()["notification_preferences"] == ALL_ON
    assert (await client.get("/auth/me/notification-preferences", headers=h)).json() == ALL_ON

    r = await client.patch("/auth/me/notification-preferences", headers=h, json={"offers": False, "agent_messages": False})
    assert r.status_code == 200
    assert r.json() == {**ALL_ON, "offers": False, "agent_messages": False}

    # Only what's sent changes; and it's really stored, not just echoed.
    r = await client.patch("/auth/me/notification-preferences", headers=h, json={"offers": True})
    assert r.json() == {**ALL_ON, "agent_messages": False}
    assert (await client.get("/auth/me", headers=h)).json()["notification_preferences"] == {**ALL_ON, "agent_messages": False}


@pytest.mark.asyncio
async def test_an_existing_user_with_no_saved_preferences_is_all_on(db_session_factory):
    user_id = await _user(db_session_factory)   # created without touching any toggle
    async with db_session_factory() as s:
        assert (await s.get(User, user_id)).notification_preferences == ALL_ON


# ---------- Part B: tiered delivery ----------

@pytest.mark.asyncio
async def test_a_disabled_non_critical_kind_is_not_sent_anywhere(db_session_factory, providers, monkeypatch):
    monkeypatch.setattr(settings, "email_api_key", "re_test")
    monkeypatch.setattr(settings, "sms_api_key", "termii_test")
    user_id = await _user(db_session_factory, notify_offers=False, notify_order_updates=False)

    for kind in ("offer", "item_unavailable"):
        note, count = await _send(db_session_factory, user_id, kind)
        assert note is None and count == 0
    assert providers == []


@pytest.mark.asyncio
async def test_a_non_critical_kind_is_in_app_only(db_session_factory, providers, monkeypatch):
    monkeypatch.setattr(settings, "email_api_key", "re_test")
    monkeypatch.setattr(settings, "sms_api_key", "termii_test")
    user_id = await _user(db_session_factory)

    note, count = await _send(db_session_factory, user_id, "item_unavailable")
    assert note is not None and count == 1
    assert providers == []                       # never an email or SMS


@pytest.mark.asyncio
@pytest.mark.parametrize("kind, toggle", [
    ("payment_due", "notify_payment_reminders"),
    ("out_for_delivery", "notify_order_updates"),
])
async def test_critical_kinds_always_send_in_app_and_off_app_even_when_muted(db_session_factory, providers, monkeypatch, kind, toggle):
    monkeypatch.setattr(settings, "email_api_key", "re_test")
    monkeypatch.setattr(settings, "sms_api_key", "termii_test")
    user_id = await _user(db_session_factory, **{toggle: False, "notify_offers": False})

    note, count = await _send(db_session_factory, user_id, kind)
    assert note is not None and count == 1       # in-app despite the toggle
    assert len(_emails(providers)) == 1 and len(_sms(providers)) == 1


@pytest.mark.asyncio
async def test_email_goes_through_resend_and_sms_skips_cleanly_without_a_termii_key(db_session_factory, providers, monkeypatch):
    monkeypatch.setattr(settings, "email_api_key", "re_test")
    monkeypatch.setattr(settings, "sms_api_key", "")       # Termii not set up yet
    user_id = await _user(db_session_factory)

    note, count = await _send(db_session_factory, user_id, "payment_due")
    assert note is not None and count == 1
    [(url, body)] = providers                               # one request: the email, no SMS
    assert url == "https://api.resend.com/emails"
    assert body["from"] == settings.email_from
    assert body["subject"] == "Payment due on your Qyka order"
    assert "test payment_due" in body["text"] and "test payment_due" in body["html"]


@pytest.mark.asyncio
async def test_provider_failure_never_breaks_the_notification(db_session_factory, monkeypatch):
    monkeypatch.setattr(settings, "email_api_key", "re_test")
    monkeypatch.setattr(settings, "sms_api_key", "termii_test")

    def boom(request):
        raise httpx.ConnectError("provider down")
    monkeypatch.setattr(delivery, "_transport", httpx.MockTransport(boom))
    user_id = await _user(db_session_factory)

    note, count = await _send(db_session_factory, user_id, "out_for_delivery")   # no exception
    assert note is not None and count == 1


@pytest.mark.asyncio
async def test_hub_handover_sends_the_critical_out_for_delivery_notice(db_session_factory, providers, monkeypatch):
    from app.hubs.models import Hub
    from app.hubs.service import handover
    from app.orders.models import Order

    monkeypatch.setattr(settings, "email_api_key", "re_test")
    customer_id = await _user(db_session_factory, notify_order_updates=False)   # muted - still gets it
    async with db_session_factory() as s:
        shopkeeper = User(phone="+2348079990002", role=UserRole.SHOPKEEPER, status=UserStatus.ACTIVE)
        rider = User(phone="+2348079990003", role=UserRole.RIDER, status=UserStatus.ACTIVE)
        s.add_all([shopkeeper, rider])
        await s.flush()
        hub = Hub(market_id=uuid.uuid4(), user_id=shopkeeper.id, name="H")
        s.add(hub)
        await s.flush()
        order = Order(
            customer_id=customer_id, market_id=hub.market_id, status=OrderStatus.READY_FOR_PICKUP,
            hub_id=hub.id, rider_id=rider.id, pickup_code="4321",
        )
        s.add(order)
        await s.flush()
        await handover(s, user=shopkeeper, order_id=order.id, code="4321")
        await s.commit()
        [note] = (await s.execute(select(Notification).where(Notification.user_id == customer_id))).scalars().all()

    assert note.kind == "out_for_delivery" and order.handover_code in note.message
    [email] = _emails(providers)
    assert email["subject"] == "Your Qyka order is on its way"


@pytest.mark.asyncio
async def test_read_all_and_unknown_id(client, db_session_factory):
    from app.auth.models import User
    from app.notifications import service as notifications
    from sqlalchemy import select

    r = await client.post("/auth/request-otp", json={"identifier": "+2348012300099"})
    code = r.json()["dev_otp"]
    r = await client.post("/auth/verify-otp", json={"identifier": "+2348012300099", "code": code})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    async with db_session_factory() as s:
        uid = (await s.execute(select(User).where(User.phone == "+2348012300099"))).scalar_one().id
        await notifications.send(s, user_id=uid, kind="order_cancelled", message="a")
        await notifications.send(s, user_id=uid, kind="order_cancelled", message="b")
        await s.commit()
    assert all(not n["is_read"] for n in (await client.get("/notifications", headers=h)).json())
    assert (await client.post("/notifications/read-all", headers=h)).status_code == 204
    assert all(n["is_read"] for n in (await client.get("/notifications", headers=h)).json())
    import uuid
    assert (await client.post(f"/notifications/{uuid.uuid4()}/read", headers=h)).status_code == 404
