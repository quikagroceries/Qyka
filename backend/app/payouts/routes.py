import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.guards import AuditedRoute, require_admin
from app.auth.models import User
from app.core.database import get_db
from app.core.security import require_role
from app.payouts import banks, service
from app.payouts.models import PENDING_REVIEW, Payout
from app.payouts.schemas import (
    AccountIn, AccountOut, AdminPayoutOut, BankOut, PayoutOut, RejectIn, SummaryOut, WithdrawIn,
)

earner = require_role(*service.ROLES)

# What agents, riders and shopkeepers use to take their earnings out.
router = APIRouter()


@router.get("/banks", response_model=list[BankOut])
async def list_banks(_: User = Depends(earner)) -> list[dict]:
    return [{"code": c, "name": n} for c, n in banks.BANKS]


@router.get("/summary", response_model=SummaryOut)
async def my_summary(db: AsyncSession = Depends(get_db), user: User = Depends(earner)) -> dict:
    return await service.summary(db, user)


@router.put("/account", response_model=AccountOut)
async def save_account(body: AccountIn, db: AsyncSession = Depends(get_db), user: User = Depends(earner)):
    return await service.set_account(db, user, bank_code=body.bank_code, account_number=body.account_number)


@router.post("", response_model=PayoutOut)
async def withdraw(body: WithdrawIn, db: AsyncSession = Depends(get_db), user: User = Depends(earner)):
    return await service.request(db, user, amount=body.amount)


@router.get("", response_model=list[PayoutOut])
async def my_payouts(db: AsyncSession = Depends(get_db), user: User = Depends(earner)):
    return await service.history(db, user.id)


# Admin review of held withdrawals.
admin_router = APIRouter(route_class=AuditedRoute)


@admin_router.get("", response_model=list[AdminPayoutOut])
async def review_queue(
    status: str = PENDING_REVIEW,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin()),
):
    return list((await db.execute(
        select(Payout).where(Payout.status == status).order_by(Payout.created_at).limit(200)
    )).scalars().all())


@admin_router.post("/{payout_id}/approve", response_model=AdminPayoutOut)
async def approve(payout_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                  admin: User = Depends(require_admin("payout.approve"))):
    return await service.approve(db, payout_id, admin_id=admin.id)


@admin_router.post("/{payout_id}/reject", response_model=AdminPayoutOut)
async def reject(payout_id: uuid.UUID, body: RejectIn, db: AsyncSession = Depends(get_db),
                 admin: User = Depends(require_admin("payout.reject"))):
    return await service.reject(db, payout_id, admin_id=admin.id, reason=body.reason)
