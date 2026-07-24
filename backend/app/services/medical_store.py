"""Persist and read confirmed medical metrics."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import MedicalMetric
from app.models.schemas import MedicalMetricCreate, MedicalMetricRecord
from app.services.analytics import get_latest_medical_metrics, medical_to_record


def _derive_flag(
    value: float,
    range_low: Optional[float],
    range_high: Optional[float],
    explicit: str,
) -> str:
    if explicit and explicit != "unknown":
        return explicit
    if range_low is not None and value < range_low:
        return "low"
    if range_high is not None and value > range_high:
        return "high"
    if range_low is not None or range_high is not None:
        return "normal"
    return "unknown"


async def save_medical_metric(
    db: AsyncSession,
    body: MedicalMetricCreate,
) -> MedicalMetricRecord:
    measured = body.measured_at or datetime.utcnow()
    flag = _derive_flag(body.value, body.range_low, body.range_high, body.flag)
    display = (body.display_name or body.metric_key or "metric").strip()
    row = MedicalMetric(
        user_id=body.user_id,
        analysis_id="",
        metric_name=display,
        category="other",
        value=body.value,
        unit=body.unit,
        reference_min=body.range_low,
        reference_max=body.range_high,
        reference_range_text="",
        status=flag,
        test_date=measured.date() if hasattr(measured, "date") else None,
        source_page=None,
        extraction_confidence=1.0,
        confirmed=body.confirmed,
        file_path="",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return medical_to_record(row)


async def list_latest(
    db: AsyncSession,
    *,
    user_id: str = "default",
    confirmed_only: bool = True,
) -> list[MedicalMetricRecord]:
    return await get_latest_medical_metrics(
        db, user_id=user_id, confirmed_only=confirmed_only
    )
