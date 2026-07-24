import { getToday, localDayKey } from "./date";
import { getEntries } from "./store";
import { buildDailyTotals } from "./nutrition";
import type {
  Confidence,
  DailyTotals,
  DataSource,
  DrinkAnalyzeResponse,
  DrinkConfirmResponse,
  EntryType,
  FoodAnalyzeResponse,
  FoodConfirmResponse,
  IntakeEntry,
  MedicalAnalyzeResponse,
  MedicalConfirmResponse,
  Nutrients,
  UserProfile,
} from "./types";
import { DEFAULT_TARGETS } from "./types";
import { getStoredSession } from "./auth";

/**
 * API layer — all data from the backend (Supabase) + local manual entries.
 * No hardcoded/mock data.
 */

/** Shape of a backend IntakeRecord. */
interface BackendIntake {
  id: number;
  kind: string;
  name: string;
  serving?: string;
  logged_at: string;
  source: string;
  confidence: number;
  confirmed: boolean;
  nutrients: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
    extras?: Record<string, number>;
  };
}

function mapSource(source: string): DataSource {
  const s = (source || "").toLowerCase();
  if (s.includes("ocr") || s.includes("label")) return "label";
  if (s.includes("ai")) return "ai";
  if (s.includes("manual")) return "manual";
  return "database";
}

function mapConfidence(score: number): Confidence {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function adaptBackendIntake(r: BackendIntake): IntakeEntry {
  const extras = r.nutrients.extras ?? {};
  const type: EntryType =
    r.kind === "drink" ? "drink" : r.kind === "water" ? "water" : "food";
  const source = mapSource(r.source);
  const nutrients: Nutrients = {
    calories: r.nutrients.calories,
    carbs_g: r.nutrients.carbs_g,
    totalSugar_g: extras.total_sugar_g ?? r.nutrients.sugar_g,
    addedSugar_g: extras.added_sugar_g ?? 0,
    protein_g: r.nutrients.protein_g,
    fat_g: r.nutrients.fat_g,
    caffeine_mg: extras.caffeine_mg,
  };
  return {
    id: `be_${r.id}`,
    type,
    name: r.name,
    loggedAt: r.logged_at,
    source,
    confidence: source === "manual" ? undefined : mapConfidence(r.confidence),
    confirmed: r.confirmed,
    portion: r.serving,
    volumeMl: extras.drink_volume_ml,
    nutrients,
  };
}

async function fetchBackendEntries(): Promise<IntakeEntry[]> {
  try {
    const res = await fetch("/intakes?limit=300");
    if (!res.ok) return [];
    const rows = (await res.json()) as BackendIntake[];
    if (!Array.isArray(rows)) return [];
    return rows.map(adaptBackendIntake);
  } catch {
    return [];
  }
}

function mergeEntries(
  backend: IntakeEntry[],
  local: IntakeEntry[],
): IntakeEntry[] {
  return [...backend, ...local].sort((a, b) =>
    a.loggedAt < b.loggedAt ? 1 : -1,
  );
}

export function getCurrentUser(): Promise<UserProfile> {
  const session = getStoredSession();
  const profile: UserProfile = {
    id: session?.userId ?? "guest",
    fullName: session?.fullName ?? "User",
    email: session?.email ?? "",
    initials: session?.initials ?? "U",
    subscription: session?.subscription ?? "free",
    targets: DEFAULT_TARGETS,
    goalSource: "user",
    streakDays: 0,
  };
  return Promise.resolve(profile);
}

export async function getAllEntries(): Promise<IntakeEntry[]> {
  const backend = await fetchBackendEntries();
  return mergeEntries(backend, getEntries());
}

export async function getTodayEntries(): Promise<IntakeEntry[]> {
  const today = getToday();
  const all = await getAllEntries();
  return all.filter((e) => localDayKey(e.loggedAt) === today);
}

export async function getTodayTotals(): Promise<DailyTotals> {
  const today = getToday();
  const all = await getAllEntries();
  const todays = all.filter((e) => localDayKey(e.loggedAt) === today);
  return buildDailyTotals(today, todays, DEFAULT_TARGETS);
}

// ---------------------------------------------------------------------------
// Analyze → confirm flow (backend)
// ---------------------------------------------------------------------------

async function apiError(res: Response): Promise<never> {
  let detail: string;
  try {
    const body = await res.json();
    detail = body.detail || body.message || body.error || res.statusText;
  } catch {
    detail = res.statusText;
  }
  if (typeof detail !== "string") detail = JSON.stringify(detail);
  if (res.status === 500 && detail === "Internal Server Error") {
    detail = "The backend encountered an error. Try again or use a different image.";
  }
  throw new Error(detail);
}

export async function analyzeDrink(file: File, userId = "default"): Promise<DrinkAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId);
  const res = await fetch("/api/drinks/analyze", { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmDrink(analysisId: string, drink: unknown, userId = "default"): Promise<DrinkConfirmResponse> {
  const res = await fetch(`/api/drinks/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drink, user_id: userId }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function analyzeFood(file: File, userId = "default"): Promise<FoodAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId);
  const res = await fetch("/api/foods/analyze", { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmFood(analysisId: string, food: unknown, userId = "default", name?: string): Promise<FoodConfirmResponse> {
  const res = await fetch(`/api/foods/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ food, user_id: userId, name: name || null }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function analyzeMedical(file: File, userId = "default"): Promise<MedicalAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId);
  const res = await fetch("/api/medical/analyze", { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmMedical(analysisId: string, metrics: unknown[], userId = "default"): Promise<MedicalConfirmResponse> {
  const res = await fetch(`/api/medical/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, user_id: userId }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

/** Log water volume (ml). Hold-to-fill commits full sips and partials on release. */
export async function logWaterSip(ml = 30, userId = "default"): Promise<{ intake_id: number; ml: number }> {
  const res = await fetch("/api/water/sip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ml }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function deleteIntake(intakeId: number | string): Promise<void> {
  const id = String(intakeId).replace(/^be_/, "");
  const res = await fetch(`/intakes/${id}`, { method: "DELETE" });
  if (!res.ok) await apiError(res);
}
