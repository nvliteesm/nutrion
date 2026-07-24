"""
Ingestion entrypoints → processing → dual storage.

Stages:
  1. ingest_*   save upload
  2. processing process_food | process_drink | process_document
  3. storage    Structured DB + Vector DB
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.schemas import IngestResponse
from app.services import processing, structured_store, vector_store
from app.services.pipeline import IngestedFile, ProcessResult, StorageResult

logger = logging.getLogger(__name__)


def _save_upload(file_bytes: bytes, filename: str) -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4().hex}_{Path(filename).name}"
    dest.write_bytes(file_bytes)
    return dest


async def _store(
    session: AsyncSession,
    result: ProcessResult,
    *,
    user_id: str,
    persist: bool,
) -> IngestResponse:
    intake_id: int | None = None
    storage: StorageResult | None = None

    if persist:
        row = await structured_store.save_intake(
            session,
            result.meal,
            user_id=user_id,
            source=result.meal.source or result.processor,
            kind=result.kind,
            file_path=result.file_path,
        )
        intake_id = row.id
        vector_ok = True
        vector_error = None
        try:
            await vector_store.upsert_meal(
                result.meal,
                user_id=user_id,
                intake_id=row.id,
                source=result.meal.source or result.processor,
                kind=result.kind,
            )
        except Exception as exc:
            vector_ok = False
            vector_error = str(exc)
            logger.exception("Vector upsert failed for intake %s", row.id)
        storage = StorageResult(
            intake_id=row.id,
            structured_ok=True,
            vector_ok=vector_ok,
            vector_error=vector_error,
        )
        message = (
            f"[{result.kind}] processed via {result.processor}; "
            f"stored intake #{row.id}"
            + ("" if vector_ok else f" (vector warn: {vector_error})")
        )
    else:
        message = f"[{result.kind}] processed via {result.processor} (not persisted)"

    if result.warnings:
        message += " | " + "; ".join(result.warnings)

    return IngestResponse(
        input_type=result.input_type,
        meal=result.meal,
        intake_id=intake_id,
        message=message,
    )


async def run_drink(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
    persist: bool = True,
) -> IngestResponse:
    if not file_bytes or not filename:
        raise ValueError("Drink OCR requires an uploaded image file")
    path = _save_upload(file_bytes, filename)
    item = IngestedFile(path=path, filename=filename, kind="drink", user_id=user_id)
    result = await processing.process_drink(item)
    return await _store(session, result, user_id=user_id, persist=persist)


async def run_food(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
    persist: bool = True,
) -> IngestResponse:
    if not file_bytes or not filename:
        raise ValueError("Food detection requires an uploaded image file")
    path = _save_upload(file_bytes, filename)
    item = IngestedFile(path=path, filename=filename, kind="food", user_id=user_id)
    result = await processing.process_food(item)
    return await _store(session, result, user_id=user_id, persist=persist)


async def run_document(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
    persist: bool = True,
) -> IngestResponse:
    if not file_bytes or not filename:
        raise ValueError("Document parser requires an uploaded file")
    path = _save_upload(file_bytes, filename)
    item = IngestedFile(path=path, filename=filename, kind="document", user_id=user_id)
    result = await processing.process_document(item)
    return await _store(session, result, user_id=user_id, persist=persist)


async def run_ocr(*args, **kwargs) -> IngestResponse:
    return await run_drink(*args, **kwargs)
