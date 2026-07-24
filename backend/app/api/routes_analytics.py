"""Analytics API — confirmed-data calculations only (no LLM math)."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.schemas import (
    LoggingCompleteness,
    MedicalMetricCreate,
    MedicalMetricRecord,
    NutritionTrend,
    PeriodComparison,
    PeriodSummary,
    TopSugarSources,
)
from app.services import analytics, medical_store

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _user_id(user_id: str = Query(default="default")) -> str:
    """Stand-in for auth: scope every query to this user_id."""
    return user_id or "default"


@router.get("/daily", response_model=PeriodSummary)
async def daily_analytics(
    day: Optional[date] = Query(default=None),
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> PeriodSummary:
    return await analytics.get_daily_summary(
        db, user_id=user_id, day=day, confirmed_only=confirmed_only
    )


@router.get("/weekly", response_model=PeriodSummary)
async def weekly_analytics(
    anchor: Optional[date] = Query(default=None, description="Any day in the target ISO week"),
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> PeriodSummary:
    return await analytics.get_weekly_summary(
        db, user_id=user_id, anchor=anchor, confirmed_only=confirmed_only
    )


@router.get("/monthly", response_model=PeriodSummary)
async def monthly_analytics(
    anchor: Optional[date] = Query(default=None, description="Any day in the target month"),
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> PeriodSummary:
    return await analytics.get_monthly_summary(
        db, user_id=user_id, anchor=anchor, confirmed_only=confirmed_only
    )


@router.get("/top-sugar-sources", response_model=TopSugarSources)
async def top_sugar_sources(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    drinks_only: bool = Query(default=True),
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> TopSugarSources:
    return await analytics.get_top_sugar_sources(
        db,
        user_id=user_id,
        start=start,
        end=end,
        limit=limit,
        drinks_only=drinks_only,
        confirmed_only=confirmed_only,
    )


@router.get("/trends", response_model=NutritionTrend)
async def nutrition_trends(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    metric: str = Query(default="sugar_g"),
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> NutritionTrend:
    return await analytics.get_nutrition_trend(
        db,
        user_id=user_id,
        start=start,
        end=end,
        metric=metric,
        confirmed_only=confirmed_only,
    )


@router.get("/completeness", response_model=LoggingCompleteness)
async def logging_completeness(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    min_meals_per_day: int = Query(default=1, ge=1, le=10),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> LoggingCompleteness:
    return await analytics.get_logging_completeness(
        db,
        user_id=user_id,
        start=start,
        end=end,
        min_meals_per_day=min_meals_per_day,
    )


@router.get("/medical-metrics", response_model=list[MedicalMetricRecord])
async def medical_metrics(
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> list[MedicalMetricRecord]:
    return await analytics.get_latest_medical_metrics(
        db, user_id=user_id, confirmed_only=confirmed_only
    )


@router.post("/medical-metrics", response_model=MedicalMetricRecord)
async def create_medical_metric(
    body: MedicalMetricCreate,
    db: AsyncSession = Depends(get_session),
) -> MedicalMetricRecord:
    """Store a confirmed medical metric (for Person 1 / demos / report ingest)."""
    return await medical_store.save_medical_metric(db, body)


@router.get("/compare", response_model=PeriodComparison)
async def compare_periods(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    confirmed_only: bool = Query(default=True),
    user_id: str = Depends(_user_id),
    db: AsyncSession = Depends(get_session),
) -> PeriodComparison:
    return await analytics.compare_periods(
        db,
        user_id=user_id,
        start=start,
        end=end,
        confirmed_only=confirmed_only,
    )
