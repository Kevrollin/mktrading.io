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
      // The "server-only" package's default export condition throws
      // unconditionally (it's meant to fire inside a browser bundle) —
      // Next's own build sets a "react-server" condition for server-side
      // code that resolves it to a safe no-op instead, which Vitest
      // doesn't set. Setting that condition globally (an earlier attempt)
      // also changed how Next's own "next/navigation" resolves and broke
      // it, since that package has the same conditional-exports shape —
      // so instead this aliases just the one bare specifier directly to
      // its safe empty.js, without touching any other package's
      // resolution. Without this, any test importing
      // lib/trading/price-engine.ts (or anything that transitively does)
      // crashes on import.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
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
