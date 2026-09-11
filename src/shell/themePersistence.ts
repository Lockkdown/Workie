import type { WorkieDB } from "../db/schema";
import {
  DEFAULT_THEME,
  THEME_SETTING_ID,
  isThemeSetting,
  type ThemeSetting,
} from "./theme";

export async function loadThemeSetting(db: WorkieDB): Promise<ThemeSetting> {
  const record = await db.settings.get(THEME_SETTING_ID);
  if (record && isThemeSetting(record.value)) {
    return record.value;
  }
  return DEFAULT_THEME;
}

export async function saveThemeSetting(
  db: WorkieDB,
  theme: ThemeSetting,
  now = Date.now(),
): Promise<void> {
  const existing = await db.settings.get(THEME_SETTING_ID);
  await db.settings.put({
    id: THEME_SETTING_ID,
    value: theme,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
