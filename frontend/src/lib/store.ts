import type { Favorite, IntakeEntry, MedicalMetric } from "./types";
import { getCurrentUserId } from "./auth";

/**
 * Client-side data store (localStorage-backed), scoped per signed-in user.
 *
 * Keys include userId so Maya / Alex / Google accounts on the same browser
 * never see each other's local manual logs or favorites.
 */

const ENTRIES_PREFIX = "nutrion.entries.v5";
const FAVORITES_PREFIX = "nutrion.favorites.v5";
const METRICS_PREFIX = "nutrion.metrics.v5";

/** Legacy unscoped keys — migrated once into the current user's bucket. */
const LEGACY_ENTRIES = "nutrion.entries.v4";
const LEGACY_FAVORITES = "nutrion.favorites";
const LEGACY_METRICS = "nutrion.metrics";

function uid(): string {
  return getCurrentUserId();
}

function entriesKey(userId = uid()): string {
  return `${ENTRIES_PREFIX}.${userId}`;
}
function favoritesKey(userId = uid()): string {
  return `${FAVORITES_PREFIX}.${userId}`;
}
function metricsKey(userId = uid()): string {
  return `${METRICS_PREFIX}.${userId}`;
}

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

function migrateLegacyOnce(userId: string): void {
  if (typeof window === "undefined") return;
  const flag = `nutrion.migrated.v5.${userId}`;
  if (window.localStorage.getItem(flag)) return;

  const legacyEntries = read<IntakeEntry[]>(LEGACY_ENTRIES);
  if (legacyEntries?.length && !read(entriesKey(userId))) {
    write(
      entriesKey(userId),
      legacyEntries.map((e) => ({ ...e, userId: e.userId ?? userId })),
    );
  }
  const legacyFavs = read<Favorite[]>(LEGACY_FAVORITES);
  if (legacyFavs?.length && !read(favoritesKey(userId))) {
    write(favoritesKey(userId), legacyFavs);
  }
  const legacyMetrics = read<MedicalMetric[]>(LEGACY_METRICS);
  if (legacyMetrics?.length && !read(metricsKey(userId))) {
    write(metricsKey(userId), legacyMetrics);
  }
  window.localStorage.setItem(flag, "1");
}

/** All local entries for the signed-in user, newest first. */
export function getEntries(): IntakeEntry[] {
  const userId = uid();
  migrateLegacyOnce(userId);
  const rows = read<IntakeEntry[]>(entriesKey(userId)) ?? [];
  return rows.filter((e) => !e.userId || e.userId === userId);
}

function genId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Append a new entry stamped with the current userId. */
export function addEntry(entry: Omit<IntakeEntry, "id">): IntakeEntry {
  const userId = uid();
  const stored = getEntries();
  const withId: IntakeEntry = {
    ...entry,
    id: genId(),
    userId: entry.userId ?? userId,
  };
  const next = [withId, ...stored].sort((a, b) =>
    a.loggedAt < b.loggedAt ? 1 : -1,
  );
  write(entriesKey(userId), next);
  return withId;
}

export function updateEntry(id: string, patch: Partial<IntakeEntry>): void {
  const userId = uid();
  const next = getEntries().map((e) => (e.id === id ? { ...e, ...patch } : e));
  write(entriesKey(userId), next);
}

export function deleteEntry(id: string): void {
  const userId = uid();
  write(
    entriesKey(userId),
    getEntries().filter((e) => e.id !== id),
  );
}

/** Re-insert a previously deleted entry, preserving its id (for undo). */
export function restoreEntry(entry: IntakeEntry): void {
  const userId = uid();
  const stored = getEntries().filter((e) => e.id !== entry.id);
  const stamped: IntakeEntry = {
    ...entry,
    userId: entry.userId ?? userId,
  };
  const next = [stamped, ...stored].sort((a, b) =>
    a.loggedAt < b.loggedAt ? 1 : -1,
  );
  write(entriesKey(userId), next);
}

export function getFavorites(): Favorite[] {
  const userId = uid();
  migrateLegacyOnce(userId);
  return read<Favorite[]>(favoritesKey(userId)) ?? [];
}

export function addFavorite(fav: Omit<Favorite, "id">): Favorite {
  const userId = uid();
  const withId: Favorite = { ...fav, id: genId() };
  write(favoritesKey(userId), [withId, ...getFavorites()]);
  return withId;
}

/** Confirmed medical metrics (Premium). Only confirmed values are stored. */
export function getMedicalMetrics(): MedicalMetric[] {
  const userId = uid();
  migrateLegacyOnce(userId);
  return read<MedicalMetric[]>(metricsKey(userId)) ?? [];
}

export function saveMedicalMetrics(metrics: MedicalMetric[]): void {
  write(metricsKey(uid()), metrics);
}
