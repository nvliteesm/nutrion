from __future__ import annotations

import base64
import logging
from pathlib import Path

from PIL import Image

from app.services.azure_client import azure_client
from app.services.content_understanding import content_client

logger = logging.getLogger(__name__)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


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


def stub_ocr_text(path: Path) -> str:
    try:
        with Image.open(path) as img:
            w, h = img.size
            mode = img.mode
    except Exception:
        w, h, mode = 0, 0, "unknown"
    name = path.stem.replace("_", " ").replace("-", " ")
    parts = name.split(" ", 1)
    if len(parts) == 2 and len(parts[0]) >= 16:
        name = parts[1]
    return (
        f"Nutrition Facts\n"
        f"Product: {name or 'Unknown food'}\n"
        f"Serving Size 1 serving\n"
        f"Calories 250\n"
        f"Total Fat 10g\n"
        f"Sodium 200mg\n"
        f"Total Carbohydrate 30g\n"
        f"Dietary Fiber 3g\n"
        f"Total Sugars 8g\n"
        f"Protein 12g\n"
        f"(stub OCR from {path.name}, {w}x{h} {mode})"
    )


def is_stub_ocr_text(text: str) -> bool:
    return "(stub OCR" in (text or "")


async def extract_text_from_image(
    path: Path | str,
    *,
    allow_stub: bool = True,
) -> str:
    path = Path(path)
    if path.suffix.lower() not in IMAGE_EXTS:
        raise ValueError(f"Unsupported image type: {path.suffix}")

    # 1) Account A — Azure Content Understanding (preferred for labels)
    if content_client.enabled:
        text = await content_client.analyze_file(path)
        if text:
            return text
        logger.warning("Content Understanding empty; trying other OCR paths")

    # 2) Account B — Azure vision chat (only if deployment exists)
    if azure_client.enabled:
        raw = path.read_bytes()
        b64 = base64.b64encode(raw).decode("ascii")
        text = await azure_client.vision_ocr(b64, _mime_for(path))
        if text and text.strip() and "stub OCR" not in text:
            return text.strip()
        logger.warning("Azure vision OCR unavailable; falling back to stub")

    if allow_stub:
        return stub_ocr_text(path)
    return ""
