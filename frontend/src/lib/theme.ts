export type Theme = "light" | "dark";

const KEY = "nutrion.theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "dark" || v === "light" ? v : null;
}

export function resolvedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = resolvedTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

/** Inline script that sets the theme before first paint (avoids flash).
 *  Defaults to dark to match the NutriON home design. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('nutrion.theme');var d=t!=='light';if(d)document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;
