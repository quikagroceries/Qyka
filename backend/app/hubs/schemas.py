import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import OrderStatus


class HubOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    market_id: uuid.UUID
    name: str
    is_active: bool


class HubItemOut(BaseModel):
    """What physically has to be in the bag - no prices: the hub handles
    goods, never the customer's money."""

    id: uuid.UUID
    description: str
    quantity: int | None
    requested_note: str | None


class HubOrderOut(BaseModel):
    id: uuid.UUID
    status: OrderStatus
    agent_name: str | None
    items: list[HubItemOut]
    packing_photos: list[str]
    dropped_at_hub_at: datetime | None
    hub_received_at: datetime | None
    hub_missing_item_ids: list[uuid.UUID]
    hub_receipt_note: str | None


class ReceiveIn(BaseModel):
    # The item ids the shopkeeper actually saw arrive. Omit when everything did.
    received_item_ids: list[uuid.UUID] | None = None
    note: str | None = Field(default=None, max_length=500)
    # Photos of the goods as received - our own Cloudinary links only.
    photos: list[str] = Field(default_factory=list, max_length=10)
