import path from "node:path";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine in CI, where real env vars are injected directly.
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globalSetup: "./lib/db/test-global-setup.ts",
    // All test files share one real Postgres test database (truncated
    // between tests, not per-file-isolated) — running files in parallel
    // lets one file's TRUNCATE ... CASCADE wipe rows another concurrently
    // running file is actively using. Small suite, so sequential is cheap.
    fileParallelism: false,
    env: {
      // Redirects lib/db/client.ts (and anything importing it) at the
      // throwaway test database instead of the real dev one.
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
    },
  },
});
