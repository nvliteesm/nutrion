from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class InputType(str, Enum):
    food = "food"
    drink = "drink"
    document = "document"
    medical = "medical"


class ConfirmationStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"


class MetricStatus(str, Enum):
    high = "high"
    normal = "normal"
    low = "low"
    unknown = "unknown"


class MedicalCategory(str, Enum):
    blood_sugar = "blood_sugar"
    lipid_profile = "lipid_profile"
    other = "other"


# ---------------------------------------------------------------------------
# Shared nutrient / meal models (legacy ingest)
# ---------------------------------------------------------------------------


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


OrchestrateResponse = IngestResponse


# ---------------------------------------------------------------------------
# Drink label (OCR → normalize → confirm)
# ---------------------------------------------------------------------------


class DrinkLabelData(BaseModel):
    product_name: str = "Unknown drink"
    serving_size: str = "1 serving"
    servings_per_container: Optional[float] = None
    calories: float = 0
    carbohydrates_g: float = 0
    total_sugar_g: float = 0
    added_sugar_g: float = 0
    drink_volume_ml: Optional[float] = None
    sodium_mg: Optional[float] = None
    caffeine_mg: Optional[float] = None
    confidence: float = 0.5
    confirmation_status: ConfirmationStatus = ConfirmationStatus.pending
    raw_text: str = ""


class DrinkAnalyzeResponse(BaseModel):
    analysis_id: str
    drink: DrinkLabelData
    message: str = "Normalized OCR result ready for review"


class DrinkConfirmRequest(BaseModel):
    drink: DrinkLabelData
    user_id: str = "default"


class DrinkConfirmResponse(BaseModel):
    analysis_id: str
    intake_id: int
    drink: DrinkLabelData
    message: str = "Drink nutrition entry saved"


# ---------------------------------------------------------------------------
# Medical report parsing
# ---------------------------------------------------------------------------


class MedicalMetricData(BaseModel):
    metric_name: str
    category: MedicalCategory = MedicalCategory.other
    value: float
    unit: str = ""
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    reference_range_text: str = ""
    status: MetricStatus = MetricStatus.unknown
    test_date: Optional[date] = None
    source_page: Optional[int] = None
    extraction_confidence: float = 0.5
    confirmed: bool = False


class MedicalAnalyzeResponse(BaseModel):
    analysis_id: str
    metrics: list[MedicalMetricData]
    raw_text: str = ""
    message: str = "Blood sugar + lipid profile metrics extracted — review before saving"


class MedicalConfirmRequest(BaseModel):
    metrics: list[MedicalMetricData]
    user_id: str = "default"


class MedicalConfirmResponse(BaseModel):
    analysis_id: str
    metric_ids: list[int]
    metrics: list[MedicalMetricData]
    message: str = "Medical metrics saved"


class MedicalMetricRecord(BaseModel):
    id: int
    user_id: str
    analysis_id: str
    metric_name: str
    category: str
    value: float
    unit: str
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    reference_range_text: str = ""
    status: str
    test_date: Optional[date] = None
    source_page: Optional[int] = None
    extraction_confidence: float
    confirmed: bool
    file_path: str = ""
    created_at: datetime


# ---------------------------------------------------------------------------
# Food image analysis (vision → estimate → confirm)
# ---------------------------------------------------------------------------


class FoodItemEstimate(BaseModel):
    name: str
    portion: str = "1 serving"
    portion_grams: Optional[float] = None
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    calories_low: Optional[float] = None
    calories_high: Optional[float] = None
    confidence: float = 0.5


class FoodAnalysisData(BaseModel):
    items: list[FoodItemEstimate] = Field(default_factory=list)
    total_calories: float = 0
    total_protein_g: float = 0
    total_carbs_g: float = 0
    total_fat_g: float = 0
    total_fiber_g: float = 0
    total_sugar_g: float = 0
    total_sodium_mg: float = 0
    confidence: float = 0.5
    confirmation_status: ConfirmationStatus = ConfirmationStatus.pending
    description: str = ""
    raw_text: str = ""


class FoodAnalyzeResponse(BaseModel):
    analysis_id: str
    food: FoodAnalysisData
    message: str = "Food estimate ready for review"


class FoodConfirmRequest(BaseModel):
    food: FoodAnalysisData
    user_id: str = "default"
    name: Optional[str] = None


class FoodConfirmResponse(BaseModel):
    analysis_id: str
    intake_id: int
    food: FoodAnalysisData
    message: str = "Estimated nutrition entry saved"


# ---------------------------------------------------------------------------
# Legacy / dashboard helpers
# ---------------------------------------------------------------------------


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
    confirmed_count: int = 0
    estimated_count: int = 0


class PeriodSummary(BaseModel):
    user_id: str
    period: str
    start: date
    end: date
    totals: NutrientValues
    averages_per_day: NutrientValues
    meal_count: int
    confirmed_count: int
    estimated_count: int
    days_with_logs: int
    daily: list[DailyTotals] = Field(default_factory=list)


class SugarSourceItem(BaseModel):
    name: str
    sugar_g: float
    percent_of_period_sugar: float
    intake_count: int
    input_type: str
    is_estimated: bool = False
    sample_intake_ids: list[int] = Field(default_factory=list)


class TopSugarSources(BaseModel):
    user_id: str
    start: date
    end: date
    total_sugar_g: float
    items: list[SugarSourceItem]


class TrendPoint(BaseModel):
    day: date
    calories: float
    sugar_g: float
    protein_g: float
    carbs_g: float
    fat_g: float
    meal_count: int


class NutritionTrend(BaseModel):
    user_id: str
    start: date
    end: date
    metric: str
    points: list[TrendPoint]
    period_average: float
    previous_period_average: Optional[float] = None
    change_percent: Optional[float] = None


class LoggingCompleteness(BaseModel):
    user_id: str
    start: date
    end: date
    expected_days: int
    days_with_logs: int
    incomplete_days: list[date]
    completeness_percent: float
    meals_per_logged_day: float
    note: str


class MedicalMetricCreate(BaseModel):
    """Demo / analytics helper for inserting a confirmed medical metric."""

    user_id: str = "default"
    metric_key: str
    display_name: str = ""
    value: float
    unit: str = ""
    range_low: Optional[float] = None
    range_high: Optional[float] = None
    flag: str = "unknown"
    confirmed: bool = True
    source: str = "report"
    notes: str = ""
    measured_at: Optional[datetime] = None


class PeriodComparison(BaseModel):
    user_id: str
    current_start: date
    current_end: date
    previous_start: date
    previous_end: date
    current: NutrientValues
    previous: NutrientValues
    deltas: NutrientValues
    change_percents: dict[str, Optional[float]]
    current_meal_count: int
    previous_meal_count: int


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
    kind: str = "food"
    name: str
    serving: str = "1 serving"
    logged_at: datetime
    nutrients: NutrientValues
    source: str
    confidence: float = 0.7
    confirmed: bool = False
    is_estimated: bool = False
    input_type: str = "food"
    raw_text: str = ""
    file_path: str = ""
    analysis_id: str = ""


class StorageStatus(BaseModel):
    structured: dict[str, Any]
    vector: dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    services: dict[str, Any]


class KnowledgeHit(BaseModel):
    id: str
    title: str
    topic: str
    chunk: str
    distance: Optional[float] = None


class AnalyzeRequest(BaseModel):
    question: str
    user_id: str = "default"
    # Optional explicit period override (YYYY-MM-DD). Analyzer also infers from question.
    day: Optional[date] = None
    start: Optional[date] = None
    end: Optional[date] = None


class AnalyzeSource(BaseModel):
    kind: str  # analytics | medical | knowledge | insight
    label: str
    detail: Optional[str] = None


class AnalyzeResponse(BaseModel):
    answer: str
    period_start: date
    period_end: date
    tools_used: list[str] = Field(default_factory=list)
    sources: list[AnalyzeSource] = Field(default_factory=list)
    evidence: dict[str, Any] = Field(default_factory=dict)
    medical_disclaimer: Optional[str] = None
    incomplete_logging: bool = False


class InsightRecord(BaseModel):
    id: int
    user_id: str
    kind: str
    title: str
    body: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    created_at: datetime
