"""Who may call an admin endpoint, and the automatic audit trail.

    admin: User = Depends(require_admin())                          # any admin, read-only
    admin: User = Depends(require_admin("user.suspend"))            # any admin, logged
    admin: User = Depends(require_admin("fees.set", owner_only=True))

An endpoint that changes anything MUST name its action: that is what puts it
in the audit log (tests/test_admin_audit.py fails for any state-changing admin
route that doesn't). The entry is written only when the request SUCCEEDED - a
refused or invalid request changed nothing, so it logs nothing.

How: the guard notes the action on the request; AuditedRoute (the route class
every router with admin endpoints uses) writes the entry once the response is
known to be a success.
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.routing import APIRoute

from app.admin import audit
from app.auth.models import User
from app.core.database import get_db
from app.core.enums import AdminLevel, UserRole
from app.core.security import require_role


def level_of(user: User) -> AdminLevel:
    return user.admin_level or AdminLevel.SUPPORT


def require_admin(action: str | None = None, *, owner_only: bool = False):
    base = require_role(UserRole.ADMIN)

    async def checker(request: Request, user: User = Depends(base)) -> User:
        if owner_only and level_of(user) is not AdminLevel.OWNER:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an owner can do this")
        if action:
            request.state.audit_pending = (user, action)
        return user

    checker.is_admin_guard = True
    checker.audit_action = action
    checker.owner_only = owner_only
    return checker


class AuditedRoute(APIRoute):
    """Writes the audit entry for a guarded endpoint once it has succeeded."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            response = await original(request)
            pending = getattr(request.state, "audit_pending", None)
            if pending and response.status_code < 400:
                admin, action = pending
                # A session of its own (the endpoint's has already committed),
                # obtained the way every request gets one - so tests and any
                # future override of get_db are respected.
                getter = request.app.dependency_overrides.get(get_db, get_db)
                session_gen = getter()
                db = await session_gen.__anext__()
                try:
                    await audit.record(
                        db, admin=admin, action=action, request=request,
                        detail=getattr(request.state, "audit_detail", None),
                    )
                    try:
                        await session_gen.__anext__()      # get_db commits on resume
                    except StopAsyncIteration:
                        pass
                except Exception:
                    await session_gen.aclose()
                    raise
            return response

        return handler
