/** The manual theme switch (plan §19 names only the OS setting; the switch is the owner-approved option O6, D-032).
 *  `system` means "follow prefers-color-scheme": no attribute is set. Storage is a per-browser convenience only. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "pw_theme";

export function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function readStoredTheme(): ThemePreference {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function applyTheme(theme: ThemePreference): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage can be blocked (private window); the theme still applies for this page
  }
}
