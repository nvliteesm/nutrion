"""AI Analyzer + insight endpoints."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.schemas import AnalyzeRequest, AnalyzeResponse, InsightRecord
from app.services import ai_analyzer, insights
from app.services.foundry import FoundryError

router = APIRouter(prefix="/api/ai", tags=["ai-analyzer"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_session),
) -> AnalyzeResponse:
    """Grounded analyzer: backend analytics + optional educational RAG → LLM explanation."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    try:
        return await ai_analyzer.analyze(
            db,
            question=body.question,
            user_id=body.user_id or "default",
            day=body.day,
            start=body.start,
            end=body.end,
        )
    except FoundryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/insights/daily", response_model=InsightRecord)
async def insight_daily(
    user_id: str = Query(default="default"),
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    return await insights.generate_daily_insight(db, user_id=user_id, day=day)


@router.post("/insights/weekly", response_model=InsightRecord)
async def insight_weekly(
    user_id: str = Query(default="default"),
    anchor: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    return await insights.generate_weekly_insight(db, user_id=user_id, anchor=anchor)


@router.post("/insights/sugar-sources", response_model=InsightRecord)
async def insight_sugar(
    user_id: str = Query(default="default"),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    return await insights.generate_sugar_source_insight(
        db, user_id=user_id, start=start, end=end
    )


@router.post("/insights/completeness", response_model=InsightRecord)
async def insight_completeness(
    user_id: str = Query(default="default"),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    return await insights.generate_logging_completeness_insight(
        db, user_id=user_id, start=start, end=end
    )


@router.post("/insights/medical-context", response_model=InsightRecord)
async def insight_medical(
    user_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    return await insights.generate_medical_context_summary(db, user_id=user_id)


@router.get("/insights", response_model=list[InsightRecord])
async def list_insights(
    user_id: str = Query(default="default"),
    kind: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
) -> list[InsightRecord]:
    return await insights.list_insights(db, user_id=user_id, kind=kind, limit=limit)
