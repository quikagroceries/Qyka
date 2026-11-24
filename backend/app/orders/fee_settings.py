"""Admin-set delivery pay: what a rider and a hub earn per delivered order.

One global default plus an optional override per market. An order copies the
pair that applies to its market when it is created (see Order.rider_fee /
hub_fee), so editing these only affects orders created afterwards.
Fixed amounts, not percentages: riders and shopkeepers see exactly what a job
pays.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, select, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.orders import fees


class FeeSetting(Base):
    """market_id NULL is the global default; a row with a market_id overrides
    it for that market. (The global row is kept to one by the code in
    upsert(), not by the database - NULLs never collide in a unique index.)"""

    __tablename__ = "fee_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    market_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=True
    )
    rider_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    hub_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


async def get_global(db: AsyncSession) -> FeeSetting | None:
    result = await db.execute(select(FeeSetting).where(FeeSetting.market_id.is_(None)))
    return result.scalars().first()


async def resolve(db: AsyncSession, market_id: uuid.UUID) -> tuple[Decimal, Decimal]:
    """(rider_fee, hub_fee) for a new order in this market: the market's own
    override, else the global default, else the built-in fallback."""
    row = (await db.execute(
        select(FeeSetting).where(FeeSetting.market_id == market_id)
    )).scalar_one_or_none() or await get_global(db)
    if row is None:
        return fees.DEFAULT_RIDER_FEE, fees.DEFAULT_HUB_FEE
    return row.rider_fee, row.hub_fee


async def upsert(
    db: AsyncSession, *, market_id: uuid.UUID | None,
    rider_fee: Decimal, hub_fee: Decimal, admin_id: uuid.UUID,
) -> FeeSetting:
    if market_id is None:
        row = await get_global(db)
    else:
        row = (await db.execute(
            select(FeeSetting).where(FeeSetting.market_id == market_id)
        )).scalar_one_or_none()
    if row is None:
        row = FeeSetting(market_id=market_id, rider_fee=rider_fee, hub_fee=hub_fee, updated_by=admin_id)
        db.add(row)
    else:
        row.rider_fee, row.hub_fee, row.updated_by = rider_fee, hub_fee, admin_id
    await db.flush()
    return row
