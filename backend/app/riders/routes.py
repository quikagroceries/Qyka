import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.security import require_role
from app.delivery import earnings
from app.delivery.schemas import EarningsOut
from app.orders.models import Order
from app.riders import service
from app.riders.schemas import DeliverIn, RiderJobOut

router = APIRouter()

_rider = require_role(UserRole.RIDER)


@router.get("/jobs", response_model=list[RiderJobOut])
async def job_pool(db: AsyncSession = Depends(get_db), user: User = Depends(_rider)) -> list[dict]:
    """Ready orders waiting for a rider, in the rider's market."""
    return await service.list_pool(db, user=user)


@router.get("/jobs/mine", response_model=list[RiderJobOut])
async def my_jobs(db: AsyncSession = Depends(get_db), user: User = Depends(_rider)) -> list[dict]:
    """The rider's claimed jobs, with address, contact and pickup code."""
    return await service.list_mine(db, user=user)


@router.post("/jobs/{order_id}/claim", response_model=RiderJobOut)
async def claim_job(
    order_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(_rider)
) -> dict:
    """Take a job from the pool. First to claim wins; one job at a time."""
    return await service.claim(db, user=user, order_id=order_id)


@router.post("/jobs/{order_id}/release", response_model=RiderJobOut)
async def release_job(
    order_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(_rider)
) -> dict:
    """Give a job back to the pool, until the goods have left the hub."""
    return await service.release(db, user=user, order_id=order_id)


@router.post("/jobs/{order_id}/deliver", response_model=RiderJobOut)
async def deliver_job(
    order_id: uuid.UUID,
    body: DeliverIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_rider),
) -> dict:
    """Confirm drop-off with the customer's PIN."""
    return await service.deliver(db, user=user, order_id=order_id, code=body.code)


@router.get("/earnings", response_model=EarningsOut)
async def my_earnings(db: AsyncSession = Depends(get_db), user: User = Depends(_rider)) -> dict:
    """What the rider has earned: counted once the customer confirms receipt."""
    await service.get_active_rider(db, user)
    return await earnings.summarize(db, where=Order.rider_id == user.id, amount_attr="rider_fee")
