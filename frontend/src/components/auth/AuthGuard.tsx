"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredSession, hydrateSessionFromSupabase, clearSession } from "@/lib/auth";
import { Logo } from "@/components/layout/Logo";

/**
 * Client-side gate for the signed-in app. Blocks all dashboard UI until a
 * real session exists; otherwise clears stale cookies and sends to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (getStoredSession()) {
        if (!cancelled) setReady(true);
        return;
      }
      const hydrated = await hydrateSessionFromSupabase();
      if (cancelled) return;
      if (hydrated) {
        setReady(true);
      } else {
        clearSession();
        router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app-bg text-ink">
        <Logo />
        <span
          className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-teal border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <>{children}</>;
}
