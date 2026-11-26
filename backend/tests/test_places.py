"""Delivery address search (Google Places) and the pin saved on orders and profiles."""

import httpx
import pytest

from app.core.config import settings
from app.locations import places
from tests.test_agent_dashboard import _login


async def _h(client, phone="+2348050007001"):
    return {"Authorization": f"Bearer {await _login(client, phone)}"}


@pytest.mark.asyncio
async def test_guests_can_search(client):
    r = await client.get("/locations/search", params={"q": "allen", "session": "abcdefgh"})
    assert r.status_code == 200 and r.json()[0]["title"] == "Allen Avenue"
    d = await client.get("/locations/place", params={"place_id": r.json()[0]["place_id"], "session": "abcdefgh"})
    assert d.status_code == 200


@pytest.mark.asyncio
async def test_guest_search_is_rate_limited(client):
    from app.locations import routes
    routes._recent.clear()
    codes = [(await client.get("/locations/search", params={"q": "allen", "session": "abcdefgh"})).status_code for _ in range(62)]
    assert codes.count(429) == 2 and codes[0] == 200
    routes._recent.clear()


@pytest.mark.asyncio
async def test_stub_search_and_details(client):
    h = await _h(client)
    r = await client.get("/locations/search", params={"q": "allen", "session": "abcdefgh"}, headers=h)
    assert r.status_code == 200 and r.json()[0]["title"] == "Allen Avenue"
    assert (await client.get("/locations/search", params={"q": "al", "session": "abcdefgh"}, headers=h)).json() == []
    pid = r.json()[0]["place_id"]
    d = (await client.get("/locations/place", params={"place_id": pid, "session": "abcdefgh"}, headers=h)).json()
    assert d["address"].startswith("Allen Avenue") and d["latitude"] and d["longitude"]


@pytest.mark.asyncio
async def test_google_path(client, monkeypatch):
    monkeypatch.setattr(settings, "google_maps_api_key", "k")
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        if req.url.path.endswith("places:autocomplete"):
            return httpx.Response(200, json={"suggestions": [{"placePrediction": {
                "placeId": "P1", "text": {"text": "12 Allen Ave, Ikeja"},
                "structuredFormat": {"mainText": {"text": "12 Allen Ave"}, "secondaryText": {"text": "Ikeja, Lagos"}}}}]})
        return httpx.Response(200, json={"id": "P1", "formattedAddress": "12 Allen Avenue, Ikeja, Lagos",
                                         "location": {"latitude": 6.6, "longitude": 3.35}})

    monkeypatch.setattr(places, "_transport", httpx.MockTransport(handler))
    h = await _h(client)
    r = await client.get("/locations/search", params={"q": "12 allen", "session": "abcdefgh"}, headers=h)
    assert r.json() == [{"place_id": "P1", "title": "12 Allen Ave", "subtitle": "Ikeja, Lagos"}]
    assert seen[0].headers["x-goog-api-key"] == "k"
    d = (await client.get("/locations/place", params={"place_id": "P1", "session": "abcdefgh"}, headers=h)).json()
    assert d == {"place_id": "P1", "address": "12 Allen Avenue, Ikeja, Lagos", "latitude": 6.6, "longitude": 3.35}


@pytest.mark.asyncio
async def test_google_down_gives_a_friendly_503(client, monkeypatch):
    monkeypatch.setattr(settings, "google_maps_api_key", "k")
    monkeypatch.setattr(places, "_transport", httpx.MockTransport(lambda r: httpx.Response(500)))
    r = await client.get("/locations/search", params={"q": "allen", "session": "abcdefgh"}, headers=await _h(client))
    assert r.status_code == 503 and "Type your address" in r.json()["detail"]


@pytest.mark.asyncio
async def test_profile_address_keeps_its_pin(client):
    h = await _h(client)
    body = {"default_delivery_address": "12 Allen Avenue", "default_delivery_landmark": "Green gate",
            "default_delivery_latitude": 6.6, "default_delivery_longitude": 3.35}
    me = (await client.patch("/auth/me", headers=h, json=body)).json()
    assert me["default_delivery_landmark"] == "Green gate" and me["default_delivery_latitude"] == 6.6
    # A typed address replaces the pin: it has none.
    me = (await client.patch("/auth/me", headers=h, json={"default_delivery_address": "Somewhere else"})).json()
    assert me["default_delivery_latitude"] is None and me["default_delivery_landmark"] is None
    # Changing only the name leaves the address and pin alone.
    await client.patch("/auth/me", headers=h, json=body)
    me = (await client.patch("/auth/me", headers=h, json={"full_name": "Ada"})).json()
    assert me["default_delivery_latitude"] == 6.6


@pytest.mark.asyncio
async def test_order_keeps_pin_and_landmark(client, db_session_factory):
    import uuid
    from app.markets.models import Market
    async with db_session_factory() as s:
        m = Market(name="Mile 12", city="Lagos", state="Lagos")
        s.add(m)
        await s.commit()
        mid = str(m.id)
    h = await _h(client)
    r = await client.post("/orders", headers=h, json={
        "market_id": mid, "delivery_address": "12 Allen Avenue", "delivery_landmark": "Green gate",
        "dropoff_latitude": 6.6, "dropoff_longitude": 3.35,
        "items": [{"description": "Tomatoes", "listed_price": "500.00"}]})
    assert r.status_code == 201, r.text
    o = r.json()
    assert (o["delivery_landmark"], o["dropoff_latitude"], o["dropoff_longitude"]) == ("Green gate", 6.6, 3.35)


async def _market(db_session_factory, lat=6.5994, lng=3.3921):
    from app.markets.models import Market
    async with db_session_factory() as s:
        m = Market(name="Mile 12", city="Lagos", state="Lagos", latitude=lat, longitude=lng)
        s.add(m)
        await s.commit()
        return str(m.id)


@pytest.mark.asyncio
async def test_delivery_quote_by_distance(client, db_session_factory):
    from decimal import Decimal
    mid = await _market(db_session_factory)
    q = lambda lat, lng: client.get("/locations/delivery-quote", params={"market_id": mid, "lat": lat, "lng": lng})  # noqa: E731
    near = (await q(6.6018, 3.3515)).json()          # Allen Avenue, ~4 km: inside the covered distance
    assert near["deliverable"] and near["distance_km"] < 5
    mid_ = (await q(6.4474, 3.4723)).json()          # Lekki, ~20 km
    assert mid_["deliverable"] and Decimal(mid_["delivery_fee"]) > Decimal(near["delivery_fee"])
    far = (await q(7.38, 3.9)).json()                 # Ibadan, ~140 km
    assert not far["deliverable"] and "30 km" in far["reason"]


@pytest.mark.asyncio
async def test_order_is_priced_for_distance_and_refused_when_too_far(client, db_session_factory):
    from decimal import Decimal
    mid = await _market(db_session_factory)
    h = await _h(client)
    item = [{"description": "Tomatoes", "listed_price": "500.00"}]
    flat = (await client.post("/orders", headers=h, json={"market_id": mid, "delivery_address": "12 Allen Avenue", "items": item})).json()
    lekki = (await client.post("/orders", headers=h, json={"market_id": mid, "delivery_address": "Lekki", "dropoff_latitude": 6.4474, "dropoff_longitude": 3.4723, "items": item})).json()
    assert Decimal(lekki["estimated_value"]) > Decimal(flat["estimated_value"])
    r = await client.post("/orders", headers=h, json={"market_id": mid, "delivery_address": "Ibadan", "dropoff_latitude": 7.38, "dropoff_longitude": 3.9, "items": item})
    assert r.status_code == 422 and "We deliver up to 30 km" in r.json()["detail"]


@pytest.mark.asyncio
async def test_no_pin_or_no_market_coordinates_means_flat_fee(client, db_session_factory):
    mid = await _market(db_session_factory, lat=None, lng=None)
    q = (await client.get("/locations/delivery-quote", params={"market_id": mid, "lat": 7.38, "lng": 3.9})).json()
    assert q["deliverable"] and q["distance_km"] is None
