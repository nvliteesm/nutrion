from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_user import resolve_user_id
from app.db import get_session
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    DailyTotals,
    ExtractedMeal,
    IntakeRecord,
    NutrientValues,
)
from app.services import memory as memory_service
from app.services.foundry import FoundryError
from app.services.rag_chat import answer_with_rag

router = APIRouter(tags=["memory-chat"])


class IndexMealRequest(BaseModel):
    user_id: str = "default"
    meal: ExtractedMeal = Field(
        default_factory=lambda: ExtractedMeal(
            name="Sample oatmeal",
            serving="1 bowl",
            nutrients=NutrientValues(calories=350, protein_g=12, carbs_g=54, fat_g=8, fiber_g=6),
            raw_text="Rolled oats with milk and banana",
            source="manual",
        )
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_session),
) -> ChatResponse:
    uid = await resolve_user_id(request, claimed=body.user_id, session=db)
    try:
        return await answer_with_rag(message=body.message, user_id=uid)
    except FoundryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/memory/intakes", response_model=IntakeRecord)
async def create_intake(
    request: Request,
    body: IndexMealRequest,
    db: AsyncSession = Depends(get_session),
) -> IntakeRecord:
    """Store structured intake + index into Vector DB (for Person 1 / demos)."""
    uid = await resolve_user_id(request, claimed=body.user_id, session=db)
    return await memory_service.save_and_index_meal(db, meal=body.meal, user_id=uid)


@router.get("/memory/intakes", response_model=list[IntakeRecord])
async def get_intakes(
    request: Request,
    user_id: str = Query(default="default"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[IntakeRecord]:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await memory_service.list_intakes(db, user_id=uid, limit=limit)


@router.get("/memory/daily-totals", response_model=DailyTotals)
async def get_daily_totals(
    request: Request,
    user_id: str = Query(default="default"),
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> DailyTotals:
    uid = await resolve_user_id(request, claimed=user_id, session=db)
    return await memory_service.daily_totals(db, user_id=uid, day=day)
