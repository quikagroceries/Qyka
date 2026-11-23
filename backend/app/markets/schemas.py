import uuid
from datetime import time

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import MarketStatus, VenueType
from app.core.media import require_our_image_url

FoodCategory = Literal["produce", "provisions", "protein", "spices", "fish", "grains", "household"]


def _check_image_url(v: str | None) -> str | None:
    # "" is kept as-is: on an update it means "remove the image" (None = unchanged).
    if v is None or v == "":
        return v
    return require_our_image_url(v, "Market images must be uploaded through Qyka")


class CreateMarketIn(BaseModel):
    name: str = Field(..., examples=["Mile 12 Market"])
    # Optional: derived from the name when omitted. Fixed for good once set.
    slug: str | None = Field(default=None, max_length=80, examples=["mile-12"])
    description: str | None = None
    # New markets start coming_soon by default - flip to pilot/live to launch.
    status: MarketStatus = MarketStatus.COMING_SOON
    categories: list[FoodCategory] = Field(default_factory=list)
    image_url: str | None = Field(default=None, max_length=500)
    city: str = Field(..., examples=["Lagos"])
    state: str = Field(..., examples=["Lagos"])
    venue_type: VenueType = VenueType.LOCAL_MARKET
    latitude: float | None = None
    longitude: float | None = None
    # Omitted -> the 08:00-20:00 Africa/Lagos default (markets/hours.py).
    opening_time: time | None = Field(default=None, examples=["08:00"])
    closing_time: time | None = Field(default=None, examples=["20:00"])
    timezone: str | None = Field(default=None, examples=["Africa/Lagos"])

    _image = field_validator("image_url")(classmethod(lambda cls, v: _check_image_url(v)))


class UpdateMarketIn(BaseModel):
    # Every field optional and only applied when actually sent - same
    # "omitted means unchanged" convention as auth.UpdateProfileIn.
    name: str | None = None
    # Accepted only so a client resending the current slug isn't rejected;
    # any CHANGE is refused (markets.service.update_market) - slugs are immutable.
    slug: str | None = None
    description: str | None = None
    status: MarketStatus | None = None
    categories: list[FoodCategory] | None = None
    image_url: str | None = Field(default=None, max_length=500)
    city: str | None = None
    state: str | None = None
    is_active: bool | None = None
    venue_type: VenueType | None = None
    latitude: float | None = None
    longitude: float | None = None
    opening_time: time | None = None
    closing_time: time | None = None
    timezone: str | None = None

    _image = field_validator("image_url")(classmethod(lambda cls, v: _check_image_url(v)))


class MarketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    status: MarketStatus
    categories: list[str]
    image_url: str | None
    city: str
    state: str
    is_active: bool
    venue_type: str
    latitude: float | None
    longitude: float | None
    # Local market time; whether it's open is computed against `timezone`.
    opening_time: time
    closing_time: time
    timezone: str


class CreateVendorIn(BaseModel):
    """A stall registered by an agent on the fly while shopping — no photo,
    no hours, no approval gate. Live the moment it's created."""

    name: str = Field(..., examples=["Mama Chidinma's stall"])
    # Rough location/category, free text — e.g. "Produce, near the east gate".
    stall_description: str | None = Field(default=None, examples=["Fresh produce, row 3"])
    phone: str | None = None
    # A single point captured from the agent's device at save time - optional,
    # never required. See Seller.latitude/longitude.
    latitude: float | None = None
    longitude: float | None = None


class VendorOut(BaseModel):
    """A stall / seller inside a market — customer browse surface."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    market_id: uuid.UUID
    name: str
    stall_description: str | None
    phone: str | None
    latitude: float | None
    longitude: float | None


class ShopActivityOut(BaseModel):
    """Honest live pulse for the shop hero banner."""

    agents_on_duty: int
    active_markets: int
    active_supermarkets: int


class SetDutyIn(BaseModel):
    on_duty: bool


class AgentStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    on_duty: bool
    is_available: bool
    assigned_market_id: uuid.UUID | None
