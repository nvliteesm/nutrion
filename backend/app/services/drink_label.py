"""Drink label OCR → normalized nutrition fields.

Returns None when the image is not a readable nutrition label so callers can
fall back to vision (Kimi) for unlabeled drink photos.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.models.schemas import ConfirmationStatus, DrinkLabelData
from app.services.azure_client import azure_client
from app.services import ocr
from app.services.input_validation import (
    drink_has_usable_nutrients,
    looks_like_nutrition_label,
)

logger = logging.getLogger(__name__)

DRINK_EXTRACT_SYSTEM = """You extract structured drink nutrition-label data from OCR text.

First decide whether the text is from a beverage Nutrition Facts / drink label.
If it is NOT a drink nutrition label (random photo OCR, food menu, medical report,
packaging without nutrient facts, empty/gibberish), set is_nutrition_label=false
and leave nutrients at 0.

Return JSON with keys:
is_nutrition_label (boolean),
product_name (string),
serving_size (string),
servings_per_container (number or null),
calories (number),
carbohydrates_g (number),
total_sugar_g (number),
added_sugar_g (number),
drink_volume_ml (number or null — convert fl oz to ml if needed: 1 fl oz ≈ 29.57 ml),
sodium_mg (number or null),
caffeine_mg (number or null),
confidence (0-1).
Use 0 when a nutrient is unknown. Prefer values explicitly on the label.
Never invent a product just to fill the schema when is_nutrition_label is false."""


def _num(pattern: str, text: str) -> float | None:
    m = re.search(pattern, text, flags=re.IGNORECASE)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def stub_drink_from_ocr(raw_text: str) -> DrinkLabelData:
    text = raw_text or ""
    name_match = re.search(
        r"(?:Product|Drink|Beverage)\s*[:\-]\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )
    name = name_match.group(1).strip()[:120] if name_match else None
    if not name:
        name = next((ln.strip() for ln in text.splitlines() if ln.strip()), "Unknown drink")[:120]

    volume = _num(r"(\d+(?:\.\d+)?)\s*m(?:l|illiliters?)\b", text)
    if volume is None:
        fl_oz = _num(r"(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|fluid\s*ounces?)\b", text)
        if fl_oz is not None:
            volume = round(fl_oz * 29.57, 1)

    servings = _num(r"servings?\s+per\s+container\s*[:=]?\s*(\d+(?:\.\d+)?)", text)
    serving_match = re.search(
        r"serving\s+size\s*[:=]?\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )
    serving_size = serving_match.group(1).strip()[:80] if serving_match else "1 serving"

    calories = _num(r"calories?\s*[:=]?\s*(\d+(?:\.\d+)?)", text) or 0
    carbs = _num(
        r"(?:total\s+)?carb(?:ohydrate)?s?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?",
        text,
    ) or 0
    total_sugar = _num(r"(?:total\s+)?sugars?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?", text) or 0
    added_sugar = _num(r"added\s+sugars?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?", text)
    if added_sugar is None:
        added_sugar = 0
    sodium = _num(r"sodium\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m?g?", text)
    caffeine = _num(r"caffeine\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m?g?", text)

    has_numbers = bool(re.search(r"\d", text))
    return DrinkLabelData(
        product_name=name or "Unknown drink",
        serving_size=serving_size,
        servings_per_container=servings,
        calories=calories,
        carbohydrates_g=carbs,
        total_sugar_g=total_sugar,
        added_sugar_g=added_sugar,
        drink_volume_ml=volume,
        sodium_mg=sodium,
        caffeine_mg=caffeine,
        confidence=0.55 if has_numbers else 0.35,
        confirmation_status=ConfirmationStatus.pending,
        analysis_mode="label",
        raw_text=text,
    )


def _drink_from_dict(data: dict[str, Any], raw_text: str) -> DrinkLabelData:
    def f(key: str, default: float = 0.0) -> float:
        val = data.get(key)
        if val is None or val == "":
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    def opt_f(key: str) -> float | None:
        val = data.get(key)
        if val is None or val == "":
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    return DrinkLabelData(
        product_name=str(data.get("product_name") or "Unknown drink")[:120],
        serving_size=str(data.get("serving_size") or "1 serving")[:80],
        servings_per_container=opt_f("servings_per_container"),
        calories=f("calories"),
        carbohydrates_g=f("carbohydrates_g"),
        total_sugar_g=f("total_sugar_g"),
        added_sugar_g=f("added_sugar_g"),
        drink_volume_ml=opt_f("drink_volume_ml"),
        sodium_mg=opt_f("sodium_mg"),
        caffeine_mg=opt_f("caffeine_mg"),
        confidence=float(data.get("confidence") or 0.75),
        confirmation_status=ConfirmationStatus.pending,
        analysis_mode="label",
        raw_text=raw_text,
    )


def _accept_label_result(drink: DrinkLabelData, *, is_label: bool | None) -> DrinkLabelData | None:
    """Return drink when OCR/LLM found a real nutrition label; else None."""
    if is_label is False:
        return None
    has_nutrients = drink_has_usable_nutrients(
        calories=drink.calories,
        carbohydrates_g=drink.carbohydrates_g,
        total_sugar_g=drink.total_sugar_g,
        sodium_mg=drink.sodium_mg,
        caffeine_mg=drink.caffeine_mg,
        drink_volume_ml=drink.drink_volume_ml,
        confidence=drink.confidence,
    )
    has_hints = looks_like_nutrition_label(drink.raw_text)
    if has_nutrients:
        return drink
    if is_label is True and has_hints:
        return drink
    if has_hints and drink.confidence >= 0.55:
        return drink
    return None


async def analyze_drink_label(path) -> DrinkLabelData | None:
    """
    OCR drink label image → DrinkLabelData, or None if no nutrition label found.

    Callers should fall back to vision (Kimi) when this returns None.
    """
    raw_text = await ocr.extract_text_from_image(path, allow_stub=False)
    if not raw_text.strip():
        logger.info("Drink OCR empty — no label to parse")
        return None

    if azure_client.enabled:
        data = await azure_client.chat_json(DRINK_EXTRACT_SYSTEM, raw_text[:8000])
        if data:
            is_label = data.get("is_nutrition_label")
            if isinstance(is_label, str):
                is_label = is_label.strip().lower() in {"true", "1", "yes"}
            drink = _drink_from_dict(data, raw_text)
            if not drink.raw_text:
                drink.raw_text = raw_text
            accepted = _accept_label_result(
                drink,
                is_label=bool(is_label) if is_label is not None else None,
            )
            if accepted is None:
                logger.info("OCR text present but not a drink nutrition label")
            return accepted
        logger.warning("Azure drink extract unavailable; using stub parser")

    if not looks_like_nutrition_label(raw_text):
        return None
    drink = stub_drink_from_ocr(raw_text)
    return _accept_label_result(drink, is_label=None)
