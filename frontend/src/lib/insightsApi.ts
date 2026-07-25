import { getCurrentUserId } from "./auth";
import { apiFetch } from "./apiFetch";

/** Backend InsightRecord from /api/ai/insights/*. */
export interface BackendInsight {
  id: number;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  period_start?: string | null;
  period_end?: string | null;
  created_at: string;
}

export interface BackendPeriodSummary {
  user_id: string;
  period: string;
  start: string;
  end: string;
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  averages_per_day: {
    calories: number;
    sugar_g: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  meal_count: number;
  confirmed_count: number;
  estimated_count: number;
  days_with_logs: number;
}

export interface BackendSugarSources {
  user_id: string;
  start: string;
  end: string;
  total_sugar_g: number;
  items: {
    name: string;
    sugar_g: number;
    percent_of_period_sugar: number;
    intake_count: number;
  }[];
}

function uid(userId?: string): string {
  return userId || getCurrentUserId();
}

/** Session-scoped analytics summary (week). */
export async function fetchWeeklyAnalytics(
  userId?: string,
): Promise<BackendPeriodSummary | null> {
  try {
    const q = new URLSearchParams({
      user_id: uid(userId),
      confirmed_only: "true",
    });
    const res = await apiFetch(`/api/analytics/weekly?${q}`);
    if (!res.ok) return null;
    return (await res.json()) as BackendPeriodSummary;
  } catch {
    return null;
  }
}

/** Session-scoped top sugar sources. */
export async function fetchTopSugarSources(
  userId?: string,
  limit = 5,
): Promise<BackendSugarSources | null> {
  try {
    const q = new URLSearchParams({
      user_id: uid(userId),
      limit: String(limit),
      drinks_only: "false",
      confirmed_only: "true",
    });
    const res = await apiFetch(`/api/analytics/top-sugar-sources?${q}`);
    if (!res.ok) return null;
    return (await res.json()) as BackendSugarSources;
  } catch {
    return null;
  }
}

/** Generate + persist a weekly insight for the signed-in user. */
export async function generateWeeklyInsight(
  userId?: string,
): Promise<BackendInsight | null> {
  try {
    const q = new URLSearchParams({ user_id: uid(userId) });
    const res = await apiFetch(`/api/ai/insights/weekly?${q}`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return (await res.json()) as BackendInsight;
  } catch {
    return null;
  }
}

/** Generate sugar-source insight for the signed-in user. */
export async function generateSugarInsight(
  userId?: string,
): Promise<BackendInsight | null> {
  try {
    const q = new URLSearchParams({ user_id: uid(userId) });
    const res = await apiFetch(`/api/ai/insights/sugar-sources?${q}`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return (await res.json()) as BackendInsight;
  } catch {
    return null;
  }
}

/** Generate medical-context insight for the signed-in user. */
export async function generateMedicalInsight(
  userId?: string,
): Promise<BackendInsight | null> {
  try {
    const q = new URLSearchParams({ user_id: uid(userId) });
    const res = await apiFetch(`/api/ai/insights/medical-context?${q}`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return (await res.json()) as BackendInsight;
  } catch {
    return null;
  }
}

/**
 * Load all session-scoped insight payloads used by the Insights page.
 * Always scopes to the current login (or explicit userId).
 */
export async function loadSessionInsights(userId?: string): Promise<{
  userId: string;
  weekly: BackendInsight | null;
  sugar: BackendInsight | null;
  medical: BackendInsight | null;
  analytics: BackendPeriodSummary | null;
  sugarSources: BackendSugarSources | null;
}> {
  const id = uid(userId);
  const [weekly, sugar, medical, analytics, sugarSources] = await Promise.all([
    generateWeeklyInsight(id),
    generateSugarInsight(id),
    generateMedicalInsight(id),
    fetchWeeklyAnalytics(id),
    fetchTopSugarSources(id),
  ]);
  return { userId: id, weekly, sugar, medical, analytics, sugarSources };
}
