import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./no-alert-confirm-prompt.js";

describe("workie/no-alert-confirm-prompt", () => {
  it("bans alert, confirm, and prompt calls and allows method names", () => {
    const tester = new RuleTester({
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    });

    tester.run("no-alert-confirm-prompt", rule, {
      valid: [
        { code: "function onConfirm() { return true; }" },
        { code: "dialog.confirm();" },
        { code: "form.reportValidity();" },
      ],
      invalid: [
        {
          code: "alert('kept');",
          errors: [{ messageId: "forbidden" }],
        },
        {
          code: "window.confirm('discard');",
          errors: [{ messageId: "forbidden" }],
        },
        {
          code: "globalThis.prompt('name');",
          errors: [{ messageId: "forbidden" }],
        },
        {
          code: "self.alert('kept');",
          errors: [{ messageId: "forbidden" }],
        },
      ],
    });
  });
});
