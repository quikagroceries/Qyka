import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
import uuid

from sqlalchemy import select

from app.locations import delivery, places, service
from app.markets.models import Market
from app.locations.schemas import DeliveryQuoteOut, PlaceOut, PopularLocationOut, SuggestionOut, TrackLocationIn

router = APIRouter()


@router.post("/track", status_code=204)
async def track_location(
    body: TrackLocationIn,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> None:
    """Log a location pick - guests included, so "popular areas" reflects
    everyone browsing, not just signed-in users."""
    await service.record_location_search(
        db,
        user_id=user.id if user else None,
        label=body.label,
        latitude=body.latitude,
        longitude=body.longitude,
    )


@router.get("/popular", response_model=list[PopularLocationOut])
async def popular_locations(db: AsyncSession = Depends(get_db)) -> list[dict]:
    return await service.get_popular_locations(db)


# Address search costs money per call and guests use it too, so it is rate limited per person
# (signed in) or per address (guest). Per server process: a cheap guard, not a billing control.
_recent: dict = defaultdict(deque)
_LIMIT, _WINDOW = 60, 60.0


def _throttle(request: Request, user: User | None) -> None:
    key = str(user.id) if user else f"ip:{request.client.host if request.client else '?'}"
    now = time.monotonic()
    q = _recent[key]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= _LIMIT:
        raise HTTPException(429, "Too many searches. Wait a moment.")
    q.append(now)


@router.get("/search", response_model=list[SuggestionOut])
async def search_places(
    request: Request,
    q: str = Query(..., max_length=200),
    session: str = Query(..., min_length=8, max_length=64),
    user: User | None = Depends(get_current_user_optional),
) -> list[dict]:
    """Address suggestions as the customer types. Open to guests."""
    _throttle(request, user)
    return await places.search(q, session)


@router.get("/place", response_model=PlaceOut)
async def place_details(
    request: Request,
    place_id: str = Query(..., max_length=300),
    session: str = Query(..., min_length=8, max_length=64),
    user: User | None = Depends(get_current_user_optional),
) -> dict:
    """The exact address and coordinates of a chosen suggestion."""
    _throttle(request, user)
    return await places.details(place_id, session)


@router.get("/delivery-quote", response_model=DeliveryQuoteOut)
async def delivery_quote(
    market_id: uuid.UUID,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Whether we deliver from this market to a pin, and the delivery fee for that distance."""
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(404, "Market not found")
    return await delivery.quote(db, market, lat, lng)
