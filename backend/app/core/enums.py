import enum


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    AGENT = "agent"
    RIDER = "rider"
    # Runs the hub in a market: agents drop bought goods here, and the
    # shopkeeper hands them on to a rider (see app/hubs).
    SHOPKEEPER = "shopkeeper"
    ADMIN = "admin"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    FLAGGED = "flagged"
    LOCKED = "locked"
    # An admin-initiated soft delete: sign-in and every API call are refused
    # (see core/security.py::get_current_user), but the row and every order/
    # wallet/payment record it's linked to stay intact. Reversible any time
    # via admin/service.py::reactivate_user.
    SUSPENDED = "suspended"


class ApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ApplicationKind(str, enum.Enum):
    AGENT = "agent"
    RIDER = "rider"
    SHOPKEEPER = "shopkeeper"


class RiderStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class OrderStatus(str, enum.Enum):
    # Happy path
    DRAFT = "draft"
    # An agent has been proposed but not yet accepted by the customer - the
    # agent does NOT have access to this order yet (agent_id is still unset;
    # see Order.proposed_agent_id). Sits between DRAFT and AGENT_ASSIGNED.
    PROPOSED = "proposed"
    AGENT_ASSIGNED = "agent_assigned"
    SHOPPING = "shopping"
    AWAITING_PAYMENT = "awaiting_payment"
    PAID = "paid"
    # Custody at the market hub (see app/hubs): the agent drops the goods,
    # the shopkeeper confirms what actually arrived, then marks them ready
    # for a rider.
    DROPPED_AT_HUB = "dropped_at_hub"
    RECEIVED_BY_HUB = "received_by_hub"
    READY_FOR_PICKUP = "ready_for_pickup"
    # Legacy: the agent used to pack and hand to a courier. Nothing moves INTO
    # this any more; it stays only so orders already packed can finish.
    PACKED = "packed"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CLOSED = "closed"
    # Exits
    CANCELLED = "cancelled"
    CANCELLED_UNPAID = "cancelled_unpaid"
    DISPUTED = "disputed"


class LedgerDirection(str, enum.Enum):
    DEBIT = "debit"    # money leaving the float pool (agent buying)
    CREDIT = "credit"  # money returning to the pool (customer paying)


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class MarketStatus(str, enum.Enum):
    """Whether a market takes orders. Only PILOT and LIVE do - COMING_SOON is
    for markets listed on the site but not set up yet (orders.service.create_order)."""

    COMING_SOON = "coming_soon"
    PILOT = "pilot"
    LIVE = "live"


class VenueType(str, enum.Enum):
    """Where Qyka shops — drives customer flow branching."""

    LOCAL_MARKET = "local_market"  # open-air; bargain; optional stalls
    SUPERMARKET = "supermarket"  # fixed catalogue / fixed price path
