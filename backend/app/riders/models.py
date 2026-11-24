import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.enums import RiderStatus


class Rider(Base):
    """An approved rider on Qyka's roster.

    The admin's record of who's been vetted, where they cover and whether
    they're active - created only by approving a rider application. Approval
    also gives the rider a login (UserRole.RIDER) and links it here through
    user_id. user_id is NULL only for riders approved before riders could
    sign in.
    """

    __tablename__ = "riders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=True
    )
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)
    vehicle: Mapped[str | None] = mapped_column(String(60), nullable=True)
    market_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[RiderStatus] = mapped_column(
        Enum(RiderStatus), default=RiderStatus.ACTIVE, index=True
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
