/**
 * Propagates the canonical version from package.json into every file that
 * hard-codes it, so the version can never drift after a release.
 *
 * Single source of truth:  package.json  "version"
 * Synced targets:
 *   - manifest.json   "version" field   (Chrome extension manifest)
 *   - README.md       "**Status:** v<x.y.z>" badge line
 *
 * Wired into the npm "version" lifecycle hook (see package.json), so
 * `npm version <patch|minor|major>` — and the release / release:minor /
 * release:major scripts that wrap it — rewrite these files and stage them
 * into the version-bump commit automatically. No manual edits, no drift.
 *
 * The build already injects pkg.version into the emitted manifest
 * (vite.config.ts); this keeps the *source* files in lockstep too, so what a
 * reader sees in the repo always matches what ships.
 *
 * Each target's pattern is asserted to match before substitution: if a file is
 * renamed or its version line is reworded, this fails loudly instead of
 * silently leaving the version stale.
 *
 * Usage:  tsx scripts/sync-version.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageJson {
  version: string;
}

interface SyncTarget {
  /** Path relative to the repo root. */
  readonly file: string;
  /** Must match exactly once; capture group 1 is the literal kept before the version. */
  readonly pattern: RegExp;
  /** Replacement using `$1` for the kept prefix and the injected version. */
  readonly replace: (version: string) => string;
}

const ROOT = resolve(import.meta.dirname ?? ".", "..");

function readText(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

const version = (JSON.parse(readText("package.json")) as PackageJson).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`package.json "version" is not clean semver: ${JSON.stringify(version)}`);
}

const TARGETS: readonly SyncTarget[] = [
  {
    file: "manifest.json",
    // First (and only) top-level "version": "x.y.z" in the manifest.
    pattern: /("version":\s*)"\d+\.\d+\.\d+"/,
    replace: (v) => `$1"${v}"`,
  },
  {
    file: "README.md",
    // The status badge line, e.g. `> **Status:** v0.2.8 · …`
    pattern: /(\*\*Status:\*\*\s+v)\d+\.\d+\.\d+/,
    replace: (v) => `$1${v}`,
  },
];

let changed = 0;

for (const target of TARGETS) {
  const before = readText(target.file);
  const matches = before.match(new RegExp(target.pattern, "g"));

  if (!matches || matches.length === 0) {
    throw new Error(
      `sync-version: no version marker found in ${target.file} ` +
        `(pattern ${String(target.pattern)}). Refusing to leave it stale.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `sync-version: ${String(matches.length)} version markers found in ${target.file}; ` +
        `expected exactly 1. Tighten the pattern.`,
    );
  }

  const after = before.replace(target.pattern, target.replace(version));
  if (after === before) {
    console.log(`  ${target.file.padEnd(14)} already ${version}`);
    continue;
  }

  writeFileSync(resolve(ROOT, target.file), after);
  console.log(`  ${target.file.padEnd(14)} → ${version}`);
  changed++;
}

console.log(
  changed > 0
    ? `\nSynced ${String(changed)} file(s) to version ${version}.`
    : `\nAll files already at version ${version}.`,
);
