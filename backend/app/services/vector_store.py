"""Chroma vector store for semantic meal memory."""

from __future__ import annotations

from typing import Any, Optional

import chromadb
from chromadb.api.models.Collection import Collection
from chromadb.errors import InvalidDimensionException

from app.config import settings
from app.models.schemas import ExtractedMeal
from app.services.foundry import foundry

COLLECTION_NAME = "meal_memory"


class VectorStore:
    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(path=settings.chroma_path)
        self._collection: Collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    @property
    def collection(self) -> Collection:
        return self._collection

    def reset_collection(self) -> None:
        """Drop and recreate collection (needed when embedding dims change)."""
        try:
            self._client.delete_collection(COLLECTION_NAME)
        except Exception:  # noqa: BLE001 — collection may not exist
            pass
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def _ensure_dims(self, embedding: list[float]) -> None:
        """If collection has conflicting dimensionality, recreate it empty."""
        if self._collection.count() == 0:
            return
        try:
            peek = self._collection.peek(limit=1)
            stored = (peek.get("embeddings") or [None])[0]
            if stored is not None and len(stored) != len(embedding):
                self.reset_collection()
        except Exception:  # noqa: BLE001
            pass

    async def upsert_meal(
        self,
        *,
        intake_id: int,
        user_id: str,
        document: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        doc_id = f"intake-{intake_id}"
        embedding = (await foundry.embed([document]))[0]
        self._ensure_dims(embedding)
        meta = {"user_id": user_id, "intake_id": intake_id, **(metadata or {})}
        # Chroma metadata values must be str|int|float|bool
        clean_meta = {k: v for k, v in meta.items() if isinstance(v, (str, int, float, bool))}
        try:
            self._collection.upsert(
                ids=[doc_id],
                documents=[document],
                embeddings=[embedding],
                metadatas=[clean_meta],
            )
        except InvalidDimensionException:
            self.reset_collection()
            self._collection.upsert(
                ids=[doc_id],
                documents=[document],
                embeddings=[embedding],
                metadatas=[clean_meta],
            )
        return doc_id

    async def search(
        self,
        *,
        query: str,
        user_id: str,
        top_k: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        k = top_k or settings.rag_top_k
        embedding = (await foundry.embed([query]))[0]
        self._ensure_dims(embedding)
        try:
            result = self._collection.query(
                query_embeddings=[embedding],
                n_results=max(k, 1),
                where={"user_id": user_id},
                include=["documents", "metadatas", "distances"],
            )
        except InvalidDimensionException:
            # Dims changed (e.g. stub -> Foundry). Clear incompatible vectors.
            self.reset_collection()
            return []

        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        ids = (result.get("ids") or [[]])[0]

        hits: list[dict[str, Any]] = []
        for i, doc in enumerate(docs):
            hits.append(
                {
                    "id": ids[i] if i < len(ids) else None,
                    "document": doc,
                    "metadata": metas[i] if i < len(metas) else {},
                    "distance": distances[i] if i < len(distances) else None,
                }
            )
        return hits

    def count(self) -> int:
        return self._collection.count()


vector_store = VectorStore()


def get_collection() -> dict[str, Any]:
    """Compatibility shim for app startup."""
    return {"path": settings.chroma_path, "count": vector_store.count()}


async def upsert_meal(
    meal: ExtractedMeal,
    *,
    user_id: str,
    intake_id: int,
    source: str,
    kind: str = "food",
) -> str:
    """Module-level API used by confirm flow (delegates to Chroma VectorStore)."""
    n = meal.nutrients
    document = (
        f"[{kind}] {meal.name}. Serving {meal.serving}. "
        f"Calories {n.calories}, protein {n.protein_g}g, carbs {n.carbs_g}g, "
        f"fat {n.fat_g}g, fiber {n.fiber_g}g, sugar {n.sugar_g}g, sodium {n.sodium_mg}mg. "
        f"Source {source}. Raw: {meal.raw_text[:500]}"
    )
    return await vector_store.upsert_meal(
        intake_id=intake_id,
        user_id=user_id,
        document=document,
        metadata={
            "source": source,
            "kind": kind,
            "name": meal.name,
        },
    )


async def search(
    query: str,
    *,
    user_id: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Module-level API used by vector search routes."""
    return await vector_store.search(
        query=query,
        user_id=user_id or "default",
        top_k=limit,
    )


def health() -> dict[str, Any]:
    try:
        return {"ok": True, "count": vector_store.count(), "path": settings.chroma_path}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
