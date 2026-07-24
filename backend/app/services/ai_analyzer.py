"""AI Analyzer: analytics + optional educational RAG → grounded LLM explanation.

Personal totals always come from SQL/backend analytics.
RAG is used only for approved educational knowledge.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import AnalyzeResponse, AnalyzeSource
from app.services import ai_tools, analytics
from app.services.ai_safety import (
    ANALYZER_SYSTEM_PROMPT,
    MEDICAL_DISCLAIMER,
    SAFETY_BLOCK_RESPONSE,
    build_user_prompt,
    is_medically_sensitive,
    screen_user_input,
    validate_model_output,
)
from app.services.foundry import FoundryError, foundry
from app.services.knowledge_rag import retrieve_education


def _infer_period(
    question: str,
    *,
    day: Optional[date] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> tuple[str, date, date]:
    """Return (period_kind, start, end). Backend owns date math — not the LLM."""
    if start and end:
        return "custom", start, end
    if day:
        return "daily", day, day

    q = question.lower()
    today = date.today()

    if re.search(r"\btoday\b", q):
        return "daily", today, today
    if re.search(r"\byesterday\b", q):
        y = today - timedelta(days=1)
        return "daily", y, y
    if re.search(r"\bmonth|monthly|this month\b", q):
        s, e = analytics.month_bounds(today)
        return "monthly", s, e
    if re.search(r"\blast month\b", q):
        first = today.replace(day=1)
        last_month_end = first - timedelta(days=1)
        s, e = analytics.month_bounds(last_month_end)
        return "monthly", s, e
    # Default and "week" → ISO week
    s, e = analytics.week_bounds(today)
    if re.search(r"\blast week\b", q):
        s, e = analytics.previous_period(s, e)
        return "weekly", s, e
    return "weekly", s, e


def _infer_intents(question: str) -> set[str]:
    q = question.lower()
    intents: set[str] = set()

    if re.search(r"sugar|sweet|drink", q):
        intents.add("sugar_sources")
    if re.search(r"trend|over time|change|compared|vs|versus|previous", q):
        intents.add("trends")
        intents.add("compare")
    if re.search(r"complete|missing|forgot|log(ging)?|gap", q):
        intents.add("completeness")
    if re.search(
        r"hba1c|a1c|glucose|cholesterol|ldl|hdl|triglyceride|lab|medical|blood",
        q,
    ):
        intents.add("medical")
    if re.search(r"what is|mean|explain|education|label|alternative|doctor|ask", q):
        intents.add("knowledge")
    if re.search(r"today|yesterday|daily|day", q):
        intents.add("daily")
    if re.search(r"month|monthly", q):
        intents.add("monthly")
    if re.search(r"week|weekly", q) or not intents:
        intents.add("weekly")

    # Educational questions still get knowledge
    if re.search(r"what is|how (do|does|to)|explain|tell me about", q):
        intents.add("knowledge")

    return intents


async def _gather_evidence(
    db: AsyncSession,
    *,
    user_id: str,
    question: str,
    period_kind: str,
    start: date,
    end: date,
    intents: set[str],
) -> tuple[dict[str, Any], list[str], list[AnalyzeSource], str, list]:
    evidence: dict[str, Any] = {
        "period": {"kind": period_kind, "start": start.isoformat(), "end": end.isoformat()},
        "data_policy": "confirmed_nutrition_by_default",
    }
    tools_used: list[str] = []
    sources: list[AnalyzeSource] = []

    if "daily" in intents or period_kind == "daily":
        data = await ai_tools.get_daily_summary(db, user_id=user_id, day=start)
        evidence["daily_summary"] = data
        tools_used.append("get_daily_summary")
        sources.append(
            AnalyzeSource(
                kind="analytics",
                label="daily_summary",
                detail=f"{data.get('meal_count', 0)} meals on {start}",
            )
        )

    if "weekly" in intents or period_kind == "weekly":
        data = await ai_tools.get_weekly_summary(db, user_id=user_id, anchor=start)
        # If custom range within a week request, still attach weekly for context
        evidence["weekly_summary"] = data
        tools_used.append("get_weekly_summary")
        sources.append(
            AnalyzeSource(
                kind="analytics",
                label="weekly_summary",
                detail=f"{data.get('start')} → {data.get('end')}",
            )
        )

    if "monthly" in intents or period_kind == "monthly":
        data = await ai_tools.get_monthly_summary(db, user_id=user_id, anchor=start)
        evidence["monthly_summary"] = data
        tools_used.append("get_monthly_summary")
        sources.append(
            AnalyzeSource(kind="analytics", label="monthly_summary", detail=str(data.get("start")))
        )

    if "sugar_sources" in intents:
        data = await ai_tools.get_top_sugar_sources(
            db, user_id=user_id, start=start, end=end, drinks_only=True
        )
        evidence["top_sugar_sources"] = data
        tools_used.append("get_top_sugar_sources")
        top_name = data["items"][0]["name"] if data.get("items") else "none"
        sources.append(
            AnalyzeSource(kind="analytics", label="top_sugar_sources", detail=top_name)
        )

    if "trends" in intents:
        data = await ai_tools.get_nutrition_trends(
            db, user_id=user_id, start=start, end=end, metric="sugar_g"
        )
        evidence["nutrition_trends"] = data
        tools_used.append("get_nutrition_trends")
        sources.append(AnalyzeSource(kind="analytics", label="nutrition_trends", detail="sugar_g"))

    if "compare" in intents:
        data = await ai_tools.compare_periods(db, user_id=user_id, start=start, end=end)
        evidence["period_comparison"] = data
        tools_used.append("compare_periods")
        sources.append(AnalyzeSource(kind="analytics", label="period_comparison"))

    # Always attach completeness so the model can mention gaps.
    completeness = await ai_tools.get_logging_completeness(
        db, user_id=user_id, start=start, end=end
    )
    evidence["logging_completeness"] = completeness
    tools_used.append("get_logging_completeness")
    sources.append(
        AnalyzeSource(
            kind="analytics",
            label="logging_completeness",
            detail=f"{completeness.get('completeness_percent')}%",
        )
    )

    if "medical" in intents:
        metrics = await ai_tools.get_confirmed_medical_metrics(db, user_id=user_id)
        evidence["medical_metrics"] = metrics
        tools_used.append("get_confirmed_medical_metrics")
        for m in metrics:
                sources.append(
                    AnalyzeSource(
                        kind="medical",
                        label=m.get("metric_name") or m.get("metric_key", "metric"),
                        detail=f"{m.get('value')} {m.get('unit')} ({m.get('status') or m.get('flag')})",
                    )
                )

    knowledge_text = "No educational retrieval requested."
    knowledge_hits: list = []
    if "knowledge" in intents or "medical" in intents:
        knowledge_text, knowledge_hits = await retrieve_education(question)
        tools_used.append("search_approved_health_knowledge")
        for hit in knowledge_hits:
            sources.append(
                AnalyzeSource(
                    kind="knowledge",
                    label=hit.title,
                    detail=hit.topic,
                )
            )
        evidence["knowledge_hits"] = [h.model_dump(mode="json") for h in knowledge_hits]

    return evidence, tools_used, sources, knowledge_text, knowledge_hits


def _stub_grounded_answer(
    *,
    question: str,
    evidence: dict[str, Any],
    period_start: date,
    period_end: date,
) -> str:
    """Deterministic explanation when live Foundry is off — still uses backend numbers."""
    parts = [
        f"Analysis period: {period_start.isoformat()} to {period_end.isoformat()}.",
    ]
    sugar = evidence.get("top_sugar_sources")
    if sugar and sugar.get("items"):
        top = sugar["items"][0]
        est = " Estimated items are included and should be treated cautiously." if top.get("is_estimated") else ""
        parts.append(
            f"Your confirmed drink logs show that {top['name']} contributed the most "
            f"added sugar in this period at {top['sugar_g']} g "
            f"({top['percent_of_period_sugar']}% of drink sugar).{est}"
        )
    weekly = evidence.get("weekly_summary") or evidence.get("daily_summary") or evidence.get("monthly_summary")
    if weekly:
        t = weekly.get("totals") or {}
        parts.append(
            f"Confirmed nutrition totals for the period: {t.get('calories', 0)} kcal, "
            f"{t.get('sugar_g', 0)} g sugar, across {weekly.get('meal_count', 0)} meal(s)."
        )
    comp = evidence.get("logging_completeness") or {}
    incomplete = comp.get("incomplete_days") or []
    if incomplete:
        parts.append(
            f"{len(incomplete)} day(s) have incomplete logging, so your actual totals may be higher."
        )
    metrics = evidence.get("medical_metrics") or []
    for m in metrics:
        parts.append(
            f"Your latest confirmed {m.get('metric_name') or m.get('display_name') or m.get('metric_key')} was "
            f"{m.get('value')} {m.get('unit')} and marked {m.get('status') or m.get('flag')} based on the range "
            f"printed on your report. NutriON cannot determine whether food intake caused this result."
        )
    if len(parts) == 1:
        parts.append(
            "Not enough confirmed logs were found for a detailed answer to: "
            f"“{question.strip()[:200]}”."
        )
    return " ".join(parts)


async def analyze(
    db: AsyncSession,
    *,
    question: str,
    user_id: str = "default",
    day: Optional[date] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> AnalyzeResponse:
    today = date.today()

    # Safety harness: hello / injection / misuse / off-topic — no analytics or LLM.
    verdict = screen_user_input(question)
    if not verdict.allowed:
        return AnalyzeResponse(
            answer=verdict.canned_response or "",
            period_start=today,
            period_end=today,
            tools_used=[],
            sources=[],
            evidence={"safety": {"blocked": True, "reason": verdict.reason}},
            medical_disclaimer=None,
            incomplete_logging=False,
        )

    period_kind, p_start, p_end = _infer_period(question, day=day, start=start, end=end)
    intents = _infer_intents(question)

    evidence, tools_used, sources, knowledge_text, _hits = await _gather_evidence(
        db,
        user_id=user_id,
        question=question,
        period_kind=period_kind,
        start=p_start,
        end=p_end,
        intents=intents,
    )

    incomplete = bool((evidence.get("logging_completeness") or {}).get("incomplete_days"))
    medical = is_medically_sensitive(question, tools_used)

    user_prompt = build_user_prompt(
        question=question,
        period_start=p_start.isoformat(),
        period_end=p_end.isoformat(),
        evidence=evidence,
        knowledge_text=knowledge_text,
    )

    try:
        if foundry.use_live:
            answer = await foundry.chat(system=ANALYZER_SYSTEM_PROMPT, user=user_prompt)
        else:
            answer = _stub_grounded_answer(
                question=question,
                evidence=evidence,
                period_start=p_start,
                period_end=p_end,
            )
    except FoundryError:
        answer = _stub_grounded_answer(
            question=question,
            evidence=evidence,
            period_start=p_start,
            period_end=p_end,
        )

    answer = validate_model_output(answer)

    # Ensure period is present even if the model omitted it (skip canned safety replies).
    if answer != SAFETY_BLOCK_RESPONSE and "I am not trained to answer question" not in answer:
        if p_start.isoformat() not in answer and "Analysis period" not in answer:
            answer = f"Analysis period: {p_start.isoformat()} to {p_end.isoformat()}. {answer}"

    return AnalyzeResponse(
        answer=answer.strip(),
        period_start=p_start,
        period_end=p_end,
        tools_used=tools_used,
        sources=sources,
        evidence=evidence,
        medical_disclaimer=MEDICAL_DISCLAIMER if medical else None,
        incomplete_logging=incomplete,
    )
