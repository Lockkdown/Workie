import { THEME_SETTINGS, type ThemeSetting } from "./theme";

type ThemeSettingControlProps = {
  theme: ThemeSetting;
  onTheme: (theme: ThemeSetting) => void;
};

export function ThemeSettingControl({
  theme,
  onTheme,
}: ThemeSettingControlProps) {
  return (
    <fieldset className="theme-setting">
      <legend className="type-display-m">Theme</legend>
      <div className="theme-options">
        {THEME_SETTINGS.map((name) => (
          <label key={name} className="theme-option type-body-m">
            <input
              type="radio"
              name="theme"
              value={name}
              checked={theme === name}
              onChange={() => onTheme(name)}
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
