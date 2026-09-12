import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import noAlertConfirmPrompt from "./eslint-rules/no-alert-confirm-prompt.js";
import noNonIdbAwaitInTransaction from "./eslint-rules/no-non-idb-await-in-transaction.js";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      workie: {
        rules: {
          "no-alert-confirm-prompt": noAlertConfirmPrompt,
          "no-non-idb-await-in-transaction": noNonIdbAwaitInTransaction,
        },
      },
    },
    rules: {
      "workie/no-alert-confirm-prompt": "error",
      "workie/no-non-idb-await-in-transaction": "error",
    },
  },
);
