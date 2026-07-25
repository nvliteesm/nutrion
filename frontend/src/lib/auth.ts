import type { User } from "@supabase/supabase-js";
import type { Subscription } from "./types";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * Hybrid auth: demo accounts stay in localStorage for judging;
 * Google sign-in uses Supabase Auth. Keep the `Session` shape stable
 * so the rest of the UI does not care which path created it.
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
/** Cookie middleware reads to block dashboard routes before paint. */
export const AUTH_COOKIE = "nutrion_auth";

const delay = <T>(value: T, ms = 450): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function setAuthCookie(userId: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(userId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function storeSession(session: Session): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setAuthCookie(session.userId);
  }
}

export function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    // Keep cookie in sync if localStorage still has a session.
    setAuthCookie(session.userId);
    return session;
  } catch {
    return null;
  }
}

/**
 * Stable id for API scoping (Maya → `u_maya`, Alex → `u_alex`,
 * Google → Supabase Auth UUID). Prefer this over hardcoding `"default"`.
 */
export function getCurrentUserId(): string {
  return getStoredSession()?.userId ?? "default";
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
    clearAuthCookie();
  }
}

/** Clear local session and any Supabase Auth session. */
export async function logout(): Promise<void> {
  clearSession();
  const { clearAccessTokenCache } = await import("./apiFetch");
  clearAccessTokenCache();
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
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

/** Map a Supabase Auth user to the app Session shape. */
export function sessionFromSupabaseUser(user: User): Session {
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (user.email?.split("@")[0] ?? "User");
  return {
    userId: user.id,
    fullName,
    email: user.email ?? "",
    initials: initialsFrom(fullName),
    subscription: "free",
  };
}

/**
 * Start Google OAuth via Supabase. Redirects the browser away;
 * the callback route finishes the session.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new AuthError(
      "Google sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  const supabase = getSupabase();
  if (!supabase) {
    throw new AuthError("Google sign-in is unavailable.");
  }

  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    throw new AuthError(error.message);
  }
}

/**
 * If localStorage has no session but Supabase still has one (e.g. after
 * OAuth), hydrate and return it. Used by AuthGuard.
 */
export async function hydrateSessionFromSupabase(): Promise<Session | null> {
  const existing = getStoredSession();
  if (existing) return existing;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  const session = sessionFromSupabaseUser(data.session.user);
  storeSession(session);
  return session;
}

/**
 * Finish OAuth on `/auth/callback`, then store Session.
 * Prefers PKCE `?code=`; falls back to a session already detected in the URL
 * (hash tokens / detectSessionInUrl).
 */
export async function completeOAuthCallback(
  code?: string | null,
): Promise<Session> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new AuthError("Google sign-in is unavailable.");
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      throw new AuthError(
        error?.message ?? "Could not complete Google sign-in.",
      );
    }
    const session = sessionFromSupabaseUser(data.user);
    storeSession(session);
    return session;
  }

  // No code: wait briefly for client to parse hash / existing session.
  const { data: first } = await supabase.auth.getSession();
  if (first.session?.user) {
    const session = sessionFromSupabaseUser(first.session.user);
    storeSession(session);
    return session;
  }

  await new Promise((r) => setTimeout(r, 400));
  const { data: second } = await supabase.auth.getSession();
  if (second.session?.user) {
    const session = sessionFromSupabaseUser(second.session.user);
    storeSession(session);
    return session;
  }

  throw new AuthError(
    "Missing auth code. Add http://localhost:3000/auth/callback to Supabase Auth → URL Configuration → Redirect URLs, then try again.",
  );
}
