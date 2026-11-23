"""Notification service - the single entry point the rest of the app calls at
trigger points (payment due, out for delivery, item unavailable...).

Tiered delivery (rules in notifications/policy.py):
  - in-app: every notification the user wants becomes a row in their feed
    (the bell) - free, and covers them anywhere in the app while it's open.
  - off-app: the critical kinds (payment_due, out_for_delivery) also go out
    by email and SMS (notifications/delivery.py), so they reach a user whose
    app is closed.
A user's Settings toggles silence non-critical kinds entirely; critical kinds
ignore them - you can mute offers and chatter, never "your payment is due".
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.notifications import delivery, policy
from app.notifications.models import Notification


async def send(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    kind: str,
    message: str,
    order_id: uuid.UUID | None = None,
) -> Notification | None:
    """Returns the in-app notification, or None when the user has turned this
    kind's category off (then nothing is sent on any channel)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is not None and not policy.wants(user, kind):
        return None

    note = Notification(user_id=user_id, order_id=order_id, kind=kind, message=message)
    db.add(note)
    await db.flush()

    if user is not None and policy.is_critical(kind):
        await delivery.send_off_app(user, kind, message)

    return note
