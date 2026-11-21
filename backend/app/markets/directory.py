"""The launch market directory - the markets the website lists, now owned by
the backend (they used to be hard-coded in the frontend's marketDirectory.ts
and matched onto API markets by name).

The migration that introduced slugs (b5c6d7e8f9a0) seeds a frozen copy of
this list into existing databases; this module is the live copy the dev seed
and tests use. Both upsert the same way: match an existing market by slug,
then by name - so a market that already exists (with its orders, agents and
stalls) is enriched in place - and only create one when nothing matches.
"""

import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MarketStatus
from app.markets.models import Market

FOOD_CATEGORIES = ("produce", "provisions", "protein", "spices", "fish", "grains", "household")

_IMG = "https://res.cloudinary.com/y0vuqbu5/image/upload/f_auto,q_auto"
CAT_PANTRY = f"{_IMG}/v1794666605/site-assets/qyka-cat-pantry.png"
CAT_PRODUCE = f"{_IMG}/v1794666608/site-assets/qyka-cat-produce.png"
CAT_PROTEIN = f"{_IMG}/v1794666611/site-assets/qyka-cat-protein.png"
TRUST_BASKET = f"{_IMG}/v1794666618/site-assets/qyka-trust-basket.png"

# All pilot: these are the markets in use for testing and the pilot, and all
# take orders. coming_soon is kept for future markets not set up yet.
DIRECTORY_MARKETS: list[dict] = [
    {
        "slug": "balogun", "name": "Balogun Market", "city": "Lagos Island", "state": "Lagos",
        "venue_type": "local_market", "latitude": 6.4550, "longitude": 3.3841,
        "description": "Dense stalls, sharp bargaining, provisions and produce in one dense loop.",
        "categories": ["provisions", "produce", "spices"], "image_url": CAT_PRODUCE,
    },
    {
        "slug": "mile-12", "name": "Mile 12 Market", "city": "Ketu", "state": "Lagos",
        "venue_type": "local_market", "latitude": 6.6093, "longitude": 3.3935,
        "description": "Wholesale produce hub — peppers, tomatoes, and bulk restocks.",
        "categories": ["produce", "fish", "grains"], "image_url": CAT_PROTEIN,
    },
    {
        "slug": "bodija", "name": "Bodija Market", "city": "Ibadan", "state": "Oyo",
        "venue_type": "local_market", "latitude": 7.4356, "longitude": 3.9147,
        "description": "Classic open-air shopping for families across Ibadan.",
        "categories": ["produce", "provisions", "grains"], "image_url": CAT_PANTRY,
    },
    {
        "slug": "wuse", "name": "Wuse Market", "city": "Abuja", "state": "FCT",
        "venue_type": "local_market", "latitude": 9.0645, "longitude": 7.4833,
        "description": "Capital city stalls for everyday groceries and specialty finds.",
        "categories": ["provisions", "protein", "household"], "image_url": TRUST_BASKET,
    },
    {
        "slug": "shoprite-ikeja", "name": "Shoprite Ikeja City Mall", "city": "Ikeja", "state": "Lagos",
        "venue_type": "supermarket", "latitude": 6.6194, "longitude": 3.3571,
        "description": "Fixed prices, labelled aisles — faster when you know exactly what you need.",
        "categories": ["provisions", "produce", "protein", "household"], "image_url": CAT_PANTRY,
    },
    {
        "slug": "spar-lekki", "name": "Spar Lekki", "city": "Lekki", "state": "Lagos",
        "venue_type": "supermarket", "latitude": 6.4474, "longitude": 3.4723,
        "description": "Shelf prices you can trust — Qyka still picks and delivers.",
        "categories": ["provisions", "produce", "household"], "image_url": TRUST_BASKET,
    },
]

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80] or "market"


async def unique_slug(db: AsyncSession, base: str) -> str:
    slug, n = base, 2
    while (await db.execute(select(Market.id).where(Market.slug == slug))).first() is not None:
        slug, n = f"{base}-{n}", n + 1
    return slug


async def upsert_directory_markets(db: AsyncSession) -> list[Market]:
    """Make the directory markets exist, enriching any already there."""
    out = []
    for spec in DIRECTORY_MARKETS:
        market = (await db.execute(select(Market).where(Market.slug == spec["slug"]))).scalar_one_or_none()
        if market is None:
            market = (await db.execute(
                select(Market).where(func.lower(func.trim(Market.name)) == spec["name"].lower())
            )).scalars().first()
        if market is None:
            market = Market(slug=spec["slug"], name=spec["name"], is_active=True)
            db.add(market)
        elif market.slug != spec["slug"]:
            # Matched by name (e.g. an admin-created "Balogun Market" with a
            # derived slug): give it the directory's slug, which is free -
            # the slug lookup above found nothing. Same as the migration.
            market.slug = spec["slug"]
        for field in ("city", "state", "venue_type", "description", "categories", "image_url"):
            setattr(market, field, spec[field])
        if market.latitude is None:
            market.latitude, market.longitude = spec["latitude"], spec["longitude"]
        market.status = MarketStatus.PILOT
        out.append(market)
    await db.flush()
    return out
