import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PayoutOut(BaseModel):
    agent_payout: str
    rider_payout: str
    hub_payout: str
    courier_cost: str
    company_retained: str
    grand_total: str


class DropAtHubIn(BaseModel):
    # Omit when the order's market has exactly one active hub.
    hub_id: uuid.UUID | None = None


class EarningItemOut(BaseModel):
    order_id: uuid.UUID
    amount: Decimal
    delivered_at: datetime


class EarningsOut(BaseModel):
    earnings_today: Decimal
    earnings_week: Decimal
    earnings_total: Decimal
    completed_count: int
    recent: list[EarningItemOut]
