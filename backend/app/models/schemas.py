from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class InputType(str, Enum):
    food = "food"
    drink = "drink"
    document = "document"


class NutrientValues(BaseModel):
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    extras: dict[str, float] = Field(default_factory=dict)


class ExtractedMeal(BaseModel):
    name: str = "Unknown meal"
    serving: str = "1 serving"
    nutrients: NutrientValues
    raw_text: str = ""
    confidence: float = 0.7
    source: str = "extractor"


class IngestResponse(BaseModel):
    input_type: InputType
    meal: Optional[ExtractedMeal] = None
    intake_id: Optional[int] = None
    message: str


# Back-compat alias
OrchestrateResponse = IngestResponse


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)


class DailyTotals(BaseModel):
    day: date
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    sugar_g: float
    sodium_mg: float
    meal_count: int


class TrendReport(BaseModel):
    user_id: str
    start: date
    end: date
    daily: list[DailyTotals]
    averages: NutrientValues
    insights: list[str]


class MealPlanItem(BaseModel):
    id: Optional[int] = None
    user_id: str = "default"
    title: str
    scheduled_at: datetime
    notes: str = ""
    calories_target: Optional[float] = None


class MealPlanCreate(BaseModel):
    user_id: str = "default"
    title: str
    scheduled_at: datetime
    notes: str = ""
    calories_target: Optional[float] = None


class NotificationItem(BaseModel):
    id: int
    user_id: str
    title: str
    body: str
    kind: str
    created_at: datetime
    read: bool = False


class IntakeRecord(BaseModel):
    id: int
    user_id: str
    name: str
    logged_at: datetime
    nutrients: NutrientValues
    source: str


class HealthResponse(BaseModel):
    status: str
    services: dict[str, Any]
