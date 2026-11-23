import uuid
from datetime import time

from fastapi import HTTPException, status
from fastapi import status as http_status  # `status` is also a market field below
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.enums import MarketStatus, VenueType
from app.jit.models import Seller
from app.markets import directory, hours
from app.markets.models import Agent, Market


async def create_market(
    db: AsyncSession,
    *,
    name: str,
    city: str,
    state: str,
    slug: str | None = None,
    description: str | None = None,
    status: MarketStatus = MarketStatus.COMING_SOON,
    categories: list[str] | None = None,
    image_url: str | None = None,
    venue_type: VenueType | str = VenueType.LOCAL_MARKET,
    latitude: float | None = None,
    longitude: float | None = None,
    opening_time: time | None = None,
    closing_time: time | None = None,
    timezone: str | None = None,
) -> Market:
    vt = venue_type.value if isinstance(venue_type, VenueType) else venue_type
    if slug is not None:
        slug = slug.strip().lower()
        if not directory.SLUG_RE.match(slug):
            raise HTTPException(
                http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Slug must be lowercase letters, numbers and single hyphens (e.g. mile-12)",
            )
        if (await db.execute(select(Market.id).where(Market.slug == slug))).first() is not None:
            raise HTTPException(http_status.HTTP_409_CONFLICT, f"The slug '{slug}' is already used by another market")
    else:
        slug = await directory.unique_slug(db, directory.slugify(name))
    market = Market(
        slug=slug,
        description=description,
        status=status,
        categories=list(categories or []),
        image_url=image_url or None,
        name=name,
        city=city,
        state=state,
        venue_type=vt or VenueType.LOCAL_MARKET.value,
        latitude=latitude,
        longitude=longitude,
        opening_time=opening_time or hours.DEFAULT_OPENING_TIME,
        closing_time=closing_time or hours.DEFAULT_CLOSING_TIME,
        timezone=hours.validate_timezone(timezone or hours.DEFAULT_TIMEZONE),
    )
    db.add(market)
    await db.flush()
    return market


async def list_markets(
    db: AsyncSession,
    *,
    active_only: bool,
    venue_type: str | None = None,
) -> list[Market]:
    stmt = select(Market)
    if active_only:
        stmt = stmt.where(Market.is_active.is_(True))
    if venue_type:
        stmt = stmt.where(Market.venue_type == venue_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_market_by_slug(db: AsyncSession, *, slug: str) -> Market:
    market = (await db.execute(select(Market).where(Market.slug == slug))).scalar_one_or_none()
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found")
    return market


async def get_market(db: AsyncSession, *, market_id: uuid.UUID) -> Market:
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if market is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found")
    return market


async def list_vendors(db: AsyncSession, *, market_id: uuid.UUID) -> list[Seller]:
    await get_market(db, market_id=market_id)
    result = await db.execute(
        select(Seller).where(Seller.market_id == market_id).order_by(Seller.name)
    )
    return list(result.scalars().all())


async def create_vendor(
    db: AsyncSession,
    *,
    market_id: uuid.UUID,
    name: str,
    stall_description: str | None = None,
    phone: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Seller:
    """Agent registers a stall on the fly while shopping.

    No approval workflow — the stall is live immediately and shows up in
    list_vendors right away. This is the only way a Seller row gets created
    outside of dev-seeding: there is no admin authorship path, by design
    ("the agent is the product" — stalls exist because an agent actually
    found them, not because someone curated a directory in advance).
    """
    await get_market(db, market_id=market_id)
    vendor = Seller(
        market_id=market_id,
        name=name,
        stall_description=stall_description,
        phone=phone,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(vendor)
    await db.flush()
    return vendor


async def shop_activity(db: AsyncSession) -> dict:
    agents = await db.execute(
        select(func.count())
        .select_from(Agent)
        .where(Agent.on_duty.is_(True), Agent.is_available.is_(True))
    )
    markets = await db.execute(
        select(func.count())
        .select_from(Market)
        .where(
            Market.is_active.is_(True),
            Market.venue_type == VenueType.LOCAL_MARKET.value,
        )
    )
    supers = await db.execute(
        select(func.count())
        .select_from(Market)
        .where(
            Market.is_active.is_(True),
            Market.venue_type == VenueType.SUPERMARKET.value,
        )
    )
    return {
        "agents_on_duty": int(agents.scalar_one() or 0),
        "active_markets": int(markets.scalar_one() or 0),
        "active_supermarkets": int(supers.scalar_one() or 0),
    }


async def update_market(
    db: AsyncSession,
    *,
    market_id: uuid.UUID,
    name: str | None = None,
    slug: str | None = None,
    description: str | None = None,
    status: MarketStatus | None = None,
    categories: list[str] | None = None,
    image_url: str | None = None,
    city: str | None = None,
    state: str | None = None,
    is_active: bool | None = None,
    venue_type: VenueType | str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    opening_time: time | None = None,
    closing_time: time | None = None,
    timezone: str | None = None,
) -> Market:
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if market is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Market not found")
    if slug is not None and slug.strip().lower() != market.slug:
        raise HTTPException(
            http_status.HTTP_400_BAD_REQUEST,
            "A market's slug can't be changed after it's created - links and the website depend on it",
        )
    if name is not None:
        market.name = name
    if description is not None:
        market.description = description.strip() or None
    if status is not None:
        market.status = status
    if categories is not None:
        market.categories = list(categories)
    if image_url is not None:
        market.image_url = image_url or None
    if city is not None:
        market.city = city
    if state is not None:
        market.state = state
    if is_active is not None:
        market.is_active = is_active
    if venue_type is not None:
        market.venue_type = (
            venue_type.value if isinstance(venue_type, VenueType) else venue_type
        )
    if latitude is not None:
        market.latitude = latitude
    if longitude is not None:
        market.longitude = longitude
    if opening_time is not None:
        market.opening_time = opening_time
    if closing_time is not None:
        market.closing_time = closing_time
    if timezone is not None:
        market.timezone = hours.validate_timezone(timezone)
    await db.flush()
    return market


async def _get_agent(db: AsyncSession, user_id: uuid.UUID) -> Agent:
    result = await db.execute(select(Agent).where(Agent.user_id == user_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent record not found")
    return agent


async def get_my_agent_status(db: AsyncSession, *, user_id: uuid.UUID) -> Agent:
    return await _get_agent(db, user_id)


async def set_duty(db: AsyncSession, *, user_id: uuid.UUID, on_duty: bool) -> Agent:
    """Flip an agent between their agent view (on_duty) and customer view.

    Going off-duty is refused while the agent has a live order (assigned or
    actively shopping) - the agent-side analog of "you can't clock out
    mid-delivery". Auto-assignment (orders.assignment.find_available_agent)
    already requires on_duty, so once this succeeds the agent is out of the
    pool and can never be handed a new order - including one they place
    themselves while shopping as a customer.
    """
    agent = await _get_agent(db, user_id)
    if not on_duty:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
        if not user.has_customer_side:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Register as a customer in Settings to switch to customer mode",
            )
        from app.core.enums import OrderStatus
        from app.orders.models import Order
        result = await db.execute(
            select(Order.id).where(
                Order.agent_id == user_id,
                Order.status.in_([OrderStatus.AGENT_ASSIGNED, OrderStatus.SHOPPING]),
            ).limit(1)
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Finish or release your current order before switching to customer mode",
            )
    agent.on_duty = on_duty
    await db.flush()
    return agent
