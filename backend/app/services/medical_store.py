"""Persist and read confirmed medical reports (1 report = 1 row)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import MedicalReport
from app.models.schemas import MedicalMetricCreate, MedicalMetricData, MedicalMetricRecord, MetricStatus
from app.services.analytics import get_latest_medical_metrics
from app.services.medical_extract import DEFAULT_RANGES
from app.services.medical_report import (
    canonicalize_metric_name,
    METRIC_COLUMNS,
    report_to_metric_records,
)


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
    """Demo helper: create a one-metric medical report row."""
    measured = body.measured_at or datetime.now(timezone.utc)
    flag = _derive_flag(body.value, body.range_low, body.range_high, body.flag)
    display = (body.display_name or body.metric_key or "metric").strip()
    canonical = canonicalize_metric_name(display) or canonicalize_metric_name(body.metric_key)
    if not canonical:
        # Fallback: store as notes-only report with unknown mapping skipped
        canonical = "HbA1c" if "a1c" in display.lower() else None
    if not canonical or canonical not in METRIC_COLUMNS:
        raise ValueError(
            f"Unsupported metric '{display}'. Use one of: {', '.join(METRIC_COLUMNS)}"
        )

    value_col, status_col, category, default_unit = METRIC_COLUMNS[canonical]
    ref_min, ref_max = DEFAULT_RANGES.get(canonical, (None, None))
    metric = MedicalMetricData(
        metric_name=canonical,
        category=category,
        value=float(body.value),
        unit=body.unit or default_unit,
        reference_min=body.range_low if body.range_low is not None else ref_min,
        reference_max=body.range_high if body.range_high is not None else ref_max,
        status=MetricStatus(flag) if flag in {"high", "low", "normal", "unknown"} else MetricStatus.unknown,
        test_date=measured.date() if hasattr(measured, "date") else None,
        extraction_confidence=1.0,
        confirmed=body.confirmed,
    )
    from app.services.medical_report import build_report_row

    row = build_report_row(
        metrics=[metric],
        user_id=body.user_id,
        confirmed=body.confirmed,
        notes=body.notes or "",
    )
    # Ensure derived flag wins
    setattr(row, status_col, flag)
    setattr(row, value_col, float(body.value))
    db.add(row)
    await db.commit()
    await db.refresh(row)
    records = report_to_metric_records(row)
    return records[0]


async def list_latest(
    db: AsyncSession,
    *,
    user_id: str = "default",
    confirmed_only: bool = True,
) -> list[MedicalMetricRecord]:
    return await get_latest_medical_metrics(
        db, user_id=user_id, confirmed_only=confirmed_only
    )
