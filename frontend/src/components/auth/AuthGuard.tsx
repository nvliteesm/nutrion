"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import { Logo } from "@/components/layout/Logo";

/**
 * Client-side gate for the signed-in app. Checks the stored session on mount
 * and redirects to /login when absent. Shows a brief branded splash while
 * checking to avoid a flash of protected content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getStoredSession()) {
      setReady(true);
    } else {
      router.replace("/login");
    }
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
