import { buildDailyTotals, saltFromSodiumMg, sumNutrients, waterCups } from "./nutrition";
import { groupByDate } from "./history";
import { localDayKey } from "./date";
import type { IntakeEntry, NutritionTargets } from "./types";

/** Premium analytics derived from confirmed entries. */

export interface SugarSource {
  name: string;
  grams: number;
  percent: number;
}

export interface RankedItem {
  name: string;
  value: number;
  unit: string;
}

export interface HabitStat {
  label: string;
  value: string;
  note: string;
}

export interface ComparisonBar {
  key: string;
  label: string;
  value: number;
  display: string;
  /** 0–100 relative to period target / peer max. */
  percent: number;
  colorClass: string;
  /** Absolute daily target used for per-day charts. */
  dailyTarget?: number;
  /** Average per logged/calendar day. */
  avgPerDay?: number;
  avgDisplay?: string;
}

export interface DailyBalancePoint {
  label: string;
  /** Short weekday for tight charts. */
  shortLabel: string;
  sodiumMg: number;
  saltG: number;
  waterCups: number;
  /** % of daily target (may exceed 100). */
  sodiumPct: number;
  saltPct: number;
  waterPct: number;
}

export interface DailyBalanceSeries {
  points: DailyBalancePoint[];
  /** True when points are weekly aggregates. */
  weekly: boolean;
  averages: {
    sodiumMg: number;
    saltG: number;
    waterCups: number;
    sodiumPct: number;
    saltPct: number;
    waterPct: number;
  };
  dailyTargets: {
    sodiumMg: number;
    saltG: number;
    waterCups: number;
  };
}

export interface MacroAccum {
  key: string;
  label: string;
  value: number;
  unit: string;
  colorClass: string;
}

export interface InsightsData {
  periodDays: number;
  loggedDays: number;
  afternoonPattern: { count: number; days: number };
  sources: SugarSource[];
  calorieMeals: RankedItem[];
  habits: HabitStat[];
  comparison: ComparisonBar[];
  macros: MacroAccum[];
  weekOverWeekPercent: number | null; // negative = decrease
  correlation: { highSugarDays: number; alsoAboveCalories: number } | null;
  dataQuality: {
    completeDays: number;
    totalDays: number;
    confirmed: number;
    estimated: number;
    lowConfidence: number;
    incompleteDays: number;
  };
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

/** Top calorie-contributing meals (food entries). */
function topCalorieMeals(period: IntakeEntry[]): RankedItem[] {
  const byName = new Map<string, number>();
  for (const e of period) {
    if (e.type !== "food") continue;
    if (e.nutrients.calories <= 0) continue;
    byName.set(e.name, (byName.get(e.name) ?? 0) + e.nutrients.calories);
  }
  return [...byName.entries()]
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      unit: "kcal",
    }))
    .sort((a, b) => b.value - a.value)
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

function habitStats(
  period: IntakeEntry[],
  byDate: Map<string, IntakeEntry[]>,
  endIso: string,
  periodDays: number,
  targets: NutritionTargets,
): HabitStat[] {
  const foodDrink = period.filter((e) => e.type === "food" || e.type === "drink");
  const nameCounts = new Map<string, number>();
  for (const e of foodDrink) {
    nameCounts.set(e.name, (nameCounts.get(e.name) ?? 0) + 1);
  }
  const topLogged = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const hourBuckets = new Map<number, number>();
  for (const e of foodDrink) {
    const h = new Date(e.loggedAt).getHours();
    hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
  }
  const topHour = [...hourBuckets.entries()].sort((a, b) => b[1] - a[1])[0];

  let highestSugarDay: { key: string; sugar: number } | null = null;
  let incompleteDay: { key: string; note: string } | null = null;

  for (const key of periodKeys(endIso, periodDays)) {
    const dayEntries = byDate.get(key) ?? [];
    if (dayEntries.length === 0) continue;
    const totals = buildDailyTotals(key, dayEntries, targets);
    if (!highestSugarDay || totals.addedSugar_g > highestSugarDay.sugar) {
      highestSugarDay = { key, sugar: totals.addedSugar_g || totals.totalSugar_g };
    }
    const foods = dayEntries.filter((e) => e.type === "food");
    if (foods.length < 2 && !incompleteDay) {
      incompleteDay = {
        key,
        note: foods.length === 0 ? "meals missing" : "dinner missing",
      };
    }
  }

  const weekday = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });

  const hourLabel = (h: number) => {
    const fmt = (hour: number) => {
      const h12 = hour % 12 || 12;
      return `${h12} ${hour < 12 ? "AM" : "PM"}`;
    };
    return `${fmt(h).replace(/ (AM|PM)/, "")}–${fmt((h + 1) % 24)}`;
  };

  const habitAnchor = (h: number) => {
    if (h >= 5 && h < 10) return "breakfast is your habit anchor.";
    if (h >= 10 && h < 14) return "lunch is your habit anchor.";
    if (h >= 14 && h < 17) return "afternoon snacks stand out.";
    if (h >= 17 && h < 21) return "dinner is your habit anchor.";
    return "late logging is common.";
  };

  return [
    {
      label: "Most logged food",
      value: topLogged ? topLogged[0] : "—",
      note: topLogged ? `${topLogged[1]}× this period` : "No food logs yet",
    },
    {
      label: "Most common log time",
      value: topHour ? hourLabel(topHour[0]) : "—",
      note: topHour ? habitAnchor(topHour[0]) : "Not enough logs",
    },
    {
      label: "Highest-sugar day",
      value: highestSugarDay ? weekday(highestSugarDay.key) : "—",
      note: highestSugarDay
        ? `${Math.round(highestSugarDay.sugar)} g sugar`
        : "No sugar logged",
    },
    {
      label: "Most incomplete day",
      value: incompleteDay ? weekday(incompleteDay.key) : "—",
      note: incompleteDay?.note ?? "Logging looks complete",
    },
  ];
}

/** Sodium / salt / water bars as % of period-level targets. */
function comparisonBars(
  period: IntakeEntry[],
  periodDays: number,
  targets: NutritionTargets,
): ComparisonBar[] {
  const nutrients = sumNutrients(period);
  const sodium = nutrients.sodium_mg ?? 0;
  const saltG = saltFromSodiumMg(sodium);
  const water = waterCups(period);

  const sodiumTarget = 2300 * periodDays;
  const saltTarget = 5 * periodDays;
  const waterTarget = Math.max(targets.water_cups * periodDays, 1);

  const pct = (v: number, t: number) =>
    Math.min(100, Math.round((v / Math.max(t, 1)) * 100));

  return [
    {
      key: "sodium",
      label: "Sodium",
      value: sodium,
      display: `${Math.round(sodium)} mg`,
      percent: pct(sodium, sodiumTarget),
      colorClass: "bg-amber",
      dailyTarget: 2300,
      avgPerDay: sodium / periodDays,
      avgDisplay: `${Math.round(sodium / periodDays)} mg/day`,
    },
    {
      key: "salt",
      label: "Salt",
      value: saltG,
      display: `${saltG.toFixed(1)} g`,
      percent: pct(saltG, saltTarget),
      colorClass: "bg-red",
      dailyTarget: 5,
      avgPerDay: saltG / periodDays,
      avgDisplay: `${(saltG / periodDays).toFixed(1)} g/day`,
    },
    {
      key: "water",
      label: "Water",
      value: water,
      display: `${water} cups`,
      percent: pct(water, waterTarget),
      colorClass: "bg-blue",
      dailyTarget: targets.water_cups,
      avgPerDay: water / periodDays,
      avgDisplay: `${(water / periodDays).toFixed(1)} cups/day`,
    },
  ];
}

const SODIUM_DAILY_MG = 2300;
const SALT_DAILY_G = 5;

/**
 * Per-day sodium / salt / water for Insights charts.
 * Short periods show each day; longer periods aggregate by week.
 */
export function dailySodiumSaltWater(
  entries: IntakeEntry[],
  targets: NutritionTargets,
  endIso: string,
  periodDays: number,
): DailyBalanceSeries {
  const byDate = groupByDate(entries);
  const keys = periodKeys(endIso, periodDays).reverse(); // oldest → newest
  const waterTarget = Math.max(targets.water_cups, 1);

  const daily: DailyBalancePoint[] = keys.map((key) => {
    const dayEntries = byDate.get(key) ?? [];
    const sodiumMg = Math.round(
      dayEntries.reduce((s, e) => s + (e.nutrients.sodium_mg ?? 0), 0),
    );
    const saltG = Math.round(saltFromSodiumMg(sodiumMg) * 10) / 10;
    const cups = waterCups(dayEntries);
    const d = new Date(`${key}T12:00:00`);
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      shortLabel: d.toLocaleDateString("en-US", { weekday: "short" }),
      sodiumMg,
      saltG,
      waterCups: cups,
      sodiumPct: Math.round((sodiumMg / SODIUM_DAILY_MG) * 100),
      saltPct: Math.round((saltG / SALT_DAILY_G) * 100),
      waterPct: Math.round((cups / waterTarget) * 100),
    };
  });

  const weekly = periodDays > 14;
  let points = daily;

  if (weekly) {
    const chunks: DailyBalancePoint[][] = [];
    for (let i = 0; i < daily.length; i += 7) {
      chunks.push(daily.slice(i, i + 7));
    }
    points = chunks.map((chunk, idx) => {
      const n = chunk.length || 1;
      const sodiumMg = Math.round(
        chunk.reduce((s, p) => s + p.sodiumMg, 0) / n,
      );
      const saltG =
        Math.round((chunk.reduce((s, p) => s + p.saltG, 0) / n) * 10) / 10;
      const cups =
        Math.round((chunk.reduce((s, p) => s + p.waterCups, 0) / n) * 10) / 10;
      const start = chunk[0]?.label ?? `W${idx + 1}`;
      const end = chunk[chunk.length - 1]?.label ?? start;
      return {
        label: start === end ? start : `${start}–${end}`,
        shortLabel: `W${idx + 1}`,
        sodiumMg,
        saltG,
        waterCups: cups,
        sodiumPct: Math.round((sodiumMg / SODIUM_DAILY_MG) * 100),
        saltPct: Math.round((saltG / SALT_DAILY_G) * 100),
        waterPct: Math.round((cups / waterTarget) * 100),
      };
    });
  }

  const avg = (pick: (p: DailyBalancePoint) => number) =>
    daily.length
      ? daily.reduce((s, p) => s + pick(p), 0) / daily.length
      : 0;

  const averages = {
    sodiumMg: Math.round(avg((p) => p.sodiumMg)),
    saltG: Math.round(avg((p) => p.saltG) * 10) / 10,
    waterCups: Math.round(avg((p) => p.waterCups) * 10) / 10,
    sodiumPct: Math.round(avg((p) => p.sodiumPct)),
    saltPct: Math.round(avg((p) => p.saltPct)),
    waterPct: Math.round(avg((p) => p.waterPct)),
  };

  return {
    points,
    weekly,
    averages,
    dailyTargets: {
      sodiumMg: SODIUM_DAILY_MG,
      saltG: SALT_DAILY_G,
      waterCups: waterTarget,
    },
  };
}

function macroAccum(period: IntakeEntry[]): MacroAccum[] {
  const n = sumNutrients(period);
  return [
    {
      key: "carbs",
      label: "Carbs",
      value: Math.round(n.carbs_g),
      unit: "g",
      colorClass: "bg-teal-t text-teal-d",
    },
    {
      key: "protein",
      label: "Protein",
      value: Math.round(n.protein_g),
      unit: "g",
      colorClass: "bg-blue-t text-blue-d",
    },
    {
      key: "fat",
      label: "Fat",
      value: Math.round(n.fat_g),
      unit: "g",
      colorClass: "bg-amber-t text-amber-d",
    },
    {
      key: "sugar",
      label: "Sugar",
      value: Math.round(n.totalSugar_g),
      unit: "g",
      colorClass: "bg-red-t text-red-d",
    },
  ];
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
  metric: "totalSugar_g" | "calories" | "sodium_mg" | "water_cups" = "totalSugar_g",
): SeriesPoint[] {
  const byDate = groupByDate(entries);
  const keys = periodKeys(endIso, periodDays).reverse(); // oldest first
  return keys.map((key) => {
    const dayEntries = byDate.get(key) ?? [];
    const totals = buildDailyTotals(key, dayEntries, targets);
    const d = new Date(`${key}T00:00:00`);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (metric === "calories") return { label, value: totals.calories };
    if (metric === "water_cups") return { label, value: totals.water_cups };
    if (metric === "sodium_mg") {
      const sodium = dayEntries.reduce(
        (s, e) => s + (e.nutrients.sodium_mg ?? 0),
        0,
      );
      return { label, value: Math.round(sodium) };
    }
    return { label, value: totals.totalSugar_g };
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

  let loggedDays = 0;
  let completeDays = 0;
  let highSugarDays = 0;
  let alsoAboveCalories = 0;
  let confirmed = 0;
  let estimated = 0;
  let lowConfidence = 0;

  for (const e of period) {
    if (e.confirmed) confirmed += 1;
    else estimated += 1;
    if (e.confidence === "low") lowConfidence += 1;
  }

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
    calorieMeals: topCalorieMeals(period),
    habits: habitStats(period, byDate, endIso, periodDays, targets),
    comparison: comparisonBars(period, periodDays, targets),
    macros: macroAccum(period),
    weekOverWeekPercent,
    correlation:
      highSugarDays > 0 ? { highSugarDays, alsoAboveCalories } : null,
    dataQuality: {
      completeDays,
      totalDays: periodDays,
      confirmed,
      estimated,
      lowConfidence,
      incompleteDays: periodDays - completeDays,
    },
  };
}
