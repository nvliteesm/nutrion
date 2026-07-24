import type { IntakeEntry, UserProfile } from "./types";

/**
 * Dummy data so the frontend runs fully offline while the backend is built.
 * Mirrors the numbers shown in the hi-fi mockup (Maya, Jul 24).
 */

export const mockUser: UserProfile = {
  id: "u_maya",
  fullName: "Maya Kessler",
  email: "maya@example.com",
  initials: "MK",
  subscription: "premium",
  targets: {
    calories: 2000,
    addedSugar_g: 40,
    water_cups: 8,
  },
  goalSource: "user",
  streakDays: 6,
};

// "Today" is pinned to the mockup date so seeded entries line up.
export const MOCK_TODAY = "2026-07-24";

const at = (time: string): string => `${MOCK_TODAY}T${time}:00`;

const foodAndDrink: IntakeEntry[] = [
  {
    id: "e_yogurt",
    type: "food",
    name: "Greek yogurt with honey",
    loggedAt: at("08:12"),
    source: "manual",
    confirmed: true,
    portion: "1 cup (200 g)",
    nutrients: {
      calories: 210,
      carbs_g: 24,
      totalSugar_g: 20,
      addedSugar_g: 8,
      protein_g: 14,
      fat_g: 6,
    },
  },
  {
    id: "e_latte",
    type: "drink",
    name: "Oat milk latte",
    loggedAt: at("10:05"),
    source: "label",
    confidence: "high",
    confirmed: true,
    portion: "1 cup (350 ml)",
    volumeMl: 350,
    nutrients: {
      calories: 180,
      carbs_g: 24,
      totalSugar_g: 16,
      addedSugar_g: 12,
      protein_g: 6,
      fat_g: 6,
      caffeine_mg: 120,
    },
  },
  {
    id: "e_salad",
    type: "food",
    name: "Chicken Caesar salad",
    loggedAt: at("12:40"),
    source: "ai",
    confidence: "medium",
    confirmed: true,
    portion: "1 bowl",
    caloriesRange: [480, 620],
    nutrients: {
      calories: 550,
      carbs_g: 22,
      totalSugar_g: 6,
      addedSugar_g: 4,
      protein_g: 34,
      fat_g: 30,
    },
  },
  {
    id: "e_roll",
    type: "food",
    name: "Whole-grain roll",
    loggedAt: at("12:45"),
    source: "manual",
    confirmed: true,
    portion: "1 roll",
    nutrients: {
      calories: 480,
      carbs_g: 85,
      totalSugar_g: 6,
      addedSugar_g: 4,
      protein_g: 8,
      fat_g: 6,
    },
  },
];

const waterTimes = ["07:30", "09:15", "11:00", "13:30", "15:10"];

const waterEntries: IntakeEntry[] = waterTimes.map((time, i) => ({
  id: `e_water_${i}`,
  type: "water",
  name: "Water",
  loggedAt: at(time),
  source: "manual",
  confirmed: true,
  volumeMl: 250,
  nutrients: {
    calories: 0,
    carbs_g: 0,
    totalSugar_g: 0,
    addedSugar_g: 0,
    protein_g: 0,
    fat_g: 0,
  },
}));

export const mockTodayEntries: IntakeEntry[] = [
  ...foodAndDrink,
  ...waterEntries,
];
