import { getToday } from "./date";

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type NotifKind =
  | "meal_reminder"
  | "drink_reminder"
  | "hydration"
  | "sugar_warning"
  | "daily_summary"
  | "weekly_summary"
  | "report_ready";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: NotifKind;
  createdAt: string;
  read: boolean;
}

const NOTIFS_KEY = "nutrion.notifications";

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

function seedNotifications(): AppNotification[] {
  const today = getToday();
  return [
    {
      id: "n1",
      title: "Sugar target approaching",
      body: "You've reached 80% of today's added-sugar target. Approximately 8 g remains.",
      kind: "sugar_warning",
      createdAt: `${today}T14:30:00`,
      read: false,
    },
    {
      id: "n2",
      title: "Hydration reminder",
      body: "You've logged 4 cups today — 4 more to reach your goal. Time for a glass?",
      kind: "hydration",
      createdAt: `${today}T13:00:00`,
      read: false,
    },
    {
      id: "n3",
      title: "Log your lunch",
      body: "It's past noon — have you eaten? Scan or log when you're ready.",
      kind: "meal_reminder",
      createdAt: `${today}T12:15:00`,
      read: true,
    },
    {
      id: "n4",
      title: "Yesterday's summary",
      body: "You stayed within target yesterday — 1,870 kcal, 36 g added sugar. Nice one.",
      kind: "daily_summary",
      createdAt: `${yesterday()}T21:00:00`,
      read: true,
    },
    {
      id: "n5",
      title: "Weekly summary",
      body: "Last week: avg 1,817 kcal/day, 31 g added sugar, 5 of 7 days within target.",
      kind: "weekly_summary",
      createdAt: `${daysAgoStr(3)}T09:00:00`,
      read: true,
    },
  ];
}

export function getNotifications(): AppNotification[] {
  const stored = read();
  if (stored) return stored;
  const seed = seedNotifications();
  write(seed);
  return seed;
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
