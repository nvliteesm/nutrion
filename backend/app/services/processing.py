"""Processing stage: turn ingested files into structured ExtractedMeal."""

from __future__ import annotations

import logging

from app.services import document_parser, extractor, food_detect, ocr
from app.services.pipeline import IngestedFile, ProcessResult

logger = logging.getLogger(__name__)


async def process_drink(item: IngestedFile) -> ProcessResult:
    """Drink labels: OCR → nutrient extract."""
    warnings: list[str] = []
    raw_text = await ocr.extract_text_from_image(item.path)
    if not raw_text.strip():
        warnings.append("OCR returned empty text")
    meal = await extractor.extract_nutrients(raw_text, source="drink_ocr")
    return ProcessResult(
        kind="drink",
        meal=meal,
        raw_text=raw_text,
        processor="ocr+extractor",
        file_path=str(item.path),
        warnings=warnings,
    )


async def process_food(item: IngestedFile) -> ProcessResult:
    """Food photos: AI detection (no OCR) → nutrient estimate."""
    warnings: list[str] = []
    meal = await food_detect.detect_food(item.path)
    if meal.source == "food_ai_stub":
        warnings.append("Kimi vision unavailable; used stub food detection")
    return ProcessResult(
        kind="food",
        meal=meal,
        raw_text=meal.raw_text,
        processor=meal.source or "food_ai",
        file_path=str(item.path),
        warnings=warnings,
    )


async def process_document(item: IngestedFile) -> ProcessResult:
    """Documents: parse → nutrient extract."""
    warnings: list[str] = []
    raw_text = await document_parser.parse_document(item.path)
    if not raw_text.strip():
        warnings.append("Document parser returned empty text")
    meal = await extractor.extract_nutrients(raw_text, source="document")
    return ProcessResult(
        kind="document",
        meal=meal,
        raw_text=raw_text,
        processor="document_parser+extractor",
        file_path=str(item.path),
        warnings=warnings,
    )
