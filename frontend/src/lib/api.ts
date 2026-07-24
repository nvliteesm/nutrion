import { mockUser } from "./mock-data";
import { getToday } from "./date";
import { getEntries } from "./store";
import { buildDailyTotals } from "./nutrition";
import type { DailyTotals, DrinkAnalyzeResponse, DrinkConfirmResponse, FoodAnalyzeResponse, FoodConfirmResponse, IntakeEntry, MedicalAnalyzeResponse, MedicalConfirmResponse, UserProfile } from "./types";
import { getStoredSession } from "./auth";

/**
 * API layer.
 *
 * Dashboard/history helpers read from the client-side store (localStorage)
 * so they reflect entries from both scan flows and manual logging.
 * When the backend is ready, swap the bodies for `fetch` calls.
 */

const delay = <T>(value: T, ms = 250): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function isToday(entry: IntakeEntry): boolean {
  return entry.loggedAt.slice(0, 10) === getToday();
}

export function getCurrentUser(): Promise<UserProfile> {
  // Read real session data, fall back to mockUser for seeded demo entries.
  const session = getStoredSession();
  if (session) {
    return delay({
      ...mockUser,
      id: session.userId,
      fullName: session.fullName,
      email: session.email,
      initials: session.initials,
      subscription: session.subscription,
    });
  }
  return delay(mockUser);
}

export function getTodayEntries(): Promise<IntakeEntry[]> {
  return delay(getEntries().filter(isToday));
}

export function getTodayTotals(): Promise<DailyTotals> {
  const user = getStoredSession();
  const targets = mockUser.targets; // targets from profile (TODO: persist edits)
  const todays = getEntries().filter(isToday);
  return delay(buildDailyTotals(getToday(), todays, targets));
}

/** All stored entries (for History / calendar / analytics). */
export function getAllEntries(): Promise<IntakeEntry[]> {
  return delay(getEntries());
}


/**
 * Backend API stubs for the analyze → confirm flow.
 *
 * These hit the backend when available (via Next rewrites). The frontend
 * scan pages that still use local mock extractors don't call these; they
 * exist for the scan/page.tsx hub your teammate built.
 */

async function apiError(res: Response): Promise<never> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = body.detail || body.message || detail;
  } catch {
    /* ignore */
  }
  throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
}

export async function analyzeDrink(
  file: File,
  userId = "default",
): Promise<DrinkAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId);
  const res = await fetch("/api/drinks/analyze", { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmDrink(
  analysisId: string,
  drink: unknown,
  userId = "default",
): Promise<DrinkConfirmResponse> {
  const res = await fetch(`/api/drinks/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drink, user_id: userId }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function analyzeFood(
  file: File,
  userId = "default",
): Promise<FoodAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId);
  const res = await fetch("/api/foods/analyze", { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmFood(
  analysisId: string,
  food: unknown,
  userId = "default",
  name?: string,
): Promise<FoodConfirmResponse> {
  const res = await fetch(`/api/foods/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ food, user_id: userId, name: name || null }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function analyzeMedical(
  file: File,
  userId = "default",
): Promise<MedicalAnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("user_id", userId);
  const res = await fetch("/api/medical/analyze", { method: "POST", body: form });
  if (!res.ok) await apiError(res);
  return res.json();
}

export async function confirmMedical(
  analysisId: string,
  metrics: unknown[],
  userId = "default",
): Promise<MedicalConfirmResponse> {
  const res = await fetch(`/api/medical/${analysisId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, user_id: userId }),
  });
  if (!res.ok) await apiError(res);
  return res.json();
}
