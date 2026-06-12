import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.services.razorpay_service import get_razorpay_config
from app.routers.address import router as address_router
from app.routers.auth import router as auth_router
from app.routers.checkout import router as checkout_router
from app.routers.dashboard import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.rewards import router as rewards_router

settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
allowed_origins = {
    settings.frontend_origin,
    "http://localhost:8080",
    "https://bookverse.techfilabs.com",
}
if settings.extra_frontend_origins:
    allowed_origins.update(
        origin.strip() for origin in settings.extra_frontend_origins.split(",") if origin.strip()
    )

app = FastAPI(title="BookVerse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(address_router, prefix="/address", tags=["address"])
app.include_router(checkout_router, prefix="/checkout", tags=["checkout"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
app.include_router(rewards_router, prefix="/rewards", tags=["rewards"])


@app.on_event("startup")
async def log_startup() -> None:
    logger.info("BookVerse API server started")
    try:
        config = get_razorpay_config()
        key_prefix = "rzp_test" if config.key_id.startswith("rzp_test") else "rzp_live"
        logger.info("Razorpay startup mode=%s activeKey=%s", config.mode, key_prefix)
    except Exception as exc:
        logger.warning("Razorpay config unavailable at startup: %s", exc)
