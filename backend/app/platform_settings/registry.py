"""Every business rule an owner can change without a developer.

Each setting is declared once here: what it's called, how it's validated,
its built-in default, and WHEN a change takes effect:

  scope="new_orders"   pricing: copied onto each order when it's created, so
                       a change never reprices an order already in progress
  scope="immediately"  read live at the moment it's needed

Settings backed by an environment variable (env_attr) fall back to that
variable's value until an owner sets one here, so existing deployments keep
behaving exactly as they do now.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.core.config import settings
from app.orders import fees


@dataclass(frozen=True)
class Spec:
    key: str
    group: str
    label: str
    help: str
    kind: str                       # "decimal" | "int" | "bool" | "text"
    default: Any
    min: Any = None
    max: Any = None
    unit: str = ""
    scope: str = "immediately"      # or "new_orders"
    env_attr: str | None = None     # config.Settings attribute that supplies the default

    def default_value(self) -> Any:
        value = getattr(settings, self.env_attr) if self.env_attr is not None else self.default
        return Decimal(str(value)).quantize(Decimal("0.01")) if self.kind == "decimal" else value


def _pct(rate: Decimal) -> Decimal:
    return rate * 100


SPECS: list[Spec] = [
    # --- Pricing (new orders) -------------------------------------------
    Spec("service_fee_percent", "Pricing", "Service fee", "The one fee line the customer sees, as a share of the goods bought. It also funds the agent's pay.",
         "decimal", _pct(fees.SERVICE_FEE_RATE), 0, 30, "%", "new_orders"),
    Spec("agent_base_share", "Pricing", "Agent base pay", "What an agent earns for a normal shop (the included time below).",
         "decimal", fees.AGENT_BASE_SHARE, 0, 50000, "₦", "new_orders"),
    Spec("agent_included_minutes", "Pricing", "Included shopping time", "Minutes of shopping covered by the base pay.",
         "int", fees.INCLUDED_MINUTES, 0, 600, "min", "new_orders"),
    Spec("agent_per_minute", "Pricing", "Agent pay per extra minute", "Added to the agent's pay for each started minute beyond the included time. The customer's bill doesn't change.",
         "decimal", fees.PER_MINUTE, 0, 5000, "₦", "new_orders"),
    Spec("delivery_fee", "Pricing", "Delivery fee", "What the customer pays for delivery. It funds the rider and the hub (see Delivery pay).",
         "decimal", fees.DELIVERY_FEE_FLAT, 0, 50000, "₦", "new_orders"),
    Spec("deposit_percent", "Pricing", "Deposit", "Share of the goods estimate paid up front before shopping starts.",
         "decimal", _pct(fees.DEPOSIT_RATE), 0, 100, "%", "new_orders"),
    Spec("add_item_fee", "Pricing", "Add-an-item fee", "Flat fee for adding an item to an order that's already being shopped.",
         "decimal", fees.ADD_ITEM_FEE, 0, 50000, "₦", "new_orders"),
    Spec("emtl_per_transfer", "Pricing", "Stamp duty (EMTL)", "Government stamp duty charged on a vendor transfer at or above the threshold below.",
         "decimal", fees.EMTL_PER_TRANSFER, 0, 5000, "₦", "new_orders"),
    Spec("emtl_threshold", "Pricing", "Stamp duty threshold", "Transfers at or above this amount attract the stamp duty.",
         "decimal", fees.EMTL_THRESHOLD, 0, 10_000_000, "₦", "new_orders"),

    # --- Safety limits (immediately) ------------------------------------
    Spec("payment_window_minutes", "Safety limits", "Payment window", "How long a customer has to pay the balance after shopping finishes before the order is cancelled.",
         "int", 45, 5, 1440, "min", env_attr="payment_window_minutes"),
    Spec("default_basket_cap_naira", "Safety limits", "New customer spending cap", "The most a new or unverified customer can have on one order.",
         "int", 5000, 0, 1_000_000, "₦"),
    Spec("max_transfer_naira", "Safety limits", "Largest single vendor transfer", "No single payment to a vendor may exceed this.",
         "int", 100_000, 1000, 5_000_000, "₦", env_attr="max_transfer_naira"),
    Spec("max_daily_transfers_naira", "Safety limits", "Daily transfer ceiling", "Total money that may go out to vendors in one day.",
         "int", 500_000, 1000, 50_000_000, "₦", env_attr="max_daily_transfers_naira"),
    Spec("rider_max_active_jobs", "Safety limits", "Jobs a rider can hold at once", "A rider can't claim another job while holding this many.",
         "int", 1, 1, 10, "jobs"),

    # --- Sign-in codes (immediately) ------------------------------------
    Spec("otp_expire_minutes", "Sign-in codes", "Code lifetime", "How long a sign-in code works.",
         "int", 2, 1, 30, "min", env_attr="otp_expire_minutes"),
    Spec("otp_max_requests_per_hour", "Sign-in codes", "Codes per hour", "How many codes one phone or email can request in an hour (each SMS costs money).",
         "int", 5, 1, 50, "", env_attr="otp_max_requests_per_hour"),
    Spec("otp_max_verify_attempts", "Sign-in codes", "Wrong guesses allowed", "Attempts at one code before it's thrown away.",
         "int", 5, 1, 20, "", env_attr="otp_max_verify_attempts"),
    Spec("otp_resend_cooldown_seconds", "Sign-in codes", "Wait between codes", "Seconds before another code can be requested for the same phone or email.",
         "int", 30, 0, 600, "sec", env_attr="otp_resend_cooldown_seconds"),
    Spec("otp_fallback_after_seconds", "Sign-in codes", "Offer another way after", "How long before the app offers WhatsApp or a call instead of SMS.",
         "int", 45, 0, 600, "sec", env_attr="otp_fallback_after_seconds"),

    # --- Stuck-order alerts (immediately) -------------------------------
    Spec("stuck_after_hours", "Stuck-order alerts", "Any order, overall", "An order still in flight this long after it was placed is flagged as stuck.",
         "int", 2, 1, 168, "hours"),
    Spec("stuck_paid_minutes", "Stuck-order alerts", "Paid, not yet at the hub", "Flag if an agent hasn't taken a paid order to the hub within this long.",
         "int", 45, 5, 1440, "min"),
    Spec("stuck_dropped_minutes", "Stuck-order alerts", "Dropped, not checked in", "Flag if the shopkeeper hasn't checked a drop-off in within this long.",
         "int", 20, 5, 1440, "min"),
    Spec("stuck_received_minutes", "Stuck-order alerts", "Checked in, not ready", "Flag if a checked-in order isn't marked ready within this long.",
         "int", 20, 5, 1440, "min"),
    Spec("stuck_ready_minutes", "Stuck-order alerts", "Ready, no rider collected it", "Flag if no rider has collected a ready order within this long (unclaimed or claimed but never came).",
         "int", 30, 5, 1440, "min"),
    Spec("stuck_delivery_minutes", "Stuck-order alerts", "Out for delivery", "Flag if an order has been out for delivery this long without the customer confirming.",
         "int", 120, 10, 2880, "min"),

    # --- Emergency ------------------------------------------------------
    Spec("orders_paused", "Emergency", "Pause new orders", "Stops customers starting new orders. Orders already in progress carry on normally.",
         "bool", False),
    Spec("orders_paused_message", "Emergency", "Message while paused", "What customers see when new orders are paused.",
         "text", "We're not taking new orders right now. Please check back soon.", 0, 200),
]

BY_KEY: dict[str, Spec] = {s.key: s for s in SPECS}
