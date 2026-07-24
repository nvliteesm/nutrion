"""Persist pending analyses and confirmed drink/food/medical entries."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Analysis, Intake, MedicalReport
from app.models.schemas import (
    ConfirmationStatus,
    DrinkLabelData,
    ExtractedMeal,
    FoodAnalysisData,
    FoodItemEstimate,
    IntakeRecord,
    MedicalMetricData,
    MedicalMetricRecord,
    MedicalReportRecord,
    NutrientValues,
)
from app.services.medical_report import build_report_row, report_to_metric_records

AnalysisKind = Literal["food", "drink", "medical"]


def _utc_now() -> datetime:
    """Timezone-aware UTC — required for DateTime(timezone=True) columns."""
    return datetime.now(timezone.utc)


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
    row.confirmed_at = _utc_now()
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
        # Let Postgres timestamptz server_default (now()) set this — avoids
        # naive/local mis-binding that shifted entries off the user's day.
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


def food_item_to_meal(item: FoodItemEstimate, *, raw_text: str = "") -> ExtractedMeal:
    return ExtractedMeal(
        name=item.name,
        serving=item.portion,
        nutrients=NutrientValues(
            calories=item.calories,
            protein_g=item.protein_g,
            carbs_g=item.carbs_g,
            fat_g=item.fat_g,
            fiber_g=item.fiber_g,
            sugar_g=item.sugar_g,
            sodium_mg=item.sodium_mg,
        ),
        raw_text=raw_text
        or (
            f"{item.name} ({item.portion}): {item.calories} kcal, "
            f"P {item.protein_g}g C {item.carbs_g}g F {item.fat_g}g"
        ),
        confidence=item.confidence,
        source="food_ai",
    )


def food_to_meals(food: FoodAnalysisData) -> list[ExtractedMeal]:
    """One ExtractedMeal per food item."""
    if not food.items:
        return [
            ExtractedMeal(
                name="Estimated meal",
                serving="1 serving",
                nutrients=NutrientValues(
                    calories=food.total_calories,
                    protein_g=food.total_protein_g,
                    carbs_g=food.total_carbs_g,
                    fat_g=food.total_fat_g,
                    fiber_g=food.total_fiber_g,
                    sugar_g=food.total_sugar_g,
                    sodium_mg=food.total_sodium_mg,
                ),
                raw_text=food.raw_text or food.description,
                confidence=food.confidence,
                source="food_ai",
            )
        ]
    return [food_item_to_meal(item) for item in food.items]


def food_to_meal(food: FoodAnalysisData, name: str | None = None) -> ExtractedMeal:
    """Back-compat: first item, or a named aggregate if `name` is provided."""
    meals = food_to_meals(food)
    if name and meals:
        meals[0] = meals[0].model_copy(update={"name": name})
        return meals[0]
    return meals[0]


async def save_medical_metrics(
    session: AsyncSession,
    metrics: list[MedicalMetricData],
    *,
    user_id: str,
    analysis_id: str,
    file_path: str = "",
) -> MedicalReport:
    """Save one medical report row (all Blood Sugar + Lipid metrics together)."""
    row = build_report_row(
        metrics=metrics,
        user_id=user_id,
        analysis_id=analysis_id,
        file_path=file_path,
        confirmed=True,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


def medical_report_to_record(row: MedicalReport) -> MedicalReportRecord:
    return MedicalReportRecord(
        id=row.id,
        user_id=row.user_id,
        analysis_id=row.analysis_id or "",
        test_date=row.test_date,
        file_path=row.file_path or "",
        confidence=float(row.confidence or 0.5),
        confirmed=bool(row.confirmed),
        notes=row.notes or "",
        hba1c=row.hba1c,
        hba1c_status=row.hba1c_status,
        fasting_glucose=row.fasting_glucose,
        fasting_glucose_status=row.fasting_glucose_status,
        total_cholesterol=row.total_cholesterol,
        total_cholesterol_status=row.total_cholesterol_status,
        ldl=row.ldl,
        ldl_status=row.ldl_status,
        hdl=row.hdl,
        hdl_status=row.hdl_status,
        triglycerides=row.triglycerides,
        triglycerides_status=row.triglycerides_status,
        created_at=row.created_at,
        metrics=report_to_metric_records(row),
    )


def medical_to_record(row: MedicalReport) -> list[MedicalMetricRecord]:
    """Back-compat: expand report into per-metric records."""
    return report_to_metric_records(row)


async def list_medical_metrics(
    session: AsyncSession,
    *,
    user_id: str | None = None,
    limit: int = 50,
) -> list[MedicalMetricRecord]:
    """Latest values per metric name (expanded from medical_reports)."""
    stmt = select(MedicalReport).order_by(MedicalReport.created_at.desc()).limit(limit)
    if user_id:
        stmt = stmt.where(MedicalReport.user_id == user_id)
    result = await session.execute(stmt)
    latest: dict[str, MedicalMetricRecord] = {}
    for report in result.scalars().all():
        for rec in report_to_metric_records(report):
            key = rec.metric_name.lower()
            if key not in latest:
                latest[key] = rec
    return list(latest.values())


async def list_medical_reports(
    session: AsyncSession,
    *,
    user_id: str | None = None,
    limit: int = 50,
) -> list[MedicalReportRecord]:
    stmt = select(MedicalReport).order_by(MedicalReport.created_at.desc()).limit(limit)
    if user_id:
        stmt = stmt.where(MedicalReport.user_id == user_id)
    result = await session.execute(stmt)
    return [medical_report_to_record(r) for r in result.scalars().all()]


_METRIC_VALUE_STATUS: tuple[tuple[str, str, str], ...] = (
    ("hba1c", "hba1c_status", "HbA1c"),
    ("fasting_glucose", "fasting_glucose_status", "Fasting Blood Glucose"),
    ("total_cholesterol", "total_cholesterol_status", "Total Cholesterol"),
    ("ldl", "ldl_status", "LDL"),
    ("hdl", "hdl_status", "HDL"),
    ("triglycerides", "triglycerides_status", "Triglycerides"),
)

_UPDATABLE_REPORT_FIELDS = frozenset(
    {
        "test_date",
        "notes",
        *(col for pair in _METRIC_VALUE_STATUS for col in pair[:2]),
    }
)


async def update_medical_report(
    session: AsyncSession,
    report_id: int,
    updates: dict[str, object],
) -> MedicalReportRecord | None:
    """Partial update of a saved lab report. Only keys present in `updates` change."""
    from app.services.medical_extract import DEFAULT_RANGES, _infer_status

    row = await session.get(MedicalReport, report_id)
    if not row:
        return None

    patch = {k: v for k, v in updates.items() if k in _UPDATABLE_REPORT_FIELDS}
    if "test_date" in patch:
        row.test_date = patch["test_date"]  # type: ignore[assignment]
    if "notes" in patch:
        row.notes = str(patch["notes"] or "")

    for value_col, status_col, metric_name in _METRIC_VALUE_STATUS:
        if value_col not in patch and status_col not in patch:
            continue
        if value_col in patch:
            setattr(row, value_col, patch[value_col])
        if status_col in patch:
            setattr(row, status_col, patch[status_col])
        elif value_col in patch:
            value = patch[value_col]
            if value is None:
                setattr(row, status_col, None)
            else:
                ref_min, ref_max = DEFAULT_RANGES.get(metric_name, (None, None))
                inferred = _infer_status(metric_name, float(value), ref_min, ref_max)
                setattr(
                    row,
                    status_col,
                    inferred.value if hasattr(inferred, "value") else str(inferred),
                )

    await session.commit()
    await session.refresh(row)
    return medical_report_to_record(row)


async def delete_medical_report(session: AsyncSession, report_id: int) -> bool:
    row = await session.get(MedicalReport, report_id)
    if not row:
        return False
    await session.delete(row)
    await session.commit()
    return True


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
