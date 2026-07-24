from __future__ import annotations

import re
from typing import Any

from app.models.schemas import ExtractedMeal, NutrientValues
from app.services.azure_client import azure_client

EXTRACT_SYSTEM = """You extract structured nutrition data from raw text (labels, docs, or meal notes).
Return JSON with keys:
name (string), serving (string), confidence (0-1 number),
calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg (numbers).
Use 0 when unknown. Prefer numbers written in the text."""


def _num(pattern: str, text: str, default: float = 0.0) -> float:
    m = re.search(pattern, text, flags=re.IGNORECASE)
    if not m:
        return default
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return default


def stub_extract(raw_text: str, source: str = "extractor") -> ExtractedMeal:
    text = raw_text or ""
    name_match = re.search(
        r"(?:Product|Meal|Food|Item)\s*[:\-]\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )
    name = name_match.group(1).strip()[:120] if name_match else "Logged meal"
    if name == "Logged meal":
        first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "Logged meal")
        name = first[:120]

    nutrients = NutrientValues(
        calories=_num(r"calories?\s*[:=]?\s*(\d+(?:\.\d+)?)", text, 200),
        protein_g=_num(r"protein\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?", text, 10),
        carbs_g=_num(
            r"(?:total\s+)?carb(?:ohydrate)?s?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?",
            text,
            20,
        ),
        fat_g=_num(r"(?:total\s+)?fat\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?", text, 8),
        fiber_g=_num(r"fiber\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?", text, 2),
        sugar_g=_num(r"sugars?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?", text, 5),
        sodium_mg=_num(r"sodium\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m?g?", text, 150),
    )
    has_numbers = bool(re.search(r"\d", text))
    return ExtractedMeal(
        name=name or "Logged meal",
        serving="1 serving",
        nutrients=nutrients,
        raw_text=text,
        confidence=0.55 if has_numbers else 0.35,
        source=source,
    )


def _meal_from_dict(data: dict[str, Any], raw_text: str, source: str) -> ExtractedMeal:
    nutrients = NutrientValues(
        calories=float(data.get("calories") or 0),
        protein_g=float(data.get("protein_g") or 0),
        carbs_g=float(data.get("carbs_g") or 0),
        fat_g=float(data.get("fat_g") or 0),
        fiber_g=float(data.get("fiber_g") or 0),
        sugar_g=float(data.get("sugar_g") or 0),
        sodium_mg=float(data.get("sodium_mg") or 0),
    )
    return ExtractedMeal(
        name=str(data.get("name") or "Logged meal")[:120],
        serving=str(data.get("serving") or "1 serving"),
        nutrients=nutrients,
        raw_text=raw_text,
        confidence=float(data.get("confidence") or 0.8),
        source=source,
    )


async def extract_nutrients(raw_text: str, source: str = "extractor") -> ExtractedMeal:
    text = (raw_text or "").strip()
    if not text:
        return ExtractedMeal(
            name="Empty input",
            nutrients=NutrientValues(),
            raw_text="",
            confidence=0.0,
            source=source,
        )

    if azure_client.enabled:
        data = await azure_client.chat_json(EXTRACT_SYSTEM, text[:8000])
        if data:
            return _meal_from_dict(data, text, source)

    return stub_extract(text, source=source)
