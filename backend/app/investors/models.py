import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InvestorLink(Base):
    """A shareable, read-only link to the company overview.

    Only a hash of the secret is stored, so the link can be shown exactly once
    (when it's made); a lost link is revoked and replaced. Anyone holding a live
    link sees the aggregate overview and nothing else - no logins, no personal
    data - until it expires or is revoked.
    """

    __tablename__ = "investor_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120))
    # Revenue and take rate can be left off a link (volume/reliability only).
    include_financials: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
