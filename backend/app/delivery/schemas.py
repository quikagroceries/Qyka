import uuid

from pydantic import BaseModel


class PayoutOut(BaseModel):
    agent_payout: str
    courier_cost: str
    company_retained: str
    grand_total: str


class DropAtHubIn(BaseModel):
    # Omit when the order's market has exactly one active hub.
    hub_id: uuid.UUID | None = None
