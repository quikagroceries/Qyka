import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.media import is_our_cloudinary_url
from app.core.security import get_current_user, require_role
from app.delivery import service
from app.delivery.schemas import DropAtHubIn, PayoutOut
from app.orders.schemas import OrderOut

router = APIRouter()


@router.post("/orders/{order_id}/drop-at-hub", response_model=OrderOut)
async def drop_at_hub(
    order_id: uuid.UUID,
    body: DropAtHubIn | None = None,
    db: AsyncSession = Depends(get_db),
    agent: User = Depends(require_role(UserRole.AGENT)),
) -> OrderOut:
    """Agent drops the paid order's goods at the market hub. `hub_id` is
    optional when the market has a single hub."""
    return await service.drop_at_hub(
        db, order_id=order_id, agent_id=agent.id, hub_id=body.hub_id if body else None
    )


@router.post("/orders/{order_id}/confirm-delivery", response_model=PayoutOut)
async def confirm_delivery(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    customer: User = Depends(get_current_user),
) -> PayoutOut:
    """Customer confirms receipt. Releases the agent payout."""
    split = await service.confirm_delivery(
        db, order_id=order_id, customer_id=customer.id
    )
    return PayoutOut(**split)


@router.post("/orders/{order_id}/packing-photos")
async def add_packing_photos(
    order_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    agent: User = Depends(require_role(UserRole.AGENT)),
) -> dict:
    """Attach packing photos (storage refs) to the order at handover.

    Best-effort: photos attach to the order but NEVER gate packing or dispatch,
    so a slow upload in a weak-signal market can't stall the handover. `refs`
    is a list of image URLs on our Cloudinary account (core/media.py) - never
    image bytes, and never an outside link.
    """
    from app.orders.service import _load
    order = await _load(db, order_id)
    if order.agent_id != agent.id:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the assigned agent")
    refs = [r for r in (body.get("refs") or []) if r]
    if not all(isinstance(r, str) and is_our_cloudinary_url(r) for r in refs):
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Image must be uploaded through Qyka")
    existing = list(order.packing_photos or [])
    order.packing_photos = existing + refs
    await db.flush()
    return {"order_id": str(order.id), "packing_photos": order.packing_photos}
