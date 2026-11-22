import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.media import require_our_image_url


class ItemPriceIn(BaseModel):
    item_id: uuid.UUID
    # What the agent actually paid for THIS item - recorded exactly as
    # typed, never synthesized from an even split of a stall total.
    price: Decimal = Field(..., gt=0, examples=["1500.00"])


class PayVendorIn(BaseModel):
    account_number: str = Field(..., examples=["9012345678"])
    bank_code: str = Field(..., examples=["999992"])  # OPay code, illustrative
    # One transfer can still cover several items bought from the same
    # stall - but each carries its own agent-typed price. The transfer
    # amount is ALWAYS the sum of these, never a separate free-typed figure,
    # so there's no way for the recorded prices to disagree with the money
    # that actually moved.
    items: list[ItemPriceIn] = Field(..., min_length=1)
    seller_id: uuid.UUID | None = None
    photo_ref: str | None = None

    @field_validator("photo_ref")
    @classmethod
    def _receipt_is_ours(cls, v):
        return None if v in (None, "") else require_our_image_url(v)


class VendorTransferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    account_number: str
    amount: Decimal
    fee: Decimal
    emtl: Decimal
    reference: str
    status: str
    photo_ref: str | None


class AttachPhotoIn(BaseModel):
    photo_ref: str = Field(..., min_length=1)

    @field_validator("photo_ref")
    @classmethod
    def _receipt_is_ours(cls, v):
        return require_our_image_url(v)


class RaiseCapIn(BaseModel):
    extra: Decimal = Field(..., gt=0, examples=["500.00"])


class AuthorizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: uuid.UUID
    cap: Decimal
    spent: Decimal
