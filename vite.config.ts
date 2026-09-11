import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "eslint-rules/**/*.test.js"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
