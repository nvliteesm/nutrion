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
  | "within"
  | "approaching"
  | "above"
  | "incomplete"
  | "no_data";

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
  /** Total sugar target in grams. */
  sugar_g: number;
  /** Hydration goal expressed in cups. */
  water_cups: number;
}

export type GoalSource = "user" | "nutrion";

/** Default targets for new users (before they customize). */
export const DEFAULT_TARGETS: NutritionTargets = {
  calories: 2000,
  sugar_g: 60,
  water_cups: 8,
};

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

/** Values extracted from a scanned drink nutrition label (per serving). */
export interface ExtractedDrink {
  productName: string;
  servingSizeMl: number;
  servingsPerContainer: number;
  caloriesPerServing: number;
  carbs_g: number;
  totalSugar_g: number;
  addedSugar_g: number;
  caffeine_mg?: number;
  confidence: Confidence;
  /** Field keys the OCR was less sure about — highlighted for the user. */
  lowConfidenceFields: string[];
}

/** A metric extracted from a medical report (Premium). */
export interface MedicalMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  /** Numeric reference bounds where available (open-ended if undefined). */
  refLow?: number;
  refHigh?: number;
  referenceText: string;
  page: number;
  confidence: Confidence;
  confirmed: boolean;
}

/** A single food item detected in a photo (per-serving estimate). */
export interface DetectedFoodItem {
  id: string;
  name: string;
  /** Portion unit label, e.g. "cup" or "120 g". */
  unit: string;
  /** Number of servings the user has dialled in. */
  servings: number;
  perServingRange: [number, number];
  perServingNutrients: Nutrients;
}

export interface FoodAnalysis {
  items: DetectedFoodItem[];
  confidence: Confidence;
}

/** A saved meal/drink the user can re-log quickly. */
export interface Favorite {
  id: string;
  type: EntryType;
  name: string;
  portion?: string;
  volumeMl?: number;
  nutrients: Nutrients;
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

export type ConfirmationStatus = "pending" | "confirmed" | "rejected";
export type MetricStatus = "high" | "normal" | "low" | "unknown";
export type MedicalCategory = "blood_sugar" | "lipid_profile" | "other";
export type ScanMode = "drink" | "food" | "medical";

/** Supported medical report metrics only (Blood Sugar + Lipid Profile). */
export const MEDICAL_METRIC_GROUPS = [
  {
    category: "blood_sugar" as const,
    title: "Blood Sugar",
    metrics: ["HbA1c", "Fasting Blood Glucose"] as const,
  },
  {
    category: "lipid_profile" as const,
    title: "Lipid Profile",
    metrics: [
      "Total Cholesterol",
      "LDL",
      "HDL",
      "Triglycerides",
    ] as const,
  },
] as const;

export interface DrinkLabelData {
  product_name: string;
  serving_size: string;
  servings_per_container: number | null;
  calories: number;
  carbohydrates_g: number;
  total_sugar_g: number;
  added_sugar_g: number;
  drink_volume_ml: number | null;
  sodium_mg: number | null;
  caffeine_mg: number | null;
  confidence: number;
  confirmation_status: ConfirmationStatus;
  raw_text: string;
}

export interface DrinkAnalyzeResponse {
  analysis_id: string;
  drink: DrinkLabelData;
  message: string;
}

export interface DrinkConfirmResponse {
  analysis_id: string;
  intake_id: number;
  drink: DrinkLabelData;
  message: string;
}

export interface FoodItemEstimate {
  name: string;
  portion: string;
  portion_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  calories_low: number | null;
  calories_high: number | null;
  confidence: number;
}

export interface FoodAnalysisData {
  items: FoodItemEstimate[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  total_sugar_g: number;
  total_sodium_mg: number;
  confidence: number;
  confirmation_status: ConfirmationStatus;
  description: string;
  raw_text: string;
}

export interface FoodAnalyzeResponse {
  analysis_id: string;
  food: FoodAnalysisData;
  message: string;
}

export interface FoodConfirmResponse {
  analysis_id: string;
  intake_id: number;
  food: FoodAnalysisData;
  message: string;
}

export interface MedicalMetricData {
  metric_name: string;
  category: MedicalCategory;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  reference_range_text: string;
  status: MetricStatus;
  test_date: string | null;
  source_page: number | null;
  extraction_confidence: number;
  confirmed: boolean;
}

export interface MedicalAnalyzeResponse {
  analysis_id: string;
  metrics: MedicalMetricData[];
  raw_text: string;
  message: string;
}

export interface MedicalConfirmResponse {
  analysis_id: string;
  report_id: number;
  metric_ids: number[];
  metrics: MedicalMetricData[];
  message: string;
}
