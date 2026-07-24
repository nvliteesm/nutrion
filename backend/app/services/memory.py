"""Structured memory helpers: persist intakes and index into Vector DB."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import (
    DailyTotals,
    ExtractedMeal,
    IntakeRecord,
)
from app.services import structured_store
from app.services.vector_store import vector_store


def meal_to_document(meal: ExtractedMeal, *, logged_at: Optional[datetime] = None) -> str:
    n = meal.nutrients
    when = (logged_at or datetime.utcnow()).isoformat(timespec="seconds")
    return (
        f"Meal: {meal.name}\n"
        f"Serving: {meal.serving}\n"
        f"Logged at: {when}\n"
        f"Calories: {n.calories}; Protein: {n.protein_g}g; Carbs: {n.carbs_g}g; "
        f"Fat: {n.fat_g}g; Fiber: {n.fiber_g}g; Sugar: {n.sugar_g}g; Sodium: {n.sodium_mg}mg\n"
        f"Notes: {meal.raw_text or 'n/a'}"
    )


async def save_and_index_meal(
    db: AsyncSession,
    *,
    meal: ExtractedMeal,
    user_id: str = "default",
    logged_at: Optional[datetime] = None,
) -> IntakeRecord:
    """Person 1 calls this after nutrient extraction."""
    row = await structured_store.save_intake(
        db,
        meal,
        user_id=user_id,
        source=meal.source,
    )
    if logged_at is not None:
        row.logged_at = logged_at
        await db.commit()
        await db.refresh(row)

    document = meal_to_document(meal, logged_at=row.logged_at)
    await vector_store.upsert_meal(
        intake_id=row.id,
        user_id=user_id,
        document=document,
        metadata={"name": meal.name, "source": meal.source},
    )
    return structured_store.intake_to_record(row)


async def list_intakes(
    db: AsyncSession,
    *,
    user_id: str = "default",
    limit: int = 50,
) -> list[IntakeRecord]:
    return await structured_store.list_intakes(db, user_id=user_id, limit=limit)


async def daily_totals(
    db: AsyncSession,
    *,
    user_id: str = "default",
    day: Optional[date] = None,
) -> DailyTotals:
    from app.services.analytics import get_daily_summary

    summary = await get_daily_summary(db, user_id=user_id, day=day, confirmed_only=True)
    d = summary.daily[0] if summary.daily else None
    if d:
        return d
    target = day or date.today()
    return DailyTotals(
        day=target,
        calories=0,
        protein_g=0,
        carbs_g=0,
        fat_g=0,
        fiber_g=0,
        sugar_g=0,
        sodium_mg=0,
        meal_count=0,
    )
