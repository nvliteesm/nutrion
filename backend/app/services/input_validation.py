"""Reject wrong-type uploads so analyze flows ask the user to try again."""

from __future__ import annotations

import re

DRINK_REJECT = (
    "This doesn't look like a drink. "
    "Please try again with a clear drink label or beverage photo."
)
DRINK_PHOTO_REJECT = (
    "No drink detected in this image. "
    "Please try again with a clear photo of your beverage or its nutrition label."
)
DRINK_FOOD_REJECT = (
    "This looks like food, not a drink. "
    "Please use Food photo instead, or try again with a beverage."
)
FOOD_REJECT = (
    "No food detected in this image. "
    "Please try again with a clear photo of your meal."
)
MEDICAL_REJECT = (
    "No blood sugar or lipid profile metrics found. "
    "Please try again with a clearer lab report "
    "(HbA1c, fasting glucose, cholesterol, LDL, HDL, or triglycerides)."
)
UNREADABLE = (
    "Could not read this file. Please try again with a clearer image or PDF."
)

_LABEL_HINTS = re.compile(
    r"nutrition\s*facts|calories|serving\s*size|total\s+sugars?|"
    r"added\s+sugars?|carbohydrate|sodium|caffeine|daily\s+value|"
    r"servings?\s+per\s+container|ingredients|fl\.?\s*oz|\bml\b|"
    r"milliliters?|energy",
    re.IGNORECASE,
)

_MEDICAL_HINTS = re.compile(
    r"hba1c|hb\s*a1c|a1c|fasting|glucose|cholesterol|ldl|hdl|"
    r"triglyceride|lipid|lab(?:oratory)?|reference\s*range|"
    r"mg/?\s*dL|mmol|patient|specimen|result",
    re.IGNORECASE,
)


def looks_like_nutrition_label(text: str) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 20:
        return False
    return bool(_LABEL_HINTS.search(cleaned))


def looks_like_medical_report(text: str) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 20:
        return False
    return bool(_MEDICAL_HINTS.search(cleaned))


def drink_has_usable_nutrients(
    *,
    calories: float,
    carbohydrates_g: float,
    total_sugar_g: float,
    sodium_mg: float | None,
    caffeine_mg: float | None,
    drink_volume_ml: float | None,
    confidence: float,
) -> bool:
    """True when OCR/LLM found at least one plausible label signal."""
    nutrient_hits = sum(
        1
        for v in (calories, carbohydrates_g, total_sugar_g)
        if v and v > 0
    )
    if sodium_mg and sodium_mg > 0:
        nutrient_hits += 1
    if caffeine_mg and caffeine_mg > 0:
        nutrient_hits += 1
    if drink_volume_ml and drink_volume_ml > 0:
        nutrient_hits += 1
    if nutrient_hits >= 1 and confidence >= 0.45:
        return True
    if nutrient_hits >= 2:
        return True
    return False
