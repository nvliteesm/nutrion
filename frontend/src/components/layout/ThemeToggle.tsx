"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { resolvedTheme, toggleTheme, type Theme } from "@/lib/theme";

/** Light/dark switch. Reads the class set by the pre-paint init script. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolvedTheme());
  }, []);

  function handleToggle() {
    setTheme(toggleTheme());
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={
        className ??
        "inline-flex h-9 items-center gap-2 rounded-card-sm border border-line-2 px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-app-bg"
      }
    >
      {isDark ? <MoonIcon size={16} /> : <SunIcon size={16} />}
      {isDark ? "Dark" : "Light"}
    </button>
  );
}
