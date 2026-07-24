"""Controlled AI tools — the only data access path for the Analyzer LLM.

No arbitrary SQL. No unrestricted database access.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import analytics
from app.services.knowledge_store import search_approved_health_knowledge


async def get_daily_summary(
    db: AsyncSession,
    *,
    user_id: str,
    day: Optional[date] = None,
) -> dict[str, Any]:
    summary = await analytics.get_daily_summary(db, user_id=user_id, day=day)
    return summary.model_dump(mode="json")


async def get_weekly_summary(
    db: AsyncSession,
    *,
    user_id: str,
    anchor: Optional[date] = None,
) -> dict[str, Any]:
    summary = await analytics.get_weekly_summary(db, user_id=user_id, anchor=anchor)
    return summary.model_dump(mode="json")


async def get_monthly_summary(
    db: AsyncSession,
    *,
    user_id: str,
    anchor: Optional[date] = None,
) -> dict[str, Any]:
    summary = await analytics.get_monthly_summary(db, user_id=user_id, anchor=anchor)
    return summary.model_dump(mode="json")


async def get_top_sugar_sources(
    db: AsyncSession,
    *,
    user_id: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    drinks_only: bool = True,
) -> dict[str, Any]:
    result = await analytics.get_top_sugar_sources(
        db,
        user_id=user_id,
        start=start,
        end=end,
        drinks_only=drinks_only,
    )
    return result.model_dump(mode="json")


async def get_nutrition_trends(
    db: AsyncSession,
    *,
    user_id: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    metric: str = "sugar_g",
) -> dict[str, Any]:
    result = await analytics.get_nutrition_trend(
        db, user_id=user_id, start=start, end=end, metric=metric
    )
    return result.model_dump(mode="json")


async def get_confirmed_medical_metrics(
    db: AsyncSession,
    *,
    user_id: str,
) -> list[dict[str, Any]]:
    rows = await analytics.get_latest_medical_metrics(db, user_id=user_id)
    return [r.model_dump(mode="json") for r in rows]


async def get_logging_completeness(
    db: AsyncSession,
    *,
    user_id: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> dict[str, Any]:
    result = await analytics.get_logging_completeness(
        db, user_id=user_id, start=start, end=end
    )
    return result.model_dump(mode="json")


async def compare_periods(
    db: AsyncSession,
    *,
    user_id: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> dict[str, Any]:
    result = await analytics.compare_periods(
        db, user_id=user_id, start=start, end=end
    )
    return result.model_dump(mode="json")


async def search_approved_health_knowledge_tool(
    query: str,
    *,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    hits = await search_approved_health_knowledge(query, top_k=top_k)
    return [h.model_dump(mode="json") for h in hits]


TOOL_NAMES = (
    "get_daily_summary",
    "get_weekly_summary",
    "get_monthly_summary",
    "get_top_sugar_sources",
    "get_nutrition_trends",
    "get_confirmed_medical_metrics",
    "get_logging_completeness",
    "compare_periods",
    "search_approved_health_knowledge",
)
