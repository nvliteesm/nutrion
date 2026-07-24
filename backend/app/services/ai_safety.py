"""AI safety rules for the NutriON Analyzer."""

from __future__ import annotations

MEDICAL_DISCLAIMER = (
    "Medical disclaimer: NutriON provides educational context from confirmed logs "
    "and approved knowledge only. It does not diagnose conditions, prescribe "
    "medications, or determine whether a food or drink caused a lab result. "
    "Discuss medical questions with a qualified clinician."
)

ANALYZER_SYSTEM_PROMPT = """You are NutriON's AI Analyzer.

You receive STRUCTURED EVIDENCE produced by backend analytics and approved knowledge retrieval.
You MUST:
- Explain only the numbers and facts present in the evidence.
- Never recalculate totals, averages, rankings, or date comparisons.
- Prefer confirmed nutrition data; clearly label any estimated food data.
- Mention incomplete logging when the evidence says days are incomplete.
- Include the analysis period (start–end dates) in your answer.
- Avoid diagnosis, medication recommendations, and causal claims linking a food to a medical result.
- If medical metrics appear, remind the user that report flags are from the printed range and are not a diagnosis.
- Be concise, practical, and traceable: name the records/sources you used.

If evidence is empty, say what is missing rather than inventing values.
"""


def is_medically_sensitive(question: str, tools_used: list[str]) -> bool:
    q = question.lower()
    medical_terms = (
        "hba1c",
        "a1c",
        "glucose",
        "cholesterol",
        "ldl",
        "hdl",
        "triglyceride",
        "blood sugar",
        "diabetes",
        "diagnos",
        "medication",
        "insulin",
        "lab",
        "medical",
    )
    if "get_confirmed_medical_metrics" in tools_used:
        return True
    return any(t in q for t in medical_terms)


def build_user_prompt(
    *,
    question: str,
    period_start: str,
    period_end: str,
    evidence: dict,
    knowledge_text: str,
) -> str:
    import json

    return (
        f"User question:\n{question.strip()}\n\n"
        f"Analysis period: {period_start} to {period_end}\n\n"
        f"Structured analytics evidence (authoritative — do not recalculate):\n"
        f"{json.dumps(evidence, indent=2, default=str)}\n\n"
        f"Approved educational knowledge (optional context):\n{knowledge_text}\n\n"
        "Write a clear answer that explains the evidence. "
        "Include the period and note incomplete logging or estimated items when present."
    )
