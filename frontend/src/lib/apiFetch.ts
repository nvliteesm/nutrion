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
  return fetch(input, {
    ...init,
    headers: auth,
  });
}
