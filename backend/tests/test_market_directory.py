"""The launch market directory now lives in the backend: slugs the frontend
matches on, metadata it renders, and status that decides orderability."""

import pytest
from sqlalchemy import func, select

from app.markets.directory import DIRECTORY_MARKETS, upsert_directory_markets
from app.markets.models import Market
from app.orders.models import Order
from tests.test_admin import _login, _login_admin

SLUGS = {m["slug"] for m in DIRECTORY_MARKETS}


async def _seed(db_session_factory):
    async with db_session_factory() as s:
        await upsert_directory_markets(s)
        await s.commit()


def _order(market_id):
    return {"market_id": str(market_id), "listed_items_total": "5000.00", "items": [{"description": "rice"}]}


@pytest.mark.asyncio
async def test_api_returns_the_directory_markets_with_all_fields(client, db_session_factory):
    await _seed(db_session_factory)
    r = await client.get("/markets")
    assert r.status_code == 200
    by_slug = {m["slug"]: m for m in r.json()}
    assert set(by_slug) == SLUGS and len(by_slug) == 6

    balogun = by_slug["balogun"]
    assert balogun["name"] == "Balogun Market"
    assert balogun["description"].startswith("Dense stalls")
    assert balogun["status"] == "pilot"
    assert balogun["categories"] == ["provisions", "produce", "spices"]
    assert balogun["image_url"].startswith("https://res.cloudinary.com/")
    assert (balogun["opening_time"], balogun["closing_time"], balogun["timezone"]) == ("08:00:00", "20:00:00", "Africa/Lagos")

    r = await client.get("/markets/slug/spar-lekki")
    assert r.status_code == 200 and r.json()["venue_type"] == "supermarket"
    assert (await client.get("/markets/slug/nowhere")).status_code == 404


@pytest.mark.asyncio
async def test_all_directory_markets_are_orderable(client, db_session_factory):
    await _seed(db_session_factory)
    h = {"Authorization": f"Bearer {await _login(client, '08061110001')}"}
    markets = (await client.get("/markets")).json()
    assert all(m["status"] in ("pilot", "live") for m in markets)
    for m in markets:
        r = await client.post("/orders", headers=h, json=_order(m["id"]))
        assert r.status_code == 201, (m["slug"], r.text)


@pytest.mark.asyncio
async def test_coming_soon_market_refuses_orders(client, db_session_factory):
    admin_h = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'dir1@qyka.com')}"}
    r = await client.post("/markets", headers=admin_h, json={"name": "Oyingbo Market", "city": "Ebute Metta", "state": "Lagos"})
    assert r.status_code == 201, r.text
    market = r.json()
    assert market["status"] == "coming_soon" and market["slug"] == "oyingbo-market"

    h = {"Authorization": f"Bearer {await _login(client, '08061110002')}"}
    r = await client.post("/orders", headers=h, json=_order(market["id"]))
    assert r.status_code == 409
    assert r.json()["detail"] == "Oyingbo Market is coming soon — not available yet."
    async with db_session_factory() as s:
        assert (await s.execute(select(func.count()).select_from(Order))).scalar_one() == 0

    # Launching it is just a status flip.
    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"status": "live"})
    assert r.status_code == 200 and r.json()["status"] == "live"
    r = await client.post("/orders", headers=h, json=_order(market["id"]))
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_rename_keeps_the_slug(client, db_session_factory):
    await _seed(db_session_factory)
    admin_h = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'dir2@qyka.com')}"}
    market = (await client.get("/markets/slug/balogun")).json()

    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"name": "Balogun Market, Lagos Island"})
    assert r.status_code == 200
    assert (r.json()["name"], r.json()["slug"]) == ("Balogun Market, Lagos Island", "balogun")
    r = await client.get("/markets/slug/balogun")                 # the match survives the rename
    assert r.json()["id"] == market["id"] and r.json()["name"] == "Balogun Market, Lagos Island"


@pytest.mark.asyncio
async def test_slug_is_unique_and_immutable(client, db_session_factory):
    await _seed(db_session_factory)
    admin_h = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'dir3@qyka.com')}"}

    r = await client.post("/markets", headers=admin_h, json={"name": "Another Balogun", "slug": "balogun", "city": "x", "state": "Lagos"})
    assert r.status_code == 409
    r = await client.post("/markets", headers=admin_h, json={"name": "Bad", "slug": "Not A Slug!", "city": "x", "state": "Lagos"})
    assert r.status_code == 422
    # A name that slugifies onto a taken slug gets a unique one instead.
    r = await client.post("/markets", headers=admin_h, json={"name": "Wuse", "city": "Abuja", "state": "FCT"})
    assert r.status_code == 201 and r.json()["slug"] == "wuse-2"

    market = (await client.get("/markets/slug/bodija")).json()
    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"slug": "bodija-ibadan"})
    assert r.status_code == 400
    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"slug": "bodija", "description": "Updated"})
    assert r.status_code == 200 and r.json()["description"] == "Updated"   # resending the same slug is fine
    assert (await client.get("/markets/slug/bodija")).json()["slug"] == "bodija"


@pytest.mark.asyncio
async def test_admin_edits_metadata_and_bad_values_are_refused(client, db_session_factory):
    await _seed(db_session_factory)
    admin_h = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'dir4@qyka.com')}"}
    market = (await client.get("/markets/slug/wuse")).json()
    url = "https://res.cloudinary.com/y0vuqbu5/image/upload/v1/site-assets/wuse.png"
    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={
        "description": "Abuja's busiest market.", "categories": ["fish", "grains"], "image_url": url,
        "opening_time": "07:00", "closing_time": "19:00",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["description"], body["categories"], body["image_url"]) == ("Abuja's busiest market.", ["fish", "grains"], url)
    assert (body["opening_time"], body["closing_time"]) == ("07:00:00", "19:00:00")

    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"description": "Still here"})
    assert r.json()["image_url"] == url                               # omitted -> unchanged
    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"image_url": ""})
    assert r.status_code == 200 and r.json()["image_url"] is None     # "" -> removed

    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"categories": ["toys"]})
    assert r.status_code == 422
    r = await client.patch(f"/markets/{market['id']}", headers=admin_h, json={"image_url": "https://evil.example.com/x.png"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_seeding_enriches_an_existing_market_instead_of_duplicating_it(client, db_session_factory):
    """A database that already has 'Balogun Market' (with its orders, agents,
    stalls) must get that same row enriched - never a second Balogun."""
    async with db_session_factory() as s:
        old = Market(name="  balogun market ", city="Lagos", state="Lagos")
        s.add(old)
        await s.commit()
        old_id = old.id

    await _seed(db_session_factory)
    await _seed(db_session_factory)   # running it twice changes nothing

    async with db_session_factory() as s:
        assert (await s.execute(select(func.count()).select_from(Market))).scalar_one() == 6
        balogun = (await s.execute(select(Market).where(Market.slug == "balogun"))).scalar_one()
    assert balogun.id == old_id
