"""Withdrawals of earnings.

A person's balance is what they have earned (orders the customer has
confirmed received) minus every withdrawal that is held, in flight or paid.
A failed or rejected withdrawal frees its money again.

Money goes out only one way: a row is saved as PROCESSING first, THEN the
rail is called, so a crash can never send money that has no record. The
unique reference makes a retry safe, and an unclear outcome (timeout) stays
PROCESSING until the rail is asked what happened - it is never resent blindly.

Qyka absorbs the transfer fee and stamp duty: the person gets exactly the
amount they asked for.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.config import settings
from app.core.enums import OrderStatus, UserRole
from app.delivery.earnings import PAID_OUT
from app.hubs.models import Hub
from app.notifications import service as notifications
from app.orders.models import Order
from app.payments import transfers
from app.payouts import banks
from app.payouts.models import (
    FAILED, HOLDING, PAID, PENDING_REVIEW, PROCESSING, REJECTED, Payout, PayoutAccount,
)
from app.platform_settings import service as platform

ROLES = (UserRole.AGENT, UserRole.RIDER, UserRole.SHOPKEEPER)
ZERO = Decimal("0.00")


def _bad(detail: str, code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(code, detail)


async def earned(db: AsyncSession, user: User) -> Decimal:
    """Everything this person has been paid for so far (customer-confirmed orders)."""
    if user.role is UserRole.AGENT:
        where = (Order.agent_id == user.id, Order.status.in_((OrderStatus.DELIVERED, OrderStatus.CLOSED)))
        col = Order.agent_share
    elif user.role is UserRole.RIDER:
        where = (Order.rider_id == user.id, Order.status.in_(PAID_OUT))
        col = Order.rider_fee
    else:
        hub = (await db.execute(select(Hub).where(Hub.user_id == user.id))).scalar_one_or_none()
        if hub is None:
            return ZERO
        where = (Order.hub_id == hub.id, Order.status.in_(PAID_OUT))
        col = Order.hub_fee
    total = (await db.execute(
        select(func.coalesce(func.sum(col), 0)).where(*where, Order.delivered_at.is_not(None))
    )).scalar_one()
    return Decimal(total).quantize(Decimal("0.01"))


async def _sum_payouts(db: AsyncSession, user_id, statuses, since: datetime | None = None) -> Decimal:
    q = select(func.coalesce(func.sum(Payout.amount), 0)).where(
        Payout.user_id == user_id, Payout.status.in_(statuses))
    if since is not None:
        q = q.where(Payout.created_at >= since)
    return Decimal((await db.execute(q)).scalar_one()).quantize(Decimal("0.01"))


async def get_account(db: AsyncSession, user_id) -> PayoutAccount | None:
    return (await db.execute(select(PayoutAccount).where(PayoutAccount.user_id == user_id))).scalar_one_or_none()


async def summary(db: AsyncSession, user: User) -> dict:
    total = await earned(db, user)
    taken = await _sum_payouts(db, user.id, HOLDING)
    in_review = await _sum_payouts(db, user.id, (PENDING_REVIEW,))
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    sent_today = await _sum_payouts(db, user.id, HOLDING, since=day_start)
    daily_cap = Decimal(await platform.get(db, "payout_daily_cap_naira"))
    per_request = Decimal(await platform.get(db, "payout_max_per_request_naira"))
    available = max(total - taken, ZERO)
    can_now = max(min(available, per_request, daily_cap - sent_today), ZERO)
    return {
        "earned": total,
        "available": available,
        "in_review": in_review,
        "withdrawn": await _sum_payouts(db, user.id, (PAID, PROCESSING)),
        "min_withdrawal": await platform.get(db, "payout_min_naira"),
        "max_per_withdrawal": per_request,
        "daily_limit": daily_cap,
        "can_withdraw_now": can_now,
        "account": await get_account(db, user.id),
    }


async def set_account(db: AsyncSession, user: User, *, bank_code: str, account_number: str) -> PayoutAccount:
    bank_name = banks.BY_CODE.get(bank_code)
    if bank_name is None:
        raise _bad("Choose a bank from the list")
    if not (account_number.isdigit() and len(account_number) == 10):
        raise _bad("An account number has 10 digits")
    try:
        found = await transfers.resolve_account(account_number=account_number, bank_code=bank_code)
    except httpx.HTTPError:
        raise _bad("We couldn't confirm that account. Check the number and bank, then try again.")
    name = (found.get("account_name") or "").strip()
    if not name:
        raise _bad("We couldn't confirm that account. Check the number and bank, then try again.")

    acct = await get_account(db, user.id)
    if acct is None:
        acct = PayoutAccount(user_id=user.id, bank_code=bank_code, bank_name=bank_name,
                             account_number=account_number, account_name=name)
        db.add(acct)
    else:
        acct.bank_code, acct.bank_name = bank_code, bank_name
        acct.account_number, acct.account_name = account_number, name
        acct.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(acct)
    return acct


async def _dispatch(db: AsyncSession, payout: Payout) -> Payout:
    """Send a PROCESSING payout. The row is already committed."""
    try:
        res = await transfers.send_transfer(
            account_number=payout.account_number, bank_code=payout.bank_code,
            amount_naira=payout.amount, reference=payout.reference, reason="Qyka earnings payout")
        outcome = str(res.get("status", "")).lower()
    except httpx.HTTPStatusError as e:
        # The rail answered "no": nothing was sent.
        if 400 <= e.response.status_code < 500:
            outcome = "failed"
            payout.failure_reason = f"The bank rail refused it ({e.response.status_code})"
        else:
            outcome = "unknown"
    except Exception:
        outcome = "unknown"   # timeout etc.: it may have gone through. Stay PROCESSING.

    if outcome == "success":
        payout.status, payout.paid_at = PAID, datetime.now(timezone.utc)
    elif outcome in ("failed", "reversed", "abandoned"):
        payout.status = FAILED
        payout.failure_reason = payout.failure_reason or "The transfer failed"
    # anything else (pending, unknown) stays PROCESSING
    await db.commit()
    await _tell(db, payout)
    return payout


async def _tell(db: AsyncSession, p: Payout) -> None:
    msgs = {
        PAID: f"₦{p.amount:,.0f} has been sent to your {p.bank_name} account.",
        FAILED: f"Your ₦{p.amount:,.0f} withdrawal didn't go through. The money is back in your balance.",
        REJECTED: f"Your ₦{p.amount:,.0f} withdrawal wasn't approved. The money is back in your balance.",
        PENDING_REVIEW: f"Your ₦{p.amount:,.0f} withdrawal is being reviewed. We'll let you know.",
    }
    if p.status in msgs:
        await notifications.send(db, user_id=p.user_id, kind=f"payout_{p.status}", message=msgs[p.status])
        await db.commit()


async def request(db: AsyncSession, user: User, *, amount: Decimal) -> Payout:
    # One withdrawal at a time per person, so two quick taps can't spend the same money twice.
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())

    amount = Decimal(amount).quantize(Decimal("0.01"))
    acct = await get_account(db, user.id)
    if acct is None:
        raise _bad("Add the bank account you want to be paid into first")
    s = await summary(db, user)
    if amount < s["min_withdrawal"]:
        raise _bad(f"The smallest withdrawal is ₦{s['min_withdrawal']:,}")
    if amount > s["max_per_withdrawal"]:
        raise _bad(f"The most you can withdraw at once is ₦{s['max_per_withdrawal']:,.0f}")
    if amount > s["available"]:
        raise _bad("That's more than your available balance")
    if amount > s["can_withdraw_now"]:
        raise _bad(f"You've reached today's limit. You can withdraw ₦{s['can_withdraw_now']:,.0f} more today.")

    hold = None
    prior = (await db.execute(select(func.count()).select_from(Payout).where(
        Payout.user_id == user.id, Payout.status.in_((PAID, PROCESSING, PENDING_REVIEW))))).scalar_one()
    if prior == 0:
        hold = "First withdrawal"
    elif amount > Decimal(await platform.get(db, "payout_review_above_naira")):
        hold = "Large withdrawal"

    p = Payout(
        user_id=user.id, role=user.role.value, amount=amount,
        status=PENDING_REVIEW if hold else PROCESSING,
        reference=f"po_{uuid.uuid4().hex}", hold_reason=hold,
        bank_code=acct.bank_code, bank_name=acct.bank_name,
        account_number=acct.account_number, account_name=acct.account_name)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    if hold:
        await _tell(db, p)
        return p
    return await _dispatch(db, p)


async def _locked(db: AsyncSession, payout_id) -> Payout:
    p = (await db.execute(select(Payout).where(Payout.id == payout_id).with_for_update())).scalar_one_or_none()
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Withdrawal not found")
    return p


async def approve(db: AsyncSession, payout_id, *, admin_id) -> Payout:
    p = await _locked(db, payout_id)
    if p.status != PENDING_REVIEW:
        raise _bad("This withdrawal isn't waiting for review", status.HTTP_409_CONFLICT)
    p.status, p.reviewed_by = PROCESSING, admin_id
    await db.commit()
    return await _dispatch(db, p)


async def reject(db: AsyncSession, payout_id, *, admin_id, reason: str | None) -> Payout:
    p = await _locked(db, payout_id)
    if p.status != PENDING_REVIEW:
        raise _bad("This withdrawal isn't waiting for review", status.HTTP_409_CONFLICT)
    p.status, p.reviewed_by, p.failure_reason = REJECTED, admin_id, (reason or None)
    await db.commit()
    await _tell(db, p)
    return p


async def reconcile(db: AsyncSession, user_id) -> None:
    """Ask the rail about this person's withdrawals whose outcome we don't know."""
    if settings.environment != "production":
        return
    stuck = (await db.execute(select(Payout).where(
        Payout.user_id == user_id, Payout.status == PROCESSING))).scalars().all()
    for p in stuck:
        try:
            res = await transfers.verify_transfer(p.reference)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:   # the rail never saw it
                p.status, p.failure_reason = FAILED, "The transfer was never received"
                await db.commit()
                await _tell(db, p)
            continue
        except Exception:
            continue
        st = str(res.get("status", "")).lower()
        if st == "success":
            p.status, p.paid_at = PAID, datetime.now(timezone.utc)
        elif st in ("failed", "reversed", "abandoned"):
            p.status, p.failure_reason = FAILED, "The transfer failed"
        else:
            continue
        await db.commit()
        await _tell(db, p)


async def history(db: AsyncSession, user_id, limit: int = 50) -> list[Payout]:
    await reconcile(db, user_id)
    return list((await db.execute(
        select(Payout).where(Payout.user_id == user_id).order_by(Payout.created_at.desc()).limit(limit)
    )).scalars().all())
