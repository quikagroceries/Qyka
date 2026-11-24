"""The company's numbers, defined once.

Used by the admin Company overview and by the investor link, so the two can
never disagree. Aggregates only: nothing here names a customer, agent, rider
or order.

DEFINITIONS (what each figure means - the investor page repeats these):

  Completed order   delivered and confirmed (status delivered/closed), counted
                    on the day it was delivered. Everything below that says
                    "completed" uses this - revenue, goods sold, earnings -
                    because that is the moment the money is actually settled
                    (the agent, rider and hub are paid out on confirmation).
  Goods sold        what customers' orders actually bought (items_total) -
                    the value that moved through the markets. Not Qyka's money.
  Revenue           what Qyka keeps from a completed order after paying the
                    agent, rider and hub: the service-fee margin plus whatever
                    the delivery fee leaves (delivery.payouts.compute_split).
  Take rate         revenue as a share of goods sold.
  Repeat customers  of the customers served in the period, the share who have
                    completed two or more orders with us (ever).
  Delivery time     median minutes from the order being placed to delivery.
  Completion rate   of orders placed in the period that reached an outcome,
                    the share that were delivered (the rest were cancelled or
                    went unpaid). Orders still in progress are left out.
"""

import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.enums import MarketStatus, OrderStatus, RiderStatus, UserRole
from app.delivery.payouts import compute_split
from app.hubs.models import Hub
from app.markets.models import Agent, Market
from app.orders.models import Order
from app.ratings.models import AgentRating
from app.riders.models import Rider

COMPLETED = (OrderStatus.DELIVERED, OrderStatus.CLOSED)
OUTCOMES = COMPLETED + (OrderStatus.CANCELLED, OrderStatus.CANCELLED_UNPAID, OrderStatus.DISPUTED)
IN_FLIGHT_EXCLUDED = OUTCOMES + (OrderStatus.DRAFT,)
WEEKS = 12
ZERO = Decimal("0.00")


def _aware(ts: datetime) -> datetime:
    return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)


def revenue_of(order: Order) -> Decimal:
    """Qyka's take from one completed order (see the module docstring)."""
    return Decimal(compute_split(order)["company_retained"])


def _pct(part: Decimal | int, whole: Decimal | int) -> str | None:
    if not whole:
        return None
    return str((Decimal(part) / Decimal(whole) * 100).quantize(Decimal("0.1")))


def _change(now: Decimal | int, before: Decimal | int) -> str | None:
    """Percent change vs the previous period; None when there's nothing to compare to."""
    if not before:
        return None
    return str(((Decimal(now) - Decimal(before)) / Decimal(before) * 100).quantize(Decimal("0.1")))


def _money(v: Decimal) -> str:
    return str(v.quantize(Decimal("0.01")))


async def company_overview(
    db: AsyncSession, *, days: int | None = 30, include_financials: bool = True
) -> dict:
    """days=None means all time. include_financials=False leaves out revenue
    and take rate (an owner may share volume and reliability without them)."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days) if days else None
    prev_since = now - timedelta(days=2 * days) if days else None

    orders = list((await db.execute(select(Order))).scalars().all())
    completed = [o for o in orders if o.status in COMPLETED and o.delivered_at is not None]

    def done_between(lo, hi):
        return [o for o in completed if (lo is None or _aware(o.delivered_at) >= lo) and (hi is None or _aware(o.delivered_at) < hi)]

    cur = done_between(since, None)
    prev = done_between(prev_since, since) if days else []

    goods = sum((o.items_total for o in cur), start=ZERO)
    goods_prev = sum((o.items_total for o in prev), start=ZERO)
    revenue = sum((revenue_of(o) for o in cur), start=ZERO)
    revenue_prev = sum((revenue_of(o) for o in prev), start=ZERO)

    # --- customers -------------------------------------------------------
    completed_by_customer: dict = defaultdict(int)
    for o in completed:
        completed_by_customer[o.customer_id] += 1
    served = {o.customer_id for o in cur}
    repeat = sum(1 for c in served if completed_by_customer[c] >= 2)
    registered = (await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.CUSTOMER)
    )).scalar_one()

    # --- speed -----------------------------------------------------------
    minutes = [
        (_aware(o.delivered_at) - _aware(o.created_at)).total_seconds() / 60
        for o in cur if o.created_at is not None
    ]

    # --- reliability: orders PLACED in the period that reached an outcome ----
    placed = [o for o in orders if o.status in OUTCOMES and o.created_at is not None
              and (since is None or _aware(o.created_at) >= since)]
    delivered_n = sum(1 for o in placed if o.status in COMPLETED)

    # --- ratings -----------------------------------------------------------
    rating_row = (await db.execute(select(func.avg(AgentRating.stars), func.count(AgentRating.id)))).one()
    avg_rating = round(float(rating_row[0]), 2) if rating_row[0] is not None else None

    # --- growth: the last 12 weeks, always (independent of the period) -------
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    this_monday = today - timedelta(days=today.weekday())
    weeks = []
    for i in range(WEEKS - 1, -1, -1):
        start = this_monday - timedelta(weeks=i)
        bucket = [o for o in completed if start <= _aware(o.delivered_at) < start + timedelta(weeks=1)]
        weeks.append({
            "week_start": start.date().isoformat(),
            "orders": len(bucket),
            "goods_sold": _money(sum((o.items_total for o in bucket), start=ZERO)),
            "revenue": _money(sum((revenue_of(o) for o in bucket), start=ZERO)) if include_financials else None,
        })

    # --- supply ------------------------------------------------------------
    recent = [o for o in completed if _aware(o.delivered_at) >= now - timedelta(days=30)]
    markets = {m.id: m for m in (await db.execute(select(Market))).scalars().all()}
    live_markets = sum(1 for m in markets.values() if m.status in (MarketStatus.LIVE, MarketStatus.PILOT))
    supply = {
        "agents": (await db.execute(select(func.count()).select_from(Agent))).scalar_one(),
        "agents_active_30d": len({o.agent_id for o in recent if o.agent_id}),
        "riders": (await db.execute(
            select(func.count()).select_from(Rider).where(Rider.status == RiderStatus.ACTIVE)
        )).scalar_one(),
        "riders_active_30d": len({o.rider_id for o in recent if o.rider_id}),
        "hubs": (await db.execute(
            select(func.count()).select_from(Hub).where(Hub.is_active.is_(True))
        )).scalar_one(),
        "markets_live": live_markets,
    }

    # --- per market --------------------------------------------------------
    by_market: dict = defaultdict(list)
    for o in cur:
        by_market[o.market_id].append(o)
    market_rows = sorted(
        (
            {
                "name": markets[mid].name if mid in markets else "Unknown",
                "city": markets[mid].city if mid in markets else None,
                "orders": len(rows),
                "goods_sold": _money(sum((o.items_total for o in rows), start=ZERO)),
                "revenue": _money(sum((revenue_of(o) for o in rows), start=ZERO)) if include_financials else None,
            }
            for mid, rows in by_market.items()
        ),
        key=lambda r: -Decimal(r["goods_sold"]),
    )

    in_flight = sum(1 for o in orders if o.status not in IN_FLIGHT_EXCLUDED)
    return {
        "as_of": now.isoformat(),
        "period_days": days,
        "financials_included": include_financials,
        "headline": {
            "goods_sold": _money(goods),
            "orders_completed": len(cur),
            "avg_order_value": _money(goods / len(cur)) if cur else None,
            "revenue": _money(revenue) if include_financials else None,
            "take_rate_percent": _pct(revenue, goods) if include_financials else None,
            "customers_served": len(served),
            "repeat_customer_rate_percent": _pct(repeat, len(served)),
            "median_delivery_minutes": round(statistics.median(minutes)) if minutes else None,
            "avg_rating": avg_rating,
            "ratings_count": rating_row[1],
            "registered_customers": registered,
        },
        "vs_previous_period": {
            "goods_sold_percent": _change(goods, goods_prev) if days else None,
            "orders_percent": _change(len(cur), len(prev)) if days else None,
            "revenue_percent": _change(revenue, revenue_prev) if days and include_financials else None,
        },
        "reliability": {
            "orders_with_outcome": len(placed),
            "completion_rate_percent": _pct(delivered_n, len(placed)),
            "cancelled_percent": _pct(sum(1 for o in placed if o.status is OrderStatus.CANCELLED), len(placed)),
            "unpaid_percent": _pct(sum(1 for o in placed if o.status is OrderStatus.CANCELLED_UNPAID), len(placed)),
        },
        "weekly": weeks,
        "supply": supply,
        "markets": market_rows,
        "pipeline": {"orders_in_flight": in_flight},
    }
