import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BankOut(BaseModel):
    code: str
    name: str


class AccountIn(BaseModel):
    bank_code: str
    account_number: str


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    bank_code: str
    bank_name: str
    account_number: str
    account_name: str


class SummaryOut(BaseModel):
    earned: Decimal
    available: Decimal
    in_review: Decimal
    withdrawn: Decimal
    min_withdrawal: int
    max_per_withdrawal: Decimal
    daily_limit: Decimal
    can_withdraw_now: Decimal
    account: AccountOut | None


class WithdrawIn(BaseModel):
    amount: Decimal


class PayoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    amount: Decimal
    status: str
    bank_name: str
    account_number: str
    account_name: str
    hold_reason: str | None = None
    created_at: datetime
    paid_at: datetime | None = None


class AdminPayoutOut(PayoutOut):
    user_id: uuid.UUID
    role: str
    failure_reason: str | None = None


class RejectIn(BaseModel):
    reason: str | None = None
