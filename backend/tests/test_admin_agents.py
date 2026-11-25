"""Agent verification and the hands-on agent controls: each audited, each refusing
what it would corrupt, and the optional rule that only verified agents get work."""

import uuid

import pytest
from sqlalchemy import select

from app.auth.models import User
from app.core.enums import UserRole
from app.markets.models import Agent, Market
from tests.test_admin_audit import _entries, _support
from tests.test_admin_ops import _market, _owner, _sign_in


async def _agent(client, db_session_factory, market_id, phone="+2348077700001"):
    """A signed-in agent in `market_id`; returns (headers, user_id)."""
    headers = await _sign_in(client, phone)
    async with db_session_factory() as s:
        user = (await s.execute(select(User).where(User.phone == phone))).scalar_one()
        user.role = UserRole.AGENT
        user.full_name = "Chidi Eze"
        s.add(Agent(user_id=user.id, assigned_market_id=market_id, is_available=True))
        await s.commit()
        return headers, user.id


@pytest.mark.asyncio
async def test_admin_verifies_and_unverifies_an_agent(client, db_session_factory):
    market_id = await _market(db_session_factory)
    _, agent_id = await _agent(client, db_session_factory, market_id)
    owner = await _owner(client, db_session_factory)

    row = next(a for a in (await client.get("/admin/agents", headers=owner)).json() if a["user_id"] == str(agent_id))
    assert row["verified"] is False and row["account_status"] == "active"

    r = await client.post(f"/admin/agents/{agent_id}/verify", headers=owner, json={"note": "NIN slip matched face"})
    assert r.status_code == 200, r.text
    detail = (await client.get(f"/admin/agents/{agent_id}", headers=owner)).json()
    assert detail["verified"] is True
    assert detail["verification_note"] == "NIN slip matched face"
    assert detail["verified_by"] == "ops-owner@qyka.com"

    # Withdrawing needs a reason, and keeps it.
    assert (await client.post(f"/admin/agents/{agent_id}/unverify", headers=owner, json={"note": ""})).status_code == 422
    r = await client.post(f"/admin/agents/{agent_id}/unverify", headers=owner, json={"note": "ID expired"})
    assert r.status_code == 200, r.text
    detail = (await client.get(f"/admin/agents/{agent_id}", headers=owner)).json()
    assert detail["verified"] is False and detail["verification_note"] == "ID expired"

    assert [e.action for e in await _entries(db_session_factory, "agent.verify")]
    assert [e.action for e in await _entries(db_session_factory, "agent.unverify")]


@pytest.mark.asyncio
async def test_support_can_verify_and_the_agent_is_told(client, db_session_factory):
    market_id = await _market(db_session_factory, "Verify Market")
    agent_h, agent_id = await _agent(client, db_session_factory, market_id, "+2348077700002")
    support = await _support(client, db_session_factory)

    r = await client.post(f"/admin/agents/{agent_id}/verify", headers=support, json={})
    assert r.status_code == 200, r.text
    notes = (await client.get("/notifications", headers=agent_h)).json()
    assert any(n["kind"] == "agent_verified" for n in notes)


@pytest.mark.asyncio
async def test_verifying_someone_who_is_not_an_agent_is_a_404(client, db_session_factory):
    await _market(db_session_factory, "Nobody Market")
    await _sign_in(client, "+2348077700003")
    async with db_session_factory() as s:
        customer = (await s.execute(select(User).where(User.phone == "+2348077700003"))).scalar_one()
    owner = await _owner(client, db_session_factory, "nobody-owner@qyka.com")
    assert (await client.post(f"/admin/agents/{customer.id}/verify", headers=owner, json={})).status_code == 404
    assert (await client.get(f"/admin/agents/{uuid.uuid4()}", headers=owner)).status_code == 404


@pytest.mark.asyncio
async def test_admin_puts_an_agent_on_and_off_duty(client, db_session_factory):
    market_id = await _market(db_session_factory, "Duty Market")
    _, agent_id = await _agent(client, db_session_factory, market_id, "+2348077700004")
    owner = await _owner(client, db_session_factory, "duty-owner@qyka.com")

    r = await client.post(f"/admin/agents/{agent_id}/duty", headers=owner, json={"on_duty": False})
    assert r.status_code == 200 and r.json()["on_duty"] is False
    async with db_session_factory() as s:
        assert (await s.execute(select(Agent).where(Agent.user_id == agent_id))).scalar_one().on_duty is False
    assert [e.action for e in await _entries(db_session_factory, "agent.set_duty")]


@pytest.mark.asyncio
async def test_unverified_agents_are_skipped_when_verification_is_required(client, db_session_factory):
    from app.orders import assignment

    market_id = await _market(db_session_factory, "Rule Market")
    _, agent_id = await _agent(client, db_session_factory, market_id, "+2348077700005")
    owner = await _owner(client, db_session_factory, "rule-owner@qyka.com")

    async def pick():
        async with db_session_factory() as s:
            return await assignment.find_available_agent(s, market_id)

    # Rule off (the default): any free agent in the market is picked.
    assert (await pick()) is not None

    r = await client.put("/admin/platform-settings/require_verified_agents", headers=owner, json={"value": True})
    assert r.status_code == 200, r.text
    assert (await pick()) is None  # not verified yet

    assert (await client.post(f"/admin/agents/{agent_id}/verify", headers=owner, json={})).status_code == 200
    assert (await pick()) is not None
