import { getToday } from "./date";
import { DEFAULT_TARGETS } from "./types";
import type { DailyTotals } from "./types";

export type NotifKind =
  | "meal_reminder"
  | "drink_reminder"
  | "hydration"
  | "sugar_warning"
  | "daily_summary"
  | "welcome";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: NotifKind;
  createdAt: string;
  read: boolean;
}

const NOTIFS_KEY = "nutrion.notifications.v2";

function read(): AppNotification[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(NOTIFS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return null;
  }
}

function write(notifs: AppNotification[]): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
  }
}

/**
 * Generate notifications dynamically from today's actual totals.
 * No hardcoded numbers — only real data-driven alerts.
 */
function generateFromTotals(totals: DailyTotals | null): AppNotification[] {
  const today = getToday();
  const now = new Date().toISOString();
  const notifs: AppNotification[] = [];

  if (!totals || totals.entryCount === 0) {
    // No entries yet today — show a friendly reminder.
    notifs.push({
      id: `${today}_welcome`,
      title: "Ready to track?",
      body: "No entries logged yet today. Scan a drink label or log a meal when you're ready.",
      kind: "welcome",
      createdAt: now,
      read: false,
    });
    return notifs;
  }

  const targets = DEFAULT_TARGETS;

  // Sugar approaching target (80%+)
  const sugarRatio = totals.totalSugar_g / targets.sugar_g;
  if (sugarRatio >= 1) {
    const over = Math.round(totals.totalSugar_g - targets.sugar_g);
    notifs.push({
      id: `${today}_sugar_over`,
      title: "Sugar target reached",
      body: `You're ${over} g over your ${targets.sugar_g} g sugar target today. An unsweetened option next time keeps things balanced.`,
      kind: "sugar_warning",
      createdAt: now,
      read: false,
    });
  } else if (sugarRatio >= 0.8) {
    const left = Math.round(targets.sugar_g - totals.totalSugar_g);
    notifs.push({
      id: `${today}_sugar_80`,
      title: "Sugar target approaching",
      body: `You've reached 80% of today's sugar target. Approximately ${left} g remains.`,
      kind: "sugar_warning",
      createdAt: now,
      read: false,
    });
  }

  // Hydration reminder
  if (totals.water_cups < targets.water_cups) {
    const toGo = targets.water_cups - totals.water_cups;
    notifs.push({
      id: `${today}_hydration`,
      title: "Hydration reminder",
      body: `You've logged ${totals.water_cups} cups today — ${toGo} more to reach your goal.`,
      kind: "hydration",
      createdAt: now,
      read: false,
    });
  }

  // Calorie info
  if (totals.calories > targets.calories) {
    notifs.push({
      id: `${today}_cal_over`,
      title: "Calorie target reached",
      body: `You've logged ${Math.round(totals.calories)} kcal today (target ${targets.calories}). Return to your usual target tomorrow.`,
      kind: "daily_summary",
      createdAt: now,
      read: false,
    });
  }

  if (notifs.length === 0) {
    notifs.push({
      id: `${today}_ontrack`,
      title: "Looking good",
      body: `${totals.entryCount} entries logged today, all within target. Keep it up.`,
      kind: "daily_summary",
      createdAt: now,
      read: false,
    });
  }

  return notifs;
}

/** Refresh notifications from real today's data. */
export function refreshNotifications(totals: DailyTotals | null): AppNotification[] {
  const generated = generateFromTotals(totals);
  write(generated);
  return generated;
}

export function getNotifications(): AppNotification[] {
  return read() ?? [];
}

export function markAllRead(): void {
  const notifs = getNotifications().map((n) => ({ ...n, read: true }));
  write(notifs);
}

export function markRead(id: string): void {
  const notifs = getNotifications().map((n) =>
    n.id === id ? { ...n, read: true } : n,
  );
  write(notifs);
}

export function unreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}
