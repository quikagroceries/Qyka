"""The admin audit log: who did what, to what, when.

Every state-changing admin action is recorded automatically by the
require_admin guard (admin/guards.py) - an endpoint only has to declare its
action name. Failed attempts aren't logged here (the request rolled back);
sign-in attempts are, separately, via record_event.
"""

import uuid
from datetime import datetime

from fastapi import Request
from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import User
from app.core.database import Base
from app.payments.models import JsonType


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Who. Email and level are copied so the entry still reads correctly after
    # the admin is removed or their level changes.
    admin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True, nullable=True)
    admin_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    admin_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # What: a dotted name like "user.suspend" or "fees.set_default".
    action: Mapped[str] = mapped_column(String(80), index=True)
    # To what: the path parameters of the request (e.g. {"user_id": "..."}).
    target: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    # Anything worth keeping about the change (before/after values, a reason).
    detail: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


def _ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


def note(request: Request, **detail) -> None:
    """Endpoints call this to add detail (e.g. before/after) to the entry the
    guard writes when the request succeeds."""
    request.state.audit_detail = {**getattr(request.state, "audit_detail", {}), **detail}


async def record(
    db: AsyncSession,
    *,
    admin: User | None,
    action: str,
    request: Request | None = None,
    detail: dict | None = None,
    email: str | None = None,
) -> AdminAuditLog:
    entry = AdminAuditLog(
        admin_id=admin.id if admin else None,
        admin_email=(admin.email if admin else email),
        admin_level=(admin.admin_level.value if admin and admin.admin_level else None),
        action=action,
        target={k: str(v) for k, v in request.path_params.items()} if request is not None and request.path_params else None,
        detail=detail or None,
        method=request.method if request is not None else None,
        path=request.url.path[:300] if request is not None else None,
        ip=_ip(request),
    )
    db.add(entry)
    await db.flush()
    return entry
