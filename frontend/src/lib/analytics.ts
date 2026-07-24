import { buildDailyTotals } from "./nutrition";
import { groupByDate } from "./history";
import { localDayKey } from "./date";
import type { IntakeEntry, NutritionTargets } from "./types";

/** Premium analytics derived from confirmed entries. */

export interface SugarSource {
  name: string;
  grams: number;
  percent: number;
}

export interface InsightsData {
  periodDays: number;
  loggedDays: number;
  afternoonPattern: { count: number; days: number };
  sources: SugarSource[];
  weekOverWeekPercent: number | null; // negative = decrease
  correlation: { highSugarDays: number; alsoAboveCalories: number } | null;
  dataQuality: { completeDays: number; totalDays: number };
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodKeys(endIso: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(endIso, -i));
}

function inPeriod(entries: IntakeEntry[], endIso: string, days: number): IntakeEntry[] {
  const start = addDays(endIso, -(days - 1));
  return entries.filter((e) => {
    const key = localDayKey(e.loggedAt);
    return key >= start && key <= endIso;
  });
}

/** Top drink-sugar sources over the period, as % of recorded drink sugar. */
function drinkSugarSources(period: IntakeEntry[]): SugarSource[] {
  const byName = new Map<string, number>();
  let total = 0;
  for (const e of period) {
    if (e.type !== "drink") continue;
    const g = e.nutrients.totalSugar_g;
    if (g <= 0) continue;
    byName.set(e.name, (byName.get(e.name) ?? 0) + g);
    total += g;
  }
  if (total === 0) return [];
  return [...byName.entries()]
    .map(([name, grams]) => ({
      name,
      grams: Math.round(grams),
      percent: Math.round((grams / total) * 100),
    }))
    .sort((a, b) => b.grams - a.grams)
    .slice(0, 3);
}

/** Days (of last 7) with a sweetened drink logged after 3 PM. */
function afternoonSweetDrink(entries: IntakeEntry[], endIso: string): {
  count: number;
  days: number;
} {
  const keys = periodKeys(endIso, 7);
  let count = 0;
  for (const key of keys) {
    const has = entries.some((e) => {
      if (localDayKey(e.loggedAt) !== key) return false;
      if (e.type !== "drink" || e.nutrients.totalSugar_g <= 0) return false;
      const hour = new Date(e.loggedAt).getHours();
      return hour >= 15;
    });
    if (has) count += 1;
  }
  return { count, days: 7 };
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Daily values for a metric over the period (oldest → newest), for charts.
 * Days with no logs contribute 0.
 */
export function dailySeries(
  entries: IntakeEntry[],
  targets: NutritionTargets,
  endIso: string,
  periodDays: number,
  metric: "totalSugar_g" | "calories" = "totalSugar_g",
): SeriesPoint[] {
  const byDate = groupByDate(entries);
  const keys = periodKeys(endIso, periodDays).reverse(); // oldest first
  return keys.map((key) => {
    const dayEntries = byDate.get(key) ?? [];
    const totals = buildDailyTotals(key, dayEntries, targets);
    const d = new Date(`${key}T00:00:00`);
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: metric === "calories" ? totals.calories : totals.totalSugar_g,
    };
  });
}

export function computeInsights(
  entries: IntakeEntry[],
  targets: NutritionTargets,
  endIso: string,
  periodDays: number,
): InsightsData {
  const byDate = groupByDate(entries);
  const period = inPeriod(entries, endIso, periodDays);

  // Days logged + complete (>= 2 food entries) within the period.
  let loggedDays = 0;
  let completeDays = 0;
  let highSugarDays = 0;
  let alsoAboveCalories = 0;

  for (const key of periodKeys(endIso, periodDays)) {
    const dayEntries = byDate.get(key);
    if (!dayEntries || dayEntries.length === 0) continue;
    loggedDays += 1;
    const foods = dayEntries.filter((e) => e.type === "food").length;
    if (foods >= 2) completeDays += 1;
    const totals = buildDailyTotals(key, dayEntries, targets);
    if (totals.totalSugar_g > targets.sugar_g) {
      highSugarDays += 1;
      if (totals.calories > targets.calories) alsoAboveCalories += 1;
    }
  }

  // Week-over-week total-sugar average (7-day windows).
  const avg = (end: string): number | null => {
    let sum = 0;
    let n = 0;
    for (const key of periodKeys(end, 7)) {
      const de = byDate.get(key);
      if (!de || de.length === 0) continue;
      sum += buildDailyTotals(key, de, targets).totalSugar_g;
      n += 1;
    }
    return n ? sum / n : null;
  };
  const thisAvg = avg(endIso);
  const prevAvg = avg(addDays(endIso, -7));
  const weekOverWeekPercent =
    thisAvg !== null && prevAvg !== null && prevAvg > 0
      ? Math.round(((thisAvg - prevAvg) / prevAvg) * 100)
      : null;

  return {
    periodDays,
    loggedDays,
    afternoonPattern: afternoonSweetDrink(entries, endIso),
    sources: drinkSugarSources(period),
    weekOverWeekPercent,
    correlation:
      highSugarDays > 0 ? { highSugarDays, alsoAboveCalories } : null,
    dataQuality: { completeDays, totalDays: periodDays },
  };
}
