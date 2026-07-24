import { mockUser, MOCK_TODAY } from "./mock-data";
import { getEntries } from "./store";
import { buildDailyTotals } from "./nutrition";
import type { DailyTotals, IntakeEntry, UserProfile } from "./types";

/**
 * Mock API layer.
 *
 * Reads through the client store so entries saved by the scan/manual flows
 * immediately affect Today and History. Every function returns a Promise with
 * a small simulated latency so the UI exercises real loading states. When the
 * backend is ready, swap the bodies for `fetch` calls — keep the signatures.
 */

const delay = <T>(value: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function isToday(entry: IntakeEntry): boolean {
  return entry.loggedAt.slice(0, 10) === MOCK_TODAY;
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
