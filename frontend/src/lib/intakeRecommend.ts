import type { Sex, SugarBarrierResult } from "./types";

/**
 * Client-side calorie + sugar + water recommendation (mirrors backend rules).
 * Used when the API is unavailable or as an instant fallback.
 */

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function idealWeightKg(
  sex: Sex | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (heightCm == null || heightCm < 100) return null;
  const inches = heightCm / 2.54;
  const kg =
    sex === "female"
      ? 45.5 + 2.3 * Math.max(inches - 60, 0)
      : 50 + 2.3 * Math.max(inches - 60, 0);
  return clamp(kg, 40, 120);
}

export function recommendIntakeLocal(input: {
  age?: number | null;
  sex?: Sex | string | null;
  height_cm?: number | null;
  hba1c?: number | null;
  fasting_glucose?: number | null;
}): SugarBarrierResult {
  const age = input.age != null && input.age > 0 ? input.age : 30;
  const sex = (input.sex as Sex | null) ?? null;
  const height = input.height_cm ?? 170;
  const hba1c = input.hba1c ?? null;
  const fasting = input.fasting_glucose ?? null;

  const reasons: string[] = [];
  const weight = idealWeightKg(sex, input.height_cm);

  let calories: number;
  let water: number;
  if (weight == null) {
    calories = sex === "female" ? 1800 : 2000;
    water = sex === "female" ? 7 : 8;
    reasons.push("Using general calorie and water starting points.");
  } else {
    const bmr =
      sex === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age + 5;
    calories = bmr * 1.2;
    const ml = weight * 35;
    water = ml / 250; // 250 ml per cup — same as HydrationCard
    reasons.push(
      `Calorie and water targets from height/sex/age (${sex ?? "unspecified"}, ${Math.round(height)} cm; 250 ml/cup).`,
    );
  }

  let sugar = 50;
  let elevatedLabs = false;
  if (hba1c != null) {
    if (hba1c >= 6.5) {
      sugar = 20;
      calories *= 0.92;
      elevatedLabs = true;
      reasons.push(`HbA1c ${hba1c}% — tighter sugar and calorie caps.`);
    } else if (hba1c >= 5.7) {
      sugar = 30;
      calories *= 0.96;
      elevatedLabs = true;
      reasons.push(`HbA1c ${hba1c}% — moderated sugar and calorie caps.`);
    } else {
      sugar = 50;
      reasons.push(`HbA1c ${hba1c}% is in a typical reference band.`);
    }
  }

  if (fasting != null) {
    const fbg = fasting < 30 ? fasting * 18 : fasting;
    if (fbg >= 126) {
      sugar = Math.min(sugar, 20);
      calories *= 0.92;
      elevatedLabs = true;
      reasons.push(`Fasting glucose ~${Math.round(fbg)} mg/dL is elevated.`);
    } else if (fbg >= 100) {
      sugar = Math.min(sugar, 30);
      calories *= 0.96;
      elevatedLabs = true;
      reasons.push(`Fasting glucose ~${Math.round(fbg)} mg/dL is in a watch band.`);
    }
  }

  if (age >= 50) {
    sugar = Math.max(15, sugar - 5);
    water += 0.5;
    reasons.push("Age 50+ — slightly lower sugar barrier and higher water.");
  }
  if (sex === "female" && (input.height_cm ?? 0) > 0 && (input.height_cm ?? 0) < 165) {
    sugar = Math.max(15, sugar - 3);
  }
  if (elevatedLabs) {
    water += 1;
    reasons.push("Extra water cup recommended when blood-sugar labs are elevated.");
  }

  if (!hba1c && !fasting) {
    reasons.push("No lab values yet — sugar uses a general ~50 g/day guide.");
  }

  sugar = Math.round(clamp(sugar, 15, 60));
  calories = Math.round(clamp(calories, 1200, 3200) / 10) * 10;
  water = Math.round(clamp(water, 6, 16));

  const disclaimer =
    "Educational estimate only — not medical advice. Discuss targets with a clinician.";

  return {
    calories,
    sugar_limit_g: sugar,
    monthly_sugar_limit_g: sugar * 30,
    water_cups: water,
    rationale: `${reasons.join(" ")} ${disclaimer}`,
    source: "rules",
    confidence: hba1c != null || fasting != null ? 0.7 : 0.45,
    based_on: {
      hba1c,
      fasting_glucose: fasting,
      age: input.age ?? null,
      sex,
      height_cm: input.height_cm ?? null,
    },
  };
}
