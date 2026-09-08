import { test } from "node:test";
import { runMigrationCloseout } from "./migration-closeout.mjs";
test(
  "WP09 supported migration workflow preserves history through read and rollback",
  { timeout: 120000 },
  () => {
    runMigrationCloseout();
  }
);
