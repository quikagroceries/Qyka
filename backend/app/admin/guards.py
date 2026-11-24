"""Who may call an admin endpoint, and the automatic audit trail.

    admin: User = Depends(require_admin())                          # any admin, read-only
    admin: User = Depends(require_admin("user.suspend"))            # any admin, logged
    admin: User = Depends(require_admin("fees.set", owner_only=True))

An endpoint that changes anything MUST name its action: that is what puts it
in the audit log (tests/test_admin_audit.py fails for any state-changing admin
route that doesn't). The entry is written only if the request succeeds, in the
same transaction as the change itself.
"""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import audit
from app.auth.models import User
from app.core.database import get_db
from app.core.enums import AdminLevel, UserRole
from app.core.security import require_role


def level_of(user: User) -> AdminLevel:
    return user.admin_level or AdminLevel.SUPPORT


def require_admin(action: str | None = None, *, owner_only: bool = False):
    base = require_role(UserRole.ADMIN)

    async def checker(
        request: Request,
        user: User = Depends(base),
        db: AsyncSession = Depends(get_db),  # the same session the endpoint gets (cached per request)
    ):
        if owner_only and level_of(user) is not AdminLevel.OWNER:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an owner can do this")
        try:
            yield user
        except Exception:
            # The endpoint failed: nothing changed, so there's nothing to log.
            raise
        else:
            if action:
                # Same session as the endpoint's, so the entry commits - or
                # rolls back - together with the change itself.
                await audit.record(
                    db, admin=user, action=action, request=request,
                    detail=getattr(request.state, "audit_detail", None),
                )

    checker.is_admin_guard = True
    checker.audit_action = action
    checker.owner_only = owner_only
    return checker
