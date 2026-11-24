import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import OrderStatus


class RiderJobOut(BaseModel):
    """A delivery job. In the pool (unclaimed) it shows only what's needed to
    decide whether to take it; the customer's address and contact, and the
    pickup code, are filled in only for the rider who has claimed it."""

    id: uuid.UUID
    status: OrderStatus
    hub_id: uuid.UUID | None
    hub_name: str | None
    market_name: str | None
    item_count: int
    ready_at: datetime | None
    claimed_at: datetime | None
    # Claimed jobs only:
    pickup_code: str | None = None          # shown to the shopkeeper at the hub
    customer_name: str | None = None
    customer_phone: str | None = None
    delivery_address: str | None = None
    dropoff_latitude: float | None = None
    dropoff_longitude: float | None = None
    delivered_at: datetime | None = None    # the rider's own drop-off confirmation


class DeliverIn(BaseModel):
    # The 4-digit PIN the customer was sent when the order went out.
    code: str = Field(..., min_length=4, max_length=8)
