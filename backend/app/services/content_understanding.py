from __future__ import annotations

import base64
import logging
import time
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class ContentUnderstandingClient:
    """Account A — Azure Content Understanding for OCR / document text."""

    def __init__(self) -> None:
        self.endpoint = settings.content_base_url
        self.api_key = settings.azure_content_api_key
        self.analyzer = settings.azure_content_analyzer
        self.api_version = settings.azure_content_api_version

    @property
    def enabled(self) -> bool:
        return settings.content_understanding_enabled

    def _headers(self) -> dict[str, str]:
        return {
            "Ocp-Apim-Subscription-Key": self.api_key,
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def analyze_file(
        self,
        path: Path | str,
        *,
        analyzer: str | None = None,
        poll_seconds: float = 1.2,
        max_wait_seconds: float = 90.0,
    ) -> str | None:
        if not self.enabled:
            return None

        path = Path(path)
        analyzer = analyzer or self.analyzer
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        url = (
            f"{self.endpoint}/contentunderstanding/analyzers/"
            f"{analyzer}:analyze?api-version={self.api_version}"
        )

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    url,
                    headers=self._headers(),
                    json={"inputs": [{"data": b64}]},
                )
                if resp.status_code >= 400:
                    logger.error(
                        "Content Understanding start %s: %s",
                        resp.status_code,
                        resp.text[:500],
                    )
                    return None

                operation = resp.headers.get("Operation-Location")
                if not operation:
                    # Some responses may include inline result
                    data = resp.json()
                    return self._extract_text(data)

                deadline = time.monotonic() + max_wait_seconds
                while time.monotonic() < deadline:
                    poll = await client.get(operation, headers=self._headers())
                    if poll.status_code >= 400:
                        logger.error(
                            "Content Understanding poll %s: %s",
                            poll.status_code,
                            poll.text[:500],
                        )
                        return None
                    data = poll.json()
                    status = (data.get("status") or "").lower()
                    if status == "succeeded":
                        return self._extract_text(data)
                    if status == "failed":
                        logger.error(
                            "Content Understanding failed: %s",
                            data.get("error"),
                        )
                        return None
                    await _async_sleep(poll_seconds)

                logger.error("Content Understanding timed out")
                return None
        except Exception:
            logger.exception("Content Understanding analyze failed")
            return None

    def _extract_text(self, data: dict) -> str | None:
        result = data.get("result") or data
        contents = result.get("contents") or []
        parts: list[str] = []
        for item in contents:
            md = item.get("markdown") or item.get("text") or ""
            if md and str(md).strip():
                parts.append(str(md).strip())
        text = "\n\n".join(parts).strip()
        return text or None


async def _async_sleep(seconds: float) -> None:
    import asyncio

    await asyncio.sleep(seconds)


content_client = ContentUnderstandingClient()
