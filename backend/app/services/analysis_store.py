"""Persist pending analyses and confirmed drink/food/medical entries."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Analysis, Intake, MedicalMetric
from app.models.schemas import (
    ConfirmationStatus,
    DrinkLabelData,
    ExtractedMeal,
    FoodAnalysisData,
    IntakeRecord,
    MedicalMetricData,
    MedicalMetricRecord,
    NutrientValues,
)

AnalysisKind = Literal["food", "drink", "medical"]


def _new_id() -> str:
    return uuid.uuid4().hex


async def create_analysis(
    session: AsyncSession,
    *,
    kind: AnalysisKind,
    result: dict[str, Any],
    user_id: str = "default",
    file_path: str = "",
    raw_text: str = "",
) -> Analysis:
    row = Analysis(
        id=_new_id(),
        user_id=user_id,
        kind=kind,
        status=ConfirmationStatus.pending.value,
        file_path=file_path,
        result_json=json.dumps(result),
        raw_text=raw_text,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def get_analysis(session: AsyncSession, analysis_id: str) -> Analysis | None:
    return await session.get(Analysis, analysis_id)


def analysis_payload(row: Analysis) -> dict[str, Any]:
    try:
        return json.loads(row.result_json or "{}")
    except Exception:
        return {}


async def mark_confirmed(
    session: AsyncSession,
    row: Analysis,
    *,
    result: dict[str, Any] | None = None,
) -> Analysis:
    row.status = ConfirmationStatus.confirmed.value
    row.confirmed_at = datetime.utcnow()
    if result is not None:
        row.result_json = json.dumps(result)
    await session.commit()
    await session.refresh(row)
    return row


async def save_confirmed_intake(
    session: AsyncSession,
    meal: ExtractedMeal,
    *,
    user_id: str = "default",
    source: str | None = None,
    kind: str = "food",
    file_path: str = "",
    analysis_id: str = "",
    extras: dict[str, Any] | None = None,
) -> Intake:
    n = meal.nutrients
    merged_extras = dict(n.extras or {})
    if extras:
        merged_extras.update(extras)
    row = Intake(
        user_id=user_id,
        kind=kind,
        name=meal.name,
        serving=meal.serving,
        source=source or meal.source,
        file_path=file_path,
        raw_text=meal.raw_text,
        confidence=meal.confidence,
        confirmed=True,
        analysis_id=analysis_id,
        calories=n.calories,
        protein_g=n.protein_g,
        carbs_g=n.carbs_g,
        fat_g=n.fat_g,
        fiber_g=n.fiber_g,
        sugar_g=n.sugar_g,
        sodium_mg=n.sodium_mg,
        extras_json=json.dumps(merged_extras),
        logged_at=datetime.utcnow(),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


def drink_to_meal(drink: DrinkLabelData) -> ExtractedMeal:
    extras: dict[str, float] = {
        "total_sugar_g": drink.total_sugar_g,
        "added_sugar_g": drink.added_sugar_g,
    }
    if drink.drink_volume_ml is not None:
        extras["drink_volume_ml"] = drink.drink_volume_ml
    if drink.caffeine_mg is not None:
        extras["caffeine_mg"] = drink.caffeine_mg
    if drink.servings_per_container is not None:
        extras["servings_per_container"] = drink.servings_per_container

    return ExtractedMeal(
        name=drink.product_name,
        serving=drink.serving_size,
        nutrients=NutrientValues(
            calories=drink.calories,
            carbs_g=drink.carbohydrates_g,
            sugar_g=drink.total_sugar_g,
            sodium_mg=drink.sodium_mg or 0,
            extras=extras,
        ),
        raw_text=drink.raw_text,
        confidence=drink.confidence,
        source="drink_ocr",
    )


def food_to_meal(food: FoodAnalysisData, name: str | None = None) -> ExtractedMeal:
    if name:
        meal_name = name
    elif len(food.items) == 1:
        meal_name = food.items[0].name
    elif food.items:
        meal_name = f"{food.items[0].name} + {len(food.items) - 1} more"
    else:
        meal_name = "Estimated meal"

    serving = (
        food.items[0].portion
        if len(food.items) == 1
        else f"{len(food.items)} items"
    )
    extras: dict[str, float] = {
        "item_count": float(len(food.items)),
    }
    return ExtractedMeal(
        name=meal_name,
        serving=serving,
        nutrients=NutrientValues(
            calories=food.total_calories,
            protein_g=food.total_protein_g,
            carbs_g=food.total_carbs_g,
            fat_g=food.total_fat_g,
            fiber_g=food.total_fiber_g,
            sugar_g=food.total_sugar_g,
            sodium_mg=food.total_sodium_mg,
            extras=extras,
        ),
        raw_text=food.raw_text or food.description,
        confidence=food.confidence,
        source="food_ai",
    )


async def save_medical_metrics(
    session: AsyncSession,
    metrics: list[MedicalMetricData],
    *,
    user_id: str,
    analysis_id: str,
    file_path: str = "",
) -> list[MedicalMetric]:
    rows: list[MedicalMetric] = []
    for m in metrics:
        m.confirmed = True
        row = MedicalMetric(
            user_id=user_id,
            analysis_id=analysis_id,
            metric_name=m.metric_name,
            category=m.category.value if hasattr(m.category, "value") else str(m.category),
            value=m.value,
            unit=m.unit,
            reference_min=m.reference_min,
            reference_max=m.reference_max,
            reference_range_text=m.reference_range_text,
            status=m.status.value if hasattr(m.status, "value") else str(m.status),
            test_date=m.test_date,
            source_page=m.source_page,
            extraction_confidence=m.extraction_confidence,
            confirmed=True,
            file_path=file_path,
        )
        session.add(row)
        rows.append(row)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows


def medical_to_record(row: MedicalMetric) -> MedicalMetricRecord:
    return MedicalMetricRecord(
        id=row.id,
        user_id=row.user_id,
        analysis_id=row.analysis_id,
        metric_name=row.metric_name,
        category=row.category,
        value=row.value,
        unit=row.unit,
        reference_min=row.reference_min,
        reference_max=row.reference_max,
        reference_range_text=row.reference_range_text,
        status=row.status,
        test_date=row.test_date,
        source_page=row.source_page,
        extraction_confidence=row.extraction_confidence,
        confirmed=row.confirmed,
        file_path=row.file_path or "",
        created_at=row.created_at,
    )


async def list_medical_metrics(
    session: AsyncSession,
    *,
    user_id: str | None = None,
    limit: int = 50,
) -> list[MedicalMetricRecord]:
    stmt = select(MedicalMetric).order_by(MedicalMetric.created_at.desc()).limit(limit)
    if user_id:
        stmt = stmt.where(MedicalMetric.user_id == user_id)
    result = await session.execute(stmt)
    return [medical_to_record(r) for r in result.scalars().all()]


def intake_to_record(row: Intake) -> IntakeRecord:
    extras: dict[str, float] = {}
    try:
        extras = {k: float(v) for k, v in json.loads(row.extras_json or "{}").items()}
    except Exception:
        extras = {}
    return IntakeRecord(
        id=row.id,
        user_id=row.user_id,
        kind=getattr(row, "kind", None) or "food",
        name=row.name,
        serving=row.serving,
        logged_at=row.logged_at,
        nutrients=NutrientValues(
            calories=row.calories,
            protein_g=row.protein_g,
            carbs_g=row.carbs_g,
            fat_g=row.fat_g,
            fiber_g=row.fiber_g,
            sugar_g=row.sugar_g,
            sodium_mg=row.sodium_mg,
            extras=extras,
        ),
        source=row.source,
        confidence=row.confidence,
        confirmed=bool(getattr(row, "confirmed", False)),
        is_estimated=bool(getattr(row, "is_estimated", False)),
        input_type=getattr(row, "input_type", None)
        or getattr(row, "kind", None)
        or "food",
        raw_text=row.raw_text,
        file_path=getattr(row, "file_path", "") or "",
        analysis_id=getattr(row, "analysis_id", "") or "",
    )
