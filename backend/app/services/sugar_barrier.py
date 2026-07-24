"""Recommend daily calorie + sugar intake from labs + personal profile.

Uses Kimi when available; falls back to transparent clinical-style rules.
Educational only — not a diagnosis or medical prescription.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.services.kimi_client import kimi_client

logger = logging.getLogger(__name__)

MEDICAL_DISCLAIMER = (
    "Educational estimate only — not medical advice. Discuss targets with a clinician."
)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _ideal_weight_kg(sex: Optional[str], height_cm: Optional[float]) -> Optional[float]:
    """Devine ideal body weight from height (no measured weight available)."""
    if height_cm is None or height_cm < 100:
        return None
    inches = height_cm / 2.54
    if sex == "female":
        kg = 45.5 + 2.3 * max(inches - 60, 0)
    else:
        # male / other default
        kg = 50.0 + 2.3 * max(inches - 60, 0)
    return _clamp(kg, 40.0, 120.0)


def _estimate_calories(
    *,
    age: Optional[float],
    sex: Optional[str],
    height_cm: Optional[float],
    hba1c: Optional[float],
    fasting_glucose: Optional[float],
) -> tuple[float, list[str]]:
    """Mifflin-St Jeor using ideal weight from height + sedentary multiplier."""
    reasons: list[str] = []
    weight = _ideal_weight_kg(sex, height_cm)
    age_v = age if age is not None and age > 0 else 30.0
    height_v = height_cm if height_cm is not None else 170.0

    if weight is None:
        calories = 2000.0 if sex != "female" else 1800.0
        reasons.append("Using a general calorie starting point (add height for a tighter estimate).")
    else:
        if sex == "female":
            bmr = 10 * weight + 6.25 * height_v - 5 * age_v - 161
        else:
            bmr = 10 * weight + 6.25 * height_v - 5 * age_v + 5
        calories = bmr * 1.2  # sedentary maintenance
        sex_label = sex or "unspecified"
        reasons.append(
            f"Calorie target from height/sex/age ({sex_label}, {round(height_v)} cm) "
            f"via estimated maintenance needs."
        )

    # Tighten slightly when glycemic labs are elevated (weight-management lean).
    if hba1c is not None and hba1c >= 6.5:
        calories *= 0.92
        reasons.append("Slightly lower calories because HbA1c is in the diabetes range.")
    elif hba1c is not None and hba1c >= 5.7:
        calories *= 0.96
        reasons.append("Modest calorie trim for prediabetes-range HbA1c.")
    elif fasting_glucose is not None:
        fbg = fasting_glucose * 18.0 if fasting_glucose < 30 else fasting_glucose
        if fbg >= 126:
            calories *= 0.92
            reasons.append("Slightly lower calories because fasting glucose is elevated.")
        elif fbg >= 100:
            calories *= 0.96
            reasons.append("Modest calorie trim for elevated fasting glucose.")

    calories = round(_clamp(calories, 1200.0, 3200.0) / 10) * 10
    return calories, reasons


def _estimate_water_cups(
    *,
    age: Optional[float],
    sex: Optional[str],
    height_cm: Optional[float],
    hba1c: Optional[float],
    fasting_glucose: Optional[float],
) -> tuple[float, list[str]]:
    """Daily water goal in cups (250 ml each — same as HydrationCard)."""
    cup_ml = 250.0
    reasons: list[str] = []
    weight = _ideal_weight_kg(sex, height_cm)

    if weight is None:
        cups = 8.0 if sex != "female" else 7.0
        reasons.append("Water goal uses a general 7–8 cup starting point (250 ml/cup).")
    else:
        # ~35 ml/kg → cups (250 ml)
        ml = weight * 35.0
        cups = ml / cup_ml
        reasons.append(
            f"Water goal ~{round(ml / 1000, 1)} L/day from estimated body size "
            f"({round(weight)} kg → {round(cups)} cups × 250 ml)."
        )

    if age is not None and age >= 50:
        cups += 0.5
        reasons.append("Slightly higher hydration target for age 50+.")

    # Mild bump when glycemic labs are elevated (hydration support).
    elevated = False
    if hba1c is not None and hba1c >= 5.7:
        elevated = True
    elif fasting_glucose is not None:
        fbg = fasting_glucose * 18.0 if fasting_glucose < 30 else fasting_glucose
        if fbg >= 100:
            elevated = True
    if elevated:
        cups += 1.0
        reasons.append("Extra cup recommended when blood-sugar labs are elevated.")

    cups = round(_clamp(cups, 6.0, 16.0))
    return cups, reasons


def _rules_barrier(
    *,
    age: Optional[float],
    sex: Optional[str],
    height_cm: Optional[float],
    hba1c: Optional[float],
    fasting_glucose: Optional[float],
) -> dict[str, Any]:
    """Deterministic daily sugar + calorie + water targets from labs + demographics."""
    sugar = 50.0
    sugar_reasons: list[str] = []

    if hba1c is not None:
        if hba1c >= 6.5:
            sugar = 20.0
            sugar_reasons.append(f"HbA1c {hba1c}% is in the diabetes range — tighter sugar cap.")
        elif hba1c >= 5.7:
            sugar = 30.0
            sugar_reasons.append(f"HbA1c {hba1c}% suggests prediabetes risk — moderated sugar cap.")
        else:
            sugar = 50.0
            sugar_reasons.append(f"HbA1c {hba1c}% is in a typical reference band.")

    if fasting_glucose is not None:
        fbg = fasting_glucose * 18.0 if fasting_glucose < 30 else fasting_glucose
        if fbg >= 126:
            sugar = min(sugar, 20.0)
            sugar_reasons.append(f"Fasting glucose ~{round(fbg)} mg/dL is elevated.")
        elif fbg >= 100:
            sugar = min(sugar, 30.0)
            sugar_reasons.append(f"Fasting glucose ~{round(fbg)} mg/dL is in a watch band.")

    if age is not None and age >= 50:
        sugar = max(15.0, sugar - 5.0)
        sugar_reasons.append("Age 50+ — slightly lower added-sugar barrier.")

    if sex == "female" and height_cm is not None and height_cm < 165:
        sugar = max(15.0, sugar - 3.0)
        sugar_reasons.append("Smaller frame — modest sugar reduction vs default.")

    if not sugar_reasons:
        sugar_reasons.append(
            "No lab values yet — using a general WHO-style ~50 g/day sugar barrier."
        )

    calories, cal_reasons = _estimate_calories(
        age=age,
        sex=sex,
        height_cm=height_cm,
        hba1c=hba1c,
        fasting_glucose=fasting_glucose,
    )
    water_cups, water_reasons = _estimate_water_cups(
        age=age,
        sex=sex,
        height_cm=height_cm,
        hba1c=hba1c,
        fasting_glucose=fasting_glucose,
    )

    sugar = round(_clamp(sugar, 15.0, 60.0))
    monthly = round(sugar * 30)
    rationale = (
        " ".join(cal_reasons + sugar_reasons + water_reasons) + " " + MEDICAL_DISCLAIMER
    )
    return {
        "calories": calories,
        "sugar_limit_g": sugar,
        "monthly_sugar_limit_g": monthly,
        "water_cups": water_cups,
        "rationale": rationale,
        "source": "rules",
        "confidence": 0.7 if (hba1c is not None or fasting_glucose is not None) else 0.45,
        "based_on": {
            "hba1c": hba1c,
            "fasting_glucose": fasting_glucose,
            "age": age,
            "sex": sex,
            "height_cm": height_cm,
        },
    }


async def recommend_sugar_barrier(
    *,
    age: Optional[float] = None,
    sex: Optional[str] = None,
    height_cm: Optional[float] = None,
    hba1c: Optional[float] = None,
    fasting_glucose: Optional[float] = None,
) -> dict[str, Any]:
    """Recommend daily calorie + sugar + water intake targets (legacy name kept)."""
    fallback = _rules_barrier(
        age=age,
        sex=sex,
        height_cm=height_cm,
        hba1c=hba1c,
        fasting_glucose=fasting_glucose,
    )

    if not kimi_client.enabled:
        return fallback

    system = (
        "You are NutriON's nutrition coach. Recommend DAILY dietary intake targets "
        "for tracking: calories (kcal), sugar in grams (added/free sugar), and water "
        "in cups (250 ml each, matching the app hydration tracker) — NOT a blood glucose "
        "mmol/L target. Respond ONLY with JSON: "
        '{"calories": number, "sugar_limit_g": number, "water_cups": number, '
        '"rationale": string, "confidence": number}. '
        "Clamp calories between 1200 and 3200. Clamp sugar_limit_g between 15 and 60. "
        "Clamp water_cups between 6 and 16. "
        "Use sex, height, and age for calorie and water needs; tighten sugar (and mildly calories) "
        "if labs are elevated; bump water slightly if labs are elevated. "
        "Include a one-sentence educational disclaimer that this is not medical advice."
    )
    user = (
        f"Profile: age={age}, sex={sex}, height_cm={height_cm}. "
        f"Labs: HbA1c={hba1c}%, fasting_glucose={fasting_glucose}. "
        f"Rule-based suggestion: {fallback['calories']} kcal/day, "
        f"{fallback['sugar_limit_g']} g sugar/day, {fallback['water_cups']} cups water/day."
    )
    try:
        data = await kimi_client.chat_json(system=system, user_text=user)
    except Exception:
        logger.exception("Kimi intake recommendation failed")
        return fallback

    if not isinstance(data, dict):
        return fallback

    try:
        sugar = float(data.get("sugar_limit_g", fallback["sugar_limit_g"]))
        sugar = round(_clamp(sugar, 15.0, 60.0))
        calories = float(data.get("calories", fallback["calories"]))
        calories = round(_clamp(calories, 1200.0, 3200.0) / 10) * 10
        water = float(data.get("water_cups", fallback["water_cups"]))
        water = round(_clamp(water, 6.0, 16.0))
        rationale = str(data.get("rationale") or fallback["rationale"]).strip()
        confidence = float(data.get("confidence", 0.75))
        confidence = _clamp(confidence, 0.0, 1.0)
        if MEDICAL_DISCLAIMER.lower() not in rationale.lower():
            rationale = f"{rationale} {MEDICAL_DISCLAIMER}".strip()
        return {
            "calories": calories,
            "sugar_limit_g": sugar,
            "monthly_sugar_limit_g": round(sugar * 30),
            "water_cups": water,
            "rationale": rationale,
            "source": "kimi",
            "confidence": confidence,
            "based_on": fallback["based_on"],
        }
    except (TypeError, ValueError):
        return fallback


# Alias for clearer imports
recommend_intake_targets = recommend_sugar_barrier
