"""AI Analyzer + insight endpoints."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_user import resolve_user_id
from app.db import get_session
from app.models.schemas import AnalyzeRequest, AnalyzeResponse, InsightRecord
from app.services import ai_analyzer, insights
from app.services.foundry import FoundryError
from app.services.speech import SpeechError, transcribe_audio

router = APIRouter(prefix="/api/ai", tags=["ai-analyzer"])


class TranscribeResponse(BaseModel):
    transcript: str = ""
    status: str = Field(default="ok", description="ok | not_configured")
    detail: str = ""


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    request: Request,
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_session),
) -> AnalyzeResponse:
    """Grounded analyzer: backend analytics + optional educational RAG → LLM explanation."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    uid = await resolve_user_id(request, claimed=body.user_id, session=db)
    try:
        return await ai_analyzer.analyze(
            db,
            question=body.question,
            user_id=uid,
            day=body.day,
            start=body.start,
            end=body.end,
        )
    except FoundryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_endpoint(
    request: Request,
    file: UploadFile = File(..., description="Recorded audio (webm/m4a/wav)"),
    user_id: str = Form("default"),
    db: AsyncSession = Depends(get_session),
) -> TranscribeResponse:
    """Speech → text via Azure Speech Fast Transcription."""
    await resolve_user_id(request, claimed=user_id, session=db)
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    try:
        transcript = await transcribe_audio(
            file_bytes=raw,
            filename=file.filename or "audio.webm",
            content_type=file.content_type,
        )
    except SpeechError as exc:
        status = 503 if "not configured" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return TranscribeResponse(transcript=transcript, status="ok")


@router.post("/insights/daily", response_model=InsightRecord)
async def insight_daily(
    request: Request,
    user_id: str = Query(default="default"),
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await insights.generate_daily_insight(db, user_id=uid, day=day)


@router.post("/insights/weekly", response_model=InsightRecord)
async def insight_weekly(
    request: Request,
    user_id: str = Query(default="default"),
    anchor: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await insights.generate_weekly_insight(db, user_id=uid, anchor=anchor)


@router.post("/insights/sugar-sources", response_model=InsightRecord)
async def insight_sugar(
    request: Request,
    user_id: str = Query(default="default"),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await insights.generate_sugar_source_insight(
        db, user_id=uid, start=start, end=end
    )


@router.post("/insights/completeness", response_model=InsightRecord)
async def insight_completeness(
    request: Request,
    user_id: str = Query(default="default"),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await insights.generate_logging_completeness_insight(
        db, user_id=uid, start=start, end=end
    )


@router.post("/insights/medical-context", response_model=InsightRecord)
async def insight_medical(
    request: Request,
    user_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_session),
) -> InsightRecord:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await insights.generate_medical_context_summary(db, user_id=uid)


@router.get("/insights", response_model=list[InsightRecord])
async def list_insights(
    request: Request,
    user_id: str = Query(default="default"),
    kind: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
) -> list[InsightRecord]:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await insights.list_insights(db, user_id=uid, kind=kind, limit=limit)
