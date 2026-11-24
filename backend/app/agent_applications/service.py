import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import service as admin_service
from app.agent_applications.models import AgentApplication
from app.auth.models import User
from app.core.config import settings
from app.platform_settings import service as platform
from app.core.enums import ApplicationKind, ApplicationStatus, UserRole, UserStatus
from app.core.phone import normalize_phone
from app.hubs.models import Hub
from app.markets.models import Market
from app.riders.models import Rider


async def _require_market(db: AsyncSession, market_id: uuid.UUID) -> None:
    market_result = await db.execute(select(Market).where(Market.id == market_id))
    if market_result.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found")


async def apply(
    db: AsyncSession, *, user: User, market_id: uuid.UUID, note: str | None
) -> AgentApplication:
    """In-app agent application from a signed-in customer's Settings."""
    if user.role is not UserRole.CUSTOMER:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only customers can apply to become an agent"
        )
    await _require_market(db, market_id)

    existing = await db.execute(
        select(AgentApplication).where(
            AgentApplication.user_id == user.id,
            AgentApplication.kind == ApplicationKind.AGENT,
            AgentApplication.status == ApplicationStatus.PENDING,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You already have a pending application"
        )

    application = AgentApplication(
        kind=ApplicationKind.AGENT,
        user_id=user.id,
        full_name=user.full_name,
        phone=user.phone,
        market_id=market_id,
        note=note,
    )
    db.add(application)
    await db.flush()
    return application


# The login role each kind of approved applicant ends up with.
_ROLE_FOR_KIND = {
    ApplicationKind.AGENT: UserRole.AGENT,
    ApplicationKind.RIDER: UserRole.RIDER,
    ApplicationKind.SHOPKEEPER: UserRole.SHOPKEEPER,
}
_ROLE_LABEL = {
    ApplicationKind.AGENT: "an agent",
    ApplicationKind.RIDER: "a rider",
    ApplicationKind.SHOPKEEPER: "a shopkeeper",
}

# E.164-ish after normalize_phone: "+" then 10-15 digits.
_PHONE_RE = re.compile(r"\+\d{10,15}")


def _clean(value: str | None) -> str | None:
    return (value or "").strip() or None


async def apply_public(
    db: AsyncSession,
    *,
    kind: ApplicationKind,
    full_name: str,
    phone: str,
    market_id: uuid.UUID | None,
    area: str | None,
    vehicle: str | None,
    note: str | None,
) -> AgentApplication:
    """Application from the public For Agents / For Riders pages - anyone,
    no account. Keyed on the (normalized) phone: that's who approval turns
    into an agent, and who the admin calls."""
    if kind is ApplicationKind.SHOPKEEPER:
        # Hubs hold other people's goods, so shopkeepers are set up by an
        # admin (Admin > Hubs > Add a hub), never by applying.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Hubs are set up by Qyka - get in touch and we'll arrange one",
        )
    phone = normalize_phone(phone)
    if not _PHONE_RE.fullmatch(phone):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid phone number")
    full_name = full_name.strip()
    area = _clean(area)
    if kind in (ApplicationKind.AGENT, ApplicationKind.SHOPKEEPER):
        if market_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Pick the market you'd shop in"
                if kind is ApplicationKind.AGENT
                else "Pick the market your hub is in",
            )
        await _require_market(db, market_id)
    elif market_id is None and area is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tell us the area you'd cover")
    elif market_id is not None:
        await _require_market(db, market_id)

    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    if user is not None and user.role is UserRole.ADMIN:
        raise HTTPException(status.HTTP_409_CONFLICT, "This number can't be used to apply")
    if user is not None and user.role is _ROLE_FOR_KIND[kind]:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"This number is already {_ROLE_LABEL[kind]}"
        )
    if kind is ApplicationKind.RIDER:
        rider = (await db.execute(select(Rider).where(Rider.phone == phone))).scalar_one_or_none()
        if rider is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "This number is already a rider")

    pending = await db.execute(
        select(AgentApplication).where(
            AgentApplication.phone == phone,
            AgentApplication.kind == kind,
            AgentApplication.status == ApplicationStatus.PENDING,
        )
    )
    if pending.scalar_one_or_none() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "There's already an application for this number - we'll be in touch",
        )

    application = AgentApplication(
        kind=kind,
        user_id=user.id if user is not None else None,
        full_name=full_name,
        phone=phone,
        market_id=market_id,
        area=area,
        vehicle=_clean(vehicle),
        note=_clean(note),
    )
    db.add(application)
    await db.flush()
    return application


async def list_my_applications(
    db: AsyncSession, *, user_id: uuid.UUID
) -> list[AgentApplication]:
    result = await db.execute(
        select(AgentApplication)
        .where(AgentApplication.user_id == user_id)
        .order_by(AgentApplication.created_at.desc())
    )
    return list(result.scalars().all())


async def list_applications(
    db: AsyncSession,
    *,
    status_filter: ApplicationStatus | None,
    kind: ApplicationKind | None = None,
) -> list[AgentApplication]:
    stmt = select(AgentApplication)
    if status_filter is not None:
        stmt = stmt.where(AgentApplication.status == status_filter)
    if kind is not None:
        stmt = stmt.where(AgentApplication.kind == kind)
    result = await db.execute(stmt.order_by(AgentApplication.created_at.desc()))
    return list(result.scalars().all())


async def _get_application(
    db: AsyncSession, application_id: uuid.UUID
) -> AgentApplication:
    result = await db.execute(
        select(AgentApplication).where(AgentApplication.id == application_id)
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return application


async def _account_for(db: AsyncSession, application: AgentApplication) -> User:
    """The account an approved agent application promotes: the applicant's
    own if they applied signed in, else whoever owns that phone - created
    now if nobody does, so their first OTP sign-in lands straight in the
    agent app. An existing account keeps its customer side; a created one
    is agent-only."""
    if application.user_id is not None:
        user = (await db.execute(select(User).where(User.id == application.user_id))).scalar_one()
    else:
        user = (await db.execute(select(User).where(User.phone == application.phone))).scalar_one_or_none()
    if user is None:
        user = User(
            phone=application.phone,
            full_name=application.full_name,
            role=UserRole.CUSTOMER,
            status=UserStatus.ACTIVE,
            basket_cap_kobo=await platform.default_basket_cap_kobo(db),
            # Applied as an agent, never registered as a customer: agent-only
            # until they do (POST /auth/me/register-customer).
            has_customer_side=False,
        )
        db.add(user)
        await db.flush()
    if user.role is UserRole.ADMIN:
        raise HTTPException(status.HTTP_409_CONFLICT, "That number belongs to an admin account")
    # One staff role per account: an agent can't also be a rider or run a
    # hub, because the role is what routes them to their app.
    target = _ROLE_FOR_KIND[application.kind]
    if user.role not in (UserRole.CUSTOMER, target):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"That number already belongs to {_ROLE_LABEL[ApplicationKind(user.role.value)]}",
        )
    if not user.full_name and application.full_name:
        user.full_name = application.full_name
    application.user_id = user.id
    return user


async def approve(
    db: AsyncSession, *, application_id: uuid.UUID, admin: User
) -> AgentApplication:
    application = await _get_application(db, application_id)
    if application.status is not ApplicationStatus.PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Application has already been reviewed"
        )

    user = await _account_for(db, application)
    if application.kind is ApplicationKind.AGENT:
        await admin_service.promote_to_agent(
            db, user_id=user.id, market_id=application.market_id
        )
    elif application.kind is ApplicationKind.RIDER:
        existing = await db.execute(select(Rider).where(Rider.phone == application.phone))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "This number is already a rider")
        user.role = UserRole.RIDER
        db.add(Rider(
            user_id=user.id,
            full_name=application.full_name or application.phone,
            phone=application.phone,
            area=application.area,
            vehicle=application.vehicle,
            market_id=application.market_id,
            application_id=application.id,
        ))
    else:
        market = (await db.execute(
            select(Market).where(Market.id == application.market_id)
        )).scalar_one_or_none()
        if market is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found")
        user.role = UserRole.SHOPKEEPER
        db.add(Hub(
            market_id=market.id,
            user_id=user.id,
            name=f"{market.name} Hub",
        ))
    application.status = ApplicationStatus.APPROVED
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    return application


async def reject(
    db: AsyncSession, *, application_id: uuid.UUID, admin: User
) -> AgentApplication:
    application = await _get_application(db, application_id)
    if application.status is not ApplicationStatus.PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Application has already been reviewed"
        )

    application.status = ApplicationStatus.REJECTED
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    return application
