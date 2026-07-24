from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.db import init_db
from app.services import vector_store


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    vector_store.get_collection()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "health": "/health",
    }
