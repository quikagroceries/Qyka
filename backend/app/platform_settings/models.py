import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.payments.models import JsonType


class PlatformSetting(Base):
    """An owner's override of one platform setting (see platform/registry.py).
    No row means the built-in default applies."""

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    # Stored as a string for decimals/ints (no float rounding), JSON for the rest.
    value: Mapped[dict] = mapped_column(JsonType)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
