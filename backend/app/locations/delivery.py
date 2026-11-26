"""Can we deliver there, and what does it cost?

Distance is measured in a straight line from the market to the delivery pin
(roads are longer, so the per-km rate is set with that in mind). An address
with no pin, or a market with no coordinates, gets the plain flat delivery
fee: we only charge for distance we can actually measure.
"""

import math
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.markets.models import Market
from app.platform_settings import service as platform


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def quote(db: AsyncSession, market: Market | None, lat: float | None, lng: float | None) -> dict:
    base = Decimal((await platform.pricing(db)).delivery_fee)
    if market is None or lat is None or lng is None or market.latitude is None or market.longitude is None:
        return {"deliverable": True, "distance_km": None, "delivery_fee": base, "reason": None}

    km = haversine_km(market.latitude, market.longitude, lat, lng)
    radius = int(await platform.get(db, "delivery_radius_km"))
    if radius and km > radius:
        return {"deliverable": False, "distance_km": round(km, 1), "delivery_fee": base,
                "reason": f"That address is about {km:.0f} km from {market.name}. We deliver up to {radius} km."}

    included = int(await platform.get(db, "delivery_included_km"))
    per_km = Decimal(await platform.get(db, "delivery_per_km"))
    extra_km = max(0, math.ceil(km - included))
    return {"deliverable": True, "distance_km": round(km, 1),
            "delivery_fee": (base + per_km * extra_km).quantize(Decimal("0.01")), "reason": None}
