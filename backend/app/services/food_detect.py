from __future__ import annotations

import base64
import logging
from pathlib import Path

from app.models.schemas import ExtractedMeal, NutrientValues
from app.services.azure_client import azure_client
from app.services.extractor import stub_extract

logger = logging.getLogger(__name__)

FOOD_DETECT_SYSTEM = """You identify food in a photo and estimate nutrition for one serving.
Return JSON with keys:
name (string), serving (string), confidence (0-1),
calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg (numbers),
description (short string of what you see).
Estimate reasonably if exact values are unknown. Use 0 only when truly unknown."""


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


def stub_food_from_image(path: Path) -> ExtractedMeal:
    name = path.stem.replace("_", " ").replace("-", " ")
    parts = name.split(" ", 1)
    if len(parts) == 2 and len(parts[0]) >= 16:
        name = parts[1]
    name = name.strip() or "Unknown food"
    # Heuristic placeholder estimates until Azure vision deployment works
    raw = (
        f"Food photo detected (stub AI): {name}\n"
        f"Estimated nutrients for 1 serving.\n"
        f"Calories 350 Protein 20g Carbs 35g Fat 12g Fiber 4g Sugars 8g Sodium 400mg"
    )
    meal = stub_extract(raw, source="food_ai_stub")
    meal.name = name.title()
    meal.confidence = 0.4
    meal.source = "food_ai_stub"
    meal.raw_text = raw
    return meal


async def detect_food(path: Path | str) -> ExtractedMeal:
    """AI food detection from image (Account B vision). Falls back to stub."""
    path = Path(path)

    if azure_client.enabled:
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        data = await azure_client.vision_json(
            system=FOOD_DETECT_SYSTEM,
            user_text="Identify the food and estimate nutrients for one serving.",
            image_b64=b64,
            mime=_mime_for(path),
        )
        if data:
            nutrients = NutrientValues(
                calories=float(data.get("calories") or 0),
                protein_g=float(data.get("protein_g") or 0),
                carbs_g=float(data.get("carbs_g") or 0),
                fat_g=float(data.get("fat_g") or 0),
                fiber_g=float(data.get("fiber_g") or 0),
                sugar_g=float(data.get("sugar_g") or 0),
                sodium_mg=float(data.get("sodium_mg") or 0),
            )
            desc = str(data.get("description") or "").strip()
            name = str(data.get("name") or "Detected food")[:120]
            raw = desc or f"AI food detection: {name}"
            return ExtractedMeal(
                name=name,
                serving=str(data.get("serving") or "1 serving"),
                nutrients=nutrients,
                raw_text=raw,
                confidence=float(data.get("confidence") or 0.75),
                source="food_ai",
            )
        logger.warning("Azure food vision unavailable; using stub detection")

    return stub_food_from_image(path)
