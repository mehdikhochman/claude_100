import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // Applies migrations to the test database once before the run.
    globalSetup: ["tests/setup/global.ts"],
    // Points DATABASE_URL at the test database before any module loads.
    setupFiles: ["tests/setup/env.ts"],
    // Booking tests share one database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
