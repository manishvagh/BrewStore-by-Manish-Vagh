export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "brewstore-color-scheme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "system";
}

export function colorSchemeMetaContent(preference: ThemePreference): string {
  return preference === "system" ? "light dark" : preference;
}

export function applyThemePreference(preference: ThemePreference): void {
  const content = colorSchemeMetaContent(preference);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute("content", content);
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = content;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }

  void window.brewStore?.setTheme?.(preference);
}

export function resolveEffectiveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
