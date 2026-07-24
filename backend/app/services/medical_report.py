"""Helpers: MedicalMetricData list <-> one MedicalReport row."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.models.orm import MedicalReport
from app.models.schemas import (
    MedicalCategory,
    MedicalMetricData,
    MedicalMetricRecord,
    MetricStatus,
)
from app.services.medical_extract import DEFAULT_RANGES

# Canonical column mapping for the wide medical_reports table
METRIC_COLUMNS: dict[str, tuple[str, str, MedicalCategory, str]] = {
    # metric_name -> (value_col, status_col, category, unit)
    "HbA1c": ("hba1c", "hba1c_status", MedicalCategory.blood_sugar, "%"),
    "Fasting Blood Glucose": (
        "fasting_glucose",
        "fasting_glucose_status",
        MedicalCategory.blood_sugar,
        "mg/dL",
    ),
    "Total Cholesterol": (
        "total_cholesterol",
        "total_cholesterol_status",
        MedicalCategory.lipid_profile,
        "mg/dL",
    ),
    "LDL": ("ldl", "ldl_status", MedicalCategory.lipid_profile, "mg/dL"),
    "HDL": ("hdl", "hdl_status", MedicalCategory.lipid_profile, "mg/dL"),
    "Triglycerides": (
        "triglycerides",
        "triglycerides_status",
        MedicalCategory.lipid_profile,
        "mg/dL",
    ),
}

# Aliases that may appear from older rows / demo API
METRIC_ALIASES: dict[str, str] = {
    "hba1c": "HbA1c",
    "a1c": "HbA1c",
    "fasting blood glucose": "Fasting Blood Glucose",
    "fasting glucose": "Fasting Blood Glucose",
    "fbg": "Fasting Blood Glucose",
    "fbs": "Fasting Blood Glucose",
    "total cholesterol": "Total Cholesterol",
    "cholesterol": "Total Cholesterol",
    "ldl": "LDL",
    "ldl cholesterol": "LDL",
    "hdl": "HDL",
    "hdl cholesterol": "HDL",
    "triglycerides": "Triglycerides",
    "triglyceride": "Triglycerides",
    "tg": "Triglycerides",
}


def canonicalize_metric_name(name: str) -> str | None:
    raw = (name or "").strip()
    if raw in METRIC_COLUMNS:
        return raw
    key = raw.lower()
    if key in METRIC_ALIASES:
        return METRIC_ALIASES[key]
    for alias, canonical in METRIC_ALIASES.items():
        if alias in key or key in alias:
            return canonical
    return None


def _status_str(status: Any) -> str:
    if hasattr(status, "value"):
        return str(status.value)
    return str(status or "unknown")


def metrics_to_report_fields(
    metrics: list[MedicalMetricData],
) -> dict[str, Any]:
    """Flatten metric list into MedicalReport column values."""
    fields: dict[str, Any] = {
        "hba1c": None,
        "hba1c_status": None,
        "fasting_glucose": None,
        "fasting_glucose_status": None,
        "total_cholesterol": None,
        "total_cholesterol_status": None,
        "ldl": None,
        "ldl_status": None,
        "hdl": None,
        "hdl_status": None,
        "triglycerides": None,
        "triglycerides_status": None,
        "test_date": None,
        "confidence": 0.5,
    }
    confidences: list[float] = []
    for m in metrics:
        canonical = canonicalize_metric_name(m.metric_name)
        if not canonical:
            continue
        value_col, status_col, _, _ = METRIC_COLUMNS[canonical]
        fields[value_col] = float(m.value)
        fields[status_col] = _status_str(m.status)
        if m.test_date and fields["test_date"] is None:
            fields["test_date"] = m.test_date
        confidences.append(float(m.extraction_confidence or 0.5))
    if confidences:
        fields["confidence"] = sum(confidences) / len(confidences)
    return fields


def report_to_metrics(row: MedicalReport) -> list[MedicalMetricData]:
    """Expand one report row back into metric objects (API / insights)."""
    out: list[MedicalMetricData] = []
    for name, (value_col, status_col, category, unit) in METRIC_COLUMNS.items():
        value = getattr(row, value_col, None)
        if value is None:
            continue
        status_raw = getattr(row, status_col, None) or "unknown"
        try:
            status = MetricStatus(str(status_raw).lower())
        except ValueError:
            status = MetricStatus.unknown
        ref_min, ref_max = DEFAULT_RANGES.get(name, (None, None))
        out.append(
            MedicalMetricData(
                metric_name=name,
                category=category,
                value=float(value),
                unit=unit,
                reference_min=ref_min,
                reference_max=ref_max,
                reference_range_text="",
                status=status,
                test_date=row.test_date,
                source_page=None,
                extraction_confidence=float(row.confidence or 0.5),
                confirmed=bool(row.confirmed),
            )
        )
    return out


def report_to_metric_records(row: MedicalReport) -> list[MedicalMetricRecord]:
    """Expand one report into flat metric records for list/latest APIs."""
    created = row.created_at or datetime.utcnow()
    records: list[MedicalMetricRecord] = []
    for m in report_to_metrics(row):
        # Synthetic id keeps records unique when expanding: report_id * 100 + index
        idx = list(METRIC_COLUMNS.keys()).index(m.metric_name) + 1
        records.append(
            MedicalMetricRecord(
                id=row.id * 100 + idx,
                user_id=row.user_id,
                analysis_id=row.analysis_id or "",
                metric_name=m.metric_name,
                category=m.category.value if hasattr(m.category, "value") else str(m.category),
                value=m.value,
                unit=m.unit,
                reference_min=m.reference_min,
                reference_max=m.reference_max,
                reference_range_text=m.reference_range_text,
                status=m.status.value if hasattr(m.status, "value") else str(m.status),
                test_date=m.test_date,
                source_page=None,
                extraction_confidence=m.extraction_confidence,
                confirmed=bool(row.confirmed),
                file_path=row.file_path or "",
                created_at=created,
            )
        )
    return records


def build_report_row(
    *,
    metrics: list[MedicalMetricData],
    user_id: str,
    analysis_id: str = "",
    file_path: str = "",
    confirmed: bool = True,
    notes: str = "",
) -> MedicalReport:
    fields = metrics_to_report_fields(metrics)
    return MedicalReport(
        user_id=user_id,
        analysis_id=analysis_id,
        file_path=file_path,
        confirmed=confirmed,
        notes=notes,
        test_date=fields.pop("test_date"),
        confidence=float(fields.pop("confidence") or 0.5),
        **fields,
    )
