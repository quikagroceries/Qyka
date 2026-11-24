"""Shopkeeper-side hub custody: see what's been dropped, confirm what
actually arrived, then mark it ready for a rider."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.core.enums import OrderStatus
from app.core.media import is_our_cloudinary_url
from app.hubs.models import Hub
from app.orders.models import Order
from app.orders.state_machine import IllegalTransition, assert_can_transition

# Items that never made it into the bag: nothing to receive for them.
_NOT_BOUGHT = ("unavailable", "dropped")

_AT_HUB = (
    OrderStatus.DROPPED_AT_HUB,
    OrderStatus.RECEIVED_BY_HUB,
    OrderStatus.READY_FOR_PICKUP,
)


async def hub_for_shopkeeper(db: AsyncSession, user: User) -> Hub:
    hub = (await db.execute(select(Hub).where(Hub.user_id == user.id))).scalar_one_or_none()
    if hub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hub is linked to this account")
    return hub


def _bought(order: Order) -> list:
    return [i for i in order.items if i.availability not in _NOT_BOUGHT]


async def _hub_order(db: AsyncSession, hub: Hub, order_id: uuid.UUID) -> Order:
    """An order at THIS hub. Anything else 404s, same as a missing order, so
    one shopkeeper can't probe another hub's orders."""
    order = (await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )).scalar_one_or_none()
    if order is None or order.hub_id != hub.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


async def _out(db: AsyncSession, order: Order) -> dict:
    agent = None
    if order.agent_id is not None:
        agent = (await db.execute(select(User).where(User.id == order.agent_id))).scalar_one_or_none()
    return {
        "id": order.id,
        "status": order.status,
        "agent_name": agent.full_name if agent is not None else None,
        "items": [
            {"id": i.id, "description": i.description, "quantity": i.quantity,
             "requested_note": i.requested_note}
            for i in _bought(order)
        ],
        "packing_photos": list(order.packing_photos or []),
        "dropped_at_hub_at": order.dropped_at_hub_at,
        "hub_received_at": order.hub_received_at,
        "hub_missing_item_ids": list(order.hub_missing_item_ids or []),
        "hub_receipt_note": order.hub_receipt_note,
    }


async def list_orders(db: AsyncSession, *, user: User) -> list[dict]:
    """Orders currently at this hub, oldest drop first."""
    hub = await hub_for_shopkeeper(db, user)
    orders = (await db.execute(
        select(Order)
        .where(Order.hub_id == hub.id, Order.status.in_(_AT_HUB))
        .options(selectinload(Order.items))
        .order_by(Order.dropped_at_hub_at)
    )).scalars().all()
    return [await _out(db, o) for o in orders]


async def get_order(db: AsyncSession, *, user: User, order_id: uuid.UUID) -> dict:
    hub = await hub_for_shopkeeper(db, user)
    return await _out(db, await _hub_order(db, hub, order_id))


def _transition(order: Order, target: OrderStatus) -> None:
    try:
        assert_can_transition(order.status, target)
    except IllegalTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    order.status = target


async def receive(
    db: AsyncSession,
    *,
    user: User,
    order_id: uuid.UUID,
    received_item_ids: list[uuid.UUID] | None,
    note: str | None,
    photos: list[str],
) -> dict:
    """Shopkeeper confirms what actually arrived. Custody passes to the hub.

    Anything not seen is recorded (and needs a note saying why) but never
    blocks the receipt - the goods are physically here either way, so the
    accountability trail is what catches up, not the flow.
    """
    hub = await hub_for_shopkeeper(db, user)
    order = await _hub_order(db, hub, order_id)
    if order.status is not OrderStatus.DROPPED_AT_HUB:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot confirm receipt from {order.status.value}",
        )
    if not all(is_our_cloudinary_url(p) for p in photos):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Image must be uploaded through Qyka")

    expected = {i.id for i in _bought(order)}
    missing: list[uuid.UUID] = []
    if received_item_ids is not None:
        seen = set(received_item_ids)
        if not seen <= expected:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown item for this order")
        missing = sorted(expected - seen, key=str)
    note = (note or "").strip() or None
    if missing and note is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Add a note about what's missing"
        )

    _transition(order, OrderStatus.RECEIVED_BY_HUB)
    order.hub_received_at = datetime.now(timezone.utc)
    order.hub_missing_item_ids = [str(i) for i in missing]
    order.hub_receipt_note = note
    if photos:
        order.packing_photos = list(order.packing_photos or []) + photos
    await db.flush()
    return await _out(db, order)


async def mark_ready(db: AsyncSession, *, user: User, order_id: uuid.UUID) -> dict:
    """Shopkeeper has the goods bagged and ready for a rider to claim."""
    hub = await hub_for_shopkeeper(db, user)
    order = await _hub_order(db, hub, order_id)
    _transition(order, OrderStatus.READY_FOR_PICKUP)
    order.packed_at = datetime.now(timezone.utc)
    await db.flush()
    return await _out(db, order)
