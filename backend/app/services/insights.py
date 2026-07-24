"""Reusable insight generators — compute text from analytics evidence, then persist."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Insight
from app.models.schemas import InsightRecord
from app.services import analytics


def _insight_record(row: Insight) -> InsightRecord:
    return InsightRecord(
        id=row.id,
        user_id=row.user_id,
        kind=row.kind,
        title=row.title,
        body=row.body,
        period_start=row.period_start,
        period_end=row.period_end,
        created_at=row.created_at,
    )


async def _save_insight(
    db: AsyncSession,
    *,
    user_id: str,
    kind: str,
    title: str,
    body: str,
    start: date,
    end: date,
    evidence: dict[str, Any],
) -> InsightRecord:
    row = Insight(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        period_start=datetime.combine(start, datetime.min.time()),
        period_end=datetime.combine(end, datetime.max.time()),
        evidence_json=json.dumps(evidence, default=str),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _insight_record(row)


async def generate_daily_insight(
    db: AsyncSession,
    *,
    user_id: str = "default",
    day: Optional[date] = None,
) -> InsightRecord:
    summary = await analytics.get_daily_summary(db, user_id=user_id, day=day)
    t = summary.totals
    body = (
        f"On {summary.start.isoformat()}, confirmed logs total "
        f"{t.calories:.0f} kcal and {t.sugar_g:.1f} g sugar across {summary.meal_count} meal(s). "
        f"{summary.estimated_count} item(s) were marked estimated."
    )
    return await _save_insight(
        db,
        user_id=user_id,
        kind="daily",
        title=f"Daily insight — {summary.start.isoformat()}",
        body=body,
        start=summary.start,
        end=summary.end,
        evidence=summary.model_dump(mode="json"),
    )


async def generate_weekly_insight(
    db: AsyncSession,
    *,
    user_id: str = "default",
    anchor: Optional[date] = None,
) -> InsightRecord:
    summary = await analytics.get_weekly_summary(db, user_id=user_id, anchor=anchor)
    t = summary.totals
    body = (
        f"This week ({summary.start} to {summary.end}) you logged {summary.meal_count} confirmed meal(s) "
        f"on {summary.days_with_logs} day(s). Totals: {t.calories:.0f} kcal, "
        f"{t.sugar_g:.1f} g sugar (avg {summary.averages_per_day.sugar_g:.1f} g/day)."
    )
    return await _save_insight(
        db,
        user_id=user_id,
        kind="weekly",
        title=f"Weekly insight — {summary.start} → {summary.end}",
        body=body,
        start=summary.start,
        end=summary.end,
        evidence=summary.model_dump(mode="json"),
    )


async def generate_sugar_source_insight(
    db: AsyncSession,
    *,
    user_id: str = "default",
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> InsightRecord:
    sources = await analytics.get_top_sugar_sources(
        db, user_id=user_id, start=start, end=end, drinks_only=True
    )
    if not sources.items:
        body = (
            f"No confirmed drink sugar sources were found between {sources.start} and {sources.end}."
        )
    else:
        top = sources.items[0]
        est = " (includes estimated items)" if top.is_estimated else ""
        body = (
            f"Between {sources.start} and {sources.end}, confirmed drink logs show "
            f"{top.name} contributed the most sugar at {top.sugar_g:.1f} g "
            f"({top.percent_of_period_sugar:.0f}% of drink sugar in this period){est}."
        )
    return await _save_insight(
        db,
        user_id=user_id,
        kind="sugar_sources",
        title="Top sugar source insight",
        body=body,
        start=sources.start,
        end=sources.end,
        evidence=sources.model_dump(mode="json"),
    )


async def generate_logging_completeness_insight(
    db: AsyncSession,
    *,
    user_id: str = "default",
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> InsightRecord:
    comp = await analytics.get_logging_completeness(
        db, user_id=user_id, start=start, end=end
    )
    body = (
        f"Logging completeness from {comp.start} to {comp.end}: "
        f"{comp.completeness_percent:.0f}% ({comp.days_with_logs}/{comp.expected_days} days). "
        f"{comp.note}"
    )
    return await _save_insight(
        db,
        user_id=user_id,
        kind="completeness",
        title="Logging completeness insight",
        body=body,
        start=comp.start,
        end=comp.end,
        evidence=comp.model_dump(mode="json"),
    )


async def generate_medical_context_summary(
    db: AsyncSession,
    *,
    user_id: str = "default",
) -> InsightRecord:
    metrics = await analytics.get_latest_medical_metrics(db, user_id=user_id)
    today = date.today()
    if not metrics:
        body = "No confirmed medical metrics are on file yet."
        evidence: dict[str, Any] = {"metrics": []}
    else:
        parts = []
        for m in metrics:
            flag = m.status or "unknown"
            flag_bit = f", flagged {flag} on the report range" if flag != "unknown" else ""
            when = m.test_date.isoformat() if m.test_date else m.created_at.date().isoformat()
            parts.append(
                f"{m.metric_name}: {m.value} {m.unit}{flag_bit} (measured {when})"
            )
        body = (
            "Latest confirmed medical metrics: "
            + "; ".join(parts)
            + ". These are report values only — not a diagnosis."
        )
        evidence = {"metrics": [m.model_dump(mode="json") for m in metrics]}
    return await _save_insight(
        db,
        user_id=user_id,
        kind="medical_context",
        title="Medical context summary",
        body=body,
        start=today,
        end=today,
        evidence=evidence,
    )


async def list_insights(
    db: AsyncSession,
    *,
    user_id: str = "default",
    kind: Optional[str] = None,
    limit: int = 20,
) -> list[InsightRecord]:
    stmt = (
        select(Insight)
        .where(Insight.user_id == user_id)
        .order_by(Insight.created_at.desc())
        .limit(limit)
    )
    if kind:
        stmt = stmt.where(Insight.kind == kind)
    rows = (await db.execute(stmt)).scalars().all()
    return [_insight_record(r) for r in rows]


# Brief-style aliases
generateDailyInsight = generate_daily_insight
generateWeeklyInsight = generate_weekly_insight
generateSugarSourceInsight = generate_sugar_source_insight
generateLoggingCompletenessInsight = generate_logging_completeness_insight
generateMedicalContextSummary = generate_medical_context_summary
