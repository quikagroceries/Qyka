"""The company overview and the investor link: the numbers are right, mean
what they say, and the link exposes nothing but aggregates."""

import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.admin.audit import AdminAuditLog
from app.auth.models import User
from app.core.enums import MarketStatus, OrderStatus, RiderStatus, UserRole, UserStatus
from app.hubs.models import Hub
from app.investors.models import InvestorLink
from app.markets.models import Agent, Market
from app.orders.models import Order, OrderItem
from app.ratings.models import AgentRating
from app.riders.models import Rider
from tests.test_admin import _login_admin
from tests.test_admin_audit import _support

NOW = datetime.now(timezone.utc)


async def _owner(client, db_session_factory, email="co-owner@qyka.com"):
    return {"Authorization": f"Bearer {await _login_admin(client, db_session_factory, email)}"}


async def _seed(db_session_factory):
    """Four completed orders, one old one (previous period), a cancellation, an
    unpaid cancellation and one in progress, across two markets."""
    async with db_session_factory() as s:
        alpha = Market(name="Alpha Market", city="Ibadan", state="Oyo", status=MarketStatus.LIVE)
        beta = Market(name="Beta Market", city="Lagos", state="Lagos", status=MarketStatus.PILOT)
        s.add_all([alpha, beta])
        custs = [User(phone=f"+23480000000{i}", role=UserRole.CUSTOMER, status=UserStatus.ACTIVE) for i in range(1, 4)]
        agent_u = User(phone="+2348000000010", role=UserRole.AGENT, status=UserStatus.ACTIVE)
        rider_u = User(phone="+2348000000011", role=UserRole.RIDER, status=UserStatus.ACTIVE)
        keeper_u = User(phone="+2348000000012", role=UserRole.SHOPKEEPER, status=UserStatus.ACTIVE)
        s.add_all(custs + [agent_u, rider_u, keeper_u])
        await s.flush()
        s.add_all([
            Agent(user_id=agent_u.id, assigned_market_id=alpha.id),
            Rider(user_id=rider_u.id, full_name="R", phone=rider_u.phone, status=RiderStatus.ACTIVE),
            Hub(market_id=alpha.id, user_id=keeper_u.id, name="H", is_active=True),
        ])
        await s.flush()
        c1, c2, c3 = [c.id for c in custs]
        hub = (await s.execute(select(Hub))).scalar_one()

        def order(market, cust, status, *, items=0, share=0, delivery=1500, rider=0, hubfee=0,
                  delivered_ago=None, minutes=60, via_hub=True):
            delivered = NOW - timedelta(days=delivered_ago) if delivered_ago is not None else None
            o = Order(
                customer_id=cust, market_id=market.id, status=status, agent_id=agent_u.id,
                items_total=Decimal(items), company_share=Decimal(share), agent_share=Decimal("1000"),
                delivery_fee=Decimal(delivery), rider_fee=Decimal(rider), hub_fee=Decimal(hubfee),
                rider_id=rider_u.id if via_hub else None, hub_id=hub.id if via_hub else None,
                delivered_at=delivered, created_at=(delivered - timedelta(minutes=minutes)) if delivered else NOW - timedelta(days=1),
            )
            s.add(o)
            return o

        done = OrderStatus.CLOSED
        o1 = order(alpha, c1, done, items=10000, share=300, rider=1000, hubfee=500, delivered_ago=0, minutes=60)     # revenue 300
        o2 = order(alpha, c1, done, items=6000, share=100, rider=800, hubfee=300, delivered_ago=0, minutes=90)       # revenue 100 + 400 margin
        o3 = order(beta, c2, done, items=4000, share=50, rider=1000, hubfee=500, delivered_ago=0, minutes=120)       # revenue 50
        o4 = order(beta, c3, done, items=2000, share=20, via_hub=False, delivered_ago=0, minutes=150)                # legacy: courier took it all -> 20
        order(alpha, c1, done, items=5000, share=100, rider=1000, hubfee=500, delivered_ago=45)                      # previous period
        order(alpha, c2, OrderStatus.CANCELLED)
        order(beta, c3, OrderStatus.CANCELLED_UNPAID)
        order(alpha, c3, OrderStatus.SHOPPING)
        await s.flush()
        s.add_all([
            AgentRating(order_id=o1.id, agent_id=agent_u.id, customer_id=c1, stars=5),
            AgentRating(order_id=o3.id, agent_id=agent_u.id, customer_id=c2, stars=4),
        ])
        await s.commit()


@pytest.mark.asyncio
async def test_headline_numbers_mean_what_they_say(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    await _seed(db_session_factory)
    body = (await client.get("/admin/company-overview?days=30", headers=h)).json()
    hl = body["headline"]

    assert hl["goods_sold"] == "22000.00" and hl["orders_completed"] == 4
    assert hl["avg_order_value"] == "5500.00"
    # Revenue is what Qyka keeps after paying agent, rider and hub - including
    # the 400 left over on the second order, and nothing extra on the legacy one.
    assert hl["revenue"] == "870.00" and hl["take_rate_percent"] == "4.0"
    assert hl["customers_served"] == 3 and hl["repeat_customer_rate_percent"] == "33.3"   # only c1 has 2+
    assert hl["median_delivery_minutes"] == 105                                           # median of 60/90/120/150
    assert hl["avg_rating"] == 4.5 and hl["ratings_count"] == 2
    assert hl["registered_customers"] == 3

    # Against the previous 30 days (one order, 5000 of goods, 100 share).
    assert body["vs_previous_period"]["goods_sold_percent"] == "340.0"
    assert body["vs_previous_period"]["orders_percent"] == "300.0"

    # Of the six orders placed in the period that reached an outcome, 4 were delivered.
    rel = body["reliability"]
    assert rel["orders_with_outcome"] == 6 and rel["completion_rate_percent"] == "66.7"
    assert rel["cancelled_percent"] == "16.7" and rel["unpaid_percent"] == "16.7"
    assert body["pipeline"]["orders_in_flight"] == 1

    # Supply and markets.
    assert body["supply"] == {"agents": 1, "agents_active_30d": 1, "riders": 1, "riders_active_30d": 1, "hubs": 1, "markets_live": 2}
    assert [(m["name"], m["orders"], m["goods_sold"], m["revenue"]) for m in body["markets"]] == [
        ("Alpha Market", 2, "16000.00", "800.00"), ("Beta Market", 2, "6000.00", "70.00")]

    # Twelve weekly buckets, oldest first; this week holds the four, six weeks back holds the old one.
    weeks = body["weekly"]
    assert len(weeks) == 12 and weeks[-1]["orders"] == 4 and weeks[-1]["goods_sold"] == "22000.00"
    assert sum(w["orders"] for w in weeks) == 5
    # All time includes the old order.
    allt = (await client.get("/admin/company-overview?days=0", headers=h)).json()
    assert allt["period_days"] is None and allt["headline"]["orders_completed"] == 5     # 0 = all time
    assert allt["vs_previous_period"]["goods_sold_percent"] is None                     # nothing to compare an all-time total to
    assert (await client.get("/admin/company-overview?days=7", headers=h)).json()["period_days"] == 30   # not an offered window
    assert (await client.get("/admin/company-overview", headers=h)).json()["headline"]["orders_completed"] == 4


@pytest.mark.asyncio
async def test_financials_can_be_left_out(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    await _seed(db_session_factory)
    body = (await client.get("/admin/company-overview?include_financials=false", headers=h)).json()
    assert body["financials_included"] is False
    assert body["headline"]["revenue"] is None and body["headline"]["take_rate_percent"] is None
    assert body["vs_previous_period"]["revenue_percent"] is None
    assert all(m["revenue"] is None for m in body["markets"]) and all(w["revenue"] is None for w in body["weekly"])
    assert body["headline"]["goods_sold"] == "22000.00"          # volume still there


@pytest.mark.asyncio
async def test_an_investor_link_shows_aggregates_only_and_can_be_revoked(client, db_session_factory):
    h = await _owner(client, db_session_factory)
    await _seed(db_session_factory)

    r = await client.post("/admin/investor-links", headers=h, json={"label": "Seed round", "expires_in_days": 30})
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    assert len(token) >= 30 and r.json()["status"] == "live"

    # The secret is shown once and stored only as a hash - never in the list, never in the audit log.
    assert token not in json.dumps((await client.get("/admin/investor-links", headers=h)).json())
    async with db_session_factory() as s:
        link = (await s.execute(select(InvestorLink))).scalar_one()
        assert link.token_hash != token and len(link.token_hash) == 64
        audit_blob = json.dumps([[e.detail, e.target, e.path] for e in (await s.execute(select(AdminAuditLog))).scalars()], default=str)
    assert token not in audit_blob and '"label": "Seed round"' in audit_blob

    # Anyone with the link - no login - sees the overview, uncached and unindexed.
    pub = await client.get(f"/investors/{token}/overview")
    assert pub.status_code == 200
    assert pub.headers["cache-control"] == "no-store" and "noindex" in pub.headers["x-robots-tag"]
    assert pub.json()["headline"]["goods_sold"] == "22000.00"
    # ...and only aggregates: no person, phone, email or order id anywhere in it.
    blob = json.dumps(pub.json()).lower()
    for forbidden in ("phone", "email", "customer_id", "agent_id", "order_id", "+234", "full_name"):
        assert forbidden not in blob, forbidden

    await client.get(f"/investors/{token}/overview?days=90")
    row = (await client.get("/admin/investor-links", headers=h)).json()[0]
    assert row["view_count"] == 2 and row["last_viewed_at"] and row["status"] == "live"

    # Any problem with a link is the same 404: unknown, revoked, expired.
    assert (await client.get("/investors/not-a-real-token/overview")).status_code == 404
    revoked = await client.post(f"/admin/investor-links/{row['id']}/revoke", headers=h)
    assert revoked.status_code == 200 and revoked.json()["status"] == "revoked"
    assert (await client.get(f"/investors/{token}/overview")).status_code == 404

    token2 = (await client.post("/admin/investor-links", headers=h, json={"label": "Short", "expires_in_days": 1})).json()["token"]
    assert (await client.get(f"/investors/{token2}/overview")).status_code == 200
    async with db_session_factory() as s:
        link2 = (await s.execute(select(InvestorLink).where(InvestorLink.label == "Short"))).scalar_one()
        link2.expires_at = NOW - timedelta(minutes=1)
        await s.commit()
    assert (await client.get(f"/investors/{token2}/overview")).status_code == 404
    statuses = {x["label"]: x["status"] for x in (await client.get("/admin/investor-links", headers=h)).json()}
    assert statuses == {"Seed round": "revoked", "Short": "expired"}

    # A link without financials never shows revenue, whatever the page asks.
    token3 = (await client.post("/admin/investor-links", headers=h, json={"label": "Volume only", "include_financials": False})).json()["token"]
    vol = (await client.get(f"/investors/{token3}/overview")).json()
    assert vol["headline"]["revenue"] is None and vol["headline"]["goods_sold"] == "22000.00"


@pytest.mark.asyncio
async def test_only_owners_manage_links_and_see_the_overview(client, db_session_factory):
    support_h = await _support(client, db_session_factory)
    assert (await client.get("/admin/company-overview", headers=support_h)).status_code == 403
    assert (await client.get("/admin/investor-links", headers=support_h)).status_code == 403
    assert (await client.post("/admin/investor-links", headers=support_h, json={"label": "Nope"})).status_code == 403
    assert (await client.post(f"/admin/investor-links/{uuid.uuid4()}/revoke", headers=support_h)).status_code == 403
    assert (await client.get("/admin/company-overview")).status_code == 401
    h = await _owner(client, db_session_factory, "links-owner@qyka.com")
    assert (await client.post("/admin/investor-links", headers=h, json={"label": "x"})).status_code == 422          # label too short
    assert (await client.post(f"/admin/investor-links/{uuid.uuid4()}/revoke", headers=h)).status_code == 404
