"""Polled endpoints answer "nothing changed" with an empty 304 (core/etag.py),
so a poll that finds no change costs almost nothing to send."""

import pytest

from tests.test_admin import _login
from tests.test_chat import _setup_order


async def _poll_twice(client, url, headers):
    """First poll: full body + ETag. Second, sending that ETag back the way the
    browser does: empty 304."""
    r1 = await client.get(url, headers=headers)
    assert r1.status_code == 200, r1.text
    etag = r1.headers["etag"]
    assert r1.headers["cache-control"] == "private, no-cache"
    r2 = await client.get(url, headers={**headers, "If-None-Match": etag})
    assert r2.status_code == 304 and r2.content == b"" and r2.headers["etag"] == etag
    return r1, etag


@pytest.mark.asyncio
async def test_chat_poll_is_a_304_until_a_message_arrives(client, db_session_factory):
    order_id, cust_h, agent_h = await _setup_order(client, db_session_factory)
    url = f"/orders/{order_id}/messages"

    r, etag = await _poll_twice(client, url, cust_h)
    assert r.json() == []

    await client.post(url, headers=agent_h, json={"text": "Found your pepper"})
    r = await client.get(url, headers={**cust_h, "If-None-Match": etag})   # changed -> full body again
    assert r.status_code == 200 and [m["text"] for m in r.json()] == ["Found your pepper"]
    assert r.headers["etag"] != etag

    await _poll_twice(client, url, cust_h)                                 # and quiet again after


@pytest.mark.asyncio
async def test_chat_fast_path_still_checks_who_is_asking(client, db_session_factory):
    order_id, cust_h, _ = await _setup_order(client, db_session_factory)
    url = f"/orders/{order_id}/messages"
    _, etag = await _poll_twice(client, url, cust_h)

    outsider = {"Authorization": f"Bearer {await _login(client, '08091119999')}"}
    r = await client.get(url, headers={**outsider, "If-None-Match": etag})  # a valid ETag is no key
    assert r.status_code in (403, 404)


@pytest.mark.asyncio
async def test_order_poll_is_a_304_until_the_order_changes(client, db_session_factory):
    order_id, cust_h, agent_h = await _setup_order(client, db_session_factory)
    url = f"/orders/{order_id}"
    r, etag = await _poll_twice(client, url, cust_h)
    assert r.json()["status"] == "agent_assigned"

    await client.post(f"/orders/{order_id}/cancel", headers=cust_h)
    r = await client.get(url, headers={**cust_h, "If-None-Match": etag})
    assert r.status_code == 200 and r.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_purchases_poll_is_a_304_when_nothing_new_was_bought(client, db_session_factory):
    order_id, cust_h, _ = await _setup_order(client, db_session_factory)
    r, _ = await _poll_twice(client, f"/jit/orders/{order_id}/purchases", cust_h)
    assert r.json() == []
