import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Payout.status
PENDING_REVIEW = "pending_review"   # held for an admin (first withdrawal, or a large one)
PROCESSING = "processing"           # money is on its way / outcome not yet known
PAID = "paid"
FAILED = "failed"                   # the rail refused it; the money is back in the balance
REJECTED = "rejected"               # an admin said no; the money is back in the balance

# These count against a person's balance and their daily limit.
HOLDING = (PENDING_REVIEW, PROCESSING, PAID)


class PayoutAccount(Base):
    """The one bank account a person withdraws their earnings to."""

    __tablename__ = "payout_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, index=True)
    bank_code: Mapped[str] = mapped_column(String(10))
    bank_name: Mapped[str] = mapped_column(String(80))
    account_number: Mapped[str] = mapped_column(String(10))
    account_name: Mapped[str] = mapped_column(String(120))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Payout(Base):
    """One withdrawal. The bank details are copied on, so changing the saved
    account later never changes where an old withdrawal went."""

    __tablename__ = "payouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    role: Mapped[str] = mapped_column(String(20))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), index=True)
    reference: Mapped[str] = mapped_column(String(64), unique=True)
    bank_code: Mapped[str] = mapped_column(String(10))
    bank_name: Mapped[str] = mapped_column(String(80))
    account_number: Mapped[str] = mapped_column(String(10))
    account_name: Mapped[str] = mapped_column(String(120))
    hold_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
