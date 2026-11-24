"""Fee calculation — the settled Qyka money model, isolated in one file.

FEE POLICY:
  Items    : whatever the agent actually TRANSFERRED to vendors (JIT).
  Service fee: SERVICE_FEE_RATE (7.5%) of the goods total. This is the ONE
             fee line the customer sees and pays, and it depends only on the
             goods - never on how long shopping took. (Stored on the order as
             `combined_fee`, the name of the old single customer-facing line.)
             Internally it splits between agent and company:
               - agent  : AGENT_BASE_SHARE + PER_MINUTE for every started
                          minute beyond INCLUDED_MINUTES
               - company: whatever remains of the service fee
             The agent always gets their full time-based share, even when it
             exceeds the service fee: the company's share then goes NEGATIVE,
             deliberately. Across all orders in a day the aggregate 7.5% is the
             company's margin, and a single long or cheap order running the
             company negative is absorbed there. Never cap the agent's share or
             floor the company's at zero.
  Delivery : courier quote; flat placeholder until a partner is live.
  EMTL     : ₦50 govt stamp duty per transfer >= EMTL_THRESHOLD. Pass-through.
  Transfer : provider fee per transfer. Pass-through. (OPay->OPay = 0.)

DEPOSIT POLICY:
  Every order pays DEPOSIT_RATE of the goods estimate up front, before
  shopping starts. Flagged/prepay customers pay 100% of the estimate instead.

All money is Decimal, quantized to 2 places.
"""

import math
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

# --- Service fee (customer-facing) and its internal agent/company split ---
SERVICE_FEE_RATE = Decimal("0.075")      # 7.5% of the goods total
AGENT_BASE_SHARE = Decimal("1000.00")    # agent's flat share, first 30 min
INCLUDED_MINUTES = 30                    # minutes covered by the base share
PER_MINUTE = Decimal("50.00")            # agent's, per minute beyond the window

# --- Delivery ---
DELIVERY_FEE_FLAT = Decimal("1500.00")   # placeholder until courier quotes live

# --- Delivery pay (what the rider and the hub earn per delivered order) ---
# Admin-configurable (orders/fee_settings.py); these are only the fallback when
# nothing has been set. Together they equal the flat delivery fee, so out of
# the box the delivery fee pays exactly the two people who carry the order.
DEFAULT_RIDER_FEE = Decimal("1000.00")
DEFAULT_HUB_FEE = Decimal("500.00")

# --- Government stamp duty (EMTL) ---
EMTL_PER_TRANSFER = Decimal("50.00")
EMTL_THRESHOLD = Decimal("10000.00")     # applies to transfers >= this

# --- Deposit policy ---
DEPOSIT_RATE = Decimal("0.30")           # 30% of the goods estimate, every order

# --- Mid-order additions ---
# Flat platform fee for adding a new item to an order that's already being
# shopped (see orders.service.add_item). Deliberately flat regardless of the
# item's own price or how far along shopping is - fair and predictable
# rather than punitive, per the product spec this came from. Charged
# separately from - and never folded into - the spending authorization cap:
# it's a platform fee, not goods money, same reasoning that already keeps
# delivery/the service fee out of goods_estimate (see Order.goods_estimate's
# own comment).
ADD_ITEM_FEE = Decimal("500.00")


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class PricingConfig:
    """The fee rules an order is priced by. The constants above are the
    built-in defaults; the admin can change them (platform settings) and each
    new order takes a snapshot of what applied when it was created
    (Order.pricing), so a later change never reprices an order in progress."""

    service_fee_rate: Decimal = SERVICE_FEE_RATE
    agent_base_share: Decimal = AGENT_BASE_SHARE
    included_minutes: int = INCLUDED_MINUTES
    per_minute: Decimal = PER_MINUTE
    delivery_fee: Decimal = DELIVERY_FEE_FLAT
    deposit_rate: Decimal = DEPOSIT_RATE
    add_item_fee: Decimal = ADD_ITEM_FEE
    emtl_per_transfer: Decimal = EMTL_PER_TRANSFER
    emtl_threshold: Decimal = EMTL_THRESHOLD

    def to_snapshot(self) -> dict:
        return {k: str(v) for k, v in self.__dict__.items()}

    @classmethod
    def from_snapshot(cls, snap: dict | None) -> "PricingConfig":
        """An order's own rules. Orders with no snapshot (created before
        pricing was editable) were priced by the built-in defaults."""
        if not snap:
            return DEFAULT_PRICING
        base = DEFAULT_PRICING
        kwargs = {}
        for name, default in base.__dict__.items():
            if name in snap:
                kwargs[name] = int(snap[name]) if isinstance(default, int) else Decimal(str(snap[name]))
        return cls(**kwargs)


DEFAULT_PRICING = PricingConfig()


def billable_minutes(seconds: float) -> int:
    """Round the shopping duration UP to whole started minutes."""
    if seconds <= 0:
        return 0
    return math.ceil(seconds / 60)


def service_fee(goods_total: Decimal, cfg: PricingConfig = DEFAULT_PRICING) -> Decimal:
    """The single customer-facing fee: a percentage of the goods. Time never enters."""
    return _money(goods_total * cfg.service_fee_rate)


def agent_share(shopping_seconds: float, cfg: PricingConfig = DEFAULT_PRICING) -> Decimal:
    """The agent's cut: base share plus overtime beyond the included window."""
    extra = max(0, billable_minutes(shopping_seconds) - cfg.included_minutes)
    return _money(cfg.agent_base_share + cfg.per_minute * extra)


def split_fee(
    goods_total: Decimal, shopping_seconds: float, cfg: PricingConfig = DEFAULT_PRICING
) -> dict[str, Decimal]:
    """Split the service fee into agent and company shares.

    agent + company == total, always - the company's share is simply the
    remainder, and may be negative (see the module docstring).
    """
    total = service_fee(goods_total, cfg)
    agent = agent_share(shopping_seconds, cfg)
    return {"total": total, "agent": agent, "company": total - agent}


def emtl_for_transfer(amount: Decimal, cfg: PricingConfig = DEFAULT_PRICING) -> Decimal:
    """Stamp duty on a single transfer: the flat charge if >= threshold, else 0."""
    return cfg.emtl_per_transfer if amount >= cfg.emtl_threshold else Decimal("0.00")


def calculate_fees(
    items_total: Decimal,
    shopping_seconds: float = 0.0,
    emtl_total: Decimal = Decimal("0.00"),
    transfer_fees_total: Decimal = Decimal("0.00"),
    delivery_fee: Decimal | None = None,
    cfg: PricingConfig = DEFAULT_PRICING,
) -> dict[str, Decimal]:
    """Final bill once shopping is done and real transfers are known.

    items_total          : sum of actual vendor transfers (goods)
    shopping_seconds     : affects only the agent/company split, never the bill
    emtl_total           : sum of stamp duty across the order's transfers
    transfer_fees_total  : sum of provider fees across the order's transfers
    delivery_fee         : courier quote; falls back to the configured delivery fee
    """
    fee = split_fee(items_total, shopping_seconds, cfg)
    delivery = cfg.delivery_fee if delivery_fee is None else delivery_fee
    grand_total = (
        items_total + fee["total"] + delivery + emtl_total + transfer_fees_total
    )
    return {
        "items_total": _money(items_total),
        "combined_fee": fee["total"],       # the service fee - single customer-facing line
        "company_share": fee["company"],    # internal; may be negative
        "agent_share": fee["agent"],        # internal
        "delivery_fee": _money(delivery),
        "emtl_total": _money(emtl_total),
        "transfer_fees_total": _money(transfer_fees_total),
        "grand_total": _money(grand_total),
    }


def estimate_order_value(
    listed_items_total: Decimal,
    delivery_fee: Decimal | None = None,
    cfg: PricingConfig = DEFAULT_PRICING,
) -> Decimal:
    """Pre-shopping estimate: listed goods + delivery + the service fee on them.

    Used for a must_prepay customer's 100% deposit. The spending authorization
    cap is sourced from the goods estimate alone, never from this.
    """
    delivery = cfg.delivery_fee if delivery_fee is None else delivery_fee
    return _money(listed_items_total + delivery + service_fee(listed_items_total, cfg))


def required_deposit(
    listed_items_total: Decimal,
    estimated_value: Decimal,
    *,
    must_prepay: bool = False,
    cfg: PricingConfig = DEFAULT_PRICING,
) -> Decimal:
    """Deposit due up front, before shopping starts.

    - must_prepay (flagged customer): 100% of the estimate.
    - everyone else, every order: the configured deposit rate of the GOODS estimate.
    """
    if must_prepay:
        return _money(estimated_value)
    return _money(listed_items_total * cfg.deposit_rate)


def pricing_summary(cfg: PricingConfig = DEFAULT_PRICING) -> dict:
    """The fee rules as public numbers - what GET /pricing returns, so the
    website's calculator and checkout never hard-code their own copies."""
    return {
        "service_fee_percent": str((cfg.service_fee_rate * 100).quantize(Decimal("0.1"))),
        "delivery_fee": str(cfg.delivery_fee),
        "delivery_fee_is_placeholder": False,
        "deposit_percent": str((cfg.deposit_rate * 100).quantize(Decimal("1"))),
        "add_item_fee": str(cfg.add_item_fee),
        "emtl_per_transfer": str(cfg.emtl_per_transfer),
        "emtl_threshold": str(cfg.emtl_threshold),
    }
