import type {
  DailyStatus,
  DailyTotals,
  IntakeEntry,
  NutritionTargets,
  Nutrients,
} from "./types";

const emptyNutrients = (): Nutrients => ({
  calories: 0,
  carbs_g: 0,
  totalSugar_g: 0,
  addedSugar_g: 0,
  protein_g: 0,
  fat_g: 0,
  caffeine_mg: 0,
});

/** Sum consumed nutrients across a set of entries. */
export function sumNutrients(entries: IntakeEntry[]): Nutrients {
  return entries.reduce<Nutrients>((acc, entry) => {
    acc.calories += entry.nutrients.calories;
    acc.carbs_g += entry.nutrients.carbs_g;
    acc.totalSugar_g += entry.nutrients.totalSugar_g;
    acc.addedSugar_g += entry.nutrients.addedSugar_g;
    acc.protein_g += entry.nutrients.protein_g;
    acc.fat_g += entry.nutrients.fat_g;
    acc.caffeine_mg = (acc.caffeine_mg ?? 0) + (entry.nutrients.caffeine_mg ?? 0);
    return acc;
  }, emptyNutrients());
}

/** Count hydration in cups from water entries (~250 ml per cup). */
export function waterCups(entries: IntakeEntry[]): number {
  const ml = entries
    .filter((e) => e.type === "water")
    .reduce((total, e) => total + (e.volumeMl ?? 0), 0);
  return Math.round(ml / 250);
}

/**
 * Derive a day's target status.
 *
 * Product rule: exceeding a target never punishes the user or reduces a
 * future target — this only classifies today for display.
 */
export function deriveStatus(
  totals: Pick<Nutrients, "calories" | "addedSugar_g">,
  targets: NutritionTargets,
  entryCount: number,
): DailyStatus {
  if (entryCount === 0) return "no_data";

  const calRatio = totals.calories / targets.calories;
  const sugarRatio = totals.addedSugar_g / targets.addedSugar_g;
  const worst = Math.max(calRatio, sugarRatio);

  // Very light logging for the day — treat as incomplete rather than "within".
  if (entryCount < 2 && worst < 0.4) return "incomplete";

  if (worst > 1) return "above";
  if (worst >= 0.85) return "approaching";
  return "within";
}

/** Build aggregated totals for a single day from its entries. */
export function buildDailyTotals(
  date: string,
  entries: IntakeEntry[],
  targets: NutritionTargets,
): DailyTotals {
  const totals = sumNutrients(entries);
  const confirmedCount = entries.filter((e) => e.confirmed).length;
  return {
    date,
    calories: Math.round(totals.calories),
    carbs_g: Math.round(totals.carbs_g),
    totalSugar_g: Math.round(totals.totalSugar_g),
    addedSugar_g: Math.round(totals.addedSugar_g),
    protein_g: Math.round(totals.protein_g),
    fat_g: Math.round(totals.fat_g),
    water_cups: waterCups(entries),
    entryCount: entries.length,
    confirmedCount,
    status: deriveStatus(totals, targets, entries.length),
  };
}

/** Clamp a 0..1 progress value for bars/rings. */
export function progress(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

/**
 * Parse a numeric input value, rejecting NaN and negatives.
 * Optionally clamp to a maximum. Used across all nutrition number inputs.
 */
export function parseNonNegative(raw: string | number, max?: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (max !== undefined && n > max) return max;
  return n;
}
