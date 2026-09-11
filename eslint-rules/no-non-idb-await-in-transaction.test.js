import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./no-non-idb-await-in-transaction.js";

describe("workie/no-non-idb-await-in-transaction", () => {
  it("allows IndexedDB awaits and rejects other async work", () => {
    const tester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    });

    tester.run("no-non-idb-await-in-transaction", rule, {
      valid: [
        {
          code: "db.transaction('readwrite', db.tasks, async () => { await db.tasks.add({ id: '1' }); });",
        },
        {
          code: "db.transaction('readwrite', [db.tasks], async () => { await db.tasks.where('id').equals('1').toArray(); });",
        },
      ],
      invalid: [
        {
          code: "db.transaction('readwrite', db.tasks, async () => { await fetch('/batch'); });",
          errors: [{ messageId: "forbidden" }],
        },
        {
          code: "db.transaction('readwrite', db.tasks, async () => { await db.tasks.add({ id: '1' }); await new Promise((r) => setTimeout(r, 0)); });",
          errors: [{ messageId: "forbidden" }],
        },
      ],
    });
  });
});
