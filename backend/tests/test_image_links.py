"""Image links users send must be uploads on OUR Cloudinary account - checked
by one shared validator (core/media.py) on every field that stores one:
purchase receipts, chat images, packing photos, profile photos."""

import pytest
import pytest_asyncio

from app.core.config import settings
from app.core.media import is_our_cloudinary_url
from tests.test_jit import _order_shopping, _setup

OURS = f"https://res.cloudinary.com/{settings.cloudinary_cloud_name}/image/upload/v1/receipts/r1.jpg"

BAD = [
    "https://evil.example.com/x.jpg",                                           # not Cloudinary at all
    "https://res.cloudinary.com/demo/image/upload/v1/x.jpg",                    # another Cloudinary account
    "https://cloudinary.evil.com/y0vuqbu5/image/upload/v1/x.jpg",               # lookalike domain
    "https://res.cloudinary.com.evil.com/y0vuqbu5/image/upload/v1/x.jpg",       # our host as a prefix of theirs
    "https://res.cloudinary.com@evil.com/y0vuqbu5/image/upload/v1/x.jpg",       # userinfo trick
    "https://evil.com/res.cloudinary.com/y0vuqbu5/x.jpg",                       # our host in the path
    "https://res.cloudinary.com/y0vuqbu5evil/image/upload/v1/x.jpg",            # our cloud name as a prefix
    "http://res.cloudinary.com/y0vuqbu5/image/upload/v1/x.jpg",                 # not https
    "https://res.cloudinary.com:8443/y0vuqbu5/image/upload/v1/x.jpg",           # odd port
    "javascript:alert(1)",
    "photos/pack1.jpg",                                                         # bare key, not a link
]


def test_only_our_cloudinary_account_passes():
    assert is_our_cloudinary_url(OURS)
    assert is_our_cloudinary_url("https://RES.CLOUDINARY.COM/y0vuqbu5/image/upload/x.png")   # host case-insensitive
    for url in BAD:
        assert not is_our_cloudinary_url(url), url


@pytest_asyncio.fixture
async def shopping_order(client, db_session_factory, monkeypatch):
    admin_h, agent_h, market_id, _, _ = await _setup(client, db_session_factory, monkeypatch)
    oid, items = await _order_shopping(client, admin_h, agent_h, market_id)
    return admin_h, agent_h, oid, items


def _pay(item_id, photo_ref):
    return {"account_number": "9012345678", "bank_code": "999992", "photo_ref": photo_ref,
            "items": [{"item_id": item_id, "price": "1000.00"}]}


@pytest.mark.asyncio
async def test_purchase_receipt_photos(client, shopping_order):
    admin_h, agent_h, oid, items = shopping_order
    for url in BAD[:4]:
        r = await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json=_pay(items[0]["id"], url))
        assert r.status_code == 422 and "uploaded through Qyka" in r.text, url

    r = await client.post(f"/jit/orders/{oid}/pay-vendor", headers=agent_h, json=_pay(items[0]["id"], OURS))
    assert r.status_code == 200, r.text
    assert r.json()["photo_ref"] == OURS
    transfer_id = r.json()["id"]

    # Attaching / replacing the photo afterwards: same rule.
    for url in BAD[:4]:
        r = await client.post(f"/jit/orders/{oid}/purchases/{transfer_id}/photo", headers=agent_h, json={"photo_ref": url})
        assert r.status_code == 422, url
    r = await client.post(f"/jit/orders/{oid}/purchases/{transfer_id}/photo", headers=agent_h,
                          json={"photo_ref": OURS.replace("r1", "r2")})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_chat_images(client, shopping_order):
    admin_h, agent_h, oid, _ = shopping_order
    for url in BAD[:4]:
        r = await client.post(f"/orders/{oid}/messages", headers=admin_h, json={"image_url": url})
        assert r.status_code == 422 and "uploaded through Qyka" in r.text, url
    r = await client.post(f"/orders/{oid}/messages", headers=admin_h, json={"image_url": OURS})
    assert r.status_code in (200, 201), r.text
    r = await client.post(f"/orders/{oid}/messages", headers=admin_h, json={"text": "plain text still fine"})
    assert r.status_code in (200, 201), r.text


@pytest.mark.asyncio
async def test_packing_photos(client, shopping_order):
    admin_h, agent_h, oid, _ = shopping_order
    for url in BAD[:4]:
        r = await client.post(f"/delivery/orders/{oid}/packing-photos", headers=agent_h, json={"refs": [OURS, url]})
        assert r.status_code == 422 and "uploaded through Qyka" in r.text, url
    r = await client.post(f"/delivery/orders/{oid}/packing-photos", headers=agent_h, json={"refs": [OURS]})
    assert r.status_code == 200 and r.json()["packing_photos"] == [OURS]   # nothing from the rejected batches stuck


@pytest.mark.asyncio
async def test_profile_photos_still_accept_ours_and_now_reject_other_accounts(client):
    from tests.test_admin import _login
    h = {"Authorization": f"Bearer {await _login(client, '08091110001')}"}
    r = await client.patch("/auth/me", headers=h, json={"avatar_url": OURS})
    assert r.status_code == 200 and r.json()["avatar_url"] == OURS
    for url in BAD[:4]:
        r = await client.patch("/auth/me", headers=h, json={"avatar_url": url})
        assert r.status_code == 422 and "Profile photos must be uploaded through Qyka" in r.text, url
