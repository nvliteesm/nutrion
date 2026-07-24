from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api, router
from app.config import settings
from app.db import init_db
from app.services import vector_store


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    vector_store.get_collection()
    yield


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
    allow_origins=settings.origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(api)


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
        "legacy_ingestion": ["/food", "/drink", "/document"],
        "storage": ["/intakes", "/totals/daily", "/api/medical/metrics", "/vector/search"],
    }
