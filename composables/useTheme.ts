import { useEffect } from "react";

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", "dark");
}

/**
 * Applies the dark theme to <html>. Light mode has been removed.
 */
export function useTheme() {
  useEffect(() => {
    applyTheme();
  }, []);
}
