import type { Favorite, IntakeEntry, MedicalMetric } from "./types";

/**
 * Client-side data store (localStorage-backed).
 *
 * Stores local manual entries and favorites. Backend-confirmed entries come
 * from /intakes via api.ts and are merged at read time.
 */

const ENTRIES_KEY = "nutrion.entries.v4";
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

/** All local entries (manual/quick log), newest first. */
export function getEntries(): IntakeEntry[] {
  return read<IntakeEntry[]>(ENTRIES_KEY) ?? [];
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

/** Re-insert a previously deleted entry, preserving its id (for undo). */
export function restoreEntry(entry: IntakeEntry): void {
  const stored = getEntries().filter((e) => e.id !== entry.id);
  const next = [entry, ...stored].sort((a, b) =>
    a.loggedAt < b.loggedAt ? 1 : -1,
  );
  write(ENTRIES_KEY, next);
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
