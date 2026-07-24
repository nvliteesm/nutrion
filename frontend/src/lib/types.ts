/**
 * NutriON domain models.
 *
 * A single unified "intake" entry represents food, a drink, or water
 * (water is just the simplest drink). Daily totals are computed by summing
 * the *consumed* nutrients across a day's entries.
 *
 * Product rules baked into these types:
 *  - Sugar is tracked in grams; energy in kilocalories.
 *  - Carbohydrates and sugar are distinct fields.
 *  - Every entry records its data source and (for extracted/estimated data)
 *    a confidence level plus a confirmed flag. Only confirmed data feeds
 *    analytics.
 */

export type EntryType = "food" | "drink" | "water";

/** Where the numbers came from. */
export type DataSource = "label" | "manual" | "database" | "ai";

/** Confidence for OCR- or AI-derived data. Absent for manual entries. */
export type Confidence = "high" | "medium" | "low";

/** Daily target status, drives the calendar colours and dashboard pills. */
export type DailyStatus =
  | "within" // green
  | "approaching" // teal/amber-ish, close to target
  | "above" // over target
  | "incomplete" // logged, but partial day
  | "no_data"; // nothing logged

export type Subscription = "free" | "premium";

/** All nutrient values are the *consumed* amounts for an entry. */
export interface Nutrients {
  calories: number;
  carbs_g: number;
  totalSugar_g: number;
  addedSugar_g: number;
  protein_g: number;
  fat_g: number;
  /** Drinks only. Milligrams is correct for caffeine (sugar stays in grams). */
  caffeine_mg?: number;
}

export interface IntakeEntry {
  id: string;
  type: EntryType;
  name: string;
  /** ISO timestamp of when it was consumed. */
  loggedAt: string;
  source: DataSource;
  confidence?: Confidence;
  confirmed: boolean;
  /** Human-readable portion, e.g. "1 can (355 ml)" or "1 bowl (240 g)". */
  portion?: string;
  /** Volume in millilitres for drinks and water. */
  volumeMl?: number;
  nutrients: Nutrients;
  /**
   * AI estimates are shown as ranges to avoid false precision.
   * When present, `nutrients.calories` holds the midpoint.
   */
  caloriesRange?: [number, number];
  notes?: string;
}

/** Per-day nutrition targets. */
export interface NutritionTargets {
  calories: number;
  addedSugar_g: number;
  /** Hydration goal expressed in cups. */
  water_cups: number;
}

export type GoalSource = "user" | "nutrion";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  /** Avatar initials, e.g. "MK". */
  initials: string;
  subscription: Subscription;
  targets: NutritionTargets;
  goalSource: GoalSource;
  streakDays: number;
}

/** Aggregated totals for a single day. */
export interface DailyTotals {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  calories: number;
  carbs_g: number;
  totalSugar_g: number;
  addedSugar_g: number;
  protein_g: number;
  fat_g: number;
  water_cups: number;
  entryCount: number;
  confirmedCount: number;
  status: DailyStatus;
}
