import { useEffect, useState } from "react";
import {
  applyThemePreference,
  readStoredTheme,
  resolveEffectiveTheme,
  type ThemePreference,
} from "../theme";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === "undefined" ? "system" : readStoredTheme(),
  );
  const [effective, setEffective] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : resolveEffectiveTheme(readStoredTheme()),
  );

  useEffect(() => {
    applyThemePreference(preference);
    setEffective(resolveEffectiveTheme(preference));

    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setEffective(resolveEffectiveTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
  }

  return { preference, effective, setPreference };
}
