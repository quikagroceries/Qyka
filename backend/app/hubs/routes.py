from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.security import require_role
from app.hubs.models import Hub
from app.hubs.schemas import HubOut

router = APIRouter()


@router.get("/me", response_model=HubOut)
async def my_hub(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> Hub:
    """The signed-in shopkeeper's hub."""
    hub = (await db.execute(select(Hub).where(Hub.user_id == user.id))).scalar_one_or_none()
    if hub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hub is linked to this account")
    return hub
