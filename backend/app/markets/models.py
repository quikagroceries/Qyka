import re
import uuid
from datetime import datetime, time

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.enums import MarketStatus, VenueType
from app.markets.hours import DEFAULT_CLOSING_TIME, DEFAULT_OPENING_TIME, DEFAULT_TIMEZONE


def _fallback_slug(context) -> str:
    """Only for markets built directly in code without a slug (scripts,
    tests). The API and the migrations always set a clean slug themselves."""
    name = (context.get_current_parameters().get("name") or "market").lower()
    return f"{re.sub(r'[^a-z0-9]+', '-', name).strip('-')[:70] or 'market'}-{uuid.uuid4().hex[:6]}"


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(120))
    # Stable public key (e.g. "balogun") - what the frontend matches on and
    # what /markets/<slug> URLs use. Set once at creation, never changed,
    # so renaming a market can't break the match.
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, default=_fallback_slug)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[MarketStatus] = mapped_column(
        Enum(MarketStatus), default=MarketStatus.PILOT, index=True
    )
    # Food categories sold here (produce, provisions, protein, spices, fish,
    # grains, household) - drives the shop's category filters.
    categories: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Cover image (an https URL on our Cloudinary account).
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(80))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # local_market | supermarket — see VenueType
    venue_type: Mapped[str] = mapped_column(
        String(32),
        default=VenueType.LOCAL_MARKET.value,
        server_default=VenueType.LOCAL_MARKET.value,
        index=True,
    )
    # Pickup point for courier quotes. Geocoded once from the market name.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # When orders may be placed, in the market's own local time (see
    # markets/hours.py - enforced in orders.service.create_order).
    opening_time: Mapped[time] = mapped_column(Time, default=DEFAULT_OPENING_TIME)
    closing_time: Mapped[time] = mapped_column(Time, default=DEFAULT_CLOSING_TIME)
    timezone: Mapped[str] = mapped_column(String(64), default=DEFAULT_TIMEZONE)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    assigned_market_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # Whether this agent is currently presenting as an agent at all, vs.
    # switched into customer mode to shop for themselves (see markets.service
    # set_duty). Auto-assignment requires BOTH on_duty and is_available -
    # is_available alone only tracks "not mid-shopping an order", it says
    # nothing about which mode they're in. Defaults True: a freshly
    # promoted/seeded agent starts in their agent view.
    on_duty: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # ID/identity check by an admin. Approval lets someone in; verification says
    # we have actually checked them. Optionally required before an agent can be
    # assigned or shop (platform setting "require_verified_agents").
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    verification_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
