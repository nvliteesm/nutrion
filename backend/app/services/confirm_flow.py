"""Analyze → edit/confirm → save workflows for drink, food, and medical."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.schemas import (
    ConfirmationStatus,
    DrinkAnalyzeResponse,
    DrinkConfirmResponse,
    DrinkLabelData,
    FoodAnalysisData,
    FoodAnalyzeResponse,
    FoodConfirmResponse,
    MedicalAnalyzeResponse,
    MedicalConfirmResponse,
    MedicalMetricData,
)
from app.services import analysis_store, drink_detect, drink_label, food_detect, medical_extract, vector_store

logger = logging.getLogger(__name__)


def _save_upload(file_bytes: bytes, filename: str) -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4().hex}_{Path(filename).name}"
    dest.write_bytes(file_bytes)
    return dest


def _drink_intake_source(drink: DrinkLabelData) -> str:
    return "drink_ai" if drink.analysis_mode == "photo" else "drink_ocr"


# ---- Drinks (label OCR, then Kimi vision fallback) --------------------------

async def analyze_drink(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
) -> DrinkAnalyzeResponse:
    if not file_bytes or not filename:
        raise ValueError("Drink scan requires an uploaded image file")
    path = _save_upload(file_bytes, filename)

    # 1) Prefer nutrition-label OCR when present
    drink = await drink_label.analyze_drink_label(path)
    if drink is not None:
        drink.analysis_mode = "label"
        message = "Normalized OCR result ready for review"
    else:
        # 2) No label → Kimi classifies drink vs food and estimates
        logger.info("No drink label found; falling back to Kimi vision")
        drink = await drink_detect.analyze_drink_photo(path)
        drink.analysis_mode = "photo"
        message = "No label found — drink photo estimate ready for review"

    row = await analysis_store.create_analysis(
        session,
        kind="drink",
        result=drink.model_dump(mode="json"),
        user_id=user_id,
        file_path=str(path),
        raw_text=drink.raw_text,
    )
    return DrinkAnalyzeResponse(
        analysis_id=row.id,
        drink=drink,
        message=message,
    )


async def get_drink_analysis(session: AsyncSession, analysis_id: str) -> DrinkAnalyzeResponse:
    row = await analysis_store.get_analysis(session, analysis_id)
    if not row or row.kind != "drink":
        raise KeyError("Drink analysis not found")
    drink = DrinkLabelData.model_validate(analysis_store.analysis_payload(row))
    if row.status == ConfirmationStatus.confirmed.value:
        drink.confirmation_status = ConfirmationStatus.confirmed
    return DrinkAnalyzeResponse(analysis_id=row.id, drink=drink)


async def confirm_drink(
    session: AsyncSession,
    analysis_id: str,
    drink: DrinkLabelData,
    *,
    user_id: str = "default",
) -> DrinkConfirmResponse:
    row = await analysis_store.get_analysis(session, analysis_id)
    if not row or row.kind != "drink":
        raise KeyError("Drink analysis not found")
    if row.status == ConfirmationStatus.confirmed.value:
        raise ValueError("Analysis already confirmed")

    # Preserve mode from stored analysis if client omitted it
    stored = DrinkLabelData.model_validate(analysis_store.analysis_payload(row))
    if not drink.analysis_mode:
        drink.analysis_mode = stored.analysis_mode or "label"

    drink.confirmation_status = ConfirmationStatus.confirmed
    meal = analysis_store.drink_to_meal(drink)
    source = _drink_intake_source(drink)
    extras = {
        "total_sugar_g": drink.total_sugar_g,
        "added_sugar_g": drink.added_sugar_g,
    }
    if drink.drink_volume_ml is not None:
        extras["drink_volume_ml"] = drink.drink_volume_ml
    if drink.caffeine_mg is not None:
        extras["caffeine_mg"] = drink.caffeine_mg
    if drink.servings_per_container is not None:
        extras["servings_per_container"] = drink.servings_per_container

    intake = await analysis_store.save_confirmed_intake(
        session,
        meal,
        user_id=user_id or row.user_id,
        source=source,
        kind="drink",
        file_path=row.file_path,
        analysis_id=row.id,
        extras=extras,
    )
    await analysis_store.mark_confirmed(
        session, row, result=drink.model_dump(mode="json")
    )
    try:
        await vector_store.upsert_meal(
            meal,
            user_id=intake.user_id,
            intake_id=intake.id,
            source=source,
            kind="drink",
        )
    except Exception:
        logger.exception("Vector upsert failed for drink intake %s", intake.id)

    return DrinkConfirmResponse(
        analysis_id=row.id,
        intake_id=intake.id,
        drink=drink,
    )


# ---- Food -------------------------------------------------------------------


async def analyze_food(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
) -> FoodAnalyzeResponse:
    if not file_bytes or not filename:
        raise ValueError("Food analysis requires an uploaded image file")
    path = _save_upload(file_bytes, filename)
    food = await food_detect.analyze_food_image(path)
    row = await analysis_store.create_analysis(
        session,
        kind="food",
        result=food.model_dump(mode="json"),
        user_id=user_id,
        file_path=str(path),
        raw_text=food.raw_text,
    )
    return FoodAnalyzeResponse(analysis_id=row.id, food=food)


async def get_food_analysis(session: AsyncSession, analysis_id: str) -> FoodAnalyzeResponse:
    row = await analysis_store.get_analysis(session, analysis_id)
    if not row or row.kind != "food":
        raise KeyError("Food analysis not found")
    food = FoodAnalysisData.model_validate(analysis_store.analysis_payload(row))
    if row.status == ConfirmationStatus.confirmed.value:
        food.confirmation_status = ConfirmationStatus.confirmed
    return FoodAnalyzeResponse(analysis_id=row.id, food=food)


async def confirm_food(
    session: AsyncSession,
    analysis_id: str,
    food: FoodAnalysisData,
    *,
    user_id: str = "default",
    name: str | None = None,
) -> FoodConfirmResponse:
    row = await analysis_store.get_analysis(session, analysis_id)
    if not row or row.kind != "food":
        raise KeyError("Food analysis not found")
    if row.status == ConfirmationStatus.confirmed.value:
        raise ValueError("Analysis already confirmed")

    # Recompute totals from edited items
    food.total_calories = sum(i.calories for i in food.items)
    food.total_protein_g = sum(i.protein_g for i in food.items)
    food.total_carbs_g = sum(i.carbs_g for i in food.items)
    food.total_fat_g = sum(i.fat_g for i in food.items)
    food.total_fiber_g = sum(i.fiber_g for i in food.items)
    food.total_sugar_g = sum(i.sugar_g for i in food.items)
    food.total_sodium_mg = sum(i.sodium_mg for i in food.items)
    if food.items:
        food.confidence = sum(i.confidence for i in food.items) / len(food.items)
    food.confirmation_status = ConfirmationStatus.confirmed

    meals = analysis_store.food_to_meals(food)
    if name and len(meals) == 1:
        meals[0] = meals[0].model_copy(update={"name": name})

    intake_ids: list[int] = []
    for meal in meals:
        intake = await analysis_store.save_confirmed_intake(
            session,
            meal,
            user_id=user_id or row.user_id,
            source="food_ai",
            kind="food",
            file_path=row.file_path,
            analysis_id=row.id,
        )
        intake_ids.append(intake.id)
        try:
            await vector_store.upsert_meal(
                meal,
                user_id=intake.user_id,
                intake_id=intake.id,
                source="food_ai",
                kind="food",
            )
        except Exception:
            logger.exception("Vector upsert failed for food intake %s", intake.id)

    await analysis_store.mark_confirmed(
        session, row, result=food.model_dump(mode="json")
    )

    return FoodConfirmResponse(
        analysis_id=row.id,
        intake_id=intake_ids[0],
        intake_ids=intake_ids,
        food=food,
        message=f"Saved {len(intake_ids)} food item(s)",
    )


# ---- Medical ----------------------------------------------------------------


async def analyze_medical(
    session: AsyncSession,
    *,
    file_bytes: bytes,
    filename: str,
    user_id: str = "default",
) -> MedicalAnalyzeResponse:
    if not file_bytes or not filename:
        raise ValueError("Medical report requires an uploaded file")
    path = _save_upload(file_bytes, filename)
    metrics, raw_text = await medical_extract.extract_medical_metrics(path)
    payload = {"metrics": [m.model_dump(mode="json") for m in metrics]}
    row = await analysis_store.create_analysis(
        session,
        kind="medical",
        result=payload,
        user_id=user_id,
        file_path=str(path),
        raw_text=raw_text,
    )
    return MedicalAnalyzeResponse(
        analysis_id=row.id,
        metrics=metrics,
        raw_text=raw_text,
    )


async def get_medical_analysis(
    session: AsyncSession, analysis_id: str
) -> MedicalAnalyzeResponse:
    row = await analysis_store.get_analysis(session, analysis_id)
    if not row or row.kind != "medical":
        raise KeyError("Medical analysis not found")
    payload = analysis_store.analysis_payload(row)
    metrics = [
        MedicalMetricData.model_validate(m)
        for m in payload.get("metrics", [])
        if isinstance(m, dict)
    ]
    if row.status == ConfirmationStatus.confirmed.value:
        for m in metrics:
            m.confirmed = True
    return MedicalAnalyzeResponse(
        analysis_id=row.id,
        metrics=metrics,
        raw_text=row.raw_text or "",
    )


async def confirm_medical(
    session: AsyncSession,
    analysis_id: str,
    metrics: list[MedicalMetricData],
    *,
    user_id: str = "default",
) -> MedicalConfirmResponse:
    row = await analysis_store.get_analysis(session, analysis_id)
    if not row or row.kind != "medical":
        raise KeyError("Medical analysis not found")
    if row.status == ConfirmationStatus.confirmed.value:
        raise ValueError("Analysis already confirmed")
    if not metrics:
        raise ValueError("At least one metric is required to confirm")

    for m in metrics:
        m.confirmed = True

    saved = await analysis_store.save_medical_metrics(
        session,
        metrics,
        user_id=user_id or row.user_id,
        analysis_id=row.id,
        file_path=row.file_path,
    )
    await analysis_store.mark_confirmed(
        session,
        row,
        result={"metrics": [m.model_dump(mode="json") for m in metrics]},
    )
    return MedicalConfirmResponse(
        analysis_id=row.id,
        report_id=saved.id,
        metric_ids=[saved.id],
        metrics=metrics,
    )
