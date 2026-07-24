"""RAG chat: retrieve meal memory from Vector DB, answer via Foundry."""

from __future__ import annotations

from app.config import settings
from app.models.schemas import ChatResponse
from app.services.foundry import foundry
from app.services.vector_store import vector_store

SYSTEM_PROMPT = """You are Nutrion, a helpful nutrition assistant.
Answer using the user's logged meal memory when relevant.
If memory does not contain enough information, say what is missing and give general guidance.
Be concise, practical, and do not invent specific logged meals that are not in context.
"""


def _format_context(hits: list[dict]) -> tuple[str, list[str]]:
    if not hits:
        return "No meal memory found for this user yet.", []

    blocks: list[str] = []
    sources: list[str] = []
    for i, hit in enumerate(hits, start=1):
        doc = (hit.get("document") or "").strip()
        meta = hit.get("metadata") or {}
        label = meta.get("name") or hit.get("id") or f"memory-{i}"
        sources.append(str(label))
        blocks.append(f"[{i}] {doc}")
    return "\n\n".join(blocks), sources


async def answer_with_rag(*, message: str, user_id: str = "default") -> ChatResponse:
    hits = await vector_store.search(query=message, user_id=user_id, top_k=settings.rag_top_k)
    context, sources = _format_context(hits)

    user_prompt = (
        f"User question:\n{message.strip()}\n\n"
        f"Meal memory context:\n{context}\n\n"
        "Answer the user question using the memory context when helpful."
    )
    answer = await foundry.chat(system=SYSTEM_PROMPT, user=user_prompt)
    return ChatResponse(answer=answer, sources=sources)
