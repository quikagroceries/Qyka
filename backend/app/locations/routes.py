import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
from app.locations import places, service
from app.locations.schemas import PlaceOut, PopularLocationOut, SuggestionOut, TrackLocationIn

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


# Address search costs money per call, so it needs a signed-in user and is rate limited
# per person (per server process: a cheap guard, not a billing control).
_recent: dict = defaultdict(deque)
_LIMIT, _WINDOW = 60, 60.0


def _throttle(user: User) -> None:
    now = time.monotonic()
    q = _recent[user.id]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= _LIMIT:
        raise HTTPException(429, "Too many searches. Wait a moment.")
    q.append(now)


@router.get("/search", response_model=list[SuggestionOut])
async def search_places(
    q: str = Query(..., max_length=200),
    session: str = Query(..., min_length=8, max_length=64),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """Address suggestions as the customer types."""
    _throttle(user)
    return await places.search(q, session)


@router.get("/place", response_model=PlaceOut)
async def place_details(
    place_id: str = Query(..., max_length=300),
    session: str = Query(..., min_length=8, max_length=64),
    user: User = Depends(get_current_user),
) -> dict:
    """The exact address and coordinates of a chosen suggestion."""
    _throttle(user)
    return await places.details(place_id, session)
