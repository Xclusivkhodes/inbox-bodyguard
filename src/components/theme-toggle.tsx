"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

function ibToggleTheme() {
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  const current =
    attr === "light" || attr === "dark"
      ? attr
      : root.classList.contains("dark") || matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  root.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("ib-theme", next);
  } catch {
    /* private mode */
  }
}

export function ThemeToggle() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return (
    <button
      type="button"
      className="ib-theme-toggle"
      onClick={ibToggleTheme}
      aria-label="Switch between light and dark"
      title="Light / dark"
    >
      <Moon className="ib-theme-moon" aria-hidden="true" />
      <Sun className="ib-theme-sun" aria-hidden="true" />
    </button>
  );
}
