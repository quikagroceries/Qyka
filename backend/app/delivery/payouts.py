"""Payout split — how a paid order's money is divided on delivery confirmation.

When the customer paid, the full grand_total was credited back into the float
pool (Week 3). Payout is the mirror: on delivery confirmation we release the
agent's and rider's shares OUT of the pool to them, and the company retains the
rest (item cost recovery + service charge margin).

Kept isolated like fees.py so the split policy lives in one place. In V1 this
records the split on the transaction; actual disbursement to agent/rider bank
accounts via Paystack Transfers is a thin call layered on top later.
"""

from decimal import Decimal

from app.orders.models import Order


def compute_split(order: Order) -> dict[str, str]:
    """Return the payout breakdown for a delivered order, as string amounts.

    - agent_payout   : the agent's fee
    - rider_payout   : the rider's fee (snapshotted on the order)
    - hub_payout     : the hub shopkeeper's fee (snapshotted on the order)
    - courier_cost   : LEGACY - the whole delivery fee, for orders that went
                       out before riders existed (no rider on the order)
    - company_retained: service-fee margin, plus whatever the delivery fee
                       leaves after the rider and hub are paid (negative if
                       they're paid more than the customer's delivery fee)
    """
    agent_payout = order.agent_share
    rider_payout = order.rider_fee if order.rider_id is not None else Decimal("0.00")
    hub_payout = order.hub_fee if order.hub_id is not None else Decimal("0.00")
    courier_cost = order.delivery_fee if order.rider_id is None else Decimal("0.00")
    company_retained = (
        order.company_share + order.delivery_fee - rider_payout - hub_payout - courier_cost
    )
    return {
        "agent_payout": str(agent_payout),
        "rider_payout": str(rider_payout),
        "hub_payout": str(hub_payout),
        "courier_cost": str(courier_cost),
        "company_retained": str(company_retained),
        "grand_total": str(order.grand_total),
    }
