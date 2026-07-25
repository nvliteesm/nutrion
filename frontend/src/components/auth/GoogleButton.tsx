"use client";

import { useState } from "react";
import { AuthError, signInWithGoogle } from "@/lib/auth";
import { Button } from "@/components/ui";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

interface GoogleButtonProps {
  label?: string;
  onError?: (message: string) => void;
}

export function GoogleButton({
  label = "Continue with Google",
  onError,
}: GoogleButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await signInWithGoogle();
      // Browser redirects to Google; keep busy state.
    } catch (err) {
      setBusy(false);
      const message =
        err instanceof AuthError
          ? err.message
          : "Could not start Google sign-in.";
      onError?.(message);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      fullWidth
      disabled={busy}
      onClick={handleClick}
    >
      <GoogleGlyph />
      {busy ? "Redirecting…" : label}
    </Button>
  );
}

export function AuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        {label}
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
