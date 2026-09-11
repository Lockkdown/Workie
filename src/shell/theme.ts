export const THEME_SETTINGS = ["System", "Dark", "Light"] as const;

export type ThemeSetting = (typeof THEME_SETTINGS)[number];

export const DEFAULT_THEME: ThemeSetting = "System";

export const THEME_SETTING_ID = "theme";

export type ThemeAttribute = "system" | "dark" | "light";

export function isThemeSetting(value: string): value is ThemeSetting {
  return (THEME_SETTINGS as readonly string[]).includes(value);
}

export function themeAttribute(theme: ThemeSetting): ThemeAttribute {
  if (theme === "Dark") {
    return "dark";
  }
  if (theme === "Light") {
    return "light";
  }
  return "system";
}

export function applyThemeToDocument(theme: ThemeSetting): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", themeAttribute(theme));
}
