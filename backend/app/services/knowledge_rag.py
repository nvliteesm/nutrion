"""Educational RAG retrieval layer.

Retrieves approved knowledge chunks only.
Does NOT calculate sugar totals, averages, medical values, or date comparisons.
"""

from __future__ import annotations

from typing import Optional

from app.models.schemas import KnowledgeHit
from app.services.knowledge_store import knowledge_store, search_approved_health_knowledge


async def retrieve_education(
    question: str,
    *,
    top_k: Optional[int] = None,
) -> tuple[str, list[KnowledgeHit]]:
    hits = await search_approved_health_knowledge(question, top_k=top_k)
    if not hits:
        return "No approved educational passages matched this question.", []

    blocks: list[str] = []
    for i, hit in enumerate(hits, start=1):
        blocks.append(f"[{i}] {hit.title} ({hit.topic})\n{hit.chunk}")
    return "\n\n".join(blocks), hits


# Re-export for tool registry clarity
retrieve = retrieve_education
ensure_knowledge_indexed = knowledge_store.ensure_indexed
