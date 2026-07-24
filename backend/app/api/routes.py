from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models.schemas import HealthResponse, IngestResponse, IntakeRecord
from app.services import ingest, structured_store, vector_store

router = APIRouter()


class VectorSearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=20)


class VectorSearchResponse(BaseModel):
    results: list[dict[str, Any]]


def _bool_form(value: Optional[str], default: bool = True) -> bool:
    if value is None or value.strip() == "" or value.strip().lower() == "string":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


async def _read_upload(file: Optional[UploadFile]) -> tuple[bytes | None, str | None]:
    if file is None or not file.filename:
        return None, None
    return await file.read(), file.filename


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    chroma = vector_store.health()
    return HealthResponse(
        status="ok" if chroma.get("ok") else "degraded",
        services={
            "structured_db": {"ok": True, "url": settings.database_url},
            "vector_db": chroma,
            "azure_models": {
                "live_ai": settings.live_ai_enabled,
                "endpoint": settings.openai_base_url,
                "project": settings.azure_ai_project_endpoint,
                "chat_deployment": settings.chat_model,
                "embedding_deployment": settings.embedding_model,
                "has_key": settings.has_azure_key,
            },
            "content_understanding": {
                "enabled": settings.content_understanding_enabled,
                "endpoint": settings.content_base_url,
                "analyzer": settings.azure_content_analyzer,
                "has_key": settings.has_content_key,
            },
        },
    )


@router.post(
    "/drink",
    response_model=IngestResponse,
    summary="Drink — nutrition label image → OCR only → extract",
    tags=["ingestion"],
)
async def drink_endpoint(
    file: UploadFile = File(..., description="Drink nutrition label photo"),
    user_id: str = Form("default"),
    persist: Optional[str] = Form("true"),
    session: AsyncSession = Depends(get_session),
) -> IngestResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await ingest.run_drink(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
            persist=_bool_form(persist, True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Drink OCR failed: {exc}") from exc


@router.post(
    "/food",
    response_model=IngestResponse,
    summary="Food — meal photo → AI detect food (no OCR) → estimate nutrients",
    tags=["ingestion"],
)
async def food_endpoint(
    file: UploadFile = File(..., description="Food / meal photo"),
    user_id: str = Form("default"),
    persist: Optional[str] = Form("true"),
    session: AsyncSession = Depends(get_session),
) -> IngestResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await ingest.run_food(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
            persist=_bool_form(persist, True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Food detection failed: {exc}") from exc


@router.post(
    "/document",
    response_model=IngestResponse,
    summary="Document parser — PDF/txt → parse → nutrient extract",
    tags=["ingestion"],
)
async def document_endpoint(
    file: UploadFile = File(..., description="PDF or text nutrition document"),
    user_id: str = Form("default"),
    persist: Optional[str] = Form("true"),
    session: AsyncSession = Depends(get_session),
) -> IngestResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await ingest.run_document(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
            persist=_bool_form(persist, True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Document parse failed: {exc}") from exc


# Back-compat alias for older clients
@router.post(
    "/ocr",
    response_model=IngestResponse,
    summary="Alias of /drink (OCR-only)",
    tags=["ingestion"],
    deprecated=True,
)
async def ocr_alias(
    file: UploadFile = File(...),
    user_id: str = Form("default"),
    persist: Optional[str] = Form("true"),
    session: AsyncSession = Depends(get_session),
) -> IngestResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await ingest.run_drink(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
            persist=_bool_form(persist, True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc


@router.get("/intakes", response_model=list[IntakeRecord])
async def get_intakes(
    user_id: Optional[str] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[IntakeRecord]:
    return await structured_store.list_intakes(session, user_id=user_id, limit=min(limit, 200))


@router.post("/vector/search", response_model=VectorSearchResponse)
async def vector_search(body: VectorSearchRequest) -> VectorSearchResponse:
    results = await vector_store.search(
        body.query,
        user_id=body.user_id,
        limit=body.limit,
    )
    return VectorSearchResponse(results=results)
