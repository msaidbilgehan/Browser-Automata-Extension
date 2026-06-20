import { CURRENT_SCHEMA_VERSION } from "../constants";
import { localStore } from "./chrome-storage";

/** A single migration step: from version N to N+1 */
interface Migration {
  version: number;
  migrate: () => Promise<void>;
}

/**
 * Sequential migrations. Each entry upgrades from (version - 1) to version.
 * Add new migrations at the end of this array as the schema evolves.
 *
 * Contract: every migration body MUST be idempotent — read all required keys,
 * transform in memory, then write once. The version bump is not transactional
 * with the migration write, so a crash mid-step (or a retry after a failed bump)
 * re-runs the body; idempotency guarantees that re-run is a no-op rather than a
 * double-application.
 */
const MIGRATIONS: Migration[] = [
  // Migration to version 1: initialize empty collections that don't exist yet.
  {
    version: 1,
    migrate: async () => {
      // Read all keys first, then write only the missing defaults in a single
      // set so a mid-step crash cannot leave a partial write behind.
      const patch: Record<string, unknown> = {};
      if ((await localStore.get("scripts")) === undefined) patch["scripts"] = {};
      if ((await localStore.get("shortcuts")) === undefined) patch["shortcuts"] = {};
      if ((await localStore.get("cssRules")) === undefined) patch["cssRules"] = {};
      if ((await localStore.get("log")) === undefined) patch["log"] = [];

      if (Object.keys(patch).length > 0) {
        await chrome.storage.local.set(patch);
      }
    },
  },
];

/**
 * Runs on extension install/update. Checks current schema version
 * and applies any pending migrations sequentially.
 *
 * Each migration step is wrapped in try-catch so a single failure
 * does not leave the schema in an inconsistent state. The schema
 * version is only bumped after a step succeeds.
 */
export async function runMigrations(): Promise<void> {
  const currentVersion = (await localStore.get("schemaVersion")) ?? 0;

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[Browser Automata] Stored schema v${String(currentVersion)} is newer than the ` +
        `supported v${String(CURRENT_SCHEMA_VERSION)} (older extension build?). ` +
        `Skipping migrations — data written by a newer version may not be fully compatible.`,
    );
    return;
  }

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return;
  }

  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pendingMigrations) {
    console.log(`[Browser Automata] Running migration to v${String(migration.version)}`);
    try {
      await migration.migrate();
      await localStore.set("schemaVersion", migration.version);
      console.log(`[Browser Automata] Migration to v${String(migration.version)} succeeded`);
    } catch (err) {
      console.error(
        `[Browser Automata] Migration to v${String(migration.version)} failed — stopping`,
        err,
      );
      // Stop applying further migrations so we don't skip a step
      return;
    }
  }

  console.log(`[Browser Automata] Schema migrated to v${String(CURRENT_SCHEMA_VERSION)}`);
}
