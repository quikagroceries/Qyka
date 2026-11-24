import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.investors.models import InvestorLink
from app.metrics import service as metrics

router = APIRouter()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _aware(ts: datetime) -> datetime:
    return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)


def link_is_live(link: InvestorLink, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if link.revoked_at is not None:
        return False
    return link.expires_at is None or _aware(link.expires_at) > now


@router.get("/{token}/overview")
async def investor_overview(
    token: str,
    response: Response,
    days: int | None = 30,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """The company overview, for whoever holds a live link. Anything wrong with
    the link - unknown, revoked, expired - is the same 404, so a guesser learns
    nothing."""
    link = (await db.execute(
        select(InvestorLink).where(InvestorLink.token_hash == hash_token(token))
    )).scalar_one_or_none()
    if link is None or not link_is_live(link):
        raise HTTPException(404, "This link isn't valid")
    # 0 means all time; anything else that isn't an offered window is 30 days.
    days = None if days == 0 else (days if days in (30, 90, 365) else 30)
    link.view_count = (link.view_count or 0) + 1
    link.last_viewed_at = datetime.now(timezone.utc)
    # Never cached or indexed: a revoked link must stop working immediately.
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return await metrics.company_overview(db, days=days, include_financials=link.include_financials)
