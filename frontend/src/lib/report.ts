import { buildDailyTotals } from "./nutrition";
import { groupByDate } from "./history";
import { computeInsights } from "./analytics";
import { getMedicalMetrics } from "./store";
import { outOfRange } from "./medical";
import type { IntakeEntry, MedicalMetric, NutritionTargets } from "./types";

export interface PersonalReport {
  fullName: string;
  periodLabel: string;
  periodDays: number;
  avgCalories: number;
  avgAddedSugar: number;
  daysWithinTarget: number;
  totalDays: number;
  loggingCompleteness: number; // 0..100
  topSugarSources: string[];
  keyPatterns: string[];
  questionsForProfessional: string[];
  confirmedMetrics: MedicalMetric[];
  outOfRangeMetrics: string[];
  disclaimer: string;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function generateReport(
  fullName: string,
  entries: IntakeEntry[],
  targets: NutritionTargets,
  endIso: string,
  periodDays: number,
): PersonalReport {
  const startIso = addDays(endIso, -(periodDays - 1));
  const byDate = groupByDate(entries);
  const insights = computeInsights(entries, targets, endIso, periodDays);

  // Averages
  let calSum = 0;
  let sugarSum = 0;
  let logged = 0;
  let within = 0;
  let complete = 0;

  for (let i = 0; i < periodDays; i++) {
    const key = addDays(endIso, -i);
    const dayEntries = byDate.get(key);
    if (!dayEntries || dayEntries.length === 0) continue;
    logged += 1;
    const totals = buildDailyTotals(key, dayEntries, targets);
    calSum += totals.calories;
    sugarSum += totals.addedSugar_g;
    if (totals.calories <= targets.calories && totals.addedSugar_g <= targets.addedSugar_g) {
      within += 1;
    }
    const foods = dayEntries.filter((e) => e.type === "food").length;
    if (foods >= 2) complete += 1;
  }

  const avgCalories = logged ? Math.round(calSum / logged) : 0;
  const avgAddedSugar = logged ? Math.round(sugarSum / logged) : 0;
  const loggingCompleteness = periodDays ? Math.round((complete / periodDays) * 100) : 0;

  // Patterns
  const patterns: string[] = [];
  if (insights.weekOverWeekPercent !== null) {
    if (insights.weekOverWeekPercent <= 0) {
      patterns.push(
        `Added sugar trended down ${Math.abs(insights.weekOverWeekPercent)}% over the period.`,
      );
    } else {
      patterns.push(
        `Added sugar trended up ${insights.weekOverWeekPercent}% over the period.`,
      );
    }
  }
  if (insights.sources.length > 0) {
    patterns.push(
      `${insights.sources[0].name} remained the largest single sugar source (~${insights.sources[0].percent}%).`,
    );
  }
  if (insights.afternoonPattern.count >= 4) {
    patterns.push("Most over-target days correlated with afternoon sweetened drinks.");
  }

  // Medical
  const confirmed = getMedicalMetrics();
  const outNames = confirmed.filter(outOfRange).map((m) => m.name);

  const startLabel = new Date(`${startIso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endLabel = new Date(`${endIso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    fullName,
    periodLabel: `${startLabel} – ${endLabel}`,
    periodDays,
    avgCalories,
    avgAddedSugar,
    daysWithinTarget: within,
    totalDays: periodDays,
    loggingCompleteness,
    topSugarSources: insights.sources.map((s) => `${s.name} (${s.percent}%)`),
    keyPatterns: patterns,
    questionsForProfessional: [
      '"Is my added-sugar target of 40 g/day appropriate for me?"',
      '"How might my weekend eating patterns fit into my overall goals?"',
    ],
    confirmedMetrics: confirmed,
    outOfRangeMetrics: outNames,
    disclaimer:
      "AI-generated educational summary from your confirmed data. This report is not a medical diagnosis.",
  };
}
