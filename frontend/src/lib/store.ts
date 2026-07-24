import { mockSeedEntries } from "./mock-data";
import type { Favorite, IntakeEntry, MedicalMetric } from "./types";

/**
 * Client-side data store (localStorage-backed).
 *
 * Seeds from the mock day on first use so the dashboard has content, then
 * lets the scan and manual flows append real entries that immediately show up
 * on Today and in History. Swap for API calls when the backend is ready.
 */

// v2: seed now includes a full month of history.
const ENTRIES_KEY = "nutrion.entries.v2";
const FAVORITES_KEY = "nutrion.favorites";
const METRICS_KEY = "nutrion.metrics";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

/** All entries, newest first. Seeds from mock data on first read. */
export function getEntries(): IntakeEntry[] {
  const stored = read<IntakeEntry[]>(ENTRIES_KEY);
  if (stored) return stored;
  const seed = [...mockSeedEntries];
  write(ENTRIES_KEY, seed);
  return seed;
}

function genId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Append a new entry and persist. Returns the stored entry (with id). */
export function addEntry(entry: Omit<IntakeEntry, "id">): IntakeEntry {
  const stored = getEntries();
  const withId: IntakeEntry = { ...entry, id: genId() };
  const next = [withId, ...stored].sort((a, b) =>
    a.loggedAt < b.loggedAt ? 1 : -1,
  );
  write(ENTRIES_KEY, next);
  return withId;
}

export function updateEntry(id: string, patch: Partial<IntakeEntry>): void {
  const next = getEntries().map((e) => (e.id === id ? { ...e, ...patch } : e));
  write(ENTRIES_KEY, next);
}

export function deleteEntry(id: string): void {
  write(
    ENTRIES_KEY,
    getEntries().filter((e) => e.id !== id),
  );
}

export function getFavorites(): Favorite[] {
  return read<Favorite[]>(FAVORITES_KEY) ?? [];
}

export function addFavorite(fav: Omit<Favorite, "id">): Favorite {
  const withId: Favorite = { ...fav, id: genId() };
  write(FAVORITES_KEY, [withId, ...getFavorites()]);
  return withId;
}

/** Confirmed medical metrics (Premium). Only confirmed values are stored. */
export function getMedicalMetrics(): MedicalMetric[] {
  return read<MedicalMetric[]>(METRICS_KEY) ?? [];
}

export function saveMedicalMetrics(metrics: MedicalMetric[]): void {
  write(METRICS_KEY, metrics);
}
