from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class AzureOpenAIClient:
    def __init__(self) -> None:
        self.base_url = settings.openai_base_url
        self.api_key = settings.openai_api_key
        self.chat_model = settings.chat_model
        self.embedding_model = settings.embedding_model

    @property
    def enabled(self) -> bool:
        return settings.live_ai_enabled

    def _headers(self) -> dict[str, str]:
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def chat_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float | None = None,
    ) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        # gpt-5-mini and similar deployments only allow the default temperature.
        if temperature is not None:
            payload["temperature"] = temperature
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                if (
                    resp.status_code >= 400
                    and "temperature" in (resp.text or "").lower()
                    and "temperature" in payload
                ):
                    payload.pop("temperature", None)
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    )
                if resp.status_code >= 400:
                    logger.error("Azure chat_json %s: %s", resp.status_code, resp.text[:500])
                    resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
        except Exception:
            logger.exception("Azure chat_json failed")
            return None

    async def embed(self, texts: list[str]) -> list[list[float]] | None:
        if not self.enabled or not texts:
            return None
        payload = {
            "model": self.embedding_model,
            "input": texts,
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.base_url}/embeddings",
                    headers=self._headers(),
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.error("Azure embed %s: %s", resp.status_code, resp.text[:500])
                    resp.raise_for_status()
                data = resp.json()
                items = sorted(data["data"], key=lambda x: x["index"])
                return [item["embedding"] for item in items]
        except Exception:
            logger.exception("Azure embed failed")
            return None

    async def vision_ocr(self, image_b64: str, mime: str = "image/jpeg") -> str | None:
        if not self.enabled:
            return None
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Extract all readable text from this nutrition label or food photo. "
                        "Return plain text only, preserving nutrient numbers when present."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the label / food text from this image.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{image_b64}"},
                        },
                    ],
                },
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.error("Azure vision OCR %s: %s", resp.status_code, resp.text[:500])
                    resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception:
            logger.exception("Azure vision OCR failed")
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
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{image_b64}"},
                        },
                    ],
                },
            ],
        }
        # gpt-5-mini and similar deployments only allow the default temperature.
        if temperature is not None:
            payload["temperature"] = temperature
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                if (
                    resp.status_code >= 400
                    and "temperature" in (resp.text or "").lower()
                    and "temperature" in payload
                ):
                    payload.pop("temperature", None)
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    )
                if resp.status_code >= 400:
                    logger.error(
                        "Azure vision_json %s: %s",
                        resp.status_code,
                        resp.text[:500],
                    )
                    resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
        except Exception:
            logger.exception("Azure vision_json failed")
            return None


azure_client = AzureOpenAIClient()
