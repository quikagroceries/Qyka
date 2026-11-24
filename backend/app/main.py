from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import service as admin_service
from app.orders import fee_settings, fees
from app.admin.routes import router as admin_router
from app.agent.routes import router as agent_router
from app.agent_applications.routes import router as agent_applications_router
from app.auth.routes import router as auth_router
from app.calls.routes import router as calls_router
from app.content.routes import router as content_router
from app.chat.routes import conversations_router, router as chat_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.platform_settings import service as platform
from app.delivery.routes import router as delivery_router
from app.dev.routes import router as dev_router
from app.float.routes import router as float_router
from app.hubs.routes import router as hubs_router
from app.investors.routes import router as investors_router
from app.jit.routes import router as jit_router
from app.locations.routes import router as locations_router
from app.markets.routes import router as markets_router
from app.notifications.routes import router as notifications_router
from app.orders.routes import router as orders_router
from app.payments.routes import router as payments_router
from app.ratings.routes import router as ratings_router
from app.riders.routes import router as riders_router
from app.wallet.routes import router as wallet_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as session:
        await admin_service.bootstrap_admin(
            session, settings.bootstrap_admin_email, settings.bootstrap_admin_password
        )
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}


@app.get("/pricing")
async def pricing(db: AsyncSession = Depends(get_db)) -> dict:
    """Public fee rules - what a new order would be priced by right now. The
    single source the website's pricing calculator and checkout estimates
    read from (set by an owner under Platform settings)."""
    cfg = await platform.pricing(db)
    summary = fees.pricing_summary(cfg)
    # What the people who do the work earn, so the website's earnings
    # estimators quote the real figures. Rider and hub pay are per market
    # (Admin > Delivery pay); this is the default that applies unless a market
    # has its own.
    default = await fee_settings.get_global(db)
    summary.update({
        "agent_base_pay": str(cfg.agent_base_share),
        "agent_included_minutes": cfg.included_minutes,
        "rider_pay": str(default.rider_fee if default else fees.DEFAULT_RIDER_FEE),
        "hub_pay": str(default.hub_fee if default else fees.DEFAULT_HUB_FEE),
    })
    return summary


@app.get("/status")
async def platform_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Public: whether new orders are open, and what to tell customers if not."""
    paused = await platform.get(db, "orders_paused")
    return {
        "orders_paused": paused,
        "message": await platform.get(db, "orders_paused_message") if paused else None,
    }


# Registered in the order they'd actually be hit in a real run of the app:
# sign in -> set up markets/agents/float -> place an order -> shop, pay,
# deliver -> ongoing notifications and admin oversight -> dev-only helpers.
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(markets_router, prefix="/markets", tags=["markets"])
app.include_router(
    agent_applications_router,
    prefix="/agent-applications",
    tags=["agent-applications"],
)
app.include_router(float_router, prefix="/float", tags=["float"])
app.include_router(orders_router, prefix="/orders", tags=["orders"])
# Same "/orders" prefix as orders_router - messages hang off /orders/{id}/messages.
app.include_router(chat_router, prefix="/orders", tags=["chat"])
app.include_router(conversations_router, prefix="/chat", tags=["chat"])
app.include_router(jit_router, prefix="/jit", tags=["jit"])
app.include_router(payments_router, prefix="/payments", tags=["payments"])
app.include_router(wallet_router, prefix="/wallet", tags=["wallet"])
app.include_router(delivery_router, prefix="/delivery", tags=["delivery"])
app.include_router(locations_router, prefix="/locations", tags=["locations"])
# Same "/orders" prefix as chat_router - rating hangs off /orders/{id}/rating.
app.include_router(ratings_router, prefix="/orders", tags=["ratings"])
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(agent_router, prefix="/agent", tags=["agent"])
app.include_router(hubs_router, prefix="/hubs", tags=["hubs"])
app.include_router(content_router, prefix="/content", tags=["content"])
app.include_router(investors_router, prefix="/investors", tags=["investors"])
app.include_router(riders_router, prefix="/riders", tags=["riders"])
app.include_router(calls_router, prefix="/calls", tags=["calls"])
app.include_router(dev_router, prefix="/dev", tags=["dev"])
