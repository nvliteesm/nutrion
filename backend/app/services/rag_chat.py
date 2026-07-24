"""RAG chat: retrieve meal memory from Vector DB, answer via Foundry."""

from __future__ import annotations

from app.config import settings
from app.models.schemas import ChatResponse
from app.services.ai_safety import (
    RAG_SYSTEM_PROMPT,
    build_rag_user_prompt,
    screen_user_input,
    validate_model_output,
)
from app.services.foundry import foundry
from app.services.vector_store import vector_store


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
    verdict = screen_user_input(message)
    if not verdict.allowed:
        return ChatResponse(answer=verdict.canned_response or "", sources=[])

    hits = await vector_store.search(query=message, user_id=user_id, top_k=settings.rag_top_k)
    context, sources = _format_context(hits)

    user_prompt = build_rag_user_prompt(message=message, context=context)
    answer = await foundry.chat(system=RAG_SYSTEM_PROMPT, user=user_prompt)
    return ChatResponse(answer=validate_model_output(answer), sources=sources)
