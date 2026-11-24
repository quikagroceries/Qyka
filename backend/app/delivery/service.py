"""Delivery service — packing, rider assignment, dispatch, confirmation, payout.

Guards mirror the rest of the system: transitions go through the state machine,
and each action checks the actor is allowed. The important boundary is that
NONE of this is reachable until an order is PAID — the state machine enforces
that, so an unpaid order can never be packed or dispatched.

Delivery confirmation is the terminal money event: it computes the payout split
and releases the agent's and rider's shares from the float pool.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.core.enums import LedgerDirection, OrderStatus, UserRole
from app.delivery import payouts
from app.float import service as float_service
from app.hubs.models import Hub
from app.notifications import service as notif_service
from app.orders.models import Order
from app.orders.state_machine import IllegalTransition, assert_can_transition
from app.payments.models import Transaction


async def _load(db: AsyncSession, order_id: uuid.UUID) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


async def _transition(db: AsyncSession, order: Order, target: OrderStatus) -> None:
    try:
        assert_can_transition(order.status, target)
    except IllegalTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    order.status = target
    await db.flush()


async def drop_at_hub(
    db: AsyncSession,
    *,
    order_id: uuid.UUID,
    agent_id: uuid.UUID,
    hub_id: uuid.UUID | None,
) -> Order:
    """Agent drops the paid order's goods at a hub in the order's market.

    Only valid once PAID (state machine enforces), so goods never travel on
    an unpaid order. The hub is the one given, which must be an active hub
    in this order's market - or, when omitted, the market's only active hub.
    The shopkeeper is told; custody passes to them when they confirm receipt.
    """
    order = await _load(db, order_id)
    if order.agent_id != agent_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the assigned agent")
    if order.status is not OrderStatus.PAID:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot drop at a hub from {order.status.value}: the order must be paid",
        )

    hubs = list((await db.execute(
        select(Hub).where(Hub.market_id == order.market_id, Hub.is_active.is_(True))
    )).scalars().all())
    if hub_id is not None:
        hub = next((h for h in hubs if h.id == hub_id), None)
        if hub is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "That hub isn't an active hub in this order's market"
            )
    elif not hubs:
        raise HTTPException(status.HTTP_409_CONFLICT, "This market has no hub yet")
    elif len(hubs) > 1:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "This market has several hubs - pick one"
        )
    else:
        hub = hubs[0]

    order.hub_id = hub.id
    order.dropped_at_hub_at = datetime.now(timezone.utc)
    await _transition(db, order, OrderStatus.DROPPED_AT_HUB)
    await notif_service.send(
        db, user_id=hub.user_id, order_id=order.id, kind="hub_drop",
        message="An agent has dropped an order at your hub - check it in.",
    )
    return order


async def confirm_delivery(
    db: AsyncSession, *, order_id: uuid.UUID, customer_id: uuid.UUID
) -> dict:
    """Customer confirms receipt. Terminal money event: release payouts.

    The agent fee and rider fee are debited OUT of the float pool to them; the
    company retains item-cost recovery + service charge. The split is recorded
    on the order's transaction for audit.
    """
    order = await _load(db, order_id)
    if order.customer_id != customer_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your order")

    await _transition(db, order, OrderStatus.DELIVERED)
    order.delivered_at = datetime.now(timezone.utc)

    split = payouts.compute_split(order)

    # Release agent + rider shares from the pool.
    if order.agent_share > 0:
        await float_service.record_movement(
            db,
            direction=LedgerDirection.DEBIT,
            amount=order.agent_share,
            order_id=order.id,
            market_id=order.market_id,
            note="Agent payout",
        )
    if order.delivery_fee > 0:
        await float_service.record_movement(
            db,
            direction=LedgerDirection.DEBIT,
            amount=order.delivery_fee,
            order_id=order.id,
            market_id=order.market_id,
            note="Courier delivery cost",
        )

    # Record the split on the transaction for audit.
    result = await db.execute(
        select(Transaction).where(Transaction.order_id == order.id)
    )
    txn = result.scalars().first()
    if txn is not None:
        txn.split_breakdown = split

    await _transition(db, order, OrderStatus.CLOSED)
    return split
