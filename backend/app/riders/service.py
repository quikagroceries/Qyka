"""Rider-side delivery: see the pool of ready orders, claim one, collect it
from the hub, and confirm drop-off with the customer's PIN.

Custody is two-key at the hub: claiming issues a pickup code to the rider,
and the SHOPKEEPER enters it to release the goods (hubs/service.py::handover)
- so the shopkeeper, not the rider, is the one who says "it left with them".
"""

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.core.enums import OrderStatus, RiderStatus
from app.hubs.models import Hub
from app.markets.models import Market
from app.notifications import service as notif_service
from app.orders.models import Order
from app.riders.models import Rider

# One job at a time: a pool only works if nobody sits on several.
MAX_ACTIVE_JOBS = 1
_ACTIVE = (OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY)


async def get_active_rider(db: AsyncSession, user: User) -> Rider:
    """The roster record behind a rider login, which must be ACTIVE. A
    suspended rider keeps their login (and role) but can't touch a job."""
    rider = (await db.execute(select(Rider).where(Rider.user_id == user.id))).scalar_one_or_none()
    if rider is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No rider profile is linked to this account")
    if rider.status is not RiderStatus.ACTIVE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your rider account is suspended")
    return rider


async def _job(db: AsyncSession, order: Order, *, mine: bool) -> dict:
    hub = market = customer = None
    if order.hub_id is not None:
        hub = (await db.execute(select(Hub).where(Hub.id == order.hub_id))).scalar_one_or_none()
    market = (await db.execute(select(Market).where(Market.id == order.market_id))).scalar_one_or_none()
    out = {
        "id": order.id,
        "status": order.status,
        "hub_id": order.hub_id,
        "hub_name": hub.name if hub else None,
        "market_name": market.name if market else None,
        "item_count": len([i for i in order.items if i.availability not in ("unavailable", "dropped")]),
        "ready_at": order.packed_at,
        "claimed_at": order.rider_claimed_at,
    }
    if mine:
        customer = (await db.execute(select(User).where(User.id == order.customer_id))).scalar_one_or_none()
        out.update(
            pickup_code=order.pickup_code if order.status is OrderStatus.READY_FOR_PICKUP else None,
            customer_name=customer.full_name if customer else None,
            customer_phone=customer.phone if customer else None,
            delivery_address=order.delivery_address,
            dropoff_latitude=order.dropoff_latitude,
            dropoff_longitude=order.dropoff_longitude,
            delivered_at=order.rider_delivered_at,
        )
    return out


async def list_pool(db: AsyncSession, *, user: User) -> list[dict]:
    """Ready orders nobody has claimed, in the rider's market (or anywhere if
    the rider isn't tied to one), longest-waiting first."""
    rider = await get_active_rider(db, user)
    stmt = (
        select(Order)
        .where(Order.status == OrderStatus.READY_FOR_PICKUP, Order.rider_id.is_(None))
        .options(selectinload(Order.items))
        .order_by(Order.packed_at)
    )
    if rider.market_id is not None:
        stmt = stmt.where(Order.market_id == rider.market_id)
    orders = (await db.execute(stmt)).scalars().all()
    return [await _job(db, o, mine=False) for o in orders]


async def list_mine(db: AsyncSession, *, user: User) -> list[dict]:
    """The rider's current jobs, with everything they need to do them."""
    await get_active_rider(db, user)
    orders = (await db.execute(
        select(Order)
        .where(Order.rider_id == user.id, Order.status.in_(_ACTIVE))
        .options(selectinload(Order.items))
        .order_by(Order.rider_claimed_at)
    )).scalars().all()
    return [await _job(db, o, mine=True) for o in orders]


async def claim(db: AsyncSession, *, user: User, order_id: uuid.UUID) -> dict:
    rider = await get_active_rider(db, user)

    active = (await db.execute(
        select(func.count()).select_from(Order)
        .where(Order.rider_id == user.id, Order.status.in_(_ACTIVE))
    )).scalar_one()
    if active >= MAX_ACTIVE_JOBS:
        raise HTTPException(status.HTTP_409_CONFLICT, "Finish your current delivery before claiming another")

    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None or (rider.market_id is not None and order.market_id != rider.market_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    # One atomic UPDATE decides the race: if two riders tap Claim together,
    # exactly one row matches and the other gets a 409.
    result = await db.execute(
        update(Order)
        .where(
            Order.id == order_id,
            Order.status == OrderStatus.READY_FOR_PICKUP,
            Order.rider_id.is_(None),
        )
        .values(
            rider_id=user.id,
            rider_claimed_at=datetime.now(timezone.utc),
            pickup_code=f"{secrets.randbelow(10_000):04d}",
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone else already claimed this job")
    await db.flush()
    order = (await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
        .execution_options(populate_existing=True)
    )).scalar_one()
    return await _job(db, order, mine=True)


async def release(db: AsyncSession, *, user: User, order_id: uuid.UUID) -> dict:
    """Give a claimed job back to the pool - only until the goods have left
    the hub."""
    await get_active_rider(db, user)
    order = (await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )).scalar_one_or_none()
    if order is None or order.rider_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if order.status is not OrderStatus.READY_FOR_PICKUP:
        raise HTTPException(status.HTTP_409_CONFLICT, "The goods have already left the hub")
    order.rider_id = None
    order.rider_claimed_at = None
    order.pickup_code = None
    await db.flush()
    return await _job(db, order, mine=False)


async def deliver(db: AsyncSession, *, user: User, order_id: uuid.UUID, code: str) -> dict:
    """Rider hands the goods over and proves it with the customer's PIN.
    This does NOT close the order: the customer's own confirmation does,
    and that's what releases the payouts."""
    await get_active_rider(db, user)
    order = (await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )).scalar_one_or_none()
    if order is None or order.rider_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if order.status is not OrderStatus.OUT_FOR_DELIVERY or order.rider_delivered_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This job isn't out for delivery")
    if not order.handover_code or not secrets.compare_digest(code.strip(), order.handover_code):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That code doesn't match the customer's")
    order.rider_delivered_at = datetime.now(timezone.utc)
    await db.flush()
    await notif_service.send(
        db, user_id=order.customer_id, order_id=order.id, kind="rider_delivered",
        message="Your rider says your order has been handed over - please confirm you received it.",
    )
    return await _job(db, order, mine=True)
