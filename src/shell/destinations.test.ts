import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppNav } from "./AppNav";
import { ShellView } from "./AppShell";
import { DailyDesk } from "./DailyDesk";
import { PlanTomorrow } from "./PlanTomorrow";
import { Reports } from "./Reports";
import {
  DEFAULT_DESTINATION,
  DEFAULT_DESK_MODE,
  DESK_MODES,
  DESTINATIONS,
} from "./destinations";
import { DEFAULT_THEME } from "./theme";

function navHtml(): string {
  return renderToStaticMarkup(
    createElement(AppNav, {
      destination: DEFAULT_DESTINATION,
      onDestination: () => undefined,
    }),
  );
}

function shellHtml(
  overrides: Partial<{
    destination: (typeof DESTINATIONS)[number];
    mode: (typeof DESK_MODES)[number];
    theme: "System" | "Dark" | "Light";
    trayCollapsed: boolean;
  }> = {},
): string {
  return renderToStaticMarkup(
    createElement(ShellView, {
      destination: DEFAULT_DESTINATION,
      mode: DEFAULT_DESK_MODE,
      theme: DEFAULT_THEME,
      trayCollapsed: false,
      onDestination: () => undefined,
      onMode: () => undefined,
      onTheme: () => undefined,
      onTrayCollapsed: () => undefined,
      ...overrides,
    }),
  );
}

describe("destinations", () => {
  it("exposes exactly Daily Desk, Plan Tomorrow, and Reports", () => {
    expect(DESTINATIONS).toEqual(["Daily Desk", "Plan Tomorrow", "Reports"]);
    expect(DESTINATIONS).toHaveLength(3);
    expect(DEFAULT_DESTINATION).toBe("Daily Desk");
  });

  it("renders those three names in app navigation and no peers", () => {
    const html = navHtml();
    expect(html).toContain('aria-label="App"');
    for (const name of DESTINATIONS) {
      expect(html).toContain(`>${name}<`);
    }
    expect(html.match(/class="app-nav-item/g)).toHaveLength(3);
    expect(html).not.toContain("Calendar");
    expect(html).not.toContain("Kanban");
    expect(html).not.toContain("Pomodoro");
    expect(html).not.toContain("Focus");
    expect(html).not.toContain("Category");
  });

  it("marks Daily Desk as the default current destination", () => {
    const html = shellHtml();
    expect(html).toContain('aria-current="page">Daily Desk<');
    expect(html).not.toContain('aria-current="page">Plan Tomorrow<');
    expect(html).not.toContain('aria-current="page">Reports<');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("Skip to main content");
  });
});

describe("Daily Desk modes", () => {
  it("defaults to Day among Tasks, Day, and Now", () => {
    expect(DESK_MODES).toEqual(["Tasks", "Day", "Now"]);
    expect(DEFAULT_DESK_MODE).toBe("Day");
    const html = renderToStaticMarkup(
      createElement(DailyDesk, {
        mode: DEFAULT_DESK_MODE,
        trayCollapsed: false,
        onMode: () => undefined,
        onTrayCollapsed: () => undefined,
      }),
    );
    expect(html).toContain('aria-label="Daily Desk mode"');
    expect(html).toContain('data-mode="Day"');
    expect(html).toContain('aria-checked="true">Day<');
    expect(html).not.toContain('aria-checked="true">Tasks<');
    expect(html).not.toContain('aria-checked="true">Now<');
    expect(html).toContain('data-zone="tray"');
    expect(html).toContain('data-zone="timeline"');
    expect(html).toContain('data-zone="now"');
  });
});

describe("primary action slots", () => {
  it("gives Daily Desk and Plan Tomorrow at most one filled primary slot", () => {
    const desk = shellHtml();
    const plan = renderToStaticMarkup(createElement(PlanTomorrow));
    expect(desk.match(/data-variant="primary"/g)).toBeNull();
    expect(plan.match(/data-variant="primary"/g)).toBeNull();
    expect(desk).toContain('data-primary-slot="daily-desk"');
    expect(plan).toContain('data-primary-slot="plan-tomorrow"');
  });

  it("gives Reports no prominent filled button", () => {
    const html = renderToStaticMarkup(createElement(Reports));
    expect(html).toContain(">Reports<");
    expect(html).not.toMatch(/data-variant="primary"/);
    expect(html).not.toContain("data-primary-slot");
  });
});

describe("theme change", () => {
  it("keeps destination hierarchy when the theme setting changes", () => {
    const system = shellHtml({ theme: "System" });
    const dark = shellHtml({ theme: "Dark" });
    expect(system).toContain('aria-label="App"');
    expect(dark).toContain('aria-label="App"');
    for (const name of DESTINATIONS) {
      expect(system).toContain(`>${name}<`);
      expect(dark).toContain(`>${name}<`);
    }
    expect(system).toContain('data-zone="timeline"');
    expect(dark).toContain('data-zone="timeline"');
    expect(system).toContain(">Daily Desk<");
    expect(dark).toContain(">Daily Desk<");
  });
});
