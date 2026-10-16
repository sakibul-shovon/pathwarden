import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const KEY = "pw_theme";
const listeners = new Set<() => void>();
const media = window.matchMedia("(prefers-color-scheme: dark)");

function readPref(): ThemePref {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "dark" || stored === "system") return stored;
  } catch {
    /* storage blocked: light is the default */
  }
  return "light";
}

let pref: ThemePref = readPref();

function resolve(p: ThemePref): Theme {
  if (p === "system") return media.matches ? "dark" : "light";
  return p;
}

/** Writes the resolved theme on <html>; `index.html` runs the same logic before first paint. */
function apply(): void {
  const root = document.documentElement;
  const theme = resolve(pref);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b0d10" : "#f4f5f7");
  listeners.forEach((l) => l());
}

media.addEventListener("change", () => {
  if (pref === "system") apply();
});

export function setThemePref(next: ThemePref): void {
  pref = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* the choice then lasts for this visit only */
  }
  apply();
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** The preference and the theme it resolves to; re-renders on any change (graphs read colours in JS). */
export function useTheme(): { pref: ThemePref; theme: Theme } {
  const theme = useSyncExternalStore(subscribe, () => resolve(pref));
  return { pref, theme };
}

apply();
