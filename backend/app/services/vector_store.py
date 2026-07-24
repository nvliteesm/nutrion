from __future__ import annotations

import json
import logging
import math
import hashlib
from pathlib import Path
from typing import Any

from app.config import settings
from app.models.schemas import ExtractedMeal
from app.services.azure_client import azure_client

logger = logging.getLogger(__name__)

EMBED_DIM = 384
_STORE_PATH = Path(settings.chroma_path) / "memory.jsonl"


def _hash_embed(text: str, dim: int = EMBED_DIM) -> list[float]:
    vec = [0.0] * dim
    tokens = text.lower().split() or ["empty"]
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        for i in range(0, min(len(digest), 32), 4):
            idx = int.from_bytes(digest[i : i + 2], "little") % dim
            sign = 1.0 if digest[i + 2] % 2 == 0 else -1.0
            vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _cosine(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    dot = sum(a[i] * b[i] for i in range(n))
    na = math.sqrt(sum(a[i] * a[i] for i in range(n))) or 1.0
    nb = math.sqrt(sum(b[i] * b[i] for i in range(n))) or 1.0
    return dot / (na * nb)


def _ensure_store() -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _STORE_PATH.exists():
        _STORE_PATH.write_text("", encoding="utf-8")


def _load_rows() -> list[dict[str, Any]]:
    _ensure_store()
    rows: list[dict[str, Any]] = []
    for line in _STORE_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _rewrite(rows: list[dict[str, Any]]) -> None:
    _ensure_store()
    with _STORE_PATH.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    live = await azure_client.embed(texts)
    if live and len(live) == len(texts):
        return live
    return [_hash_embed(t) for t in texts]


def get_collection() -> dict[str, Any]:
    """Compatibility shim for app startup."""
    _ensure_store()
    return {"path": str(_STORE_PATH), "count": len(_load_rows())}


async def upsert_meal(
    meal: ExtractedMeal,
    *,
    user_id: str,
    intake_id: int,
    source: str,
    kind: str = "food",
) -> None:
    n = meal.nutrients
    document = (
        f"[{kind}] {meal.name}. Serving {meal.serving}. "
        f"Calories {n.calories}, protein {n.protein_g}g, carbs {n.carbs_g}g, "
        f"fat {n.fat_g}g, fiber {n.fiber_g}g, sugar {n.sugar_g}g, sodium {n.sodium_mg}mg. "
        f"Source {source}. Raw: {meal.raw_text[:500]}"
    )
    embedding = (await _embed_texts([document]))[0]
    doc_id = f"intake-{intake_id}"
    row = {
        "id": doc_id,
        "document": document,
        "embedding": embedding,
        "metadata": {
            "user_id": user_id,
            "intake_id": intake_id,
            "source": source,
            "kind": kind,
            "name": meal.name,
        },
    }
    rows = [r for r in _load_rows() if r.get("id") != doc_id]
    rows.append(row)
    _rewrite(rows)


async def search(
    query: str,
    *,
    user_id: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    rows = _load_rows()
    if user_id:
        rows = [r for r in rows if (r.get("metadata") or {}).get("user_id") == user_id]
    if not rows:
        return []

    query_vec = (await _embed_texts([query]))[0]
    scored: list[tuple[float, dict[str, Any]]] = []
    for row in rows:
        emb = row.get("embedding") or []
        score = _cosine(query_vec, emb)
        scored.append((score, row))
    scored.sort(key=lambda x: x[0], reverse=True)

    out: list[dict[str, Any]] = []
    for score, row in scored[:limit]:
        out.append(
            {
                "document": row.get("document"),
                "metadata": row.get("metadata") or {},
                "distance": 1.0 - score,
            }
        )
    return out


def health() -> dict[str, Any]:
    try:
        rows = _load_rows()
        return {"ok": True, "count": len(rows), "path": str(_STORE_PATH)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
