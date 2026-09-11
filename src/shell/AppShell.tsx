import { useState } from "react";
import { AppNav } from "./AppNav";
import { DailyDesk } from "./DailyDesk";
import {
  DEFAULT_DESTINATION,
  DEFAULT_DESK_MODE,
  type Destination,
  type DeskMode,
} from "./destinations";
import { PlanTomorrow } from "./PlanTomorrow";
import { Reports } from "./Reports";
import { appDb } from "./appDb";
import {
  DEFAULT_THEME,
  applyThemeToDocument,
  type ThemeSetting,
} from "./theme";
import { saveThemeSetting } from "./themePersistence";
import { ThemeSettingControl } from "./ThemeSetting";

export type ShellViewProps = {
  destination: Destination;
  mode: DeskMode;
  theme: ThemeSetting;
  trayCollapsed: boolean;
  onDestination: (destination: Destination) => void;
  onMode: (mode: DeskMode) => void;
  onTheme: (theme: ThemeSetting) => void;
  onTrayCollapsed: (collapsed: boolean) => void;
};

export function ShellView({
  destination,
  mode,
  theme,
  trayCollapsed,
  onDestination,
  onMode,
  onTheme,
  onTrayCollapsed,
}: ShellViewProps) {
  return (
    <div className="app-shell">
      <header className="app-chrome ui-ornament" data-ornament="shell">
        <div className="ui-ornament-content app-chrome-inner">
          <h1 className="type-display-xl">Workie</h1>
          <AppNav destination={destination} onDestination={onDestination} />
          <ThemeSettingControl theme={theme} onTheme={onTheme} />
        </div>
      </header>
      <main className="app-main">
        {destination === "Daily Desk" ? (
          <DailyDesk
            mode={mode}
            trayCollapsed={trayCollapsed}
            onMode={onMode}
            onTrayCollapsed={onTrayCollapsed}
          />
        ) : null}
        {destination === "Plan Tomorrow" ? <PlanTomorrow /> : null}
        {destination === "Reports" ? <Reports /> : null}
      </main>
    </div>
  );
}

type AppShellProps = {
  initialTheme?: ThemeSetting;
};

export function AppShell({ initialTheme = DEFAULT_THEME }: AppShellProps) {
  const [destination, setDestination] =
    useState<Destination>(DEFAULT_DESTINATION);
  const [mode, setMode] = useState<DeskMode>(DEFAULT_DESK_MODE);
  const [theme, setTheme] = useState<ThemeSetting>(initialTheme);
  const [trayCollapsed, setTrayCollapsed] = useState(false);

  function handleTheme(next: ThemeSetting) {
    setTheme(next);
    applyThemeToDocument(next);
    void saveThemeSetting(appDb, next);
  }

  return (
    <ShellView
      destination={destination}
      mode={mode}
      theme={theme}
      trayCollapsed={trayCollapsed}
      onDestination={setDestination}
      onMode={setMode}
      onTheme={handleTheme}
      onTrayCollapsed={setTrayCollapsed}
    />
  );
}
