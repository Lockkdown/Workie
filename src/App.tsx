import { AppShell } from "./shell/AppShell";
import { RootErrorBoundary } from "./shell/RootErrorBoundary";
import type { ThemeSetting } from "./shell/theme";

type AppProps = {
  initialTheme?: ThemeSetting;
};

export function App({ initialTheme }: AppProps) {
  return (
    <RootErrorBoundary>
      <AppShell initialTheme={initialTheme} />
    </RootErrorBoundary>
  );
}
