"""Per-market opening hours - the backend's enforcement of when orders may
be placed (orders.service.create_order).

The server runs in UTC but hours are local market time, so "now" is always
converted into the market's own timezone before comparing - never the raw
UTC hour (8am Lagos is 7am UTC; a UTC check would block the wrong hours).
"""

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status

DEFAULT_OPENING_TIME = time(8, 0)
DEFAULT_CLOSING_TIME = time(20, 0)
DEFAULT_TIMEZONE = "Africa/Lagos"


def utc_now() -> datetime:
    """The current instant. Its own function so tests can pin the clock."""
    return datetime.now(timezone.utc)


def validate_timezone(name: str) -> str:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown timezone: {name}")
    return name


def is_open(opening: time, closing: time, tz: str, now: datetime | None = None) -> bool:
    """Whether the window [opening, closing) contains the current local time.

    Opening time is inclusive, closing time exclusive (open 08:00-20:00 means
    08:00 is open and 20:00 is closed). A window that crosses midnight
    (closing <= opening, e.g. 18:00-02:00) is handled too.
    """
    local = (now or utc_now()).astimezone(ZoneInfo(tz)).time()
    if opening < closing:
        return opening <= local < closing
    return local >= opening or local < closing


def ensure_open(market) -> None:
    """Refuse with a 409 when the market is closed right now."""
    if not is_open(market.opening_time, market.closing_time, market.timezone):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This market is closed. It opens at {market.opening_time:%H:%M}.",
        )
