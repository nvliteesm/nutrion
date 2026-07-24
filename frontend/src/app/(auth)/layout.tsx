import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

/**
 * Centered, branded shell for the sign-in / sign-up screens.
 * No app navigation here — the user isn't inside the app yet.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-app-bg px-4 py-10">
      <Link href="/" aria-label="NutriON home" className="mb-6 text-ink">
        <Logo />
      </Link>

      <div className="w-full max-w-[400px]">{children}</div>

      <p className="mt-6 max-w-[360px] text-center text-[11px] font-medium leading-relaxed text-ink-3">
        NutriON provides nutrition tracking and educational information. It does
        not diagnose medical conditions or replace professional healthcare
        advice.
      </p>
    </div>
  );
}
