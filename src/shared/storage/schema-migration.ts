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
 */
const MIGRATIONS: Migration[] = [
  // Migration to version 1: initial schema — nothing to migrate, just set version
  {
    version: 1,
    migrate: async () => {
      // Initialize empty collections if they don't exist
      const scripts = await localStore.get("scripts");
      if (scripts === undefined) {
        await localStore.set("scripts", {});
      }
      const shortcuts = await localStore.get("shortcuts");
      if (shortcuts === undefined) {
        await localStore.set("shortcuts", {});
      }
      const cssRules = await localStore.get("cssRules");
      if (cssRules === undefined) {
        await localStore.set("cssRules", {});
      }
      const log = await localStore.get("log");
      if (log === undefined) {
        await localStore.set("log", []);
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
