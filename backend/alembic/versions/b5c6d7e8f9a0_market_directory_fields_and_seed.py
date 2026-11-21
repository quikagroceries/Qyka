"""market directory fields (slug, description, status, categories, image_url)
and seed the launch markets

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-11-20 00:00:00.000000

Moves the website's hard-coded market directory into the database. For each
launch market: if a market with the same name (case/whitespace-insensitive)
already exists, it is ENRICHED in place - keeping its id, orders, agents and
stalls - and only created when nothing matches, so no duplicates. Every other
existing market keeps working and gets a slug derived from its name.

The market list below is a frozen copy of app/markets/directory.py on purpose:
a migration must keep doing exactly what it did, whatever that module becomes.
"""
import json
import re
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'a4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

market_status = postgresql.ENUM('COMING_SOON', 'PILOT', 'LIVE', name='marketstatus')

_IMG = "https://res.cloudinary.com/y0vuqbu5/image/upload/f_auto,q_auto"
_PANTRY = f"{_IMG}/v1794666605/site-assets/qyka-cat-pantry.png"
_PRODUCE = f"{_IMG}/v1794666608/site-assets/qyka-cat-produce.png"
_PROTEIN = f"{_IMG}/v1794666611/site-assets/qyka-cat-protein.png"
_BASKET = f"{_IMG}/v1794666618/site-assets/qyka-trust-basket.png"

LAUNCH_MARKETS = [
    ("balogun", "Balogun Market", "Lagos Island", "Lagos", "local_market", 6.4550, 3.3841,
     "Dense stalls, sharp bargaining, provisions and produce in one dense loop.",
     ["provisions", "produce", "spices"], _PRODUCE),
    ("mile-12", "Mile 12 Market", "Ketu", "Lagos", "local_market", 6.6093, 3.3935,
     "Wholesale produce hub — peppers, tomatoes, and bulk restocks.",
     ["produce", "fish", "grains"], _PROTEIN),
    ("bodija", "Bodija Market", "Ibadan", "Oyo", "local_market", 7.4356, 3.9147,
     "Classic open-air shopping for families across Ibadan.",
     ["produce", "provisions", "grains"], _PANTRY),
    ("wuse", "Wuse Market", "Abuja", "FCT", "local_market", 9.0645, 7.4833,
     "Capital city stalls for everyday groceries and specialty finds.",
     ["provisions", "protein", "household"], _BASKET),
    ("shoprite-ikeja", "Shoprite Ikeja City Mall", "Ikeja", "Lagos", "supermarket", 6.6194, 3.3571,
     "Fixed prices, labelled aisles — faster when you know exactly what you need.",
     ["provisions", "produce", "protein", "household"], _PANTRY),
    ("spar-lekki", "Spar Lekki", "Lekki", "Lagos", "supermarket", 6.4474, 3.4723,
     "Shelf prices you can trust — Qyka still picks and delivers.",
     ["provisions", "produce", "household"], _BASKET),
]


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80] or "market"


def upgrade() -> None:
    bind = op.get_bind()
    market_status.create(bind, checkfirst=True)

    op.add_column('markets', sa.Column('slug', sa.String(length=80), nullable=True))
    op.add_column('markets', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('markets', sa.Column(
        'status', postgresql.ENUM(name='marketstatus', create_type=False),
        nullable=False, server_default='PILOT',  # existing markets already take orders
    ))
    op.add_column('markets', sa.Column('categories', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('markets', sa.Column('image_url', sa.String(length=500), nullable=True))

    for slug, name, city, state, venue, lat, lng, desc, cats, img in LAUNCH_MARKETS:
        params = {
            "slug": slug, "name": name, "city": city, "state": state, "venue": venue,
            "lat": lat, "lng": lng, "desc": desc, "cats": json.dumps(cats), "img": img,
        }
        # Enrich the existing market with this name - the one with the most
        # orders, should there ever be two.
        existing = bind.execute(sa.text(
            "SELECT m.id FROM markets m WHERE lower(trim(m.name)) = lower(:name) "
            "ORDER BY (SELECT count(*) FROM orders o WHERE o.market_id = m.id) DESC LIMIT 1"
        ), {"name": name}).scalar()
        if existing is not None:
            bind.execute(sa.text(
                "UPDATE markets SET slug = :slug, description = :desc, status = 'PILOT', "
                "categories = CAST(:cats AS json), image_url = :img, city = :city, state = :state, "
                "venue_type = :venue, latitude = coalesce(latitude, :lat), "
                "longitude = coalesce(longitude, :lng) WHERE id = :id"
            ), {**params, "id": existing})
        else:
            bind.execute(sa.text(
                "INSERT INTO markets (id, slug, name, city, state, is_active, venue_type, latitude, "
                "longitude, description, status, categories, image_url, opening_time, closing_time, timezone) "
                "VALUES (:id, :slug, :name, :city, :state, true, :venue, :lat, :lng, :desc, 'PILOT', "
                "CAST(:cats AS json), :img, '08:00:00', '20:00:00', 'Africa/Lagos')"
            ), {**params, "id": uuid.uuid4()})

    # Every other market (e.g. ones an admin added) gets a unique slug too.
    taken = {row[0] for row in bind.execute(sa.text("SELECT slug FROM markets WHERE slug IS NOT NULL"))}
    for market_id, name in bind.execute(sa.text("SELECT id, name FROM markets WHERE slug IS NULL ORDER BY name")).all():
        base = _slugify(name)
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        taken.add(slug)
        bind.execute(sa.text("UPDATE markets SET slug = :slug WHERE id = :id"), {"slug": slug, "id": market_id})

    op.alter_column('markets', 'slug', nullable=False)
    op.create_index(op.f('ix_markets_slug'), 'markets', ['slug'], unique=True)
    op.create_index(op.f('ix_markets_status'), 'markets', ['status'], unique=False)
    # Populated-table rule: defaults were only for existing rows.
    op.alter_column('markets', 'status', server_default=None)
    op.alter_column('markets', 'categories', server_default=None)


def downgrade() -> None:
    # Markets created by upgrade() are kept (they may have orders by now);
    # only the new columns go.
    op.drop_index(op.f('ix_markets_status'), table_name='markets')
    op.drop_index(op.f('ix_markets_slug'), table_name='markets')
    op.drop_column('markets', 'image_url')
    op.drop_column('markets', 'categories')
    op.drop_column('markets', 'status')
    op.drop_column('markets', 'description')
    op.drop_column('markets', 'slug')
    market_status.drop(op.get_bind(), checkfirst=True)
