from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

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
async def chat(body: ChatRequest) -> ChatResponse:
    try:
        return await answer_with_rag(message=body.message, user_id=body.user_id)
    except FoundryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/memory/intakes", response_model=IntakeRecord)
async def create_intake(
    body: IndexMealRequest,
    db: AsyncSession = Depends(get_session),
) -> IntakeRecord:
    """Store structured intake + index into Vector DB (for Person 1 / demos)."""
    return await memory_service.save_and_index_meal(db, meal=body.meal, user_id=body.user_id)


@router.get("/memory/intakes", response_model=list[IntakeRecord])
async def get_intakes(
    user_id: str = Query(default="default"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[IntakeRecord]:
    return await memory_service.list_intakes(db, user_id=user_id, limit=limit)


@router.get("/memory/daily-totals", response_model=DailyTotals)
async def get_daily_totals(
    user_id: str = Query(default="default"),
    day: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> DailyTotals:
    return await memory_service.daily_totals(db, user_id=user_id, day=day)
