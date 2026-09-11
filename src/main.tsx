import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { appDb } from "./shell/appDb";
import { DEFAULT_THEME, applyThemeToDocument } from "./shell/theme";
import { loadThemeSetting } from "./shell/themePersistence";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./ui/primitives.css";
import "./shell/shell.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root is missing");
}

void (async () => {
  const theme = await loadThemeSetting(appDb).catch(() => DEFAULT_THEME);
  applyThemeToDocument(theme);
  createRoot(root).render(
    <StrictMode>
      <App initialTheme={theme} />
    </StrictMode>,
  );
})();
