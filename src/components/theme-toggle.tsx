"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const THEME_KEY = "ws_theme";
const listeners = new Set<() => void>();

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" ? (stored as Theme) : getSystemTheme();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    listeners.forEach((l) => l());
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
