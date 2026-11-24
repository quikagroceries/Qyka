import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.security import get_current_user, require_role
from app.delivery import earnings
from app.delivery.schemas import EarningsOut
from app.hubs import service
from app.hubs.models import Hub
from app.orders.models import Order
from app.hubs.schemas import HandoverIn, HubOrderOut, HubOut, ReceiveIn

router = APIRouter()


@router.get("", response_model=list[HubOut])
async def list_hubs(
    market_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Hub]:
    """Active hubs in a market - what an agent picks from when dropping off
    in a market that has more than one."""
    result = await db.execute(
        select(Hub).where(Hub.market_id == market_id, Hub.is_active.is_(True)).order_by(Hub.name)
    )
    return list(result.scalars().all())


@router.get("/me", response_model=HubOut)
async def my_hub(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> Hub:
    """The signed-in shopkeeper's hub."""
    return await service.hub_for_shopkeeper(db, user)


@router.get("/orders", response_model=list[HubOrderOut])
async def hub_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> list[dict]:
    """Orders currently at this hub: dropped (to check in), received, or
    ready for a rider. Items only - never prices or the customer's address."""
    return await service.list_orders(db, user=user)


@router.get("/orders/{order_id}", response_model=HubOrderOut)
async def hub_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> dict:
    return await service.get_order(db, user=user, order_id=order_id)


@router.post("/orders/{order_id}/receive", response_model=HubOrderOut)
async def receive_order(
    order_id: uuid.UUID,
    body: ReceiveIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> dict:
    """Confirm what actually arrived from the agent."""
    return await service.receive(
        db, user=user, order_id=order_id,
        received_item_ids=body.received_item_ids, note=body.note, photos=body.photos,
    )


@router.post("/orders/{order_id}/ready", response_model=HubOrderOut)
async def order_ready(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> dict:
    """Goods are bagged and ready for a rider."""
    return await service.mark_ready(db, user=user, order_id=order_id)


@router.post("/orders/{order_id}/handover", response_model=HubOrderOut)
async def handover_order(
    order_id: uuid.UUID,
    body: HandoverIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> dict:
    """Release the goods to the rider who claimed them, using the code the
    rider shows. The order goes out for delivery."""
    return await service.handover(db, user=user, order_id=order_id, code=body.code)


@router.get("/earnings", response_model=EarningsOut)
async def hub_earnings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.SHOPKEEPER)),
) -> dict:
    """What this hub has earned: counted once the customer confirms receipt."""
    hub = await service.hub_for_shopkeeper(db, user)
    return await earnings.summarize(db, where=Order.hub_id == hub.id, amount_attr="hub_fee")
