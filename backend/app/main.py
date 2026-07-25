from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api, router
from app.api.routes_ai import router as ai_router
from app.api.routes_analytics import router as analytics_router
from app.api.routes_memory_chat import router as memory_chat_router
from app.api.routes_telegram import router as telegram_router
from app.config import settings
from app.db import init_db

logger = logging.getLogger(__name__)


async def _warm_indexes() -> None:
    try:
        from app.services.knowledge_store import knowledge_store

        count = await knowledge_store.ensure_indexed()
        logger.info("Approved health knowledge indexed: %s chunks", count)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to index approved health knowledge")
    try:
        from app.db import SessionLocal
        from app.services import vector_store

        async with SessionLocal() as session:
            meal_stats = await vector_store.ensure_indexed(session)
        logger.info(
            "Meal memory indexed: %s vectors (added %s)",
            meal_stats.get("indexed"),
            meal_stats.get("added"),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to backfill meal memory vectors")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    warmup_task = asyncio.create_task(_warm_indexes())
    try:
        yield
    finally:
        if not warmup_task.done():
            warmup_task.cancel()


app = FastAPI(
    title=settings.app_name,
    description=(
        "NutriON pipeline: **upload → analyze → edit/confirm → save** "
        "for food photos, drink labels, and medical reports."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(api)
app.include_router(memory_chat_router)
app.include_router(analytics_router)
app.include_router(ai_router)
app.include_router(telegram_router)


@app.get("/")
async def root() -> dict[str, object]:
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "confirm_flow": {
            "foods": [
                "POST /api/foods/analyze",
                "GET /api/foods/{analysisId}",
                "POST /api/foods/{analysisId}/confirm",
            ],
            "drinks": [
                "POST /api/drinks/analyze",
                "GET /api/drinks/{analysisId}",
                "POST /api/drinks/{analysisId}/confirm",
            ],
            "medical": [
                "POST /api/medical/analyze",
                "GET /api/medical/{analysisId}",
                "POST /api/medical/{analysisId}/confirm",
            ],
        },
        "storage": ["/intakes", "/totals/daily", "/api/medical/metrics", "/vector/search"],
    }
