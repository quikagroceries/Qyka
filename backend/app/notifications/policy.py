"""Which notifications a user gets, and on which channels.

Every notification kind belongs to one preference category (the Settings
toggles). Two kinds are CRITICAL - operational, not marketing - and always
send, in-app AND off-app (email/SMS), whatever the user's toggles say:
a user can mute offers and chatter, but not "your payment is due" or "your
order is arriving". Everything else is in-app only and respects its toggle.
"""

ORDER_UPDATES = "order_updates"
AGENT_MESSAGES = "agent_messages"
PAYMENT_REMINDERS = "payment_reminders"
OFFERS = "offers"

# Preference category -> the User column that holds its on/off toggle.
PREFERENCE_FIELDS = {
    ORDER_UPDATES: "notify_order_updates",
    AGENT_MESSAGES: "notify_agent_messages",
    PAYMENT_REMINDERS: "notify_payment_reminders",
    OFFERS: "notify_offers",
}

KIND_CATEGORY = {
    "payment_due": PAYMENT_REMINDERS,
    "out_for_delivery": ORDER_UPDATES,
    "order_cancelled": ORDER_UPDATES,
    "item_unavailable": ORDER_UPDATES,
    "item_decided": ORDER_UPDATES,
    "item_added": ORDER_UPDATES,
    "item_overage": ORDER_UPDATES,
    "item_overage_decided": ORDER_UPDATES,
    "overage_approval": ORDER_UPDATES,
    "agent_message": AGENT_MESSAGES,
    "offer": OFFERS,
}

CRITICAL_KINDS = frozenset({"payment_due", "out_for_delivery"})


def category_for(kind: str) -> str:
    """Unknown kinds count as order updates - the safest default for anything
    new that's added later without being listed here."""
    return KIND_CATEGORY.get(kind, ORDER_UPDATES)


def is_critical(kind: str) -> bool:
    return kind in CRITICAL_KINDS


def wants(user, kind: str) -> bool:
    """Should `user` get this notification at all? Critical kinds: always."""
    if is_critical(kind):
        return True
    return bool(getattr(user, PREFERENCE_FIELDS[category_for(kind)], True))
