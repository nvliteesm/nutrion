from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models.orm import Intake
from app.models.schemas import (
    DailyTotals,
    DrinkAnalyzeResponse,
    DrinkConfirmRequest,
    DrinkConfirmResponse,
    ExtractedMeal,
    FoodAnalyzeResponse,
    FoodConfirmRequest,
    FoodConfirmResponse,
    HealthResponse,
    IntakeRecord,
    IntakeUpdateRequest,
    MedicalAnalyzeResponse,
    MedicalConfirmRequest,
    MedicalConfirmResponse,
    MedicalMetricRecord,
    MedicalReportRecord,
    MedicalReportUpdateRequest,
    NutrientValues,
    StorageStatus,
    SugarBarrierRequest,
    SugarBarrierResponse,
    WaterSipRequest,
    WaterSipResponse,
)
from app.services import analysis_store, confirm_flow, structured_store, vector_store
from app.services.confirm_flow import _save_upload

router = APIRouter()
api = APIRouter(prefix="/api")

class VectorSearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=20)


class VectorSearchResponse(BaseModel):
    results: list[dict[str, Any]]


class WaterSipRequest(BaseModel):
    user_id: str = "default"
    ml: float = Field(default=30, gt=0, le=2000)


class WaterSipResponse(BaseModel):
    intake_id: int
    ml: float


async def _read_upload(file: Optional[UploadFile]) -> tuple[bytes | None, str | None]:
    if file is None or not file.filename:
        return None, None
    return await file.read(), file.filename


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
async def health(session: AsyncSession = Depends(get_session)) -> HealthResponse:
    from app.services.foundry import foundry
    from app.services.knowledge_store import knowledge_store

    chroma = vector_store.health()
    structured = await structured_store.storage_stats(session)
    knowledge = knowledge_store.health()
    foundry_status = await foundry.ping()
    overall = (
        "ok"
        if chroma.get("ok") and knowledge.get("ok") and foundry_status.get("ok")
        else "degraded"
    )
    return HealthResponse(
        status=overall,
        services={
            "pipeline": {
                "analyze_confirm": ["foods", "drinks", "medical"],
                "processing": ["food_ai", "drink_label_ocr", "drink_ai_fallback", "ocr", "document_parser", "medical_extract"],
                "storage": ["structured_db", "vector_db", "medical_reports"],
            },
            "structured_db": {
                "ok": True,
                "backend": "postgres" if settings.is_postgres else "sqlite",
                "supabase": settings.uses_supabase,
                "ssl": settings.ssl_enabled,
                "url": (
                    f"***@{settings.database_url.split('@', 1)[1]}"
                    if "@" in settings.database_url
                    else settings.database_url
                ),
                **structured,
            },
            "vector_db": chroma,
            "knowledge_base": knowledge,
            "foundry": foundry_status,
            "azure_models": {
                "live_ai": settings.live_ai_enabled,
                "endpoint": settings.openai_base_url,
                "chat_deployment": settings.chat_model,
                "embedding_deployment": settings.embedding_model,
                "has_key": settings.has_azure_key,
            },
            "kimi_vision": {
                "enabled": settings.kimi_vision_enabled,
                "endpoint": settings.kimi_base_url,
                "model": settings.kimi_vision_model,
                "has_key": settings.has_kimi_key,
                "used_for": ["food", "drink_unlabeled_fallback"],
            },
            "content_understanding": {
                "enabled": settings.content_understanding_enabled,
                "endpoint": settings.content_base_url,
                "analyzer": settings.azure_content_analyzer,
                "has_key": settings.has_content_key,
            },
        },
    )


# ---------------------------------------------------------------------------
# Confirm-flow APIs: /api/foods | /api/drinks | /api/medical
# ---------------------------------------------------------------------------


@api.post(
    "/foods/analyze",
    response_model=FoodAnalyzeResponse,
    summary="Upload food image → vision estimate (pending confirm)",
    tags=["foods"],
)
async def foods_analyze(
    file: UploadFile = File(..., description="Food / meal photo"),
    user_id: str = Form("default"),
    session: AsyncSession = Depends(get_session),
) -> FoodAnalyzeResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await confirm_flow.analyze_food(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Food analyze failed: {exc}") from exc


@api.get(
    "/foods/{analysis_id}",
    response_model=FoodAnalyzeResponse,
    summary="Get food analysis by id",
    tags=["foods"],
)
async def foods_get(
    analysis_id: str,
    session: AsyncSession = Depends(get_session),
) -> FoodAnalyzeResponse:
    try:
        return await confirm_flow.get_food_analysis(session, analysis_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@api.post(
    "/foods/{analysis_id}/confirm",
    response_model=FoodConfirmResponse,
    summary="Edit + confirm food estimate → save nutrition entry",
    tags=["foods"],
)
async def foods_confirm(
    analysis_id: str,
    body: FoodConfirmRequest,
    session: AsyncSession = Depends(get_session),
) -> FoodConfirmResponse:
    try:
        return await confirm_flow.confirm_food(
            session,
            analysis_id,
            body.food,
            user_id=body.user_id or "default",
            name=body.name,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api.post(
    "/drinks/analyze",
    response_model=DrinkAnalyzeResponse,
    summary="Upload drink image → label OCR, or Kimi estimate if no label",
    tags=["drinks"],
)
async def drinks_analyze(
    file: UploadFile = File(..., description="Drink nutrition label or beverage photo"),
    user_id: str = Form("default"),
    session: AsyncSession = Depends(get_session),
) -> DrinkAnalyzeResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await confirm_flow.analyze_drink(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Drink analyze failed: {exc}") from exc


@api.get(
    "/drinks/{analysis_id}",
    response_model=DrinkAnalyzeResponse,
    summary="Get drink analysis by id",
    tags=["drinks"],
)
async def drinks_get(
    analysis_id: str,
    session: AsyncSession = Depends(get_session),
) -> DrinkAnalyzeResponse:
    try:
        return await confirm_flow.get_drink_analysis(session, analysis_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@api.post(
    "/drinks/{analysis_id}/confirm",
    response_model=DrinkConfirmResponse,
    summary="Edit + confirm drink label → save nutrition entry",
    tags=["drinks"],
)
async def drinks_confirm(
    analysis_id: str,
    body: DrinkConfirmRequest,
    session: AsyncSession = Depends(get_session),
) -> DrinkConfirmResponse:
    try:
        return await confirm_flow.confirm_drink(
            session,
            analysis_id,
            body.drink,
            user_id=body.user_id or "default",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api.post(
    "/medical/analyze",
    response_model=MedicalAnalyzeResponse,
    summary="Upload medical report → extract supported metrics",
    tags=["medical"],
)
async def medical_analyze(
    file: UploadFile = File(..., description="Medical report PDF/image/text"),
    user_id: str = Form("default"),
    session: AsyncSession = Depends(get_session),
) -> MedicalAnalyzeResponse:
    file_bytes, filename = await _read_upload(file)
    try:
        return await confirm_flow.analyze_medical(
            session,
            file_bytes=file_bytes or b"",
            filename=filename or "",
            user_id=user_id or "default",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Medical analyze failed: {exc}") from exc


@api.get(
    "/medical/metrics",
    response_model=list[MedicalMetricRecord],
    summary="List latest metric values (expanded from reports)",
    tags=["medical"],
)
async def medical_metrics_list(
    user_id: Optional[str] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[MedicalMetricRecord]:
    return await analysis_store.list_medical_metrics(
        session,
        user_id=user_id,
        limit=min(limit, 200),
    )


@api.get(
    "/medical/reports",
    response_model=list[MedicalReportRecord],
    summary="List medical reports (1 report = 1 row)",
    tags=["medical"],
)
async def medical_reports_list(
    user_id: Optional[str] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[MedicalReportRecord]:
    return await analysis_store.list_medical_reports(
        session,
        user_id=user_id,
        limit=min(limit, 200),
    )


@api.patch(
    "/medical/reports/{report_id}",
    response_model=MedicalReportRecord,
    summary="Update a saved medical report",
    tags=["medical"],
)
async def medical_report_update(
    report_id: int,
    body: MedicalReportUpdateRequest,
    session: AsyncSession = Depends(get_session),
) -> MedicalReportRecord:
    row = await analysis_store.update_medical_report(
        session,
        report_id,
        body.model_dump(exclude_unset=True),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Medical report not found")
    return row


@api.delete(
    "/medical/reports/{report_id}",
    summary="Delete a saved medical report",
    tags=["medical"],
)
async def medical_report_delete(
    report_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    ok = await analysis_store.delete_medical_report(session, report_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Medical report not found")
    return {"ok": True, "id": report_id}


@api.get(
    "/medical/{analysis_id}",
    response_model=MedicalAnalyzeResponse,
    summary="Get medical analysis by id",
    tags=["medical"],
)
async def medical_get(
    analysis_id: str,
    session: AsyncSession = Depends(get_session),
) -> MedicalAnalyzeResponse:
    try:
        return await confirm_flow.get_medical_analysis(session, analysis_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@api.post(
    "/medical/{analysis_id}/confirm",
    response_model=MedicalConfirmResponse,
    summary="Edit + confirm medical metrics → save",
    tags=["medical"],
)
async def medical_confirm(
    analysis_id: str,
    body: MedicalConfirmRequest,
    session: AsyncSession = Depends(get_session),
) -> MedicalConfirmResponse:
    try:
        return await confirm_flow.confirm_medical(
            session,
            analysis_id,
            body.metrics,
            user_id=body.user_id or "default",
            age=body.age,
            sex=body.sex,
            height_cm=body.height_cm,
            compute_sugar_barrier=body.compute_sugar_barrier,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api.post(
    "/profile/sugar-barrier",
    response_model=SugarBarrierResponse,
    summary="Recommend daily calorie + sugar intake from labs + profile (Kimi)",
    tags=["profile"],
)
@api.post(
    "/medical/recommend-intake",
    response_model=SugarBarrierResponse,
    summary="Recommend daily calorie + sugar intake from labs + profile (Kimi)",
    tags=["medical"],
)
async def profile_sugar_barrier(
    body: SugarBarrierRequest,
    session: AsyncSession = Depends(get_session),
) -> SugarBarrierResponse:
    from app.services.sugar_barrier import recommend_sugar_barrier

    hba1c = body.hba1c
    fasting = body.fasting_glucose
    if body.use_latest_labs and (hba1c is None or fasting is None):
        reports = await analysis_store.list_medical_reports(
            session,
            user_id=body.user_id or None,
            limit=1,
        )
        if reports:
            latest = reports[0]
            if hba1c is None:
                hba1c = latest.hba1c
            if fasting is None:
                fasting = latest.fasting_glucose

    result = await recommend_sugar_barrier(
        age=body.age,
        sex=body.sex,
        height_cm=body.height_cm,
        hba1c=hba1c,
        fasting_glucose=fasting,
    )
    return SugarBarrierResponse.model_validate(result)


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------


@router.get(
    "/intakes",
    response_model=list[IntakeRecord],
    summary="List structured intakes",
    tags=["storage"],
)
async def get_intakes(
    user_id: Optional[str] = None,
    kind: Optional[str] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
) -> list[IntakeRecord]:
    return await structured_store.list_intakes(
        session,
        user_id=user_id,
        kind=kind,
        limit=min(limit, 200),
    )


@router.get(
    "/intakes/{intake_id}",
    response_model=IntakeRecord,
    summary="Get one structured intake",
    tags=["storage"],
)
async def get_intake(
    intake_id: int,
    session: AsyncSession = Depends(get_session),
) -> IntakeRecord:
    row = await structured_store.get_intake(session, intake_id)
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    return row


@router.patch(
    "/intakes/{intake_id}",
    response_model=IntakeRecord,
    summary="Update one structured intake",
    tags=["storage"],
)
async def update_intake(
    intake_id: int,
    body: IntakeUpdateRequest,
    session: AsyncSession = Depends(get_session),
) -> IntakeRecord:
    row = await structured_store.update_intake(
        session,
        intake_id,
        name=body.name,
        serving=body.serving,
        nutrients=body.nutrients,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    return row


@router.post(
    "/intakes/{intake_id}/image",
    response_model=IntakeRecord,
    summary="Add or replace an intake photo",
    tags=["storage"],
)
async def upload_intake_image(
    intake_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> IntakeRecord:
    row = await session.get(Intake, intake_id)
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    path = _save_upload(raw, file.filename or "photo.jpg")
    row.file_path = str(path)
    await session.commit()
    await session.refresh(row)
    return structured_store.intake_to_record(row)


@router.get(
    "/uploads/{filename}",
    summary="Serve a stored upload",
    tags=["storage"],
)
async def get_upload(filename: str) -> FileResponse:
    safe = Path(filename).name
    if not safe or safe != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = Path(settings.upload_dir) / safe
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@router.delete(
    "/intakes/{intake_id}",
    summary="Delete one structured intake",
    tags=["storage"],
)
async def delete_intake(
    intake_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    row = await session.get(Intake, intake_id)
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    await session.delete(row)
    await session.commit()
    return {"ok": True, "id": intake_id}


@api.post(
    "/water/sip",
    response_model=WaterSipResponse,
    summary="Log a water sip (hold-to-fill)",
    tags=["storage"],
)
async def water_sip(
    body: WaterSipRequest,
    session: AsyncSession = Depends(get_session),
) -> WaterSipResponse:
    ml = round(float(body.ml), 1)
    meal = ExtractedMeal(
        name="Water",
        serving=f"{ml:g} ml",
        nutrients=NutrientValues(
            calories=0,
            protein_g=0,
            carbs_g=0,
            fat_g=0,
            fiber_g=0,
            sugar_g=0,
            sodium_mg=0,
            extras={"drink_volume_ml": ml},
        ),
        raw_text="Hold-to-fill water sip",
        confidence=1.0,
        source="manual",
    )
    row = await structured_store.save_intake(
        session,
        meal,
        user_id=body.user_id or "default",
        source="manual",
        kind="water",
        confirmed=True,
    )
    return WaterSipResponse(intake_id=row.id, ml=ml)


@router.get(
    "/totals/daily",
    response_model=DailyTotals,
    summary="Daily nutrient totals from Structured DB",
    tags=["storage"],
)
async def get_daily_totals(
    user_id: str = "default",
    day: Optional[date] = None,
    session: AsyncSession = Depends(get_session),
) -> DailyTotals:
    return await structured_store.daily_totals(session, user_id=user_id, day=day)


@router.get(
    "/storage/status",
    response_model=StorageStatus,
    summary="Structured + vector storage status",
    tags=["storage"],
)
async def storage_status(session: AsyncSession = Depends(get_session)) -> StorageStatus:
    return StorageStatus(
        structured=await structured_store.storage_stats(session),
        vector=vector_store.health(),
    )


@router.post(
    "/vector/search",
    response_model=VectorSearchResponse,
    summary="Search semantic memory (Vector DB)",
    tags=["storage"],
)
async def vector_search(body: VectorSearchRequest) -> VectorSearchResponse:
    results = await vector_store.search(
        body.query,
        user_id=body.user_id,
        limit=body.limit,
    )
    return VectorSearchResponse(results=results)
