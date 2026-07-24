import {
  DEFAULT_TARGETS,
  type GoalSource,
  type NutritionTargets,
  type Sex,
} from "./types";

/**
 * Local profile preferences (personal body data + nutrition targets).
 * Survives reloads; swap for a real /api/profile later without UI changes.
 */

const PROFILE_KEY = "nutrion.profile.v1";

export interface PersonalData {
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
}

export interface StoredProfile {
  personal: PersonalData;
  targets: NutritionTargets;
  goalSource: GoalSource;
  /** Last Kimi/rule rationale for the sugar barrier, if any. */
  sugarBarrierNote?: string;
  updatedAt?: string;
}

const DEFAULT_PERSONAL: PersonalData = {
  age: null,
  sex: null,
  height_cm: null,
};

const DEFAULT_PROFILE: StoredProfile = {
  personal: DEFAULT_PERSONAL,
  targets: DEFAULT_TARGETS,
  goalSource: "user",
};

function read(): StoredProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return DEFAULT_PROFILE;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    return {
      personal: {
        age: parsed.personal?.age ?? null,
        sex: parsed.personal?.sex ?? null,
        height_cm: parsed.personal?.height_cm ?? null,
      },
      targets: {
        calories: parsed.targets?.calories ?? DEFAULT_TARGETS.calories,
        sugar_g: parsed.targets?.sugar_g ?? DEFAULT_TARGETS.sugar_g,
        water_cups: parsed.targets?.water_cups ?? DEFAULT_TARGETS.water_cups,
      },
      goalSource: parsed.goalSource === "nutrion" ? "nutrion" : "user",
      sugarBarrierNote: parsed.sugarBarrierNote,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function write(profile: StoredProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }),
  );
}

export function getStoredProfile(): StoredProfile {
  return read();
}

export function savePersonalData(personal: PersonalData): StoredProfile {
  const next = { ...read(), personal };
  write(next);
  return next;
}

export function saveTargets(
  targets: NutritionTargets,
  goalSource: GoalSource = "user",
): StoredProfile {
  const next = { ...read(), targets, goalSource };
  if (goalSource === "user") {
    next.sugarBarrierNote = undefined;
  }
  write(next);
  return next;
}

export function applyIntakeTargets(
  targets: { calories?: number; sugar_g: number; water_cups?: number },
  note?: string,
): StoredProfile {
  const current = read();
  const next: StoredProfile = {
    ...current,
    targets: {
      ...current.targets,
      sugar_g: targets.sugar_g,
      ...(targets.calories != null ? { calories: targets.calories } : {}),
      ...(targets.water_cups != null ? { water_cups: targets.water_cups } : {}),
    },
    goalSource: "nutrion",
    sugarBarrierNote: note,
  };
  write(next);
  return next;
}

/** @deprecated Prefer applyIntakeTargets */
export function applySugarBarrier(
  sugar_g: number,
  note?: string,
): StoredProfile {
  return applyIntakeTargets({ sugar_g }, note);
}

export function hasPersonalBasics(personal: PersonalData): boolean {
  return (
    personal.age != null &&
    personal.age > 0 &&
    personal.sex != null &&
    personal.height_cm != null &&
    personal.height_cm > 0
  );
}
