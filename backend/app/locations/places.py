"""Address search for delivery, through Google Places (API "New").

Called only from our server, so the key never reaches a phone. A search is one
"session": the autocomplete calls and the final details call share a session
token, which Google bills as a single lookup.

Outside production with no key set, a small built-in list of Lagos places
answers instead, so the app and the tests work without Google.
"""

import uuid

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
DETAILS_URL = "https://places.googleapis.com/v1/places/{id}"

# Where results are favoured (not limited to): Lagos.
LAGOS = {"circle": {"center": {"latitude": 6.5244, "longitude": 3.3792}, "radius": 50000.0}}

# Tests swap this for httpx.MockTransport.
_transport: httpx.AsyncBaseTransport | None = None

_STUBS = [
    ("Mile 12 Market, Ikorodu Road, Lagos", 6.5994, 3.3921),
    ("Allen Avenue, Ikeja, Lagos", 6.6018, 3.3515),
    ("Ikeja City Mall, Obafemi Awolowo Way, Ikeja", 6.6143, 3.3587),
    ("Lekki Phase 1, Lagos", 6.4474, 3.4723),
    ("Yaba Tech, Herbert Macaulay Way, Yaba", 6.5158, 3.3711),
    ("Surulere, Adeniran Ogunsanya Street, Lagos", 6.4969, 3.3556),
    ("Victoria Island, Adetokunbo Ademola Street, Lagos", 6.4281, 3.4219),
]


def _use_stub() -> bool:
    return not settings.google_maps_api_key and settings.environment != "production"


def _unavailable() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Address search isn't available right now. Type your address instead.")


async def search(query: str, session: str) -> list[dict]:
    q = query.strip()
    if len(q) < 3:
        return []
    if _use_stub():
        return [
            {"place_id": f"stub:{i}", "title": a.split(",")[0], "subtitle": ", ".join(a.split(",")[1:]).strip()}
            for i, (a, _, _) in enumerate(_STUBS) if q.lower() in a.lower()
        ][:5]
    if not settings.google_maps_api_key:
        raise _unavailable()
    body = {
        "input": q, "sessionToken": session, "languageCode": "en",
        "includedRegionCodes": ["ng"], "locationBias": LAGOS,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, transport=_transport) as client:
            r = await client.post(AUTOCOMPLETE_URL, json=body, headers={"X-Goog-Api-Key": settings.google_maps_api_key})
        r.raise_for_status()
    except httpx.HTTPError:
        raise _unavailable()
    out = []
    for s in r.json().get("suggestions", []):
        p = s.get("placePrediction")
        if not p:
            continue
        fmt = p.get("structuredFormat", {})
        out.append({
            "place_id": p["placeId"],
            "title": fmt.get("mainText", {}).get("text") or p.get("text", {}).get("text", ""),
            "subtitle": fmt.get("secondaryText", {}).get("text", ""),
        })
    return out[:5]


async def details(place_id: str, session: str) -> dict:
    if _use_stub():
        try:
            address, lat, lng = _STUBS[int(place_id.removeprefix("stub:"))]
        except (ValueError, IndexError):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
        return {"place_id": place_id, "address": address, "latitude": lat, "longitude": lng}
    if not settings.google_maps_api_key:
        raise _unavailable()
    try:
        async with httpx.AsyncClient(timeout=8.0, transport=_transport) as client:
            r = await client.get(
                DETAILS_URL.format(id=place_id),
                params={"sessionToken": session},
                headers={"X-Goog-Api-Key": settings.google_maps_api_key,
                         "X-Goog-FieldMask": "id,formattedAddress,location"},
            )
        if r.status_code == 404:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
        r.raise_for_status()
    except httpx.HTTPError:
        raise _unavailable()
    d = r.json()
    loc = d.get("location") or {}
    if "latitude" not in loc or "longitude" not in loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That place has no location")
    return {"place_id": d.get("id", place_id), "address": d.get("formattedAddress", ""),
            "latitude": loc["latitude"], "longitude": loc["longitude"]}
