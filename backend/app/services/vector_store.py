"""Chroma vector store for semantic meal memory."""

from __future__ import annotations

import logging
from typing import Any, Optional

try:
    import chromadb
    from chromadb.api.models.Collection import Collection
    CHROMADB_AVAILABLE = True
except ImportError:
    chromadb = None  # type: ignore
    Collection = None  # type: ignore
    CHROMADB_AVAILABLE = False

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.orm import Intake
from app.models.schemas import ExtractedMeal
from app.services.foundry import foundry

logger = logging.getLogger(__name__)

COLLECTION_NAME = "meal_memory"
# Water sips are too repetitive for semantic meal memory.
INDEXABLE_KINDS = frozenset({"food", "drink", "document"})
_EMBED_BATCH = 32


def _intake_document(row: Intake) -> str:
    return (
        f"[{row.kind}] {row.name}. Serving {row.serving}. "
        f"Calories {row.calories}, protein {row.protein_g}g, carbs {row.carbs_g}g, "
        f"fat {row.fat_g}g, fiber {row.fiber_g}g, sugar {row.sugar_g}g, "
        f"sodium {row.sodium_mg}mg. Source {row.source}. "
        f"Raw: {(row.raw_text or '')[:500]}"
    )


class VectorStore:
    def __init__(self) -> None:
        self._client = None
        self._collection = None
        if not CHROMADB_AVAILABLE:
            logger.warning("chromadb not installed — vector store disabled (stub mode)")
            return
        try:
            self._client = chromadb.PersistentClient(path=settings.chroma_path)
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception:
            logger.exception("Failed to initialize ChromaDB — vector store disabled")

    @property
    def collection(self):
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

    def existing_ids(self) -> set[str]:
        return set(self._collection.get(include=[]).get("ids") or [])

    async def _upsert_intake_batch(self, batch: list[Intake]) -> int:
        if not batch:
            return 0
        docs = [_intake_document(r) for r in batch]
        embeddings = await foundry.embed(docs)
        if embeddings:
            self._ensure_dims(embeddings[0])
        ids = [f"intake-{r.id}" for r in batch]
        metas = [
            {
                "user_id": r.user_id or "default",
                "intake_id": r.id,
                "source": r.source or "",
                "kind": r.kind,
                "name": (r.name or "")[:200],
            }
            for r in batch
        ]
        try:
            self._collection.upsert(
                ids=ids,
                documents=docs,
                embeddings=embeddings,
                metadatas=metas,
            )
        except InvalidDimensionException:
            self.reset_collection()
            self._collection.upsert(
                ids=ids,
                documents=docs,
                embeddings=embeddings,
                metadatas=metas,
            )
        return len(batch)

    async def ensure_indexed(self, session: AsyncSession) -> dict[str, int]:
        """Backfill meal_memory from Postgres for any missing non-water intakes."""
        result = await session.execute(
            select(Intake)
            .where(Intake.kind.in_(tuple(INDEXABLE_KINDS)))
            .order_by(Intake.id)
        )
        rows = list(result.scalars().all())
        existing = self.existing_ids()
        missing = [r for r in rows if f"intake-{r.id}" not in existing]
        if not missing:
            repaired = self.sync_user_metadata(rows)
            return {
                "indexed": self.count(),
                "added": 0,
                "skipped_existing": len(rows),
                "metadata_repaired": repaired,
            }

        # Probe dims with the first doc so a stub→live mismatch resets once up front.
        probe = (await foundry.embed([_intake_document(missing[0])]))[0]
        self._ensure_dims(probe)
        existing = self.existing_ids()
        missing = [r for r in rows if f"intake-{r.id}" not in existing]

        added = 0
        for start in range(0, len(missing), _EMBED_BATCH):
            added += await self._upsert_intake_batch(missing[start : start + _EMBED_BATCH])

        repaired = self.sync_user_metadata(rows)
        return {
            "indexed": self.count(),
            "added": added,
            "skipped_existing": len(rows) - len(missing),
            "metadata_repaired": repaired,
        }

    def sync_user_metadata(self, rows: list[Intake]) -> int:
        """Align Chroma user_id metadata with Postgres (no re-embed)."""
        if not rows:
            return 0
        existing = self.existing_ids()
        ids: list[str] = []
        metas: list[dict[str, Any]] = []
        for r in rows:
            doc_id = f"intake-{r.id}"
            if doc_id not in existing:
                continue
            ids.append(doc_id)
            metas.append(
                {
                    "user_id": r.user_id or "default",
                    "intake_id": r.id,
                    "source": r.source or "",
                    "kind": r.kind,
                    "name": (r.name or "")[:200],
                }
            )
        if not ids:
            return 0
        repaired = 0
        for start in range(0, len(ids), 100):
            chunk_ids = ids[start : start + 100]
            chunk_metas = metas[start : start + 100]
            try:
                self._collection.update(ids=chunk_ids, metadatas=chunk_metas)
                repaired += len(chunk_ids)
            except Exception:  # noqa: BLE001
                import logging

                logging.getLogger(__name__).exception(
                    "Failed to sync Chroma user_id metadata"
                )
        return repaired


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


async def ensure_indexed(session: AsyncSession) -> dict[str, int]:
    """Module-level API used on app startup."""
    return await vector_store.ensure_indexed(session)


def health() -> dict[str, Any]:
    try:
        return {"ok": True, "count": vector_store.count(), "path": settings.chroma_path}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
