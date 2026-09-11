import { afterEach, describe, expect, it } from "vitest";
import { WorkieDB } from "../db/schema";
import { loadThemeSetting, saveThemeSetting } from "./themePersistence";

const opened: WorkieDB[] = [];

afterEach(async () => {
  await Promise.all(
    opened.splice(0).map(async (db) => {
      db.close();
      await db.delete();
    }),
  );
});

function openDb(): WorkieDB {
  const db = new WorkieDB(`theme-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

describe("theme persistence", () => {
  it("uses System when no setting has been stored", async () => {
    const db = openDb();
    await db.open();
    expect(await loadThemeSetting(db)).toBe("System");
  });

  it("remembers Dark across a simulated reload", async () => {
    const name = `theme-reload-${crypto.randomUUID()}`;
    const first = new WorkieDB(name);
    opened.push(first);
    await first.open();
    await saveThemeSetting(first, "Dark", 10);
    first.close();

    const second = new WorkieDB(name);
    opened.push(second);
    await second.open();
    expect(await loadThemeSetting(second)).toBe("Dark");
  });

  it("remembers Light and lets System be stored as an explicit choice", async () => {
    const db = openDb();
    await db.open();
    await saveThemeSetting(db, "Light", 20);
    expect(await loadThemeSetting(db)).toBe("Light");
    await saveThemeSetting(db, "System", 21);
    expect(await loadThemeSetting(db)).toBe("System");
    const stored = await db.settings.get("theme");
    expect(stored?.value).toBe("System");
    expect(stored?.createdAt).toBe(20);
    expect(stored?.updatedAt).toBe(21);
  });
});
