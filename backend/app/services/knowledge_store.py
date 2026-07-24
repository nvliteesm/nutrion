"""Approved health knowledge vector store (educational RAG only).

Uses a dedicated Chroma collection — separate from meal_memory.
Personal sugar/calorie/medical totals must come from SQL analytics, not this store.
"""

from __future__ import annotations

from typing import Any, Optional

import chromadb
from chromadb.api.models.Collection import Collection
from chromadb.errors import InvalidDimensionException

from app.config import settings
from app.knowledge.documents import all_chunks
from app.models.schemas import KnowledgeHit
from app.services.foundry import foundry

COLLECTION_NAME = "approved_health_knowledge"


class KnowledgeStore:
    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(path=settings.chroma_path)
        self._collection: Collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine", "purpose": "approved_education"},
        )
        self._seeded = False

    @property
    def collection(self) -> Collection:
        return self._collection

    def reset_collection(self) -> None:
        try:
            self._client.delete_collection(COLLECTION_NAME)
        except Exception:  # noqa: BLE001
            pass
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine", "purpose": "approved_education"},
        )
        self._seeded = False

    def _ensure_dims(self, embedding: list[float]) -> None:
        if self._collection.count() == 0:
            return
        try:
            peek = self._collection.peek(limit=1)
            stored = (peek.get("embeddings") or [None])[0]
            if stored is not None and len(stored) != len(embedding):
                self.reset_collection()
        except Exception:  # noqa: BLE001
            pass

    async def ensure_indexed(self) -> int:
        """Chunk, embed, and upsert approved documents if collection is empty or incomplete."""
        chunks = all_chunks()
        expected_ids = {c["id"] for c in chunks}
        existing = set(self._collection.get(include=[]).get("ids") or [])
        if expected_ids.issubset(existing) and self._collection.count() > 0:
            self._seeded = True
            return self._collection.count()

        texts = [c["text"] for c in chunks]
        embeddings = await foundry.embed(texts)
        if embeddings:
            self._ensure_dims(embeddings[0])

        ids = [c["id"] for c in chunks]
        metadatas = [
            {"title": c["title"], "topic": c["topic"], "approved": True}
            for c in chunks
        ]
        try:
            self._collection.upsert(
                ids=ids,
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )
        except InvalidDimensionException:
            self.reset_collection()
            self._collection.upsert(
                ids=ids,
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )
        self._seeded = True
        return self._collection.count()

    async def search(
        self,
        query: str,
        *,
        top_k: Optional[int] = None,
    ) -> list[KnowledgeHit]:
        await self.ensure_indexed()
        k = top_k or settings.rag_top_k
        embedding = (await foundry.embed([query]))[0]
        self._ensure_dims(embedding)
        try:
            result = self._collection.query(
                query_embeddings=[embedding],
                n_results=max(k, 1),
                include=["documents", "metadatas", "distances"],
            )
        except InvalidDimensionException:
            self.reset_collection()
            await self.ensure_indexed()
            return []

        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        ids = (result.get("ids") or [[]])[0]

        hits: list[KnowledgeHit] = []
        for i, doc in enumerate(docs):
            meta = metas[i] if i < len(metas) else {}
            hits.append(
                KnowledgeHit(
                    id=ids[i] if i < len(ids) else f"kb-{i}",
                    title=str(meta.get("title") or "Approved knowledge"),
                    topic=str(meta.get("topic") or "general"),
                    chunk=(doc or "").strip(),
                    distance=distances[i] if i < len(distances) else None,
                )
            )
        return hits

    def health(self) -> dict[str, Any]:
        try:
            return {
                "ok": True,
                "collection": COLLECTION_NAME,
                "count": self._collection.count(),
                "path": settings.chroma_path,
            }
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}


knowledge_store = KnowledgeStore()


async def search_approved_health_knowledge(
    query: str,
    *,
    top_k: Optional[int] = None,
) -> list[KnowledgeHit]:
    """Controlled tool entrypoint for educational RAG only."""
    return await knowledge_store.search(query, top_k=top_k)
