import { getCurrentUserId } from "./auth";
import { getSupabase } from "./supabase";

let cachedToken: { value: string | null; at: number } | null = null;
const TOKEN_TTL_MS = 30_000;

/** Access token for Google users (Supabase session). Demo users have none. */
export async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now - cachedToken.at < TOKEN_TTL_MS) {
    return cachedToken.value;
  }
  const supabase = getSupabase();
  if (!supabase) {
    cachedToken = { value: null, at: now };
    return null;
  }
  const { data } = await supabase.auth.getSession();
  const value = data.session?.access_token ?? null;
  cachedToken = { value, at: now };
  return value;
}

/** Clear token cache after logout. */
export function clearAccessTokenCache(): void {
  cachedToken = null;
}

/** Headers for backend calls: Bearer when Google-signed-in. */
export async function apiAuthHeaders(
  extra?: HeadersInit,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "X-User-Id": getCurrentUserId(),
  };
  if (extra) {
    const h = new Headers(extra);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Resolve a relative API path against the deployed backend.
 * On Vercel we set NEXT_PUBLIC_BACKEND_URL to the Railway URL so the browser
 * talks straight to FastAPI — no Vercel proxy, no 60s gateway timeout on
 * long AI scans. In local dev the var is unset and relative paths proxy
 * through Next.js rewrites as before.
 */
function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
  const isLocalBackend =
    base?.startsWith("http://localhost") ||
    base?.startsWith("http://127.0.0.1");
  const isLocalPage =
    typeof window === "undefined" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (base && isLocalBackend && !isLocalPage) {
    return input;
  }
  if (base && typeof input === "string" && input.startsWith("/")) {
    return `${base}${input}`;
  }
  return input;
}

/** fetch() with auth headers merged in. */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const auth = await apiAuthHeaders(init?.headers);
  // Don't force Content-Type on FormData — browser sets boundary.
  const isForm =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (isForm) {
    delete auth["Content-Type"];
  }
  return fetch(resolveApiUrl(input), {
    ...init,
    headers: auth,
  });
}
