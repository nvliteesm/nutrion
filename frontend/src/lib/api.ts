import { mockTodayEntries, mockUser, MOCK_TODAY } from "./mock-data";
import { buildDailyTotals } from "./nutrition";
import type { DailyTotals, IntakeEntry, UserProfile } from "./types";

/**
 * Mock API layer.
 *
 * Every function returns a Promise with a small simulated latency so the UI
 * exercises real loading states. When the backend is ready, swap these
 * implementations for `fetch` calls against the agreed contract — the
 * signatures should stay the same.
 */

const delay = <T>(value: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export function getCurrentUser(): Promise<UserProfile> {
  return delay(mockUser);
}

export function getTodayEntries(): Promise<IntakeEntry[]> {
  const sorted = [...mockTodayEntries].sort((a, b) =>
    a.loggedAt < b.loggedAt ? 1 : -1,
  );
  return delay(sorted);
}

export function getTodayTotals(): Promise<DailyTotals> {
  const totals = buildDailyTotals(MOCK_TODAY, mockTodayEntries, mockUser.targets);
  return delay(totals);
}
