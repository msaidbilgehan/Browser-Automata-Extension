import type { UrlPattern, ScopeMode } from "../types/entities";

/**
 * Test if a URL matches a UrlPattern.
 *
 * @param pattern - The URL pattern to match against
 * @param url - The full URL to test
 * @returns true if the URL matches the pattern
 */
export function matchUrl(pattern: UrlPattern, url: string): boolean {
  if (pattern.type === "global") {
    return true;
  }

  if (pattern.type === "exact") {
    return matchExact(pattern.value, url);
  }

  if (pattern.type === "glob") {
    return matchGlob(pattern.value, url);
  }

  // pattern.type === "regex"
  return matchRegex(pattern.value, url);
}

/**
 * Exact domain match — compares hostname only.
 * Pattern value should be a hostname like "github.com".
 */
function matchExact(patternValue: string, url: string): boolean {
  const hostname = extractHostname(url);
  return hostname === patternValue;
}

/**
 * Glob pattern match — supports * wildcards.
 * Examples:
 *   "*.github.com" — matches any subdomain
 *   "github.com/user/*" — matches paths under /user/
 *   "*.example.com/*" — matches any subdomain + any path
 */
function matchGlob(patternValue: string, url: string): boolean {
  const regex = globToRegex(patternValue);
  // Match against hostname + pathname
  const parsed = safeParseUrl(url);
  if (!parsed) return false;

  const target = parsed.hostname + parsed.pathname;
  return regex.test(target);
}

/**
 * Regex pattern match — test against full URL.
 */
function matchRegex(patternValue: string, url: string): boolean {
  try {
    const regex = new RegExp(patternValue);
    return regex.test(url);
  } catch {
    return false;
  }
}

/**
 * Convert a glob pattern to a RegExp.
 * - Leading `*.` optionally matches a subdomain (e.g. `*.youtube.com` matches
 *   both `www.youtube.com` and `youtube.com`), following Chrome match-pattern
 *   conventions.
 * - A trailing `*` (after the last `/`) matches any remaining path depth,
 *   including nested segments.
 * - `*` in mid-path position matches a single segment (no `/`).
 * - `**` matches anything including `/`.
 * - `?` matches exactly one non-`/` character.
 */
export function globToRegex(glob: string): RegExp {
  // Handle leading *. (optional subdomain, Chrome match-pattern style)
  const hasLeadingWildcardSubdomain = glob.startsWith("*.");
  const normalised = hasLeadingWildcardSubdomain ? glob.slice(2) : glob;

  // Check if the pattern ends with /* (trailing wildcard path)
  const hasTrailingWildcard =
    normalised.endsWith("/*") && !normalised.endsWith("/**");

  const body = hasTrailingWildcard
    ? normalised.slice(0, -1) // remove the trailing *; we append .* later
    : normalised;

  let result = "^";

  if (hasLeadingWildcardSubdomain) {
    // Match optional subdomain: "www." or "" (bare domain)
    result += "([^/]+\\.)?";
  }

  let i = 0;
  while (i < body.length) {
    const char = body[i];
    if (char === "*" && body[i + 1] === "*") {
      result += ".*";
      i += 2;
    } else if (char === "*") {
      result += "[^/]*";
      i++;
    } else if (char === "?") {
      result += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(char ?? "")) {
      result += "\\" + (char ?? "");
      i++;
    } else {
      result += char ?? "";
      i++;
    }
  }

  if (hasTrailingWildcard) {
    result += ".*";
  }

  result += "$";
  return new RegExp(result);
}

/**
 * Extract the base domain from a single glob segment (no commas).
 * Handles protocol prefixes like `*://` or `https://` and leading `*.`
 * wildcards. Returns the root domain or null if indeterminate.
 */
function extractGlobSegmentDomain(segment: string): string | null {
  let value = segment.trim();
  // Strip protocol prefix: "*://", "https://", "http://", etc.
  const protoIdx = value.indexOf("://");
  if (protoIdx !== -1) {
    value = value.slice(protoIdx + 3);
  }
  // Strip leading *. (subdomain wildcard)
  if (value.startsWith("*.")) {
    value = value.slice(2);
  }
  // Take only the hostname part (before any /)
  const hostPart = value.split("/")[0];
  if (!hostPart) return null;
  // If hostname still contains wildcards, we can't determine a fixed domain
  if (hostPart.includes("*") || hostPart.includes("?")) return null;
  return hostPart.toLowerCase();
}

/**
 * Extract base domains from a UrlPattern.
 * Returns an array of domain strings for domain comparison, or null
 * if the domain cannot be reliably determined (e.g. complex regex).
 *
 * Handles comma-separated multi-patterns (e.g. `*.youtube.com/*,*.vimeo.com/*`)
 * and protocol prefixes (e.g. `*://*.youtube.com/*`).
 */
export function extractPatternDomains(pattern: UrlPattern): string[] | null {
  if (pattern.type === "global") return null;

  if (pattern.type === "exact") {
    return [pattern.value.toLowerCase()];
  }

  if (pattern.type === "glob") {
    // Split comma-separated patterns
    const segments = pattern.value.split(",");
    const domains: string[] = [];

    for (const segment of segments) {
      const domain = extractGlobSegmentDomain(segment);
      if (domain === null) return null; // One indeterminate segment → give up
      domains.push(domain);
    }

    return domains.length > 0 ? domains : null;
  }

  // regex — too complex to reliably extract a domain
  return null;
}

/** Check if two domains could match the same URL (same domain or parent/subdomain) */
function domainsOverlap(a: string, b: string): boolean {
  return a === b || a.endsWith("." + b) || b.endsWith("." + a);
}

/**
 * Check whether two URL-pattern scopes could match the same URL.
 *
 * When both patterns target deterministic domains we compare those
 * domains: `exact:"github.com"` vs `glob:"*.youtube.com"` → no overlap.
 *
 * Handles comma-separated multi-patterns and protocol prefixes.
 * For patterns whose domain cannot be extracted (regex, complex globs)
 * we conservatively assume overlap.
 */
export function scopesOverlap(a: UrlPattern, b: UrlPattern): boolean {
  // Global overlaps with everything
  if (a.type === "global" || b.type === "global") return true;

  // Identical pattern — definite overlap
  if (a.type === b.type && a.value === b.value) return true;

  // Extract domains from both patterns
  const domainsA = extractPatternDomains(a);
  const domainsB = extractPatternDomains(b);

  // If both domain lists are known, check if any pair could overlap
  if (domainsA !== null && domainsB !== null) {
    for (const da of domainsA) {
      for (const db of domainsB) {
        if (domainsOverlap(da, db)) return true;
      }
    }
    return false;
  }

  // Conservative: if we can't determine one or both domains, assume overlap
  return true;
}

function extractHostname(url: string): string {
  const parsed = safeParseUrl(url);
  return parsed?.hostname ?? "";
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Match a URL against own scope + optional target entity scope, respecting the scope mode.
 *
 * - "custom": use only ownScope (current behaviour)
 * - "follow": use the target entity's scope (fall back to ownScope if target unavailable)
 * - "override": both ownScope AND targetScope must match (intersection)
 */
export function matchUrlWithScopeMode(
  ownScope: UrlPattern,
  targetScope: UrlPattern | null,
  scopeMode: ScopeMode | undefined,
  url: string,
): boolean {
  const mode = scopeMode ?? "custom";
  switch (mode) {
    case "custom":
      return matchUrl(ownScope, url);
    case "follow":
      return targetScope !== null ? matchUrl(targetScope, url) : matchUrl(ownScope, url);
    case "override":
      return matchUrl(ownScope, url) && (targetScope !== null ? matchUrl(targetScope, url) : true);
  }
}
