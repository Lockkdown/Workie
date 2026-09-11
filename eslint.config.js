import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
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
          "no-non-idb-await-in-transaction": noNonIdbAwaitInTransaction,
        },
      },
    },
    rules: {
      "workie/no-non-idb-await-in-transaction": "error",
    },
  },
);
