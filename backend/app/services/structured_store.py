from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Intake
from app.models.schemas import ExtractedMeal, IntakeRecord, NutrientValues


async def save_intake(
    session: AsyncSession,
    meal: ExtractedMeal,
    *,
    user_id: str = "default",
    source: str | None = None,
) -> Intake:
    n = meal.nutrients
    row = Intake(
        user_id=user_id,
        name=meal.name,
        serving=meal.serving,
        source=source or meal.source,
        raw_text=meal.raw_text,
        confidence=meal.confidence,
        calories=n.calories,
        protein_g=n.protein_g,
        carbs_g=n.carbs_g,
        fat_g=n.fat_g,
        fiber_g=n.fiber_g,
        sugar_g=n.sugar_g,
        sodium_mg=n.sodium_mg,
        extras_json=json.dumps(n.extras or {}),
        logged_at=datetime.utcnow(),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


def intake_to_record(row: Intake) -> IntakeRecord:
    extras: dict[str, float] = {}
    try:
        extras = {k: float(v) for k, v in json.loads(row.extras_json or "{}").items()}
    except Exception:
        extras = {}
    return IntakeRecord(
        id=row.id,
        user_id=row.user_id,
        name=row.name,
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
    )


async def list_intakes(
    session: AsyncSession,
    *,
    user_id: str | None = None,
    limit: int = 50,
) -> list[IntakeRecord]:
    stmt = select(Intake).order_by(Intake.logged_at.desc()).limit(limit)
    if user_id:
        stmt = stmt.where(Intake.user_id == user_id)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [intake_to_record(r) for r in rows]
