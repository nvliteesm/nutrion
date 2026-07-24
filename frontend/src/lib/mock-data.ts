import { getToday } from "./date";
import type { IntakeEntry, Nutrients, UserProfile } from "./types";

/**
 * Seed data. Entries are generated relative to the *real* today so the
 * dashboard, calendar, and analytics always work regardless of when the
 * app is demoed.
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

/** Helper to get a date string N days before today. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function iso(dateStr: string, time: string): string {
  return `${dateStr}T${time}:00`;
}

const nut = (
  calories: number,
  carbs_g: number,
  totalSugar_g: number,
  addedSugar_g: number,
  protein_g: number,
  fat_g: number,
  caffeine_mg = 0,
): Nutrients => ({
  calories,
  carbs_g,
  totalSugar_g,
  addedSugar_g,
  protein_g,
  fat_g,
  caffeine_mg,
});

type MenuItem = {
  name: string;
  type: "food" | "drink";
  source: "manual" | "label" | "ai";
  nutrients: Nutrients;
};

const MENU: MenuItem[] = [
  { name: "Overnight oats", type: "food", source: "manual", nutrients: nut(320, 48, 12, 6, 11, 9) },
  { name: "Greek yogurt with honey", type: "food", source: "manual", nutrients: nut(210, 24, 20, 8, 14, 6) },
  { name: "Chicken Caesar salad", type: "food", source: "ai", nutrients: nut(520, 20, 6, 4, 34, 30) },
  { name: "Salmon & rice bowl", type: "food", source: "manual", nutrients: nut(610, 55, 4, 2, 38, 22) },
  { name: "Veggie stir-fry", type: "food", source: "ai", nutrients: nut(430, 60, 10, 3, 15, 14) },
  { name: "Turkey sandwich", type: "food", source: "manual", nutrients: nut(450, 48, 6, 3, 28, 16) },
  { name: "Pasta dinner", type: "food", source: "manual", nutrients: nut(680, 90, 8, 4, 22, 20) },
  { name: "Oat milk latte", type: "drink", source: "label", nutrients: nut(180, 24, 16, 12, 6, 6, 120) },
  { name: "Energy drink", type: "drink", source: "label", nutrients: nut(160, 40, 38, 38, 0, 0, 150) },
  { name: "Cola", type: "drink", source: "label", nutrients: nut(140, 39, 39, 39, 0, 0, 30) },
  { name: "Protein shake", type: "drink", source: "manual", nutrients: nut(220, 20, 14, 6, 30, 3) },
];

const MEAL_TIMES = ["08:00", "12:30", "15:30", "19:00", "21:00"];

/** Today's seed entries — matches the mockup's dashboard numbers. */
function todaysEntries(): IntakeEntry[] {
  const today = getToday();
  return [
    {
      id: "e_yogurt",
      type: "food",
      name: "Greek yogurt with honey",
      loggedAt: iso(today, "08:12"),
      source: "manual",
      confirmed: true,
      portion: "1 cup (200 g)",
      nutrients: nut(210, 24, 20, 8, 14, 6),
    },
    {
      id: "e_latte",
      type: "drink",
      name: "Oat milk latte",
      loggedAt: iso(today, "10:05"),
      source: "label",
      confidence: "high",
      confirmed: true,
      portion: "1 cup (350 ml)",
      volumeMl: 350,
      nutrients: nut(180, 24, 16, 12, 6, 6, 120),
    },
    {
      id: "e_salad",
      type: "food",
      name: "Chicken Caesar salad",
      loggedAt: iso(today, "12:40"),
      source: "ai",
      confidence: "medium",
      confirmed: true,
      portion: "1 bowl",
      caloriesRange: [480, 620],
      nutrients: nut(550, 22, 6, 4, 34, 30),
    },
    {
      id: "e_roll",
      type: "food",
      name: "Whole-grain roll",
      loggedAt: iso(today, "12:45"),
      source: "manual",
      confirmed: true,
      portion: "1 roll",
      nutrients: nut(480, 85, 6, 4, 8, 6),
    },
  ];
}

function waterFor(dateStr: string, cups: number): IntakeEntry[] {
  return Array.from({ length: cups }).map((_, i) => ({
    id: `e_water_${dateStr}_${i}`,
    type: "water",
    name: "Water",
    loggedAt: iso(dateStr, `${String(9 + i).padStart(2, "0")}:00`),
    source: "manual",
    confirmed: true,
    volumeMl: 250,
    nutrients: nut(0, 0, 0, 0, 0, 0),
  }));
}

/** Deterministic entries for a given day-offset from today. */
function pastDay(offset: number): IntakeEntry[] {
  const dateStr = daysAgo(offset);
  const day = offset; // use offset as seed

  if (day % 11 === 0) return []; // no data day
  const light = day % 7 === 5;
  const count = light ? 1 : 3 + (day % 3);

  const items: IntakeEntry[] = [];
  for (let i = 0; i < count; i++) {
    const menu = MENU[(day * 3 + i * 5) % MENU.length];
    items.push({
      id: `e_past_${offset}_${i}`,
      type: menu.type,
      name: menu.name,
      loggedAt: iso(dateStr, MEAL_TIMES[i % MEAL_TIMES.length]),
      source: menu.source,
      confidence: menu.source === "ai" ? "medium" : menu.source === "label" ? "high" : undefined,
      confirmed: true,
      portion: menu.type === "food" ? "1 serving" : "1 cup",
      volumeMl: menu.type === "drink" ? 330 : undefined,
      nutrients: { ...menu.nutrients },
    });
  }
  if (!light) items.push(...waterFor(dateStr, 4 + (day % 5)));
  return items;
}

function buildSeed(): IntakeEntry[] {
  const all: IntakeEntry[] = [...todaysEntries()];
  // Seed 30 days of past data
  for (let offset = 1; offset <= 30; offset++) {
    all.push(...pastDay(offset));
  }
  return all.sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

/** Full seed: today + 30 days of past entries. */
export const mockSeedEntries: IntakeEntry[] = buildSeed();
