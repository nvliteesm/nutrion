import { mockUser, MOCK_TODAY } from "./mock-data";
import { getEntries } from "./store";
import { buildDailyTotals } from "./nutrition";
import type {
  DailyTotals,
  DrinkAnalyzeResponse,
  DrinkConfirmResponse,
  DrinkLabelData,
  FoodAnalysisData,
  FoodAnalyzeResponse,
  FoodConfirmResponse,
  IntakeEntry,
  MedicalAnalyzeResponse,
  MedicalConfirmResponse,
  MedicalMetricData,
  UserProfile,
} from "./types";

/**
 * API layer — analyze/confirm calls hit the backend via Next rewrites.
 * Dashboard helpers still use mock data until those screens are wired.
 */

const delay = <T>(value: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

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

export function getCurrentUser(): Promise<UserProfile> {
  return delay(mockUser);
}

export function getTodayEntries(): Promise<IntakeEntry[]> {
  return delay(getEntries().filter(isToday));
}

export function getTodayTotals(): Promise<DailyTotals> {
  const todays = getEntries().filter(isToday);
  return delay(buildDailyTotals(MOCK_TODAY, todays, mockUser.targets));
}

/** All stored entries (for History / calendar / analytics). */
export function getAllEntries(): Promise<IntakeEntry[]> {
  return delay(getEntries());
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
  drink: DrinkLabelData,
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
  food: FoodAnalysisData,
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
  metrics: MedicalMetricData[],
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
  drink: DrinkLabelData,
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
  food: FoodAnalysisData,
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
  metrics: MedicalMetricData[],
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
