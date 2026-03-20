import type { UrlPattern } from "../types/entities";

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
