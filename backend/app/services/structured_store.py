from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Intake
from app.models.schemas import DailyTotals, ExtractedMeal, IntakeRecord, NutrientValues


async def save_intake(
    session: AsyncSession,
    meal: ExtractedMeal,
    *,
    user_id: str = "default",
    source: str | None = None,
    kind: str = "food",
    file_path: str = "",
    confirmed: bool = False,
    analysis_id: str = "",
) -> Intake:
    n = meal.nutrients
    resolved_source = source or meal.source
    row = Intake(
        user_id=user_id,
        kind=kind,
        name=meal.name,
        serving=meal.serving,
        source=resolved_source,
        file_path=file_path,
        raw_text=meal.raw_text,
        confidence=meal.confidence,
        confirmed=confirmed,
        analysis_id=analysis_id,
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
        raw_text=row.raw_text,
        file_path=getattr(row, "file_path", "") or "",
        analysis_id=getattr(row, "analysis_id", "") or "",
    )


async def get_intake(session: AsyncSession, intake_id: int) -> IntakeRecord | None:
    row = await session.get(Intake, intake_id)
    return intake_to_record(row) if row else None


async def delete_intake(session: AsyncSession, intake_id: int) -> bool:
    row = await session.get(Intake, intake_id)
    if not row:
        return False
    await session.delete(row)
    await session.commit()
    return True


async def list_intakes(
    session: AsyncSession,
    *,
    user_id: str | None = None,
    kind: str | None = None,
    limit: int = 50,
) -> list[IntakeRecord]:
    stmt: Select[tuple[Intake]] = select(Intake).order_by(Intake.logged_at.desc()).limit(limit)
    if user_id:
        stmt = stmt.where(Intake.user_id == user_id)
    if kind:
        stmt = stmt.where(Intake.kind == kind)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [intake_to_record(r) for r in rows]


async def daily_totals(
    session: AsyncSession,
    *,
    user_id: str = "default",
    day: date | None = None,
) -> DailyTotals:
    day = day or date.today()
    start = datetime(day.year, day.month, day.day)
    end = start + timedelta(days=1)

    stmt = select(
        func.coalesce(func.sum(Intake.calories), 0.0),
        func.coalesce(func.sum(Intake.protein_g), 0.0),
        func.coalesce(func.sum(Intake.carbs_g), 0.0),
        func.coalesce(func.sum(Intake.fat_g), 0.0),
        func.coalesce(func.sum(Intake.fiber_g), 0.0),
        func.coalesce(func.sum(Intake.sugar_g), 0.0),
        func.coalesce(func.sum(Intake.sodium_mg), 0.0),
        func.count(Intake.id),
    ).where(
        Intake.user_id == user_id,
        Intake.logged_at >= start,
        Intake.logged_at < end,
    )
    result = await session.execute(stmt)
    cal, pro, carb, fat, fiber, sugar, sodium, count = result.one()
    return DailyTotals(
        day=day,
        calories=float(cal),
        protein_g=float(pro),
        carbs_g=float(carb),
        fat_g=float(fat),
        fiber_g=float(fiber),
        sugar_g=float(sugar),
        sodium_mg=float(sodium),
        meal_count=int(count),
    )


async def storage_stats(session: AsyncSession) -> dict:
    total = await session.scalar(select(func.count(Intake.id)))
    by_kind = await session.execute(
        select(Intake.kind, func.count(Intake.id)).group_by(Intake.kind)
    )
    return {
        "intake_count": int(total or 0),
        "by_kind": {k or "unknown": int(c) for k, c in by_kind.all()},
    }
