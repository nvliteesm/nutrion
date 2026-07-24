from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.schemas import ExtractedMeal, InputType, IngestResponse
from app.services import document_parser, extractor, food_detect, ocr, structured_store, vector_store

logger = logging.getLogger(__name__)


def _save_upload(file_bytes: bytes, filename: str) -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4().hex}_{Path(filename).name}"
    dest.write_bytes(file_bytes)
    return dest


async def _persist_meal(
    session: AsyncSession,
    *,
    meal: ExtractedMeal,
    user_id: str,
    source: str,
    input_type: InputType,
    persist: bool = True,
) -> IngestResponse:
    intake_id: int | None = None

    if persist:
        row = await structured_store.save_intake(
            session,
            meal,
            user_id=user_id,
            source=source,
        )
        intake_id = row.id
        try:
            await vector_store.upsert_meal(
                meal,
                user_id=user_id,
                intake_id=row.id,
                source=source,
            )
        except Exception:
            logger.exception("Vector upsert failed for intake %s", row.id)
        message = f"Ingested '{meal.name}' via {source} (intake #{row.id})."
    else:
        message = f"Parsed '{meal.name}' via {source} (not persisted)."

    return IngestResponse(
        input_type=input_type,
        meal=meal,
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
    """Drink label photo → OCR only → nutrient extract."""
    if not file_bytes or not filename:
        raise ValueError("Drink OCR requires an uploaded image file")
    dest = _save_upload(file_bytes, filename)
    raw_text = await ocr.extract_text_from_image(dest)
    meal = await extractor.extract_nutrients(raw_text, source="drink_ocr")
    return await _persist_meal(
        session,
        meal=meal,
        user_id=user_id,
        source="drink_ocr",
        input_type=InputType.drink,
        persist=persist,
    )


async def run_food(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
    persist: bool = True,
) -> IngestResponse:
    """Food photo → AI detection (no OCR) → nutrient estimate."""
    if not file_bytes or not filename:
        raise ValueError("Food detection requires an uploaded image file")
    dest = _save_upload(file_bytes, filename)
    meal = await food_detect.detect_food(dest)
    return await _persist_meal(
        session,
        meal=meal,
        user_id=user_id,
        source=meal.source or "food_ai",
        input_type=InputType.food,
        persist=persist,
    )


async def run_document(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
    persist: bool = True,
) -> IngestResponse:
    """PDF/txt → document parser → nutrient extract."""
    if not file_bytes or not filename:
        raise ValueError("Document parser requires an uploaded file")
    dest = _save_upload(file_bytes, filename)
    raw_text = await document_parser.parse_document(dest)
    meal = await extractor.extract_nutrients(raw_text, source="document")
    return await _persist_meal(
        session,
        meal=meal,
        user_id=user_id,
        source="document",
        input_type=InputType.document,
        persist=persist,
    )


# Back-compat name used by older callers
async def run_ocr(*args, **kwargs) -> IngestResponse:
    return await run_drink(*args, **kwargs)
