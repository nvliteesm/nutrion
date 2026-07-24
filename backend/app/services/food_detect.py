"""Food image → Vision LLM → detected items + estimated portions."""

from __future__ import annotations

import base64
from pathlib import Path

from app.models.schemas import (
    ConfirmationStatus,
    FoodAnalysisData,
    FoodItemEstimate,
)
from app.services.input_validation import FOOD_REJECT
from app.services.kimi_client import kimi_client

FOOD_DETECT_SYSTEM = """You identify food in a photo and estimate nutrition via vision.

If the image does NOT show edible food or a meal, set is_food=false and return
an empty items array. Do not invent food to fill the schema.

Set is_food=false for:
- drinks / beverages alone (cans, bottles, cups of liquid without a meal)
- people, scenery, documents, screenshots, random objects
- empty plates / packaging with no food visible

Return JSON:
{
  "is_food": true|false,
  "description": "short scene description",
  "confidence": 0-1,
  "items": [
    {
      "name": string,
      "portion": "human readable portion e.g. 1 cup / 150g",
      "portion_grams": number|null,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "sugar_g": number,
      "sodium_mg": number,
      "calories_low": number|null,
      "calories_high": number|null,
      "confidence": 0-1
    }
  ]
}
Detect multiple items when present. Estimate reasonably if exact values are unknown."""


def _mime_for(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")


def _totals(items: list[FoodItemEstimate]) -> dict[str, float]:
    return {
        "total_calories": sum(i.calories for i in items),
        "total_protein_g": sum(i.protein_g for i in items),
        "total_carbs_g": sum(i.carbs_g for i in items),
        "total_fat_g": sum(i.fat_g for i in items),
        "total_fiber_g": sum(i.fiber_g for i in items),
        "total_sugar_g": sum(i.sugar_g for i in items),
        "total_sodium_mg": sum(i.sodium_mg for i in items),
    }


def _item_from_dict(data: dict) -> FoodItemEstimate:
    def f(key: str, default: float = 0.0) -> float:
        try:
            return float(data.get(key) if data.get(key) is not None else default)
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

    return FoodItemEstimate(
        name=str(data.get("name") or "Food item")[:120],
        portion=str(data.get("portion") or "1 serving")[:80],
        portion_grams=opt_f("portion_grams"),
        calories=f("calories"),
        protein_g=f("protein_g"),
        carbs_g=f("carbs_g"),
        fat_g=f("fat_g"),
        fiber_g=f("fiber_g"),
        sugar_g=f("sugar_g"),
        sodium_mg=f("sodium_mg"),
        calories_low=opt_f("calories_low"),
        calories_high=opt_f("calories_high"),
        confidence=f("confidence", 0.5),
    )


async def analyze_food_image(path: Path | str) -> FoodAnalysisData:
    """Vision LLM food estimate (pending confirmation) via Kimi Vision.

    Rejects when the image is not food or when Kimi is unavailable.
    """
    path = Path(path)

    if not kimi_client.enabled:
        raise ValueError(
            "Food photo AI is unavailable. "
            "Please try again when Kimi vision is configured."
        )

    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    data = await kimi_client.vision_json(
        system=FOOD_DETECT_SYSTEM,
        user_text=(
            "Identify foods and estimate portions + nutrients. "
            "If this is not a food/meal photo (including drink-only images), "
            "set is_food=false and items=[]."
        ),
        image_b64=b64,
        mime=_mime_for(path),
    )
    if data is None:
        raise ValueError(FOOD_REJECT)

    is_food = data.get("is_food")
    if isinstance(is_food, str):
        is_food = is_food.strip().lower() in {"true", "1", "yes"}
    raw_items = data.get("items") if isinstance(data.get("items"), list) else []
    items = [
        _item_from_dict(item)
        for item in raw_items
        if isinstance(item, dict)
    ]

    if is_food is False or not items:
        raise ValueError(FOOD_REJECT)

    confidences = [i.confidence for i in items]
    avg_conf = sum(confidences) / len(confidences)
    overall = float(data.get("confidence") or avg_conf)
    totals = _totals(items)
    desc = str(data.get("description") or "").strip()
    raw_parts = [desc] if desc else []
    for it in items:
        raw_parts.append(
            f"{it.name} ({it.portion}): {it.calories} kcal, "
            f"P {it.protein_g}g C {it.carbs_g}g F {it.fat_g}g"
        )
    return FoodAnalysisData(
        items=items,
        confidence=overall,
        confirmation_status=ConfirmationStatus.pending,
        description=desc or f"Detected {len(items)} item(s)",
        raw_text="\n".join(raw_parts),
        **totals,
    )
