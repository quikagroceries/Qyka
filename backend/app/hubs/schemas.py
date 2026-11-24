import uuid

from pydantic import BaseModel, ConfigDict


class HubOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    market_id: uuid.UUID
    name: str
    is_active: bool
