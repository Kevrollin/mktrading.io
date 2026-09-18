// Manually (re)creates and migrates the mktrading_test database — the
// same thing Vitest's globalSetup does automatically before every test
// run. Useful for inspecting the test DB's schema without running tests.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine in CI, where real env vars are injected directly.
}

import { setup } from "@/lib/db/test-global-setup";

setup()
  .then(() => {
    console.log("mktrading_test recreated and migrated.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to reset the test database:", error);
    process.exit(1);
  });
