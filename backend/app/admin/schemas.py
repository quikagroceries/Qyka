import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.core.enums import AdminLevel, OrderStatus, RiderStatus


class AdminLoginIn(BaseModel):
    email: str = Field(..., examples=["admin@qyka.com"])
    password: str = Field(..., min_length=1, examples=["hunter2"])


# Same floor for a temporary password and a chosen one.
_MIN_PASSWORD = 8


class AdminCreateIn(BaseModel):
    email: str = Field(..., examples=["ops@qyka.com"])
    full_name: str | None = Field(None, max_length=120)
    temporary_password: str = Field(..., min_length=_MIN_PASSWORD)
    # Support by default: owner is the level that can touch money rules,
    # other admins and the audit log, so it has to be asked for.
    level: AdminLevel = AdminLevel.SUPPORT


class AdminLevelIn(BaseModel):
    level: AdminLevel


class AdminPasswordChangeIn(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=_MIN_PASSWORD)


class RiderStatusIn(BaseModel):
    status: RiderStatus


class WalletAdjustIn(BaseModel):
    direction: str = Field(..., pattern="^(credit|debit)$")
    amount: Decimal = Field(..., gt=0)
    note: str = Field(..., min_length=1, max_length=300)


class VendorTransferAckIn(BaseModel):
    note: str = Field(..., min_length=1, max_length=300)


class RaiseCapIn(BaseModel):
    extra: Decimal = Field(..., gt=0)


class AdminCancelOrderIn(BaseModel):
    refund_amount: Decimal = Field(..., ge=0)
    note: str = Field(..., min_length=1, max_length=300)


class DeliveryFeesIn(BaseModel):
    """What a rider and a hub earn per delivered order. Fixed amounts, in
    naira. The upper bound is a typo guard, not a business rule."""

    rider_fee: Decimal = Field(..., ge=0, le=100000, decimal_places=2)
    hub_fee: Decimal = Field(..., ge=0, le=100000, decimal_places=2)


class HubUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class SettingValueIn(BaseModel):
    # Decimals, whole numbers, yes/no and text all arrive here; the setting's
    # own type and bounds decide what's acceptable (platform_settings/registry).
    value: str | bool | int | float


class HubCreateIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., examples=["08012345678"])
    market_id: uuid.UUID
    hub_name: str | None = Field(default=None, max_length=120)


class ShopkeeperReplaceIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str


class ReassignAgentIn(BaseModel):
    agent_id: uuid.UUID
    note: str = Field(..., min_length=3, max_length=300)


class HubStageIn(BaseModel):
    stage: OrderStatus
    note: str = Field(..., min_length=3, max_length=300)


class NoteIn(BaseModel):
    note: str = Field(..., min_length=3, max_length=300)


class MoveMarketIn(BaseModel):
    market_id: uuid.UUID


class UserEditIn(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=255)
    basket_cap_naira: int | None = None


class ContentIn(BaseModel):
    # e.g. "en.hero.title" - where the wording lives in the site's content.
    key: str = Field(..., min_length=3, max_length=300, pattern=r"^(en|pcm|faqs|help|landing)\.[A-Za-z0-9_.\-]+$")
    # Plain text. To go back to the original wording, reset instead of blanking.
    value: str = Field(..., min_length=1, max_length=2000)
