import { AppShell } from "./shell/AppShell";
import type { ThemeSetting } from "./shell/theme";

type AppProps = {
  initialTheme?: ThemeSetting;
};

export function App({ initialTheme }: AppProps) {
  return <AppShell initialTheme={initialTheme} />;
}
