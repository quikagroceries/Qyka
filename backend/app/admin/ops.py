"""Hands-on admin actions: the things that otherwise need a developer in the
database. Every one is reached through a guarded, audited route (admin/routes.py),
refuses states where it would corrupt money or custody, and says why.
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.enums import OrderStatus, RiderStatus, UserRole, UserStatus
from app.core.phone import normalize_phone
from app.delivery import service as delivery_service
from app.hubs.models import Hub
from app.markets.models import Agent, Market
from app.notifications import service as notif_service
from app.orders.models import Order
from app.platform_settings import service as platform
from app.riders.models import Rider

_PHONE_RE = re.compile(r"\+\d{10,15}")

# Orders an agent still has work on. Nothing may be pulled out from under them.
_AGENT_ACTIVE = (OrderStatus.AGENT_ASSIGNED, OrderStatus.SHOPPING, OrderStatus.PAID)
_AT_HUB = (OrderStatus.DROPPED_AT_HUB, OrderStatus.RECEIVED_BY_HUB, OrderStatus.READY_FOR_PICKUP)


def _phone(raw: str) -> str:
    phone = normalize_phone(raw)
    if not _PHONE_RE.fullmatch(phone):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid phone number")
    return phone


async def _user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


async def _order(db: AsyncSession, order_id: uuid.UUID) -> Order:
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


def _need_note(note: str | None) -> str:
    note = (note or "").strip()
    if len(note) < 3:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Say why (a short note is required)")
    return note


async def _staff_account(db: AsyncSession, *, phone: str, full_name: str, role: UserRole) -> User:
    """The account for a new staff member: found by phone (a customer keeps
    their history), or created. Never takes over an admin or someone who
    already has a different staff role - one role per account."""
    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    if user is None:
        user = User(
            phone=phone, full_name=full_name, role=role, status=UserStatus.ACTIVE,
            is_phone_verified=False,
            basket_cap_kobo=await platform.default_basket_cap_kobo(db),
            has_customer_side=False,
        )
        db.add(user)
        await db.flush()
        return user
    if user.role is UserRole.ADMIN:
        raise HTTPException(status.HTTP_409_CONFLICT, "That number belongs to an admin account")
    if user.role not in (UserRole.CUSTOMER, role):
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"That number already belongs to a {user.role.value} account"
        )
    user.role = role
    if not user.full_name:
        user.full_name = full_name
    return user


# --- Hubs ---------------------------------------------------------------

async def create_hub(
    db: AsyncSession, *, full_name: str, phone: str, market_id: uuid.UUID, hub_name: str | None
) -> Hub:
    """Set up a hub and its shopkeeper in one step. Shopkeepers are only ever
    created this way - never by a public application - because a hub holds
    other people's goods."""
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found")
    full_name = full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter the shopkeeper's name")
    user = await _staff_account(db, phone=_phone(phone), full_name=full_name, role=UserRole.SHOPKEEPER)
    if (await db.execute(select(Hub).where(Hub.user_id == user.id))).scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That person already runs a hub")
    hub = Hub(market_id=market.id, user_id=user.id, name=(hub_name or "").strip() or f"{market.name} Hub")
    db.add(hub)
    await db.flush()
    return hub


async def replace_shopkeeper(
    db: AsyncSession, *, hub_id: uuid.UUID, full_name: str, phone: str
) -> Hub:
    """Hand a hub to someone else. Refused while orders are sitting in it:
    their custody trail runs through the current shopkeeper."""
    hub = (await db.execute(select(Hub).where(Hub.id == hub_id))).scalar_one_or_none()
    if hub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hub not found")
    in_hub = (await db.execute(
        select(Order.id).where(Order.hub_id == hub.id, Order.status.in_(_AT_HUB)).limit(1)
    )).first()
    if in_hub is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Orders are at this hub right now - change the shopkeeper once they've gone",
        )
    old = await _user(db, hub.user_id)
    new = await _staff_account(db, phone=_phone(phone), full_name=full_name.strip(), role=UserRole.SHOPKEEPER)
    if new.id == old.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "That's already this hub's shopkeeper")
    if (await db.execute(select(Hub).where(Hub.user_id == new.id))).scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That person already runs another hub")
    old.role = UserRole.CUSTOMER
    old.has_customer_side = True
    hub.user_id = new.id
    await db.flush()
    return hub


# --- Orders -------------------------------------------------------------

async def reassign_agent(
    db: AsyncSession, *, order_id: uuid.UUID, agent_user_id: uuid.UUID, note: str
) -> Order:
    """Move an order to a different agent: the first one vanished, got ill, or
    was assigned by mistake. Only while the agent is still on it - before
    shopping or during it. Spending already authorised stays with the order."""
    note = _need_note(note)
    order = await _order(db, order_id)
    if order.status not in (OrderStatus.AGENT_ASSIGNED, OrderStatus.SHOPPING):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An agent can only be swapped before or during shopping",
        )
    if order.agent_id == agent_user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "That agent already has this order")
    new_agent = (await db.execute(select(Agent).where(Agent.user_id == agent_user_id))).scalar_one_or_none()
    if new_agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person isn't an agent")
    busy = (await db.execute(
        select(Order.id).where(
            Order.agent_id == agent_user_id, Order.status.in_(_AGENT_ACTIVE), Order.id != order.id
        ).limit(1)
    )).first()
    if busy is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That agent is busy with another order")

    old_id = order.agent_id
    if old_id is not None:
        old_agent = (await db.execute(select(Agent).where(Agent.user_id == old_id))).scalar_one_or_none()
        if old_agent is not None:
            old_agent.is_available = True
    order.agent_id = agent_user_id
    order.agent_assigned_at = datetime.now(timezone.utc)
    new_agent.is_available = order.status is not OrderStatus.SHOPPING
    await db.flush()
    await notif_service.send(
        db, user_id=order.customer_id, order_id=order.id, kind="agent_changed",
        message="Your order has a new agent. Nothing you've approved changes.",
    )
    await notif_service.send(
        db, user_id=agent_user_id, order_id=order.id, kind="agent_changed",
        message="An order has been assigned to you by Qyka. Open it from your home screen.",
    )
    return order


_STAGE_ORDER = [OrderStatus.DROPPED_AT_HUB, OrderStatus.RECEIVED_BY_HUB, OrderStatus.READY_FOR_PICKUP]


async def set_hub_stage(
    db: AsyncSession, *, order_id: uuid.UUID, stage: OrderStatus, note: str
) -> Order:
    """Put an order at the right step of the hub's custody chain when someone
    tapped the wrong button (or the shopkeeper's phone died). Only between
    "dropped" and "ready" - once it's out with a rider it's no longer the
    hub's to fix."""
    note = _need_note(note)
    order = await _order(db, order_id)
    if stage not in _STAGE_ORDER:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a hub stage")
    if order.status not in _STAGE_ORDER or order.hub_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This order isn't at a hub")
    if order.status is stage:
        raise HTTPException(status.HTTP_409_CONFLICT, "It's already at that stage")
    now = datetime.now(timezone.utc)
    idx = _STAGE_ORDER.index(stage)
    if idx < 1:
        order.hub_received_at = None
    elif order.hub_received_at is None:
        order.hub_received_at = now
    if idx < 2:
        order.packed_at = None
        # A rider's claim only makes sense on an order that's ready.
        order.rider_id = None
        order.rider_claimed_at = None
        order.pickup_code = None
    elif order.packed_at is None:
        order.packed_at = now
    order.status = stage
    await db.flush()
    return order


async def confirm_delivery_for_customer(db: AsyncSession, *, order_id: uuid.UUID, note: str) -> dict:
    """Confirm receipt on the customer's behalf (they can't, or won't, but the
    goods arrived) - releases the payouts exactly as their own tap would."""
    _need_note(note)
    order = await _order(db, order_id)
    if order.status is not OrderStatus.OUT_FOR_DELIVERY:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an order that's out for delivery can be confirmed")
    return await delivery_service.confirm_delivery(db, order_id=order.id, customer_id=order.customer_id)


# --- People -------------------------------------------------------------

async def move_agent_market(db: AsyncSession, *, user_id: uuid.UUID, market_id: uuid.UUID) -> Agent:
    agent = (await db.execute(select(Agent).where(Agent.user_id == user_id))).scalar_one_or_none()
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person isn't an agent")
    if (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found")
    busy = (await db.execute(
        select(Order.id).where(Order.agent_id == user_id, Order.status.in_(_AGENT_ACTIVE)).limit(1)
    )).first()
    if busy is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "They have an order in progress - move them once it's done")
    agent.assigned_market_id = market_id
    await db.flush()
    return agent


async def end_staff_role(db: AsyncSession, *, user_id: uuid.UUID, note: str) -> User:
    """Take an agent, rider or shopkeeper out of their job: they become a plain
    customer again (history intact). Refused while they still hold work."""
    _need_note(note)
    user = await _user(db, user_id)
    if user.role is UserRole.AGENT:
        busy = (await db.execute(
            select(Order.id).where(Order.agent_id == user.id, Order.status.in_(_AGENT_ACTIVE)).limit(1)
        )).first()
        if busy is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "They have orders in progress - reassign those first")
        agent = (await db.execute(select(Agent).where(Agent.user_id == user.id))).scalar_one_or_none()
        if agent is not None:
            agent.is_available = False
            agent.on_duty = False
    elif user.role is UserRole.RIDER:
        busy = (await db.execute(
            select(Order.id).where(
                Order.rider_id == user.id,
                Order.status.in_((OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY)),
            ).limit(1)
        )).first()
        if busy is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "They hold a delivery - release or finish it first")
        rider = (await db.execute(select(Rider).where(Rider.user_id == user.id))).scalar_one_or_none()
        if rider is not None:
            rider.status = RiderStatus.SUSPENDED
    elif user.role is UserRole.SHOPKEEPER:
        hub = (await db.execute(select(Hub).where(Hub.user_id == user.id))).scalar_one_or_none()
        if hub is not None:
            in_hub = (await db.execute(
                select(Order.id).where(Order.hub_id == hub.id, Order.status.in_(_AT_HUB)).limit(1)
            )).first()
            if in_hub is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, "Orders are at their hub - hand the hub over first")
            hub.is_active = False
    else:
        raise HTTPException(status.HTTP_409_CONFLICT, "They have no agent, rider or shopkeeper role to end")
    user.role = UserRole.CUSTOMER
    user.has_customer_side = True
    await db.flush()
    return user


async def edit_user(
    db: AsyncSession, *, user_id: uuid.UUID, full_name: str | None, phone: str | None,
    email: str | None, basket_cap_naira: int | None,
) -> User:
    """Fix a person's details: a mistyped name, a changed number, a new
    spending cap. Their phone is how they sign in, so it stays unique."""
    user = await _user(db, user_id)
    if user.role is UserRole.ADMIN:
        raise HTTPException(status.HTTP_409_CONFLICT, "Admins are managed on the Admins page")
    if full_name is not None:
        user.full_name = full_name.strip() or None
    if phone is not None:
        new = _phone(phone)
        taken = (await db.execute(select(User).where(User.phone == new, User.id != user.id))).scalar_one_or_none()
        if taken is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another account already uses that number")
        user.phone = new
    if email is not None:
        clean = email.strip().lower() or None
        if clean is not None:
            if "@" not in clean:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid email")
            taken = (await db.execute(select(User).where(User.email == clean, User.id != user.id))).scalar_one_or_none()
            if taken is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, "Another account already uses that email")
        user.email = clean
    if basket_cap_naira is not None:
        if basket_cap_naira < 0 or basket_cap_naira > 10_000_000:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Spending cap out of range")
        user.basket_cap_kobo = basket_cap_naira * 100
    await db.flush()
    return user
