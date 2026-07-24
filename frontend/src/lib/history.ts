import { buildDailyTotals } from "./nutrition";
import { localDayKey } from "./date";
import type {
  DailyTotals,
  IntakeEntry,
  NutritionTargets,
} from "./types";

/** Local YYYY-MM-DD for an entry (normalizes UTC + naive-local). */
export function dateKey(entry: IntakeEntry): string {
  return localDayKey(entry.loggedAt);
}

/** Group entries by day. */
export function groupByDate(entries: IntakeEntry[]): Map<string, IntakeEntry[]> {
  const map = new Map<string, IntakeEntry[]>();
  for (const entry of entries) {
    const key = dateKey(entry);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export type CalendarStatus =
  | "within"
  | "moderate"
  | "significant"
  | "incomplete"
  | "none";

export const calendarColor: Record<CalendarStatus, string> = {
  within: "bg-teal",
  moderate: "bg-amber",
  significant: "bg-red",
  incomplete: "bg-blue",
  none: "bg-line-2",
};

export const calendarLabel: Record<CalendarStatus, string> = {
  within: "Within target",
  moderate: "Moderately over",
  significant: "Significantly over",
  incomplete: "Incomplete",
  none: "No data",
};

/** Finer-grained status used to colour calendar days. */
export function calendarStatus(
  totals: DailyTotals,
  targets: NutritionTargets,
): CalendarStatus {
  if (totals.entryCount === 0) return "none";

  const calRatio = totals.calories / targets.calories;
  const sugarRatio = totals.totalSugar_g / targets.sugar_g;
  const worst = Math.max(calRatio, sugarRatio);

  // Very little logged for the day.
  if (totals.entryCount < 2 && worst < 0.4) return "incomplete";

  if (worst > 1.25) return "significant";
  if (worst > 1) return "moderate";
  return "within";
}

export interface DayCell {
  /** Day-of-month, or null for padding cells. */
  day: number | null;
  dateIso: string | null;
  status: CalendarStatus | null;
  isFuture: boolean;
}

/**
 * Build a 6-row month grid (Sun-first) with a status per day.
 * `todayIso` marks the boundary between logged past and greyed future.
 */
export function buildMonthGrid(
  year: number,
  month0: number, // 0-indexed month
  byDate: Map<string, IntakeEntry[]>,
  targets: NutritionTargets,
  todayIso: string,
): DayCell[] {
  const first = new Date(year, month0, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: null, dateIso: null, status: null, isFuture: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateIso = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isFuture = dateIso > todayIso;
    const entries = byDate.get(dateIso) ?? [];
    const status = isFuture
      ? "none"
      : calendarStatus(buildDailyTotals(dateIso, entries, targets), targets);
    cells.push({ day: d, dateIso, status: isFuture ? null : status, isFuture });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateIso: null, status: null, isFuture: false });
  }
  // Always 6 weeks so the calendar height stays constant across months.
  while (cells.length < 42) {
    cells.push({ day: null, dateIso: null, status: null, isFuture: false });
  }
  return cells;
}

export interface WeekSummary {
  avgCalories: number;
  avgSugar: number;
  daysWithinTarget: number;
  daysConsidered: number;
  daysLogged: number;
}

/**
 * Rolling summary over the `days` days ending at (and including) endIso.
 * Averages are computed over days that have logs (analytics use confirmed
 * data only — all seeded/saved entries are confirmed).
 */
export function weekSummary(
  byDate: Map<string, IntakeEntry[]>,
  targets: NutritionTargets,
  endIso: string,
  days = 7,
): WeekSummary {
  const end = new Date(`${endIso}T00:00:00`);
  let calSum = 0;
  let sugarSum = 0;
  let logged = 0;
  let within = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entries = byDate.get(key);
    if (!entries || entries.length === 0) continue;
    const totals = buildDailyTotals(key, entries, targets);
    logged += 1;
    calSum += totals.calories;
    sugarSum += totals.totalSugar_g;
    if (
      totals.calories <= targets.calories &&
      totals.totalSugar_g <= targets.sugar_g
    ) {
      within += 1;
    }
  }

  return {
    avgCalories: logged ? Math.round(calSum / logged) : 0,
    avgSugar: logged ? Math.round(sugarSum / logged) : 0,
    daysWithinTarget: within,
    daysConsidered: days,
    daysLogged: logged,
  };
}
