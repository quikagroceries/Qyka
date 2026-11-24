"""Admin oversight — the read endpoints behind the (future) dashboard.

These are the numbers you need the day real orders run: how much float is
left, what's in flight, who to watch. All admin-gated.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import audit, ops
from app.platform_settings import service as platform
from app.admin import service as admin_service
from app.admin.schemas import (
    AdminCancelOrderIn,
    AdminCreateIn,
    AdminLevelIn,
    AdminLoginIn,
    AdminPasswordChangeIn,
    DeliveryFeesIn,
    HubCreateIn,
    HubStageIn,
    HubUpdateIn,
    MoveMarketIn,
    NoteIn,
    ReassignAgentIn,
    ShopkeeperReplaceIn,
    UserEditIn,
    SettingValueIn,
    RaiseCapIn,
    RiderStatusIn,
    VendorTransferAckIn,
    WalletAdjustIn,
)
from app.admin.guards import AuditedRoute, require_admin
from app.auth.models import User
from app.auth.schemas import TokenOut
from app.core.database import get_db
from app.core.enums import OrderStatus, UserRole, UserStatus
from app.core.security import create_access_token, get_current_user, require_role
from app.float import service as float_service
from app.orders import fee_settings, fees as order_fees
from app.markets.models import Market
from app.float.models import FloatLedger
from app.orders.models import Order

router = APIRouter(route_class=AuditedRoute)


@router.post("/login", response_model=TokenOut)
async def admin_login(
    body: AdminLoginIn, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenOut:
    """Admin sign-in — email+password only, never phone/OTP like every other
    role (see admin.service.authenticate_admin). Sign-ins, and failed
    attempts against a real admin account, go in the audit log."""
    email = body.email.strip().lower()
    try:
        user = await admin_service.authenticate_admin(db, email=body.email, password=body.password)
    except HTTPException:
        # Only for an email that really is an admin - so strangers guessing
        # addresses can't fill the log. Committed here because the request
        # is about to fail and roll back.
        known = (await db.execute(
            select(User).where(User.email == email, User.role == UserRole.ADMIN)
        )).scalar_one_or_none()
        if known is not None:
            await audit.record(db, admin=None, email=email, action="admin.login_failed", request=request)
            await db.commit()
        raise
    await audit.record(db, admin=user, action="admin.login", request=request)
    token = create_access_token(user.id, user.role)
    return TokenOut(access_token=token)


@router.post("/me/password", status_code=204)
async def change_my_password(
    body: AdminPasswordChangeIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Set your own password. get_current_user, not require_role: this is
    the one admin endpoint an admin still on a temporary password can use."""
    await admin_service.change_admin_password(
        db, user=user, current_password=body.current_password, new_password=body.new_password
    )
    await audit.record(db, admin=user, action="admin.password_change", request=request)


@router.get("/admins")
async def list_admins(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> list[dict]:
    return await admin_service.list_admins(db)


@router.post("/admins", status_code=201)
async def create_admin(
    body: AdminCreateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("admins.create", owner_only=True)),
) -> dict:
    """Add an admin on a temporary password - share it with them privately;
    they must replace it at first sign-in."""
    return await admin_service.create_admin(
        db, email=body.email, full_name=body.full_name,
        temporary_password=body.temporary_password, level=body.level,
    )


@router.patch("/admins/{user_id}")
async def set_admin_level(
    user_id: uuid.UUID,
    body: AdminLevelIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("admins.set_level", owner_only=True)),
) -> dict:
    """Change an admin between owner and support."""
    return await admin_service.set_admin_level(db, user_id=user_id, level=body.level, actor=admin)


@router.delete("/admins/{user_id}", status_code=204)
async def remove_admin(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("admins.remove", owner_only=True)),
) -> None:
    await admin_service.remove_admin(db, user_id=user_id, actor=admin)

# Statuses that mean an order is still "in flight" (not finished/dead).
_ACTIVE = [
    OrderStatus.DRAFT, OrderStatus.AGENT_ASSIGNED, OrderStatus.SHOPPING,
    OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID, OrderStatus.DROPPED_AT_HUB,
    OrderStatus.RECEIVED_BY_HUB, OrderStatus.READY_FOR_PICKUP, OrderStatus.PACKED,
    OrderStatus.OUT_FOR_DELIVERY,
]


@router.get("/float")
async def float_status(
    market_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Working capital left in a market's pool (or the global pool if omitted).

    If this runs low, no agent can shop in that market — the health metric.
    """
    balance = await float_service.get_pool_balance(db, market_id)
    stmt = select(FloatLedger).order_by(FloatLedger.created_at.desc()).limit(20)
    # Same market_id=None-means-legacy/global-pool semantics as
    # get_pool_balance - without this filter, recent_movements silently
    # showed the last 20 movements across EVERY market regardless of which
    # pool's balance was requested.
    stmt = stmt.where(FloatLedger.market_id.is_(None)) if market_id is None else stmt.where(FloatLedger.market_id == market_id)
    result = await db.execute(stmt)
    recent = [
        {
            "direction": e.direction.value,
            "amount": str(e.amount),
            "balance_after": str(e.balance_after),
            "note": e.note,
            "at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in result.scalars().all()
    ]
    return {"pool_balance": str(balance), "recent_movements": recent}


def _is_stuck(o: Order, now, limits: dict) -> bool:
    """Has this order sat in its current stage longer than the owner allows?
    (Thresholds are platform settings, so they're tuned without a developer.)"""
    def aware(ts):
        return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)

    if o.status is OrderStatus.AWAITING_PAYMENT and o.payment_window_expires_at:
        return aware(o.payment_window_expires_at) < now
    stage_limit = {
        OrderStatus.PAID: limits["stuck_paid_minutes"],
        OrderStatus.DROPPED_AT_HUB: limits["stuck_dropped_minutes"],
        OrderStatus.RECEIVED_BY_HUB: limits["stuck_received_minutes"],
        OrderStatus.READY_FOR_PICKUP: limits["stuck_ready_minutes"],
        OrderStatus.OUT_FOR_DELIVERY: limits["stuck_delivery_minutes"],
    }.get(o.status)
    started = _stage_started(o)
    if stage_limit is not None and started is not None:
        return (now - aware(started)).total_seconds() > stage_limit * 60
    return (now - aware(o.created_at)).total_seconds() > limits["stuck_after_hours"] * 3600


def _stage_started(o: Order):
    return {
        OrderStatus.PAID: o.paid_at,
        OrderStatus.DROPPED_AT_HUB: o.dropped_at_hub_at,
        OrderStatus.RECEIVED_BY_HUB: o.hub_received_at,
        # A claim restarts the clock: the order is no longer waiting for a rider.
        OrderStatus.READY_FOR_PICKUP: o.rider_claimed_at or o.packed_at,
        OrderStatus.OUT_FOR_DELIVERY: o.dispatched_at,
    }.get(o.status)


def _stage_started_at(o: Order) -> str | None:
    ts = _stage_started(o)
    return ts.isoformat() if ts else None


@router.get("/orders/in-flight")
async def in_flight_orders(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Every order not yet closed/cancelled, so you can spot what's stuck.

    Includes unassigned orders (no agent free at creation) — these need your
    attention: assign an agent manually or recruit more for that market.
    """
    result = await db.execute(
        select(Order).where(Order.status.in_(_ACTIVE)).order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    now = datetime.now(timezone.utc)
    limits = await platform.all_values(db)
    rows = [
        {
            "id": str(o.id),
            "stuck": _is_stuck(o, now, limits),
            "status": o.status.value,
            "agent_assigned": o.agent_id is not None,
            "agent_id": str(o.agent_id) if o.agent_id else None,
            "customer_id": str(o.customer_id),
            "market_id": str(o.market_id),
            "grand_total": str(o.grand_total),
            "payment_window_expires_at": o.payment_window_expires_at.isoformat() if o.payment_window_expires_at else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "hub_id": str(o.hub_id) if o.hub_id else None,
            "rider_id": str(o.rider_id) if o.rider_id else None,
            # When it reached its CURRENT stage - what "stuck" is measured
            # from at the hub (a 3-hour-old order that reached the hub a
            # minute ago isn't stuck).
            "stage_started_at": _stage_started_at(o),
        }
        for o in orders
    ]
    unassigned = sum(1 for o in orders if o.agent_id is None)
    return {
        "count": len(rows), "unassigned": unassigned,
        "stuck": sum(1 for r in rows if r["stuck"]), "orders": rows,
    }


@router.get("/orders/losses")
async def order_losses(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Orders where the balance payment window lapsed after the agent had
    already spent real money at the market - the deposit is forfeited (see
    payments.service.expire_stale_orders), which is a recorded company loss,
    not a refund. This is that loss list: what was lost, and on which order/
    market/agent, so it can be tracked and followed up on.
    """
    result = await db.execute(
        select(Order)
        .where(Order.status == OrderStatus.CANCELLED_UNPAID)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    rows = [
        {
            "id": str(o.id),
            "customer_id": str(o.customer_id),
            "agent_id": str(o.agent_id) if o.agent_id else None,
            "market_id": str(o.market_id),
            "deposit_forfeited": str(o.deposit_amount),
            "grand_total": str(o.grand_total),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders
    ]
    total_forfeited = sum((o.deposit_amount for o in orders), start=Decimal("0.00"))
    return {"count": len(rows), "total_deposit_forfeited": str(total_forfeited), "orders": rows}


@router.get("/users")
async def list_users(
    q: str | None = None,
    role: UserRole | None = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Every registered account, newest first - however they signed up (phone,
    email or Google). `q` matches name, email or phone; `role` narrows to one
    kind of account."""
    limit = max(1, min(limit, 200))
    filters = []
    if role is not None:
        filters.append(User.role == role)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        filters.append(
            or_(
                func.lower(func.coalesce(User.full_name, "")).like(like),
                func.lower(func.coalesce(User.email, "")).like(like),
                func.lower(func.coalesce(User.phone, "")).like(like),
            )
        )
    total = (await db.execute(select(func.count()).select_from(User).where(*filters))).scalar_one()
    by_role = {
        r.value: n
        for r, n in (await db.execute(select(User.role, func.count()).group_by(User.role))).all()
    }
    result = await db.execute(
        select(User).where(*filters).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    users = [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role.value,
            "status": u.status.value,
            "is_email_verified": u.is_email_verified,
            "is_phone_verified": u.is_phone_verified,
            "non_payment_count": u.non_payment_count,
            "must_prepay": u.must_prepay,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in result.scalars().all()
    ]
    return {"total": total, "by_role": by_role, "users": users}


@router.get("/users/flagged")
async def flagged_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Customers with non-payment history or a flagged/locked status."""
    result = await db.execute(
        select(User).where(
            (User.non_payment_count > 0)
            | (User.status.in_([UserStatus.FLAGGED, UserStatus.LOCKED]))
        )
    )
    rows = [
        {
            "id": str(u.id),
            "phone": u.phone,
            "full_name": u.full_name,
            "status": u.status.value,
            "non_payment_count": u.non_payment_count,
            "must_prepay": u.must_prepay,
            "basket_cap_kobo": u.basket_cap_kobo,
        }
        for u in result.scalars().all()
    ]
    return {"count": len(rows), "users": rows}


@router.post("/users/{user_id}/clear-flag")
async def clear_user_flag(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("user.clear_flag")),
) -> dict:
    """Admin pardon - resets must_prepay/non_payment_count/FLAGGED-LOCKED
    status back to normal in one action. See admin.service.clear_user_flag."""
    user = await admin_service.clear_user_flag(db, user_id=user_id)
    return {
        "id": str(user.id),
        "status": user.status.value,
        "must_prepay": user.must_prepay,
        "non_payment_count": user.non_payment_count,
    }


@router.get("/users/{user_id}")
async def user_detail(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """One user's full picture for a support case: profile, wallet balance and
    recent ledger, and recent orders (as customer or agent) - everything
    without a database query. See admin.service.get_user_detail."""
    return await admin_service.get_user_detail(db, user_id=user_id)


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("user.suspend")),
) -> dict:
    """Soft-delete a user: blocks sign-in and every API call immediately, but
    keeps their orders/wallet/payment history intact and is reversible."""
    user = await admin_service.suspend_user(db, user_id=user_id, admin_id=admin.id)
    return {"id": str(user.id), "status": user.status.value}


@router.post("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("user.reactivate")),
) -> dict:
    user = await admin_service.reactivate_user(db, user_id=user_id)
    return {"id": str(user.id), "status": user.status.value}


@router.post("/users/{user_id}/wallet/adjust")
async def adjust_wallet(
    user_id: uuid.UUID,
    body: WalletAdjustIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("user.wallet_adjust", owner_only=True)),
) -> dict:
    """Manually credit or debit a customer's wallet for a support case, with a
    mandatory note. Writes a normal WalletLedger row, same as any other
    credit/debit - it's never a silent balance change."""
    wallet = await admin_service.adjust_wallet(
        db, user_id=user_id, direction=body.direction, amount=body.amount, note=body.note
    )
    return {"user_id": str(user_id), "balance": str(wallet.balance)}


@router.get("/vendor-transfers")
async def vendor_transfers(
    only_failed: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Every JIT vendor payout attempt, newest first (optionally failed-only) -
    visibility that previously only existed by querying the database directly."""
    return await admin_service.list_vendor_transfers(db, only_failed=only_failed)


@router.post("/vendor-transfers/{transfer_id}/acknowledge")
async def acknowledge_vendor_transfer(
    transfer_id: uuid.UUID,
    body: VendorTransferAckIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("vendor_transfer.acknowledge", owner_only=True)),
) -> dict:
    """Record how a failed vendor payout was resolved. See
    admin.service.acknowledge_vendor_transfer for why this doesn't itself
    re-send the money."""
    transfer = await admin_service.acknowledge_vendor_transfer(
        db, transfer_id=transfer_id, note=body.note
    )
    return {"id": str(transfer.id), "status": transfer.status.value}


@router.post("/orders/{order_id}/authorization/raise")
async def admin_raise_cap(
    order_id: uuid.UUID,
    body: RaiseCapIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("order.raise_cap", owner_only=True)),
) -> dict:
    """Admin-side mirror of the customer's own cap-raise (jit/routes.py) - for
    when they've approved an overage by phone or chat instead of in-app."""
    auth = await admin_service.admin_raise_cap(db, order_id=order_id, extra=body.extra)
    return {"order_id": str(order_id), "cap": str(auth.cap), "spent": str(auth.spent)}


@router.post("/orders/{order_id}/cancel")
async def admin_cancel_order(
    order_id: uuid.UUID,
    body: AdminCancelOrderIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("order.cancel", owner_only=True)),
) -> dict:
    """Cancel a stuck or disputed order from any state up to (not including)
    DELIVERED, refunding a specific admin-entered amount to the customer's
    wallet. See admin.service.admin_cancel_order for why the amount isn't
    computed automatically."""
    order = await admin_service.admin_cancel_order(
        db, order_id=order_id, refund_amount=body.refund_amount, note=body.note
    )
    return {"id": str(order.id), "status": order.status.value}


@router.get("/agents")
async def list_agents(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> list[dict]:
    """Every agent, market + availability + lifetime earnings - the roster
    behind the Agents admin screen."""
    return await admin_service.list_agents(db)


@router.get("/riders")
async def list_riders(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> list[dict]:
    """Approved riders - area, vehicle, status - behind the Riders screen.
    Pending rider applications come from GET /agent-applications?kind=rider."""
    return await admin_service.list_riders(db)


@router.patch("/riders/{rider_id}")
async def set_rider_status(
    rider_id: uuid.UUID,
    body: RiderStatusIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("rider.set_status")),
) -> dict:
    """Suspend or reactivate a rider."""
    return await admin_service.set_rider_status(db, rider_id=rider_id, status_=body.status)


@router.get("/analytics")
async def analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """Order volume/revenue over the last `days`, lifetime agent/market
    activity, and completion/cancellation/non-payment rates - computed only
    from data actually recorded (see admin.service.get_analytics)."""
    return await admin_service.get_analytics(db, days=days)


def _fees_out(rider_fee, hub_fee, delivery_fee, *, market_id=None, market_name=None) -> dict:
    # delivery_margin: what the customer's flat delivery fee leaves after the
    # two payouts. Negative = the company tops it up on every order.
    return {
        "market_id": str(market_id) if market_id else None,
        "market_name": market_name,
        "rider_fee": str(rider_fee),
        "hub_fee": str(hub_fee),
        "delivery_margin": str(delivery_fee - rider_fee - hub_fee),
    }


@router.get("/fees")
async def get_delivery_fees(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> dict:
    """The global rider/hub pay plus every per-market override. Orders copy
    the figures when they are created, so changes only affect new orders."""
    delivery_fee = (await platform.pricing(db)).delivery_fee
    default = await fee_settings.get_global(db)
    rider, hub = (
        (default.rider_fee, default.hub_fee) if default
        else (order_fees.DEFAULT_RIDER_FEE, order_fees.DEFAULT_HUB_FEE)
    )
    rows = (await db.execute(
        select(fee_settings.FeeSetting, Market)
        .join(Market, Market.id == fee_settings.FeeSetting.market_id)
        .order_by(Market.name)
    )).all()
    return {
        "delivery_fee": str(delivery_fee),
        "default": {**_fees_out(rider, hub, delivery_fee), "is_built_in": default is None},
        "markets": [
            _fees_out(s.rider_fee, s.hub_fee, delivery_fee, market_id=m.id, market_name=m.name)
            for s, m in rows
        ],
    }


@router.put("/fees")
async def set_default_delivery_fees(
    body: DeliveryFeesIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("fees.set_default", owner_only=True)),
) -> dict:
    """Set the global rider/hub pay (applies to new orders in every market
    without its own override)."""
    row = await fee_settings.upsert(
        db, market_id=None, rider_fee=body.rider_fee, hub_fee=body.hub_fee, admin_id=admin.id
    )
    return _fees_out(row.rider_fee, row.hub_fee, (await platform.pricing(db)).delivery_fee)


@router.put("/fees/markets/{market_id}")
async def set_market_delivery_fees(
    market_id: uuid.UUID,
    body: DeliveryFeesIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("fees.set_market", owner_only=True)),
) -> dict:
    """Override the rider/hub pay for one market."""
    market = (await db.execute(select(Market).where(Market.id == market_id))).scalar_one_or_none()
    if market is None:
        raise HTTPException(404, "Market not found")
    row = await fee_settings.upsert(
        db, market_id=market_id, rider_fee=body.rider_fee, hub_fee=body.hub_fee, admin_id=admin.id
    )
    return _fees_out(
        row.rider_fee, row.hub_fee, (await platform.pricing(db)).delivery_fee,
        market_id=market.id, market_name=market.name,
    )


@router.delete("/fees/markets/{market_id}", status_code=204)
async def clear_market_delivery_fees(
    market_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("fees.clear_market", owner_only=True)),
) -> None:
    """Drop a market's override so it follows the global default again."""
    row = (await db.execute(
        select(fee_settings.FeeSetting).where(fee_settings.FeeSetting.market_id == market_id)
    )).scalar_one_or_none()
    if row is not None:
        await db.delete(row)


@router.get("/hubs")
async def list_hubs(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin()),
) -> list[dict]:
    """Every hub: market, shopkeeper, active flag, and orders sitting in it.
    Pending shopkeeper applications come from GET /agent-applications?kind=shopkeeper."""
    return await admin_service.list_hubs(db)


@router.patch("/hubs/{hub_id}")
async def update_hub(
    hub_id: uuid.UUID,
    body: HubUpdateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("hub.update")),
) -> dict:
    """Rename a hub or switch it off/on (off = no NEW drop-offs)."""
    await admin_service.update_hub(db, hub_id=hub_id, name=body.name, is_active=body.is_active)
    return next(h for h in await admin_service.list_hubs(db) if h["id"] == str(hub_id))


@router.post("/orders/{order_id}/release-rider")
async def release_rider(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("order.release_rider")),
) -> dict:
    """Return an order a rider claimed but never collected to the pool."""
    order = await admin_service.release_rider(db, order_id=order_id)
    return {"id": str(order.id), "status": order.status.value, "rider_id": None}


@router.post("/riders/{rider_id}/link-account")
async def link_rider_account(
    rider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("rider.link_account")),
) -> dict:
    """Give a rider approved before rider logins existed a login."""
    return await admin_service.link_rider_account(db, rider_id=rider_id)


@router.get("/audit")
async def audit_log(
    admin_id: uuid.UUID | None = None,
    action: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin(owner_only=True)),
) -> dict:
    """Every state-changing admin action, newest first. `action` matches a
    whole name ("user.suspend") or a group ("user." / "fees.")."""
    limit = max(1, min(limit, 500))
    stmt = select(audit.AdminAuditLog)
    if admin_id is not None:
        stmt = stmt.where(audit.AdminAuditLog.admin_id == admin_id)
    if action:
        stmt = stmt.where(
            audit.AdminAuditLog.action.like(action + "%") if action.endswith(".") else audit.AdminAuditLog.action == action
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(
        stmt.order_by(audit.AdminAuditLog.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return {
        "total": total,
        "entries": [
            {
                "id": str(r.id),
                "admin_id": str(r.admin_id) if r.admin_id else None,
                "admin_email": r.admin_email,
                "admin_level": r.admin_level,
                "action": r.action,
                "target": r.target,
                "detail": r.detail,
                "ip": r.ip,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/platform-settings")
async def get_platform_settings(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin(owner_only=True)),
) -> list[dict]:
    """Every business rule an owner can change, with its current value, its
    built-in default, and whether a change applies to new orders only or
    straight away."""
    return await platform.describe(db)


@router.put("/platform-settings/{key}")
async def set_platform_setting(
    key: str,
    body: SettingValueIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("settings.update", owner_only=True)),
) -> list[dict]:
    old, new = await platform.set_value(db, key=key, raw=body.value, admin_id=admin.id)
    audit.note(request, key=key, old=str(old), new=str(new))
    return [s for s in await platform.describe(db) if s["key"] == key]


@router.delete("/platform-settings/{key}", status_code=204)
async def reset_platform_setting(
    key: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("settings.reset", owner_only=True)),
) -> None:
    """Put a setting back to its built-in default."""
    old, new = await platform.reset(db, key=key)
    audit.note(request, key=key, old=str(old), new=str(new))


@router.get("/system")
async def system_status(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin(owner_only=True)),
) -> dict:
    """Is everything the app depends on actually switched on? Booleans and
    short notes only - never a key or secret."""
    from sqlalchemy import text

    from app.core.config import settings as cfg

    def check(key, label, ok, detail, *, off_ok=False):
        return {"key": key, "label": label, "status": "ok" if ok else ("off" if off_ok else "warn"), "detail": detail}

    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001 - reporting, not handling
        db_ok = False
    try:
        migration = (await db.execute(text("SELECT version_num FROM alembic_version"))).scalar_one_or_none()
    except Exception:  # noqa: BLE001 - e.g. SQLite in tests: no alembic table
        migration = None

    live_payments = cfg.paystack_secret_key.startswith("sk_live")
    checks = [
        check("database", "Database", db_ok, "Reachable" if db_ok else "Can't reach the database"),
        check("payments", "Payments (Paystack)", bool(cfg.paystack_secret_key),
              ("Live keys" if live_payments else "TEST keys - no real money moves") if cfg.paystack_secret_key else "No key set - payments won't work"),
        check("sms", "SMS codes", bool(cfg.sms_api_key), "Configured" if cfg.sms_api_key else "No key - sign-in codes aren't sent by SMS", off_ok=True),
        check("whatsapp", "WhatsApp codes", bool(cfg.whatsapp_api_key), "Configured" if cfg.whatsapp_api_key else "No key", off_ok=True),
        check("email", "Email", bool(cfg.email_api_key) and "resend.dev" not in cfg.email_from,
              "Sending from your own domain" if cfg.email_api_key and "resend.dev" not in cfg.email_from
              else ("Using the shared test sender" if cfg.email_api_key else "No key - emails aren't sent"), off_ok=not cfg.email_api_key),
        check("google", "Google sign-in", bool(cfg.google_client_id), "Configured" if cfg.google_client_id else "Not set up", off_ok=True),
        check("photos", "Photo uploads (Cloudinary)", bool(cfg.cloudinary_cloud_name), cfg.cloudinary_cloud_name or "Not set"),
        check("calls", "In-app calls (LiveKit)", bool(cfg.livekit_url and cfg.livekit_api_key and cfg.livekit_api_secret),
              "Configured" if cfg.livekit_url else "Not set up", off_ok=True),
        check("jwt", "Session signing secret", cfg.jwt_secret != "change-me-in-production" and len(cfg.jwt_secret) >= 32,
              "Strong, custom secret" if cfg.jwt_secret != "change-me-in-production" else "Still the default - change it before launch"),
    ]
    return {
        "environment": cfg.environment,
        "migration": migration,
        "allowed_origins": cfg.allowed_origins_list,
        "checks": checks,
    }


# --- Hubs: shopkeepers are only ever created here -------------------------

@router.post("/hubs", status_code=201)
async def create_hub(
    body: HubCreateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("hub.create", owner_only=True)),
) -> dict:
    """Set up a hub and its shopkeeper in one step. The shopkeeper signs in
    with a code sent to this phone number - there's no public application,
    because a hub holds other people's goods."""
    hub = await ops.create_hub(
        db, full_name=body.full_name, phone=body.phone, market_id=body.market_id, hub_name=body.hub_name
    )
    return next(h for h in await admin_service.list_hubs(db) if h["id"] == str(hub.id))


@router.post("/hubs/{hub_id}/replace-shopkeeper")
async def replace_shopkeeper(
    hub_id: uuid.UUID,
    body: ShopkeeperReplaceIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("hub.replace_shopkeeper", owner_only=True)),
) -> dict:
    """Hand a hub to a different shopkeeper (only while nothing is in it)."""
    await ops.replace_shopkeeper(db, hub_id=hub_id, full_name=body.full_name, phone=body.phone)
    return next(h for h in await admin_service.list_hubs(db) if h["id"] == str(hub_id))


# --- Orders: step in when something has gone wrong -------------------------

@router.post("/orders/{order_id}/reassign-agent")
async def reassign_agent(
    order_id: uuid.UUID,
    body: ReassignAgentIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("order.reassign_agent")),
) -> dict:
    """Swap the agent on an order before or during shopping."""
    order = await ops.reassign_agent(db, order_id=order_id, agent_user_id=body.agent_id, note=body.note)
    audit.note(request, note=body.note, agent_id=str(body.agent_id))
    return {"id": str(order.id), "status": order.status.value, "agent_id": str(order.agent_id)}


@router.post("/orders/{order_id}/set-hub-stage")
async def set_hub_stage(
    order_id: uuid.UUID,
    body: HubStageIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("order.set_hub_stage", owner_only=True)),
) -> dict:
    """Correct where an order is in the hub's custody chain (dropped, checked
    in, ready) - for a wrong tap. Not allowed once a rider has it."""
    order = await ops.set_hub_stage(db, order_id=order_id, stage=body.stage, note=body.note)
    audit.note(request, note=body.note, stage=body.stage.value)
    return {"id": str(order.id), "status": order.status.value}


@router.post("/orders/{order_id}/confirm-delivery")
async def admin_confirm_delivery(
    order_id: uuid.UUID,
    body: NoteIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("order.confirm_delivery", owner_only=True)),
) -> dict:
    """Confirm receipt on the customer's behalf and release the payouts."""
    split = await ops.confirm_delivery_for_customer(db, order_id=order_id, note=body.note)
    audit.note(request, note=body.note)
    return split


# --- People ------------------------------------------------------------

@router.post("/agents/{user_id}/move-market")
async def move_agent_market(
    user_id: uuid.UUID,
    body: MoveMarketIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("agent.move_market")),
) -> dict:
    """Assign an agent to a different market (only with nothing in progress)."""
    agent = await ops.move_agent_market(db, user_id=user_id, market_id=body.market_id)
    return {"user_id": str(agent.user_id), "market_id": str(agent.assigned_market_id)}


@router.post("/users/{user_id}/end-role")
async def end_staff_role(
    user_id: uuid.UUID,
    body: NoteIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("user.end_role", owner_only=True)),
) -> dict:
    """Take an agent, rider or shopkeeper out of their job. They become an
    ordinary customer again; nothing of theirs is deleted."""
    user = await ops.end_staff_role(db, user_id=user_id, note=body.note)
    audit.note(request, note=body.note)
    return {"id": str(user.id), "role": user.role.value}


@router.patch("/users/{user_id}")
async def edit_user(
    user_id: uuid.UUID,
    body: UserEditIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin("user.edit", owner_only=True)),
) -> dict:
    """Correct someone's name, phone, email or spending cap."""
    changed = body.model_dump(exclude_none=True)
    user = await ops.edit_user(
        db, user_id=user_id, full_name=body.full_name, phone=body.phone,
        email=body.email, basket_cap_naira=body.basket_cap_naira,
    )
    audit.note(request, fields=sorted(changed))
    return {
        "id": str(user.id), "full_name": user.full_name, "phone": user.phone,
        "email": user.email, "basket_cap_kobo": user.basket_cap_kobo,
    }
