import type { UrlPattern } from "../types/entities";

/**
 * Specificity ranking (highest priority first):
 *   1. exact    ("github.com")
 *   2. glob     ("github.com/user/*")     — no host wildcard
 *   3. glob     ("*.github.com")          — host wildcard
 *   4. regex    ("^https://github\\.com/.*")
 *   5. global   (matches everything)
 */

/** Get numeric specificity rank (higher = more specific) */
export function getSpecificity(pattern: UrlPattern): number {
  switch (pattern.type) {
    case "exact":
      return 100;
    case "glob":
      return hasHostWildcard(pattern.value) ? 60 : 80;
    case "regex":
      return 40;
    case "global":
      return 0;
  }
}

/**
 * Detect a wildcard in the host segment of a glob pattern.
 *
 * The protocol prefix (`*://`, `https://`, …) is stripped first so that
 * `*://*.github.com/*` and `https://*.github.com/*` are ranked identically —
 * both are host-wildcarded. A wildcard that appears only in the path (e.g.
 * `github.com/*`) does not count as a host wildcard.
 */
function hasHostWildcard(value: string): boolean {
  const protoIdx = value.indexOf("://");
  const afterProto = protoIdx !== -1 ? value.slice(protoIdx + 3) : value;
  const hostSegment = afterProto.split("/")[0] ?? "";
  return hostSegment.includes("*");
}

/**
 * Compare two patterns by specificity.
 * Returns negative if a is less specific, positive if a is more specific, 0 if equal.
 */
export function compareSpecificity(a: UrlPattern, b: UrlPattern): number {
  return getSpecificity(a) - getSpecificity(b);
}

/**
 * Sort items by their pattern specificity (most specific first).
 */
export function sortBySpecificity<TItem extends { scope: UrlPattern }>(items: TItem[]): TItem[] {
  return [...items].sort((a, b) => compareSpecificity(b.scope, a.scope));
}
