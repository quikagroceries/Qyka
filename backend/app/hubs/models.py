import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Hub(Base):
    """A drop-off point inside a market, run by one shopkeeper.

    Agents drop the goods they've bought here; the shopkeeper confirms
    receipt and hands them to a rider. A market normally has one hub but
    nothing stops it having several, so market_id is deliberately NOT unique.
    A shopkeeper runs exactly one hub (user_id is unique).
    Created only by approving a shopkeeper application.
    """

    __tablename__ = "hubs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    market_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
