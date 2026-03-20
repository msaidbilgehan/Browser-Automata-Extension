import type { UrlPattern } from "../types/entities";

/** Validation result for a URL pattern */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate a UrlPattern's value for its type */
export function validateUrlPattern(pattern: UrlPattern): ValidationResult {
  switch (pattern.type) {
    case "global":
      return { valid: true };

    case "exact":
      if (!pattern.value.trim()) {
        return { valid: false, error: "Domain cannot be empty" };
      }
      // Should not contain protocol or path
      if (pattern.value.includes("://")) {
        return { valid: false, error: "Use hostname only (no protocol)" };
      }
      if (pattern.value.includes("/")) {
        return { valid: false, error: "Use hostname only (no path). Use glob for path matching." };
      }
      return { valid: true };

    case "glob":
      if (!pattern.value.trim()) {
        return { valid: false, error: "Pattern cannot be empty" };
      }
      return { valid: true };

    case "regex":
      if (!pattern.value.trim()) {
        return { valid: false, error: "Pattern cannot be empty" };
      }
      try {
        new RegExp(pattern.value);
        return { valid: true };
      } catch (e) {
        return {
          valid: false,
          error: `Invalid regex: ${e instanceof SyntaxError ? e.message : "Unknown error"}`,
        };
      }
  }
}

/** Extract the domain from a full URL */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/** Create a UrlPattern matching a specific domain */
export function domainPattern(domain: string): UrlPattern {
  return { type: "exact", value: domain };
}

/** Create a global UrlPattern */
export function globalPattern(): UrlPattern {
  return { type: "global", value: "" };
}
