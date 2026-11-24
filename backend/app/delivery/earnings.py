"""Earnings summary for the people paid per delivered order (riders, hubs).

An order counts once the customer has confirmed receipt - that's the moment
the payout is released - and is dated by delivered_at.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderStatus
from app.orders.models import Order

PAID_OUT = (OrderStatus.DELIVERED, OrderStatus.CLOSED, OrderStatus.DISPUTED)


def _aware(ts: datetime) -> datetime:
    # SQLite (tests) returns naive datetimes; Postgres doesn't.
    return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)


async def summarize(db: AsyncSession, *, where, amount_attr: str) -> dict:
    """`where` selects the person's orders (e.g. Order.rider_id == user_id);
    `amount_attr` is the Order column they're paid from ("rider_fee")."""
    orders = list((await db.execute(
        select(Order)
        .where(where, Order.status.in_(PAID_OUT), Order.delivered_at.is_not(None))
        .order_by(Order.delivered_at.desc())
    )).scalars().all())

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    def total(since: datetime | None) -> Decimal:
        return sum(
            (getattr(o, amount_attr) for o in orders
             if since is None or _aware(o.delivered_at) >= since),
            start=Decimal("0.00"),
        )

    return {
        "earnings_today": total(today_start),
        "earnings_week": total(week_start),
        "earnings_total": total(None),
        "completed_count": len(orders),
        "recent": [
            {"order_id": o.id, "amount": getattr(o, amount_attr), "delivered_at": o.delivered_at}
            for o in orders[:50]
        ],
    }
