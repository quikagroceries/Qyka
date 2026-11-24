from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.models import SiteContent
from app.core.database import get_db

router = APIRouter()


@router.get("")
async def public_content(response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    """Every wording the owner has changed, for the website to apply. Public
    by nature (it's the website's own text); cached for a minute."""
    rows = (await db.execute(select(SiteContent))).scalars().all()
    response.headers["Cache-Control"] = "public, max-age=60"
    return {"overrides": {r.key: r.value for r in rows}}
