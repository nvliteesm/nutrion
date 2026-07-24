from __future__ import annotations

import logging
from pathlib import Path

from pypdf import PdfReader

from app.services.content_understanding import content_client

logger = logging.getLogger(__name__)

TEXT_EXTS = {".txt", ".md", ".csv"}
PDF_EXTS = {".pdf"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


def _parse_text_or_pdf_local(path: Path) -> str:
    ext = path.suffix.lower()

    if ext in TEXT_EXTS:
        return path.read_text(encoding="utf-8", errors="ignore").strip()

    if ext in PDF_EXTS:
        reader = PdfReader(str(path))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text.strip())
        joined = "\n\n".join(parts).strip()
        if not joined:
            return f"(PDF had no extractable text: {path.name})"
        return joined

    raise ValueError(f"Unsupported document type: {ext}")


async def parse_document(path: Path | str) -> str:
    path = Path(path)
    ext = path.suffix.lower()

    # Plain text — no need for cloud
    if ext in TEXT_EXTS:
        return _parse_text_or_pdf_local(path)

    # PDFs / image docs via Content Understanding when available
    if content_client.enabled and ext in (PDF_EXTS | IMAGE_EXTS):
        text = await content_client.analyze_file(path)
        if text:
            return text
        logger.warning("Content Understanding empty for document; using local parser")

    if ext in IMAGE_EXTS:
        raise ValueError("Image documents require Content Understanding or photo input_type")

    return _parse_text_or_pdf_local(path)
