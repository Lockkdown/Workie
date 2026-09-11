import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_SETTINGS,
  isThemeSetting,
  themeAttribute,
} from "./theme";

describe("theme setting", () => {
  it("offers System, Dark, and Light with System as the first-run default", () => {
    expect(THEME_SETTINGS).toEqual(["System", "Dark", "Light"]);
    expect(DEFAULT_THEME).toBe("System");
    expect(themeAttribute("System")).toBe("system");
    expect(themeAttribute("Dark")).toBe("dark");
    expect(themeAttribute("Light")).toBe("light");
    expect(isThemeSetting("System")).toBe(true);
    expect(isThemeSetting("dark")).toBe(false);
  });
});
