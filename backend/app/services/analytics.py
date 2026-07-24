"""Backend analytics: all totals, averages, rankings, and period comparisons.

The LLM must never compute these values from raw rows — only explain them.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Intake, MedicalMetric
from app.models.schemas import (
    DailyTotals,
    LoggingCompleteness,
    MedicalMetricRecord,
    NutrientValues,
    NutritionTrend,
    PeriodComparison,
    PeriodSummary,
    SugarSourceItem,
    TopSugarSources,
    TrendPoint,
)

NUTRIENT_FIELDS = (
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
)


def day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, datetime.min.time())
    end = datetime.combine(day, datetime.max.time())
    return start, end


def week_bounds(anchor: Optional[date] = None) -> tuple[date, date]:
    """ISO week Monday–Sunday containing anchor (default today)."""
    day = anchor or date.today()
    start = day - timedelta(days=day.weekday())
    end = start + timedelta(days=6)
    return start, end


def month_bounds(anchor: Optional[date] = None) -> tuple[date, date]:
    day = anchor or date.today()
    start = day.replace(day=1)
    if start.month == 12:
        next_month = start.replace(year=start.year + 1, month=1, day=1)
    else:
        next_month = start.replace(month=start.month + 1, day=1)
    end = next_month - timedelta(days=1)
    return start, end


def previous_period(start: date, end: date) -> tuple[date, date]:
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


def _nutrients_from_sums(
    cal: float,
    prot: float,
    carbs: float,
    fat: float,
    fiber: float,
    sugar: float,
    sodium: float,
) -> NutrientValues:
    return NutrientValues(
        calories=float(cal or 0),
        protein_g=float(prot or 0),
        carbs_g=float(carbs or 0),
        fat_g=float(fat or 0),
        fiber_g=float(fiber or 0),
        sugar_g=float(sugar or 0),
        sodium_mg=float(sodium or 0),
    )


def _avg_per_day(totals: NutrientValues, days: int) -> NutrientValues:
    d = max(days, 1)
    return NutrientValues(
        calories=round(totals.calories / d, 2),
        protein_g=round(totals.protein_g / d, 2),
        carbs_g=round(totals.carbs_g / d, 2),
        fat_g=round(totals.fat_g / d, 2),
        fiber_g=round(totals.fiber_g / d, 2),
        sugar_g=round(totals.sugar_g / d, 2),
        sodium_mg=round(totals.sodium_mg / d, 2),
    )


def _change_percent(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100.0, 1)


def _range_filters(
    user_id: str,
    start: date,
    end: date,
    *,
    confirmed_only: bool = True,
) -> list:
    start_dt, _ = day_bounds(start)
    _, end_dt = day_bounds(end)
    filters = [
        Intake.user_id == user_id,
        Intake.logged_at >= start_dt,
        Intake.logged_at <= end_dt,
    ]
    if confirmed_only:
        # Treat NULL as confirmed for rows created before the column existed.
        filters.append(or_(Intake.confirmed.is_(True), Intake.confirmed.is_(None)))
    return filters


async def _period_nutrient_sums(
    db: AsyncSession,
    *,
    user_id: str,
    start: date,
    end: date,
    confirmed_only: bool = True,
) -> tuple[NutrientValues, int, int, int]:
    filters = _range_filters(user_id, start, end, confirmed_only=confirmed_only)
    stmt = select(
        func.count(Intake.id),
        func.coalesce(func.sum(Intake.calories), 0.0),
        func.coalesce(func.sum(Intake.protein_g), 0.0),
        func.coalesce(func.sum(Intake.carbs_g), 0.0),
        func.coalesce(func.sum(Intake.fat_g), 0.0),
        func.coalesce(func.sum(Intake.fiber_g), 0.0),
        func.coalesce(func.sum(Intake.sugar_g), 0.0),
        func.coalesce(func.sum(Intake.sodium_mg), 0.0),
    ).where(and_(*filters))
    count, cal, prot, carbs, fat, fiber, sugar, sodium = (await db.execute(stmt)).one()

    est_stmt = select(func.count(Intake.id)).where(
        and_(*filters, Intake.is_estimated.is_(True))
    )
    estimated = int((await db.execute(est_stmt)).scalar() or 0)
    total = int(count or 0)
    confirmed_count = total if confirmed_only else total - estimated
    return (
        _nutrients_from_sums(cal, prot, carbs, fat, fiber, sugar, sodium),
        total,
        confirmed_count,
        estimated,
    )


async def _daily_breakdown(
    db: AsyncSession,
    *,
    user_id: str,
    start: date,
    end: date,
    confirmed_only: bool = True,
) -> list[DailyTotals]:
    filters = _range_filters(user_id, start, end, confirmed_only=confirmed_only)
    stmt = select(Intake).where(and_(*filters)).order_by(Intake.logged_at.asc())
    rows = (await db.execute(stmt)).scalars().all()

    buckets: dict[date, dict] = defaultdict(
        lambda: {
            "calories": 0.0,
            "protein_g": 0.0,
            "carbs_g": 0.0,
            "fat_g": 0.0,
            "fiber_g": 0.0,
            "sugar_g": 0.0,
            "sodium_mg": 0.0,
            "meal_count": 0,
            "confirmed_count": 0,
            "estimated_count": 0,
        }
    )
    for row in rows:
        logged = row.logged_at
        if hasattr(logged, "date"):
            d = logged.date()
        else:
            d = logged
        b = buckets[d]
        b["calories"] += float(row.calories or 0)
        b["protein_g"] += float(row.protein_g or 0)
        b["carbs_g"] += float(row.carbs_g or 0)
        b["fat_g"] += float(row.fat_g or 0)
        b["fiber_g"] += float(row.fiber_g or 0)
        b["sugar_g"] += float(row.sugar_g or 0)
        b["sodium_mg"] += float(row.sodium_mg or 0)
        b["meal_count"] += 1
        if getattr(row, "confirmed", True):
            b["confirmed_count"] += 1
        if getattr(row, "is_estimated", False):
            b["estimated_count"] += 1

    out: list[DailyTotals] = []
    cursor = start
    while cursor <= end:
        b = buckets.get(cursor)
        if b:
            out.append(
                DailyTotals(
                    day=cursor,
                    calories=round(b["calories"], 2),
                    protein_g=round(b["protein_g"], 2),
                    carbs_g=round(b["carbs_g"], 2),
                    fat_g=round(b["fat_g"], 2),
                    fiber_g=round(b["fiber_g"], 2),
                    sugar_g=round(b["sugar_g"], 2),
                    sodium_mg=round(b["sodium_mg"], 2),
                    meal_count=b["meal_count"],
                    confirmed_count=b["confirmed_count"],
                    estimated_count=b["estimated_count"],
                )
            )
        else:
            out.append(
                DailyTotals(
                    day=cursor,
                    calories=0,
                    protein_g=0,
                    carbs_g=0,
                    fat_g=0,
                    fiber_g=0,
                    sugar_g=0,
                    sodium_mg=0,
                    meal_count=0,
                )
            )
        cursor += timedelta(days=1)
    return out


async def _period_summary(
    db: AsyncSession,
    *,
    user_id: str,
    period: str,
    start: date,
    end: date,
    confirmed_only: bool = True,
) -> PeriodSummary:
    totals, meal_count, confirmed_count, estimated_count = await _period_nutrient_sums(
        db,
        user_id=user_id,
        start=start,
        end=end,
        confirmed_only=confirmed_only,
    )
    daily = await _daily_breakdown(
        db,
        user_id=user_id,
        start=start,
        end=end,
        confirmed_only=confirmed_only,
    )
    days_with_logs = sum(1 for d in daily if d.meal_count > 0)
    span_days = (end - start).days + 1
    return PeriodSummary(
        user_id=user_id,
        period=period,
        start=start,
        end=end,
        totals=totals,
        averages_per_day=_avg_per_day(totals, span_days),
        meal_count=meal_count,
        confirmed_count=confirmed_count,
        estimated_count=estimated_count,
        days_with_logs=days_with_logs,
        daily=daily,
    )


async def get_daily_summary(
    db: AsyncSession,
    *,
    user_id: str = "default",
    day: Optional[date] = None,
    confirmed_only: bool = True,
) -> PeriodSummary:
    target = day or date.today()
    return await _period_summary(
        db,
        user_id=user_id,
        period="daily",
        start=target,
        end=target,
        confirmed_only=confirmed_only,
    )


async def get_weekly_summary(
    db: AsyncSession,
    *,
    user_id: str = "default",
    anchor: Optional[date] = None,
    confirmed_only: bool = True,
) -> PeriodSummary:
    start, end = week_bounds(anchor)
    return await _period_summary(
        db,
        user_id=user_id,
        period="weekly",
        start=start,
        end=end,
        confirmed_only=confirmed_only,
    )


async def get_monthly_summary(
    db: AsyncSession,
    *,
    user_id: str = "default",
    anchor: Optional[date] = None,
    confirmed_only: bool = True,
) -> PeriodSummary:
    start, end = month_bounds(anchor)
    return await _period_summary(
        db,
        user_id=user_id,
        period="monthly",
        start=start,
        end=end,
        confirmed_only=confirmed_only,
    )


async def get_top_sugar_sources(
    db: AsyncSession,
    *,
    user_id: str = "default",
    start: Optional[date] = None,
    end: Optional[date] = None,
    limit: int = 10,
    drinks_only: bool = True,
    confirmed_only: bool = True,
) -> TopSugarSources:
    if start is None or end is None:
        start, end = week_bounds()
    filters = _range_filters(user_id, start, end, confirmed_only=confirmed_only)
    if drinks_only:
        filters.append(
            or_(
                Intake.kind == "drink",
                Intake.input_type == "drink",
                Intake.source.ilike("%drink%"),
            )
        )

    stmt = select(Intake).where(and_(*filters))
    rows = (await db.execute(stmt)).scalars().all()

    groups: dict[str, dict] = defaultdict(
        lambda: {
            "sugar_g": 0.0,
            "count": 0,
            "input_type": "drink",
            "is_estimated": False,
            "ids": [],
        }
    )
    total_sugar = 0.0
    for row in rows:
        sugar = float(row.sugar_g or 0)
        total_sugar += sugar
        key = (row.name or "Unknown").strip() or "Unknown"
        g = groups[key]
        g["sugar_g"] += sugar
        g["count"] += 1
        g["input_type"] = getattr(row, "input_type", None) or "drink"
        g["is_estimated"] = g["is_estimated"] or bool(getattr(row, "is_estimated", False))
        if len(g["ids"]) < 5:
            g["ids"].append(row.id)

    ranked = sorted(groups.items(), key=lambda kv: kv[1]["sugar_g"], reverse=True)[:limit]
    items: list[SugarSourceItem] = []
    for name, g in ranked:
        pct = (g["sugar_g"] / total_sugar * 100.0) if total_sugar > 0 else 0.0
        items.append(
            SugarSourceItem(
                name=name,
                sugar_g=round(g["sugar_g"], 2),
                percent_of_period_sugar=round(pct, 1),
                intake_count=g["count"],
                input_type=g["input_type"],
                is_estimated=g["is_estimated"],
                sample_intake_ids=g["ids"],
            )
        )
    return TopSugarSources(
        user_id=user_id,
        start=start,
        end=end,
        total_sugar_g=round(total_sugar, 2),
        items=items,
    )


async def get_nutrition_trend(
    db: AsyncSession,
    *,
    user_id: str = "default",
    start: Optional[date] = None,
    end: Optional[date] = None,
    metric: str = "sugar_g",
    confirmed_only: bool = True,
) -> NutritionTrend:
    if metric not in NUTRIENT_FIELDS and metric != "meal_count":
        metric = "sugar_g"
    if start is None or end is None:
        start, end = week_bounds()

    daily = await _daily_breakdown(
        db,
        user_id=user_id,
        start=start,
        end=end,
        confirmed_only=confirmed_only,
    )
    points = [
        TrendPoint(
            day=d.day,
            calories=d.calories,
            sugar_g=d.sugar_g,
            protein_g=d.protein_g,
            carbs_g=d.carbs_g,
            fat_g=d.fat_g,
            meal_count=d.meal_count,
        )
        for d in daily
    ]

    def _metric_value(p: TrendPoint) -> float:
        if metric == "meal_count":
            return float(p.meal_count)
        return float(getattr(p, metric))

    values = [_metric_value(p) for p in points]
    span = max(len(values), 1)
    period_avg = round(sum(values) / span, 2)

    prev_start, prev_end = previous_period(start, end)
    prev_daily = await _daily_breakdown(
        db,
        user_id=user_id,
        start=prev_start,
        end=prev_end,
        confirmed_only=confirmed_only,
    )
    prev_values = [
        float(p.meal_count if metric == "meal_count" else getattr(p, metric))
        for p in prev_daily
    ]
    prev_avg = round(sum(prev_values) / max(len(prev_values), 1), 2) if prev_values else None

    return NutritionTrend(
        user_id=user_id,
        start=start,
        end=end,
        metric=metric,
        points=points,
        period_average=period_avg,
        previous_period_average=prev_avg,
        change_percent=_change_percent(period_avg, prev_avg or 0) if prev_avg is not None else None,
    )


async def get_logging_completeness(
    db: AsyncSession,
    *,
    user_id: str = "default",
    start: Optional[date] = None,
    end: Optional[date] = None,
    min_meals_per_day: int = 1,
) -> LoggingCompleteness:
    if start is None or end is None:
        start, end = week_bounds()
    # Completeness considers all logs (confirmed + unconfirmed) so gaps are visible.
    daily = await _daily_breakdown(
        db,
        user_id=user_id,
        start=start,
        end=end,
        confirmed_only=False,
    )
    expected = (end - start).days + 1
    incomplete = [d.day for d in daily if d.meal_count < min_meals_per_day]
    days_with = expected - len(incomplete)
    logged_days = [d for d in daily if d.meal_count > 0]
    meals_per = (
        round(sum(d.meal_count for d in logged_days) / len(logged_days), 2)
        if logged_days
        else 0.0
    )
    pct = round((days_with / expected) * 100.0, 1) if expected else 0.0
    note = (
        f"{len(incomplete)} day(s) have incomplete logging "
        f"(fewer than {min_meals_per_day} meal(s) logged)."
        if incomplete
        else "All days in this period have at least the minimum expected logs."
    )
    return LoggingCompleteness(
        user_id=user_id,
        start=start,
        end=end,
        expected_days=expected,
        days_with_logs=days_with,
        incomplete_days=incomplete,
        completeness_percent=pct,
        meals_per_logged_day=meals_per,
        note=note,
    )


def medical_to_record(row: MedicalMetric) -> MedicalMetricRecord:
    measured = row.test_date
    measured_at = (
        datetime.combine(measured, datetime.min.time())
        if measured is not None
        else row.created_at
    )
    return MedicalMetricRecord(
        id=row.id,
        user_id=row.user_id,
        analysis_id=row.analysis_id or "",
        metric_name=row.metric_name,
        category=row.category or "other",
        value=row.value,
        unit=row.unit or "",
        reference_min=row.reference_min,
        reference_max=row.reference_max,
        reference_range_text=row.reference_range_text or "",
        status=row.status or "unknown",
        test_date=row.test_date,
        source_page=row.source_page,
        extraction_confidence=float(row.extraction_confidence or 0.5),
        confirmed=bool(row.confirmed),
        file_path=row.file_path or "",
        created_at=row.created_at or measured_at,
    )


async def get_latest_medical_metrics(
    db: AsyncSession,
    *,
    user_id: str = "default",
    confirmed_only: bool = True,
) -> list[MedicalMetricRecord]:
    filters = [MedicalMetric.user_id == user_id]
    if confirmed_only:
        filters.append(MedicalMetric.confirmed.is_(True))
    stmt = (
        select(MedicalMetric)
        .where(and_(*filters))
        .order_by(MedicalMetric.created_at.desc(), MedicalMetric.id.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    latest: dict[str, MedicalMetric] = {}
    for row in rows:
        key = (row.metric_name or "").strip().lower() or f"id-{row.id}"
        if key not in latest:
            latest[key] = row
    return [medical_to_record(r) for r in latest.values()]


async def compare_periods(
    db: AsyncSession,
    *,
    user_id: str = "default",
    start: Optional[date] = None,
    end: Optional[date] = None,
    confirmed_only: bool = True,
) -> PeriodComparison:
    if start is None or end is None:
        start, end = week_bounds()
    prev_start, prev_end = previous_period(start, end)

    current, cur_count, _, _ = await _period_nutrient_sums(
        db, user_id=user_id, start=start, end=end, confirmed_only=confirmed_only
    )
    previous, prev_count, _, _ = await _period_nutrient_sums(
        db, user_id=user_id, start=prev_start, end=prev_end, confirmed_only=confirmed_only
    )
    deltas = NutrientValues(
        calories=round(current.calories - previous.calories, 2),
        protein_g=round(current.protein_g - previous.protein_g, 2),
        carbs_g=round(current.carbs_g - previous.carbs_g, 2),
        fat_g=round(current.fat_g - previous.fat_g, 2),
        fiber_g=round(current.fiber_g - previous.fiber_g, 2),
        sugar_g=round(current.sugar_g - previous.sugar_g, 2),
        sodium_mg=round(current.sodium_mg - previous.sodium_mg, 2),
    )
    change_percents = {
        field: _change_percent(getattr(current, field), getattr(previous, field))
        for field in NUTRIENT_FIELDS
    }
    return PeriodComparison(
        user_id=user_id,
        current_start=start,
        current_end=end,
        previous_start=prev_start,
        previous_end=prev_end,
        current=current,
        previous=previous,
        deltas=deltas,
        change_percents=change_percents,
        current_meal_count=cur_count,
        previous_meal_count=prev_count,
    )


# Friendly aliases matching the product brief naming.
getDailySummary = get_daily_summary
getWeeklySummary = get_weekly_summary
getMonthlySummary = get_monthly_summary
getTopSugarSources = get_top_sugar_sources
getNutritionTrend = get_nutrition_trend
getLoggingCompleteness = get_logging_completeness
getLatestMedicalMetrics = get_latest_medical_metrics
comparePeriods = compare_periods
