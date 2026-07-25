import { getToday, localDayKey } from "./date";
import { deleteEntry, getEntries, updateEntry } from "./store";
import { buildDailyTotals } from "./nutrition";
import { getStoredProfile } from "./profile";
import { getCurrentUserId, getStoredSession } from "./auth";
import { apiFetch } from "./apiFetch";
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
  MedicalReportSummary,
  Nutrients,
  SugarBarrierResult,
  UserProfile,
} from "./types";

/**
 * API layer — all data from the backend (Supabase) + local manual entries.
 * No hardcoded/mock data.
 */

/**
 * Long AI analyze calls (15–90s) go straight to FastAPI in the browser.
 * Next.js rewrites drop mid-request when Turbopack recompiles, which was
 * surfacing as "backend restarted or timed out" on food/medical upload.
 */
function analyzeApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return "http://127.0.0.1:8000";
  return "";
}

function analyzeUrl(path: string): string {
  const base = analyzeApiBase();
  return base ? `${base}${path}` : path;
}

/** Shape of a backend IntakeRecord. */
interface BackendIntake {
  id: number;
  user_id?: string;
  kind: string;
  name: string;
  serving?: string;
  logged_at: string;
  source: string;
  confidence: number;
  confirmed: boolean;
  file_path?: string;
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

function filePathToUrl(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const name = filePath.replace(/\\/g, "/").split("/").pop();
  if (!name) return undefined;
  return `/uploads/${name}`;
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
    sodium_mg: r.nutrients.sodium_mg ?? 0,
    caffeine_mg: extras.caffeine_mg,
  };
  return {
    id: `be_${r.id}`,
    userId: r.user_id || getCurrentUserId(),
    type,
    name: r.name,
    loggedAt: r.logged_at,
    source,
    confidence: source === "manual" ? undefined : mapConfidence(r.confidence),
    confirmed: r.confirmed,
    portion: r.serving,
    volumeMl: extras.drink_volume_ml,
    imageUrl: filePathToUrl(r.file_path),
    nutrients,
  };
}

async function fetchBackendEntries(): Promise<IntakeEntry[]> {
  try {
    const userId = getCurrentUserId();
    const q = new URLSearchParams({
      user_id: userId,
      limit: "300",
    });
    const res = await apiFetch(`/intakes?${q}`);
    if (!res.ok) return [];
    const rows = (await res.json()) as BackendIntake[];
    if (!Array.isArray(rows)) return [];
    return rows.map(adaptBackendIntake);
  } catch {
    return [];
  }
}

/** In-flight / short-lived cache so Today + TopNav don't triple-hit /intakes. */
let entriesInflight: Promise<IntakeEntry[]> | null = null;
let entriesCache: { userId: string; at: number; rows: IntakeEntry[] } | null =
  null;
const ENTRIES_TTL_MS = 2500;

function mergeEntries(
  backend: IntakeEntry[],
  local: IntakeEntry[],
): IntakeEntry[] {
  const userId = getCurrentUserId();
  const scoped = [...backend, ...local].filter(
    (e) => !e.userId || e.userId === userId,
  );
  return scoped.sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

export function getCurrentUser(): Promise<UserProfile> {
  const session = getStoredSession();
  const stored = getStoredProfile();
  const profile: UserProfile = {
    id: session?.userId ?? "guest",
    fullName: session?.fullName ?? "User",
    email: session?.email ?? "",
    initials: session?.initials ?? "U",
    subscription: session?.subscription ?? "free",
    targets: stored.targets,
    goalSource: stored.goalSource,
    streakDays: 0,
    age: stored.personal.age,
    sex: stored.personal.sex,
    height_cm: stored.personal.height_cm,
    sugarBarrierNote: stored.sugarBarrierNote,
  };
  return Promise.resolve(profile);
}

export async function getAllEntries(options?: {
  force?: boolean;
}): Promise<IntakeEntry[]> {
  const userId = getCurrentUserId();
  const now = Date.now();
  if (
    !options?.force &&
    entriesCache &&
    entriesCache.userId === userId &&
    now - entriesCache.at < ENTRIES_TTL_MS
  ) {
    return entriesCache.rows;
  }
  if (!options?.force && entriesInflight) {
    return entriesInflight;
  }

  entriesInflight = (async () => {
    const backend = await fetchBackendEntries();
    const rows = mergeEntries(backend, getEntries());
    entriesCache = { userId, at: Date.now(), rows };
    entriesInflight = null;
    return rows;
  })();

  return entriesInflight;
}

/** Drop entries cache after logging / edits so UI refreshes. */
export function invalidateEntriesCache(): void {
  entriesCache = null;
  entriesInflight = null;
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
  return buildDailyTotals(today, todays, getStoredProfile().targets);
}

export async function listMedicalReports(
  userId?: string,
  limit = 50,
): Promise<MedicalReportSummary[]> {
  try {
    const uid = userId ?? getCurrentUserId();
    const res = await apiFetch(
      `/api/medical/reports?user_id=${encodeURIComponent(uid)}&limit=${limit}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export type MedicalReportPatch = Partial<
  Pick<
    MedicalReportSummary,
    | "test_date"
    | "notes"
    | "hba1c"
    | "hba1c_status"
    | "fasting_glucose"
    | "fasting_glucose_status"
    | "total_cholesterol"
    | "total_cholesterol_status"
    | "ldl"
    | "ldl_status"
    | "hdl"
    | "hdl_status"
    | "triglycerides"
    | "triglycerides_status"
  >
>;

export async function patchMedicalReport(
  reportId: number,
  patch: MedicalReportPatch,
): Promise<MedicalReportSummary> {
  const res = await apiFetch(`/api/medical/reports/${reportId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function deleteMedicalReport(reportId: number): Promise<void> {
  const res = await apiFetch(`/api/medical/reports/${reportId}`, {
    method: "DELETE",
  });
  if (!res.ok) await apiError(res);
}

export async function calculateSugarBarrier(input: {
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  hba1c?: number | null;
  fasting_glucose?: number | null;
  user_id?: string;
}): Promise<SugarBarrierResult> {
  const { recommendIntakeLocal } = await import("./intakeRecommend");
  const fallback = () =>
    recommendIntakeLocal({
      age: input.age,
      sex: input.sex,
      height_cm: input.height_cm,
      hba1c: input.hba1c,
      fasting_glucose: input.fasting_glucose,
    });

  try {
    const res = await apiFetch("/api/medical/recommend-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: input.user_id ?? getCurrentUserId(),
        age: input.age ?? null,
        sex: input.sex ?? null,
        height_cm: input.height_cm ?? null,
        hba1c: input.hba1c ?? null,
        fasting_glucose: input.fasting_glucose ?? null,
        use_latest_labs: true,
      }),
    });
    if (!res.ok) {
      // Legacy path if older backend only has /profile/sugar-barrier
      const legacy = await apiFetch("/api/profile/sugar-barrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: input.user_id ?? getCurrentUserId(),
          age: input.age ?? null,
          sex: input.sex ?? null,
          height_cm: input.height_cm ?? null,
          hba1c: input.hba1c ?? null,
          fasting_glucose: input.fasting_glucose ?? null,
          use_latest_labs: true,
        }),
      });
      if (!legacy.ok) return fallback();
      const legacyData = (await legacy.json()) as SugarBarrierResult;
      if (legacyData.calories == null) legacyData.calories = fallback().calories;
      if (legacyData.water_cups == null) legacyData.water_cups = fallback().water_cups;
      return legacyData;
    }
    const data = (await res.json()) as SugarBarrierResult;
    if (data.calories == null) data.calories = fallback().calories;
    if (data.water_cups == null) data.water_cups = fallback().water_cups;
    return data;
  } catch {
    return fallback();
  }
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
  // Next.js rewrite returns a bare 500 when the backend reloads / hangs up mid-request.
  if (
    res.status === 500 &&
    (detail === "Internal Server Error" || detail === "Error" || !detail.trim())
  ) {
    detail =
      "The backend restarted or timed out. Wait a moment and try again, or use a different image.";
  }
  throw new Error(detail);
}

export async function analyzeDrink(file: File, userId?: string): Promise<DrinkAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId ?? getCurrentUserId());
  const res = await apiFetch(analyzeUrl("/api/drinks/analyze"), { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmDrink(analysisId: string, drink: unknown, userId?: string): Promise<DrinkConfirmResponse> {
  const res = await apiFetch(`/api/drinks/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drink, user_id: userId ?? getCurrentUserId() }),
  });
  if (!res.ok) await apiError(res);
  invalidateEntriesCache();
  return res.json();
}

export async function analyzeFood(file: File, userId?: string): Promise<FoodAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId ?? getCurrentUserId());
  const res = await apiFetch(analyzeUrl("/api/foods/analyze"), { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmFood(analysisId: string, food: unknown, userId?: string, name?: string): Promise<FoodConfirmResponse> {
  const res = await apiFetch(`/api/foods/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ food, user_id: userId ?? getCurrentUserId(), name: name || null }),
  });
  if (!res.ok) await apiError(res);
  invalidateEntriesCache();
  return res.json();
}

export async function analyzeMedical(file: File, userId?: string): Promise<MedicalAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId ?? getCurrentUserId());
  const res = await apiFetch(analyzeUrl("/api/medical/analyze"), { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmMedical(
  analysisId: string,
  metrics: unknown[],
  userId?: string,
  profile?: {
    age?: number | null;
    sex?: string | null;
    height_cm?: number | null;
  },
): Promise<MedicalConfirmResponse> {
  const res = await apiFetch(`/api/medical/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metrics,
      user_id: userId ?? getCurrentUserId(),
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
      height_cm: profile?.height_cm ?? null,
      compute_sugar_barrier: true,
    }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

/** Latest medical metrics from confirmed reports (Premium). */
export interface BackendMedicalMetric {
  id: number;
  metric_name: string;
  category: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  reference_range_text: string;
  status: string;
  test_date: string | null;
  extraction_confidence: number;
  confirmed: boolean;
  created_at: string;
}

export async function fetchMedicalMetrics(
  userId?: string,
): Promise<BackendMedicalMetric[]> {
  try {
    const q = new URLSearchParams({
      user_id: userId ?? getCurrentUserId(),
      limit: "50",
    });
    const res = await apiFetch(`/api/medical/metrics?${q}`);
    if (!res.ok) return [];
    const rows = (await res.json()) as BackendMedicalMetric[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Log water volume (ml). Hold-to-fill commits full sips and partials on release. */
export async function logWaterSip(ml = 30, userId?: string): Promise<{ intake_id: number; ml: number }> {
  const res = await apiFetch("/api/water/sip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId ?? getCurrentUserId(), ml }),
  });
  if (!res.ok) await apiError(res);
  invalidateEntriesCache();
  return res.json();
}

export async function deleteIntake(intakeId: number | string): Promise<void> {
  const id = String(intakeId).replace(/^be_/, "");
  const res = await apiFetch(`/intakes/${id}`, { method: "DELETE" });
  if (!res.ok) await apiError(res);
  invalidateEntriesCache();
}

/** Upload recorded audio for Azure Speech transcription. */
export async function transcribeAudio(
  file: File,
  userId?: string,
): Promise<{ transcript: string; status?: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId ?? getCurrentUserId());
  let res: Response;
  try {
    res = await apiFetch("/api/ai/transcribe", { method: "POST", body: form });
  } catch {
    throw new Error("Cannot reach the backend. Is uvicorn running on port 8000?");
  }
  if (!res.ok) await apiError(res);
  return res.json();
}

/** Remove a local or backend entry. */
export async function removeEntry(entry: IntakeEntry): Promise<void> {
  if (entry.id.startsWith("be_")) {
    await deleteIntake(entry.id);
  } else {
    deleteEntry(entry.id);
  }
}

/** Patch a local or backend entry's name/nutrients. */
export async function patchEntry(
  id: string,
  patch: Partial<IntakeEntry>,
): Promise<void> {
  if (id.startsWith("be_")) {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.portion !== undefined) body.serving = patch.portion;
    if (patch.nutrients) {
      const n = patch.nutrients;
      const extras: Record<string, number> = {
        total_sugar_g: n.totalSugar_g,
        added_sugar_g: n.addedSugar_g,
      };
      if (n.caffeine_mg != null) extras.caffeine_mg = n.caffeine_mg;
      if (patch.volumeMl != null) extras.drink_volume_ml = patch.volumeMl;
      body.nutrients = {
        calories: n.calories,
        protein_g: n.protein_g,
        carbs_g: n.carbs_g,
        fat_g: n.fat_g,
        fiber_g: 0,
        sugar_g: n.totalSugar_g,
        sodium_mg: 0,
        extras,
      };
    }
    const res = await apiFetch(`/intakes/${id.replace(/^be_/, "")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) await apiError(res);
  } else {
    updateEntry(id, patch);
  }
}

/** Add or replace a photo on an entry. Returns the new image URL. */
export async function uploadEntryImage(
  entry: IntakeEntry,
  file: File,
): Promise<string> {
  if (entry.id.startsWith("be_")) {
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(`/intakes/${entry.id.replace(/^be_/, "")}/image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) await apiError(res);
    const row = (await res.json()) as BackendIntake;
    return filePathToUrl(row.file_path) ?? "";
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
  updateEntry(entry.id, { imageUrl: dataUrl });
  return dataUrl;
}
