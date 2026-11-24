"""Owner-editable website copy."""

import pytest

from tests.test_admin_audit import _entries, _support
from tests.test_admin import _login_admin


async def _owner(client, db_session_factory):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'content-owner@qyka.com')}"}


@pytest.mark.asyncio
async def test_owner_rewords_the_site_and_can_put_it_back(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    assert (await client.get("/content")).json() == {"overrides": {}}

    r = await client.put("/admin/content", headers=h, json={"key": "en.hero.title", "value": "  Your market, delivered.  "})
    assert r.status_code == 200 and r.json()["value"] == "Your market, delivered."
    await client.put("/admin/content", headers=h, json={"key": "faqs.0.a", "value": "Qyka is a personal shopper."})
    # Anyone (the website) can read it, and it's cacheable.
    pub = await client.get("/content")
    assert pub.json()["overrides"] == {"en.hero.title": "Your market, delivered.", "faqs.0.a": "Qyka is a personal shopper."}
    assert "max-age" in pub.headers["cache-control"]

    # Changing it again overwrites; the audit log keeps old and new.
    await client.put("/admin/content", headers=h, json={"key": "en.hero.title", "value": "Shop the market from home."})
    entries = await _entries(db_session_factory, "content.update")
    assert entries[-1].detail == {"key": "en.hero.title", "old": "Your market, delivered.", "new": "Shop the market from home."}
    listed = (await client.get("/admin/content", headers=h)).json()
    assert {x["key"] for x in listed} == {"en.hero.title", "faqs.0.a"}

    # Reset puts the original back.
    assert (await client.delete("/admin/content?key=en.hero.title", headers=h)).status_code == 204
    assert "en.hero.title" not in (await client.get("/content")).json()["overrides"]
    assert [e.action for e in await _entries(db_session_factory) if e.action == "content.reset"] == ["content.reset"]


@pytest.mark.asyncio
async def test_content_validation_and_access(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    for bad in (
        {"key": "hero.title", "value": "x"},                  # not a known root
        {"key": "en.", "value": "x"},                         # no path
        {"key": "en.hero title", "value": "x"},               # illegal characters
        {"key": "en.hero.title", "value": ""},                # blank: reset instead
        {"key": "en.hero.title", "value": "   "},
        {"key": "en.hero.title", "value": "x" * 2001},
    ):
        assert (await client.put("/admin/content", headers=h, json=bad)).status_code == 422, bad

    support_h = await _support(client, db_session_factory)
    assert (await client.put("/admin/content", headers=support_h, json={"key": "en.hero.title", "value": "x"})).status_code == 403
    assert (await client.delete("/admin/content?key=en.hero.title", headers=support_h)).status_code == 403
    assert (await client.get("/admin/content", headers=support_h)).status_code == 403
    assert (await client.put("/admin/content", json={"key": "en.hero.title", "value": "x"})).status_code == 401
