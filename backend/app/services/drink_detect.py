"""Drink photo (no label) → Vision LLM → classify drink vs food → estimate."""

from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any

from app.models.schemas import ConfirmationStatus, DrinkLabelData
from app.services.input_validation import DRINK_FOOD_REJECT, DRINK_PHOTO_REJECT
from app.services.kimi_client import kimi_client

logger = logging.getLogger(__name__)

DRINK_DETECT_SYSTEM = """You look at a photo taken for a *drink* scan.

Classify the main subject:
- "drink" — beverage / liquid in a cup, can, bottle, glass, carton, etc.
- "food" — solid meal / plated food / snacks (not primarily a beverage)
- "other" — people, scenery, documents, random objects, screenshots, etc.

Rules:
- If content_type is "food" or "other", set is_drink=false and leave nutrients at 0.
- Do not invent a drink for food photos.
- If content_type is "drink", estimate nutrition for the visible serving.

Return JSON:
{
  "content_type": "drink" | "food" | "other",
  "is_drink": true|false,
  "product_name": string,
  "serving_size": "human readable e.g. 1 cup / 355 ml can",
  "servings_per_container": number|null,
  "calories": number,
  "carbohydrates_g": number,
  "total_sugar_g": number,
  "added_sugar_g": number,
  "drink_volume_ml": number|null,
  "sodium_mg": number|null,
  "caffeine_mg": number|null,
  "confidence": 0-1,
  "description": "short scene description"
}
Estimate reasonably if exact values are unknown. Use 0 when unknown."""


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


def _drink_from_dict(data: dict[str, Any]) -> DrinkLabelData:
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

    desc = str(data.get("description") or "").strip()
    name = str(data.get("product_name") or "Unknown drink")[:120]
    serving = str(data.get("serving_size") or "1 serving")[:80]
    raw_parts = [desc] if desc else []
    raw_parts.append(
        f"{name} ({serving}): {f('calories')} kcal, "
        f"C {f('carbohydrates_g')}g sugar {f('total_sugar_g')}g"
    )
    return DrinkLabelData(
        product_name=name or "Unknown drink",
        serving_size=serving,
        servings_per_container=opt_f("servings_per_container"),
        calories=f("calories"),
        carbohydrates_g=f("carbohydrates_g"),
        total_sugar_g=f("total_sugar_g"),
        added_sugar_g=f("added_sugar_g"),
        drink_volume_ml=opt_f("drink_volume_ml"),
        sodium_mg=opt_f("sodium_mg"),
        caffeine_mg=opt_f("caffeine_mg"),
        confidence=float(data.get("confidence") or 0.55),
        confirmation_status=ConfirmationStatus.pending,
        analysis_mode="photo",
        raw_text="\n".join(raw_parts),
    )


def _normalize_content_type(data: dict[str, Any]) -> str:
    raw = str(data.get("content_type") or "").strip().lower()
    if raw in {"drink", "food", "other"}:
        return raw
    is_drink = data.get("is_drink")
    if isinstance(is_drink, str):
        is_drink = is_drink.strip().lower() in {"true", "1", "yes"}
    if is_drink is True:
        return "drink"
    if is_drink is False:
        # Prefer food reject when description hints at a meal
        desc = str(data.get("description") or "").lower()
        name = str(data.get("product_name") or "").lower()
        blob = f"{desc} {name}"
        food_hints = (
            "food", "meal", "plate", "rice", "chicken", "noodle", "burger",
            "salad", "pizza", "sandwich", "breakfast", "lunch", "dinner",
        )
        if any(h in blob for h in food_hints):
            return "food"
        return "other"
    return "other"


async def analyze_drink_photo(path: Path | str) -> DrinkLabelData:
    """
    Vision fallback when no nutrition label was found.

    - drink → estimate nutrients
    - food → reject (tell user to use food scan)
    - other → reject
    """
    path = Path(path)

    if not kimi_client.enabled:
        raise ValueError(
            "No nutrition label found, and drink photo AI is unavailable. "
            "Please try again with a clearer drink label photo."
        )

    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    data = await kimi_client.vision_json(
        system=DRINK_DETECT_SYSTEM,
        user_text=(
            "No nutrition label was readable. Classify drink vs food vs other. "
            "If it is a drink, estimate portion + nutrients. "
            "If it is food, set content_type=food and is_drink=false."
        ),
        image_b64=b64,
        mime=_mime_for(path),
    )
    if data is None:
        raise ValueError(DRINK_PHOTO_REJECT)

    content_type = _normalize_content_type(data)
    if content_type == "food":
        raise ValueError(DRINK_FOOD_REJECT)
    if content_type != "drink":
        raise ValueError(DRINK_PHOTO_REJECT)

    drink = _drink_from_dict(data)
    if (
        drink.calories <= 0
        and drink.carbohydrates_g <= 0
        and drink.total_sugar_g <= 0
        and not drink.drink_volume_ml
        and drink.confidence < 0.45
    ):
        raise ValueError(DRINK_PHOTO_REJECT)
    return drink
