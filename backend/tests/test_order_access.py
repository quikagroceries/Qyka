"""Reading an order is limited to the people on it: its customer, its
assigned agent, and admins. Everyone else - including an agent who's only
been proposed - gets the same 404 as an order that doesn't exist."""

import uuid

import pytest

from app.auth.models import User
from app.core.enums import UserRole, UserStatus
from app.markets.models import Agent, Market
from tests.test_admin import _login, _login_admin

AGENT_PHONE = "08053330001"


async def _proposed_order(client, db_session_factory):
    """A customer's order with an agent PROPOSED (not yet accepted)."""
    async with db_session_factory() as s:
        market = Market(name="Oja Oba", city="Ibadan", state="Oyo")
        agent = User(phone="+2348053330001", full_name="Ade", role=UserRole.AGENT, status=UserStatus.ACTIVE)
        s.add_all([market, agent])
        await s.flush()
        s.add(Agent(user_id=agent.id, assigned_market_id=market.id, is_available=True, on_duty=True))
        await s.commit()
        market_id = market.id
    cust_h = {"Authorization": f"Bearer {await _login(client, '08053330002')}"}
    r = await client.post("/orders", headers=cust_h, json={
        "market_id": str(market_id), "listed_items_total": "5000.00", "items": [{"description": "rice"}]})
    assert r.status_code == 201 and r.json()["status"] == "proposed", r.text
    agent_h = {"Authorization": f"Bearer {await _login(client, AGENT_PHONE)}"}
    return r.json()["id"], cust_h, agent_h


def _read_urls(oid):
    return [f"/orders/{oid}", f"/orders/{oid}/bargained-list", f"/jit/orders/{oid}/authorization"]


@pytest.mark.asyncio
async def test_strangers_get_a_404_on_every_order_read(client, db_session_factory):
    oid, cust_h, _ = await _proposed_order(client, db_session_factory)
    stranger = {"Authorization": f"Bearer {await _login(client, '08053339999')}"}

    for url in _read_urls(oid) + [f"/orders/{oid}/proposed-agent"]:
        r = await client.get(url, headers=stranger)
        assert r.status_code == 404 and r.json()["detail"] == "Order not found", url

    # Indistinguishable from an order that doesn't exist at all.
    r = await client.get(f"/orders/{uuid.uuid4()}", headers=stranger)
    assert r.status_code == 404 and r.json()["detail"] == "Order not found"


@pytest.mark.asyncio
async def test_customer_reads_their_own_order(client, db_session_factory):
    oid, cust_h, _ = await _proposed_order(client, db_session_factory)
    r = await client.get(f"/orders/{oid}", headers=cust_h)
    assert r.status_code == 200 and r.json()["id"] == oid
    r = await client.get(f"/orders/{oid}/proposed-agent", headers=cust_h)
    assert r.status_code == 200 and r.json()["full_name"] == "Ade"


@pytest.mark.asyncio
async def test_agent_can_read_only_once_assigned(client, db_session_factory):
    oid, cust_h, agent_h = await _proposed_order(client, db_session_factory)

    # Proposed, not accepted yet: no access (matches the rest of the agent flow).
    r = await client.get(f"/orders/{oid}", headers=agent_h)
    assert r.status_code == 404

    from tests.conftest import pay_deposit
    await pay_deposit(client, cust_h, oid)
    r = await client.post(f"/orders/{oid}/accept-agent", headers=cust_h)
    assert r.status_code == 200, r.text

    r = await client.get(f"/orders/{oid}", headers=agent_h)
    assert r.status_code == 200 and r.json()["agent_id"] is not None
    # The proposed-agent screen is the customer's decision, not the agent's.
    assert (await client.get(f"/orders/{oid}/proposed-agent", headers=agent_h)).status_code == 404


@pytest.mark.asyncio
async def test_admin_can_read_any_order(client, db_session_factory):
    oid, _, _ = await _proposed_order(client, db_session_factory)
    admin_h = {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, 'access@qyka.com')}"}
    for url in [f"/orders/{oid}", f"/orders/{oid}/proposed-agent"]:
        assert (await client.get(url, headers=admin_h)).status_code == 200, url
