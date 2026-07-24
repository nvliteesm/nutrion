"""Medical report → Blood Sugar + Lipid Profile metrics only."""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Any

from app.models.schemas import MedicalCategory, MedicalMetricData, MetricStatus
from app.services.azure_client import azure_client
from app.services import document_parser, ocr
from app.services.input_validation import MEDICAL_REJECT, UNREADABLE

logger = logging.getLogger(__name__)

# Exact supported set (nothing else is kept)
CANONICAL_METRICS: tuple[tuple[str, MedicalCategory, str], ...] = (
    ("HbA1c", MedicalCategory.blood_sugar, "%"),
    ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    ("Total Cholesterol", MedicalCategory.lipid_profile, "mg/dL"),
    ("LDL", MedicalCategory.lipid_profile, "mg/dL"),
    ("HDL", MedicalCategory.lipid_profile, "mg/dL"),
    ("Triglycerides", MedicalCategory.lipid_profile, "mg/dL"),
)

CANONICAL_ORDER = [name for name, _, _ in CANONICAL_METRICS]
CANONICAL_META = {name: (category, unit) for name, category, unit in CANONICAL_METRICS}

SUPPORTED_METRICS = {
    "hba1c": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "hbalc": ("HbA1c", MedicalCategory.blood_sugar, "%"),  # OCR often swaps 1↔l
    "hb a1c": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "hemoglobin a1c": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "glycosylated hemoglobin": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "glycated hemoglobin": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "glycohemoglobin": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "a1c": ("HbA1c", MedicalCategory.blood_sugar, "%"),
    "fasting blood glucose": ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    "fasting blood sugar": ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    "fasting glucose": ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    "fasting plasma glucose": ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    "fbg": ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    "fbs": ("Fasting Blood Glucose", MedicalCategory.blood_sugar, "mg/dL"),
    "total cholesterol": ("Total Cholesterol", MedicalCategory.lipid_profile, "mg/dL"),
    "cholesterol total": ("Total Cholesterol", MedicalCategory.lipid_profile, "mg/dL"),
    "cholesterol": ("Total Cholesterol", MedicalCategory.lipid_profile, "mg/dL"),
    "ldl": ("LDL", MedicalCategory.lipid_profile, "mg/dL"),
    "ldl cholesterol": ("LDL", MedicalCategory.lipid_profile, "mg/dL"),
    "ldl-c": ("LDL", MedicalCategory.lipid_profile, "mg/dL"),
    "hdl": ("HDL", MedicalCategory.lipid_profile, "mg/dL"),
    "hdl cholesterol": ("HDL", MedicalCategory.lipid_profile, "mg/dL"),
    "hdl-c": ("HDL", MedicalCategory.lipid_profile, "mg/dL"),
    "triglycerides": ("Triglycerides", MedicalCategory.lipid_profile, "mg/dL"),
    "triglyceride": ("Triglycerides", MedicalCategory.lipid_profile, "mg/dL"),
    "tg": ("Triglycerides", MedicalCategory.lipid_profile, "mg/dL"),
}

# Name matchers for deterministic parse (OCR + HTML tables from Content Understanding)
_METRIC_PATTERNS: tuple[tuple[str, str, MedicalCategory, str], ...] = (
    (
        r"glycosylat(?:ed|ion)?\s+h[ae]moglobin|glycated\s+h[ae]moglobin|"
        r"hb\s*a[1l]c|hba[1l]c|h[ae]moglobin\s*\(?\s*hb\s*a[1l]c|"
        r"h[ae]moglobin\s*a[1l]c|\ba[1l]c\b",
        "HbA1c",
        MedicalCategory.blood_sugar,
        "%",
    ),
    (
        r"fasting\s+(?:blood\s+)?(?:plasma\s+)?(?:glucose|sugar)|\bfbg\b|\bfbs\b",
        "Fasting Blood Glucose",
        MedicalCategory.blood_sugar,
        "mg/dL",
    ),
    (
        r"total\s+cholesterol",
        "Total Cholesterol",
        MedicalCategory.lipid_profile,
        "mg/dL",
    ),
    (r"\bldl(?:-c|\s+cholesterol)?\b", "LDL", MedicalCategory.lipid_profile, "mg/dL"),
    (r"\bhdl(?:-c|\s+cholesterol)?\b", "HDL", MedicalCategory.lipid_profile, "mg/dL"),
    (
        r"triglycerides?\b|\btg\b",
        "Triglycerides",
        MedicalCategory.lipid_profile,
        "mg/dL",
    ),
)

DEFAULT_RANGES: dict[str, tuple[float | None, float | None]] = {
    "HbA1c": (None, 5.7),
    "Fasting Blood Glucose": (70, 99),
    "Total Cholesterol": (None, 200),
    "LDL": (None, 100),
    "HDL": (40, None),  # low is bad for HDL
    "Triglycerides": (None, 150),
}

MEDICAL_EXTRACT_SYSTEM = """You extract ONLY these lab metrics from a medical report OCR/HTML text.

First decide whether the text is from a medical / lab report that could contain
blood sugar or lipid results. If it is NOT (drink label, food menu, random photo
OCR, resume, etc.), set is_medical_report=false and return metrics=[].

Blood Sugar
- HbA1c (aliases: Glycosylated Hemoglobin, Glycated Hemoglobin, HbAlc OCR typo, A1c)
- Fasting Blood Glucose (aliases: FBG, FBS, fasting sugar) — NOT estimated average glucose (eAG)

Lipid Profile
- Total Cholesterol, LDL, HDL, Triglycerides

Rules:
- Return ONLY metrics that are explicitly present with a numeric result.
- If a metric is missing, omit it (do not invent values).
- Map alias names to the exact metric_name strings below.
- Ignore eAG, CBC, kidney, liver, thyroid, VLDL, comments, interpretation tables.
- Prefer the Result column in lab tables over comment/reference narrative numbers.
- OCR may use "l" instead of "1" (HbAlc = HbA1c).

Return JSON:
{
  "is_medical_report": true|false,
  "metrics": [
    {
      "metric_name": "HbA1c" | "Fasting Blood Glucose" | "Total Cholesterol" | "LDL" | "HDL" | "Triglycerides",
      "category": "blood_sugar" | "lipid_profile",
      "value": number,
      "unit": string,
      "reference_min": number|null,
      "reference_max": number|null,
      "reference_range_text": string,
      "status": "high"|"normal"|"low"|"unknown",
      "test_date": "YYYY-MM-DD"|null,
      "source_page": number|null,
      "extraction_confidence": 0-1
    }
  ]
}"""


def _infer_status(
    metric_name: str,
    value: float,
    ref_min: float | None,
    ref_max: float | None,
) -> MetricStatus:
    lo, hi = ref_min, ref_max
    if lo is None and hi is None:
        lo, hi = DEFAULT_RANGES.get(metric_name, (None, None))

    if metric_name == "HDL":
        # Higher HDL is generally better
        if lo is not None and value < lo:
            return MetricStatus.low
        if lo is not None and value >= lo:
            return MetricStatus.normal
        return MetricStatus.unknown

    if lo is not None and value < lo:
        return MetricStatus.low
    if hi is not None and value > hi:
        return MetricStatus.high
    if lo is not None or hi is not None:
        return MetricStatus.normal
    return MetricStatus.unknown


def _parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()[:32]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _normalize_name(raw: str) -> tuple[str, MedicalCategory, str] | None:
    key = re.sub(r"\s+", " ", raw.strip().lower())
    key = key.replace("_", " ").replace("-", " ")
    if key in SUPPORTED_METRICS:
        return SUPPORTED_METRICS[key]
    # Prefer longer aliases first to avoid "cholesterol" stealing "ldl cholesterol"
    for alias, meta in sorted(SUPPORTED_METRICS.items(), key=lambda x: -len(x[0])):
        if alias == key or alias in key:
            return meta
    if raw.strip() in CANONICAL_META:
        category, unit = CANONICAL_META[raw.strip()]
        return raw.strip(), category, unit
    return None


def _metric_from_dict(data: dict[str, Any]) -> MedicalMetricData | None:
    raw_name = str(data.get("metric_name") or "").strip()
    normalized = _normalize_name(raw_name)
    if not normalized:
        return None
    metric_name, category, default_unit = normalized

    try:
        value = float(data.get("value"))
    except (TypeError, ValueError):
        return None

    ref_min = data.get("reference_min")
    ref_max = data.get("reference_max")
    try:
        ref_min_f = float(ref_min) if ref_min is not None and ref_min != "" else None
    except (TypeError, ValueError):
        ref_min_f = None
    try:
        ref_max_f = float(ref_max) if ref_max is not None and ref_max != "" else None
    except (TypeError, ValueError):
        ref_max_f = None

    if ref_min_f is None and ref_max_f is None:
        ref_min_f, ref_max_f = DEFAULT_RANGES.get(metric_name, (None, None))

    status_raw = str(data.get("status") or "unknown").lower()
    try:
        status = MetricStatus(status_raw)
    except ValueError:
        status = _infer_status(metric_name, value, ref_min_f, ref_max_f)

    if status == MetricStatus.unknown:
        status = _infer_status(metric_name, value, ref_min_f, ref_max_f)

    page = data.get("source_page")
    try:
        source_page = int(page) if page is not None and page != "" else None
    except (TypeError, ValueError):
        source_page = None

    category = CANONICAL_META[metric_name][0]

    return MedicalMetricData(
        metric_name=metric_name,
        category=category,
        value=value,
        unit=str(data.get("unit") or default_unit),
        reference_min=ref_min_f,
        reference_max=ref_max_f,
        reference_range_text=str(data.get("reference_range_text") or ""),
        status=status,
        test_date=_parse_date(data.get("test_date")),
        source_page=source_page,
        extraction_confidence=float(data.get("extraction_confidence") or 0.7),
        confirmed=False,
    )


def _dedupe_and_order(metrics: list[MedicalMetricData]) -> list[MedicalMetricData]:
    by_name: dict[str, MedicalMetricData] = {}
    for m in metrics:
        if m.metric_name not in CANONICAL_META:
            continue
        prev = by_name.get(m.metric_name)
        if not prev or m.extraction_confidence >= prev.extraction_confidence:
            by_name[m.metric_name] = m
    return [by_name[name] for name in CANONICAL_ORDER if name in by_name]


def _parse_html_table_metrics(text: str) -> list[MedicalMetricData]:
    """Pull Result values from Content Understanding <table> rows."""
    metrics: list[MedicalMetricData] = []
    row_re = re.compile(
        r"<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>",
        flags=re.IGNORECASE | re.DOTALL,
    )
    for row in row_re.finditer(text):
        name_cell = re.sub(r"<[^>]+>", " ", row.group(1))
        name_cell = re.sub(r"\s+", " ", name_cell).strip()
        # Skip eAG — not in supported set
        if re.search(r"\beag\b|estimated\s+average\s+glucose", name_cell, re.I):
            continue
        normalized = _normalize_name(name_cell)
        if not normalized:
            # Try pattern match on cell text (handles Glycosylated Hemoglobin (HbAlc))
            matched = None
            for pat, canonical, category, unit in _METRIC_PATTERNS:
                if re.search(pat, name_cell, flags=re.IGNORECASE):
                    matched = (canonical, category, unit)
                    break
            if not matched:
                continue
            metric_name, category, unit = matched
        else:
            metric_name, category, unit = normalized

        value_cell = re.sub(r"<[^>]+>", " ", row.group(2)).strip()
        unit_cell = re.sub(r"<[^>]+>", " ", row.group(3)).strip()
        ref_cell = re.sub(r"<[^>]+>", " ", row.group(4)).strip()
        vm = re.search(r"(\d+(?:\.\d+)?)", value_cell)
        if not vm:
            continue
        value = float(vm.group(1))
        found_unit = (unit_cell or unit).replace("mgdL", "mg/dL") or unit
        ref_min, ref_max = DEFAULT_RANGES.get(metric_name, (None, None))
        range_text = ref_cell
        rm = re.search(
            r"(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)",
            ref_cell,
            flags=re.IGNORECASE,
        )
        if rm:
            ref_min = float(rm.group(1))
            ref_max = float(rm.group(2))
            range_text = f"{rm.group(1)}-{rm.group(2)}"
        metrics.append(
            MedicalMetricData(
                metric_name=metric_name,
                category=category,
                value=value,
                unit=found_unit,
                reference_min=ref_min,
                reference_max=ref_max,
                reference_range_text=range_text,
                status=_infer_status(metric_name, value, ref_min, ref_max),
                extraction_confidence=0.85,
                confirmed=False,
            )
        )
    return metrics


def stub_extract_medical(raw_text: str) -> list[MedicalMetricData]:
    """Deterministic extract: HTML tables first, then loose regex. Missing → omitted."""
    text = raw_text or ""
    metrics = _parse_html_table_metrics(text)
    seen = {m.metric_name for m in metrics}

    for pat, name, category, unit in _METRIC_PATTERNS:
        if name in seen:
            continue
        m = re.search(
            rf"({pat}).{{0,120}}?(\d+(?:\.\d+)?)\s*(%|mg/?dL|mmol/L)?",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not m:
            continue
        # Avoid grabbing interpretation table numbers (e.g. 5.6 / 5.7) far from a result
        window = m.group(0)
        if re.search(r"normal|at\s+risk|diabetes|interpretation", window, re.I):
            # Still allow if the matched name is clearly a test row with unit %
            if name == "HbA1c" and "%" not in window and "mg" not in window.lower():
                continue
        value = float(m.group(2))
        found_unit = (m.group(3) or unit).replace("mgdL", "mg/dL")
        ref_min, ref_max = DEFAULT_RANGES.get(name, (None, None))
        range_m = re.search(
            rf"{re.escape(m.group(0))}.{{0,80}}?(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        range_text = ""
        if range_m:
            ref_min = float(range_m.group(1))
            ref_max = float(range_m.group(2))
            range_text = f"{range_m.group(1)}-{range_m.group(2)}"
        metrics.append(
            MedicalMetricData(
                metric_name=name,
                category=category,
                value=value,
                unit=found_unit or unit,
                reference_min=ref_min,
                reference_max=ref_max,
                reference_range_text=range_text,
                status=_infer_status(name, value, ref_min, ref_max),
                extraction_confidence=0.55,
                confirmed=False,
            )
        )
        seen.add(name)
    return _dedupe_and_order(metrics)


async def _read_report_text(path) -> str:
    from pathlib import Path

    path = Path(path)
    ext = path.suffix.lower()
    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
    if ext in image_exts:
        # Never invent stub lab text for random photos.
        return await ocr.extract_text_from_image(path, allow_stub=False)
    return await document_parser.parse_document(path)


def _merge_metrics(
    primary: list[MedicalMetricData],
    fallback: list[MedicalMetricData],
) -> list[MedicalMetricData]:
    """Keep primary hits; fill only missing canonical metrics from fallback."""
    by_name = {m.metric_name: m for m in primary}
    for m in fallback:
        if m.metric_name not in by_name:
            by_name[m.metric_name] = m
    return [by_name[name] for name in CANONICAL_ORDER if name in by_name]


async def extract_medical_metrics(path) -> tuple[list[MedicalMetricData], str]:
    """OCR/parse → classify into blood_sugar/lipid fields only; omit missing."""
    raw_text = await _read_report_text(path)
    if not (raw_text or "").strip():
        raise ValueError(UNREADABLE)

    deterministic = stub_extract_medical(raw_text)

    llm_metrics: list[MedicalMetricData] = []
    is_medical: bool | None = None
    if azure_client.enabled and raw_text.strip():
        data = await azure_client.chat_json(MEDICAL_EXTRACT_SYSTEM, raw_text[:12000])
        if data and isinstance(data.get("metrics"), list):
            flag = data.get("is_medical_report")
            if isinstance(flag, str):
                is_medical = flag.strip().lower() in {"true", "1", "yes"}
            elif isinstance(flag, bool):
                is_medical = flag
            for item in data["metrics"]:
                if isinstance(item, dict):
                    parsed = _metric_from_dict(item)
                    if parsed:
                        llm_metrics.append(parsed)
        else:
            logger.warning("Azure medical extract empty/failed; using deterministic parser")

    if is_medical is False and not llm_metrics and not deterministic:
        raise ValueError(MEDICAL_REJECT)

    ordered = _merge_metrics(_dedupe_and_order(llm_metrics), deterministic)
    if not ordered:
        raise ValueError(MEDICAL_REJECT)
    return ordered, raw_text
