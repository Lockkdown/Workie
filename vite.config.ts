import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "eslint-rules/**/*.test.js"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
  },
});
