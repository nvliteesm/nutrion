"""Microsoft Foundry (Azure OpenAI-compatible) chat + embeddings client."""

from __future__ import annotations

import hashlib
import math
import re
from typing import Any

import httpx

from app.config import settings


class FoundryError(RuntimeError):
    pass


def _stub_embedding(text: str, dims: int = 384) -> list[float]:
    """Deterministic pseudo-embedding for offline / stub mode."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    seed = digest
    while len(values) < dims:
        for b in seed:
            values.append((b / 255.0) * 2.0 - 1.0)
            if len(values) >= dims:
                break
        seed = hashlib.sha256(seed).digest()
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


class FoundryClient:
    def __init__(self) -> None:
        self.base = settings.foundry_openai_base
        self.api_key = settings.foundry_api_key
        self.chat_model = settings.chat_deployment
        self.embedding_model = settings.embedding_deployment
        self.use_live = settings.use_live_ai and settings.foundry_configured
        self._embedding_mode: str | None = None  # "live" | "stub"

    def _headers(self) -> dict[str, str]:
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def embed(self, texts: list[str]) -> list[list[float]]:
        cleaned = [t.strip() or " " for t in texts]
        if not self.use_live:
            self._embedding_mode = "stub"
            return [_stub_embedding(t) for t in cleaned]

        url = f"{self.base}/embeddings"
        payload = {"model": self.embedding_model, "input": cleaned}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers(), json=payload)
            if resp.status_code >= 400:
                if settings.allow_stub_embeddings:
                    self._embedding_mode = "stub"
                    return [_stub_embedding(t) for t in cleaned]
                raise FoundryError(f"Embeddings failed ({resp.status_code}): {resp.text}")
            data = resp.json()
        items = sorted(data.get("data", []), key=lambda x: x.get("index", 0))
        self._embedding_mode = "live"
        return [item["embedding"] for item in items]

    async def chat(
        self,
        *,
        system: str,
        user: str,
        temperature: float | None = None,
    ) -> str:
        if not self.use_live:
            return _stub_chat_answer(user)

        url = f"{self.base}/chat/completions"
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        # gpt-5-* deployments often reject custom temperature; only send when explicit.
        if temperature is not None:
            payload["temperature"] = temperature

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=self._headers(), json=payload)
            if resp.status_code >= 400:
                # Fallback to Responses API if chat/completions is unavailable
                if resp.status_code in (404, 405):
                    return await self._chat_via_responses(system=system, user=user, temperature=temperature)
                raise FoundryError(f"Chat failed ({resp.status_code}): {resp.text}")
            data = resp.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError, AttributeError) as exc:
            raise FoundryError(f"Unexpected chat response: {data}") from exc

    async def _chat_via_responses(
        self,
        *,
        system: str,
        user: str,
        temperature: float | None,
    ) -> str:
        url = f"{self.base}/responses"
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "input": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if temperature is not None:
            payload["temperature"] = temperature
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=self._headers(), json=payload)
            if resp.status_code >= 400:
                raise FoundryError(f"Responses API failed ({resp.status_code}): {resp.text}")
            data = resp.json()

        if isinstance(data.get("output_text"), str) and data["output_text"].strip():
            return data["output_text"].strip()

        # Walk Responses API output items
        chunks: list[str] = []
        for item in data.get("output", []) or []:
            for part in item.get("content", []) or []:
                text = part.get("text")
                if text:
                    chunks.append(text)
        if chunks:
            return "\n".join(chunks).strip()
        raise FoundryError(f"Unexpected responses payload: {data}")

    async def ping(self) -> dict[str, Any]:
        status: dict[str, Any] = {
            "configured": settings.foundry_configured,
            "use_live_ai": settings.use_live_ai,
            "live": self.use_live,
            "base": self.base or None,
            "chat_deployment": self.chat_model,
            "embedding_deployment": self.embedding_model,
        }
        if not self.use_live:
            status["mode"] = "stub"
            status["ok"] = True
            return status

        try:
            # Probe chat separately from embeddings (deployments may differ).
            answer = await self.chat(system="Reply with OK only.", user="ping")
            vectors = await self.embed(["nutrion health check"])
            status["mode"] = "live"
            status["ok"] = bool(answer) and bool(vectors and vectors[0])
            status["chat_ok"] = bool(answer)
            status["embedding_mode"] = self._embedding_mode
            status["embedding_dims"] = len(vectors[0]) if vectors else 0
            if self._embedding_mode == "stub":
                status["warning"] = (
                    f"Embedding deployment '{self.embedding_model}' is not available; "
                    "using local stub vectors. Deploy an embedding model in Foundry for real RAG."
                )
        except Exception as exc:  # noqa: BLE001 — surface in health payload
            status["mode"] = "live"
            status["ok"] = False
            status["error"] = str(exc)
        return status


def _stub_chat_answer(user: str) -> str:
    compact = re.sub(r"\s+", " ", user).strip()
    return (
        "Stub AI answer (USE_LIVE_AI=false or Foundry not configured). "
        f"I received your question: “{compact[:240]}”. "
        "Once Foundry is live, answers will use your meal memory via RAG."
    )


foundry = FoundryClient()
