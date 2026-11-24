"""Agent dashboard — earnings, task counts, and the manual availability
toggle. Read-mostly; the one write path (set_availability) is deliberately
narrow so it can never contradict what start_shopping/finish_shopping are
already doing.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderStatus
from app.markets.models import Agent
from app.orders.models import Order


async def _get_agent(db: AsyncSession, user_id: uuid.UUID) -> Agent:
    result = await db.execute(select(Agent).where(Agent.user_id == user_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent record not found")
    return agent


async def get_summary(db: AsyncSession, *, user_id: uuid.UUID) -> dict:
    agent = await _get_agent(db, user_id)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # Earnings are what has actually been released: the agent is paid out
    # when the customer confirms delivery (delivery.service.confirm_delivery),
    # so an order counts on the day it was delivered. Orders paid for but not
    # yet delivered are shown separately as pending - the same moment-of-payout
    # rule the rider's and hub's earnings follow, and the company's revenue.
    done_result = await db.execute(
        select(Order)
        .where(
            Order.agent_id == user_id,
            Order.status.in_((OrderStatus.DELIVERED, OrderStatus.CLOSED)),
            Order.delivered_at.is_not(None),
        )
        .order_by(Order.delivered_at.desc())
    )
    completed_orders = list(done_result.scalars().all())

    def _delivered_at(order: Order) -> datetime:
        # SQLite (the test DB) hands back naive datetimes even for
        # timezone-aware columns; Postgres (real DB) doesn't. Normalize so
        # the comparisons below work identically either way.
        ts = order.delivered_at
        return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)

    earnings_today = sum(
        (o.agent_share for o in completed_orders if _delivered_at(o) >= today_start),
        start=Decimal("0.00"),
    )
    earnings_week = sum(
        (o.agent_share for o in completed_orders if _delivered_at(o) >= week_start),
        start=Decimal("0.00"),
    )
    earnings_total = sum((o.agent_share for o in completed_orders), start=Decimal("0.00"))

    pending_result = await db.execute(
        select(Order).where(
            Order.agent_id == user_id,
            Order.paid_at.is_not(None),
            Order.status.in_((
                OrderStatus.PAID, OrderStatus.DROPPED_AT_HUB, OrderStatus.RECEIVED_BY_HUB,
                OrderStatus.READY_FOR_PICKUP, OrderStatus.PACKED, OrderStatus.OUT_FOR_DELIVERY,
            )),
        )
    )
    earnings_pending = sum((o.agent_share for o in pending_result.scalars().all()), start=Decimal("0.00"))

    # The same two buckets Home groups its task list into (see the agent
    # Home screen) — surfaced here as counts only, for the dashboard summary.
    # No "waiting on customer" bucket: since the deposit gate now sits on
    # accept_proposal (orders.service.accept_proposal), an agent is never
    # assigned to an order until any required deposit is already paid - an
    # AGENT_ASSIGNED order with an unpaid deposit can no longer exist.
    active_result = await db.execute(
        select(Order).where(
            Order.agent_id == user_id,
            Order.status.in_([OrderStatus.AGENT_ASSIGNED, OrderStatus.SHOPPING]),
        )
    )
    active_orders = list(active_result.scalars().all())
    ready = [o for o in active_orders if o.status is OrderStatus.AGENT_ASSIGNED]
    in_progress = [o for o in active_orders if o.status is OrderStatus.SHOPPING]

    return {
        "earnings_today": earnings_today,
        "earnings_week": earnings_week,
        "earnings_total": earnings_total,
        "earnings_pending": earnings_pending,
        "ready_to_shop_count": len(ready),
        "in_progress_count": len(in_progress),
        "is_available": agent.is_available,
        "on_duty": agent.on_duty,
        "completed_orders": completed_orders[:50],
    }


async def set_availability(
    db: AsyncSession, *, user_id: uuid.UUID, is_available: bool
) -> Agent:
    """Manual pause/resume of new assignments - governs new work only.

    Going available is refused while an order is actually mid-shop: that
    transition belongs to finish_shopping alone, which is what really frees
    the agent up. Without this check the toggle could silently contradict
    the shopping-in-progress state and let a second order land on someone
    who's still out at the market on the first one - the same "never
    abandons an active shop" guarantee the on_duty switch protects.
    """
    agent = await _get_agent(db, user_id)
    if is_available:
        result = await db.execute(
            select(Order.id).where(
                Order.agent_id == user_id,
                Order.status == OrderStatus.SHOPPING,
            ).limit(1)
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Cannot go available while actively shopping an order",
            )
    agent.is_available = is_available
    await db.flush()
    return agent
