"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeOAuthCallback } from "@/lib/auth";
import { Logo } from "@/components/layout/Logo";

function CallbackSpinner({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app-bg text-ink">
      <Logo />
      <span
        className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-teal border-t-transparent"
        aria-label="Loading"
      />
      <p className="text-[13px] font-medium text-ink-2">{message}</p>
    </div>
  );
}

/**
 * OAuth redirect target. Supabase sends `?code=...` after Google consents;
 * we exchange it for a session and land on /today.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    const code = searchParams.get("code");
    const errorDescription =
      searchParams.get("error_description") ?? searchParams.get("error");

    if (errorDescription) {
      router.replace(
        `/login?error=${encodeURIComponent(errorDescription)}`,
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await completeOAuthCallback(code);
        if (!cancelled) router.replace("/today");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Google sign-in failed.";
        if (!cancelled) {
          setMessage(msg);
          router.replace(`/login?error=${encodeURIComponent(msg)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return <CallbackSpinner message={message} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackSpinner message="Finishing sign-in…" />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
