import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie set by the client when a session exists (demo or Google). */
export const AUTH_COOKIE = "nutrion_auth";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/auth/callback",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isStaticOrApi(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/intakes") ||
    pathname.startsWith("/memory") ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/totals") ||
    pathname === "/chat" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  );
}

/** Next.js 16+ auth gate (replaces deprecated middleware.ts). */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticOrApi(pathname)) {
    return NextResponse.next();
  }

  const authed = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  // Root: send guests to login, signed-in users to Today.
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = authed ? "/today" : "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in → skip auth screens (except OAuth callback).
  if (authed && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  // Not signed in → block app + admin.
  if (!authed && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
