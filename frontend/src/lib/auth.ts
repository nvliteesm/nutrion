import type { Subscription } from "./types";

/**
 * Dummy-first auth.
 *
 * Sessions live in localStorage so the whole flow works offline while the
 * backend is built. Swap `login`/`register` for real API calls later — keep
 * the signatures and the `Session` shape and the UI won't change.
 */

export interface Session {
  userId: string;
  fullName: string;
  email: string;
  initials: string;
  subscription: Subscription;
}

interface SeedAccount extends Session {
  password: string;
}

/** Demo accounts for judging: one Premium, one Free. Password: demo1234 */
export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    userId: "u_maya",
    fullName: "Maya Kessler",
    email: "maya@example.com",
    initials: "MK",
    subscription: "premium",
    password: "demo1234",
  },
  {
    userId: "u_alex",
    fullName: "Alex Rivera",
    email: "alex@example.com",
    initials: "AR",
    subscription: "free",
    password: "demo1234",
  },
];

const SESSION_KEY = "nutrion.session";

const delay = <T>(value: T, ms = 450): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function storeSession(session: Session): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export class AuthError extends Error {}

export async function login(
  email: string,
  password: string,
): Promise<Session> {
  await delay(null);
  const account = SEED_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account || account.password !== password) {
    throw new AuthError("Incorrect email or password.");
  }
  const { password: _password, ...session } = account;
  storeSession(session);
  return session;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<Session> {
  await delay(null);
  const email = input.email.trim().toLowerCase();
  if (SEED_ACCOUNTS.some((a) => a.email.toLowerCase() === email)) {
    throw new AuthError("An account with this email already exists.");
  }
  const session: Session = {
    userId: `u_${Date.now()}`,
    fullName: input.fullName.trim(),
    email,
    initials: initialsFrom(input.fullName),
    subscription: "free",
  };
  storeSession(session);
  return session;
}
