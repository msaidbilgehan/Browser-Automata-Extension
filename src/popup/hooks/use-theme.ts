import { useEffect } from "react";
import { useAppStore } from "../stores/app-store";

/**
 * Applies the selected theme to the document root element.
 * Handles "system", "light", and "dark" modes, including
 * a media-query listener for the "system" preference.
 */
export function useTheme(): void {
  const theme = useAppStore((s) => s.settings.ui.theme);

  useEffect(() => {
    const root = document.documentElement;

    function apply(mode: "light" | "dark") {
      root.classList.toggle("dark", mode === "dark");
    }

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");

      function onChange(e: MediaQueryListEvent) {
        apply(e.matches ? "dark" : "light");
      }
      mq.addEventListener("change", onChange);
      return () => {
        mq.removeEventListener("change", onChange);
      };
    }

    apply(theme);
    return undefined;
  }, [theme]);
}
