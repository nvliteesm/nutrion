"""Kimi (Moonshot) client — food vision + text JSON helpers."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def _parse_json_content(content: str) -> dict[str, Any]:
    text = content.strip()
    text = _FENCE_RE.sub("", text).strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
    return json.loads(text)


def _message_content(data: dict[str, Any]) -> str:
    content = data["choices"][0]["message"]["content"]
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


class KimiVisionClient:
    def __init__(self) -> None:
        self.base_url = settings.kimi_base_url.rstrip("/")
        self.api_key = settings.kimi_api_key
        self.model = settings.kimi_vision_model

    @property
    def enabled(self) -> bool:
        return settings.kimi_vision_enabled

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat_json(
        self,
        *,
        system: str,
        user_text: str,
        temperature: float | None = None,
    ) -> dict[str, Any] | None:
        """Text-only JSON completion (sugar barrier, explanations, etc.)."""
        if not self.enabled:
            return None
        payload: dict[str, Any] = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_text},
            ],
        }
        if temperature is not None:
            payload["temperature"] = temperature
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.error(
                        "Kimi chat_json %s: %s",
                        resp.status_code,
                        resp.text[:500],
                    )
                    resp.raise_for_status()
                return _parse_json_content(_message_content(resp.json()))
        except Exception:
            logger.exception("Kimi chat_json failed")
            return None

    async def vision_json(
        self,
        *,
        system: str,
        user_text: str,
        image_b64: str,
        mime: str = "image/jpeg",
        temperature: float | None = None,
    ) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        # kimi-k3 and similar models only accept temperature=1 (or omit).
        payload: dict[str, Any] = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{image_b64}"},
                        },
                        {"type": "text", "text": user_text},
                    ],
                },
            ],
        }
        if temperature is not None:
            payload["temperature"] = temperature
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.error(
                        "Kimi vision_json %s: %s",
                        resp.status_code,
                        resp.text[:500],
                    )
                    resp.raise_for_status()
                return _parse_json_content(_message_content(resp.json()))
        except Exception:
            logger.exception("Kimi vision_json failed")
            return None


kimi_client = KimiVisionClient()
