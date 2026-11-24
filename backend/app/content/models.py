import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SiteContent(Base):
    """An owner's rewording of one piece of website copy.

    The key names the piece of text by where it lives in the site's content
    ("en.hero.title", "pcm.faq.0.a", "faqs.2.q"...); the website applies these
    on top of the wording it ships with, so changing a headline or an FAQ answer
    needs no developer and no deploy. Plain text only. Deleting a row puts the
    original wording back.
    """

    __tablename__ = "site_content"

    key: Mapped[str] = mapped_column(String(300), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
