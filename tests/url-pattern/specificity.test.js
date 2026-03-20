import { describe, it, expect } from "vitest";
import { getSpecificity, compareSpecificity, sortBySpecificity, } from "@/shared/url-pattern/specificity";
// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function exact(value) {
    return { type: "exact", value };
}
function globNoWildcardHost(value) {
    return { type: "glob", value };
}
function globWildcardHost(value) {
    // value starts with "*" so getSpecificity returns 60
    return { type: "glob", value };
}
function regex(value) {
    return { type: "regex", value };
}
function global() {
    return { type: "global", value: "" };
}
// ---------------------------------------------------------------------------
// getSpecificity
// ---------------------------------------------------------------------------
describe("getSpecificity", () => {
    it("returns 100 for exact patterns", () => {
        expect(getSpecificity(exact("github.com"))).toBe(100);
    });
    it("returns 80 for glob patterns without a wildcard host", () => {
        expect(getSpecificity(globNoWildcardHost("github.com/user/*"))).toBe(80);
    });
    it("returns 60 for glob patterns with a wildcard host", () => {
        expect(getSpecificity(globWildcardHost("*.github.com"))).toBe(60);
    });
    it("returns 40 for regex patterns", () => {
        expect(getSpecificity(regex("^https://github\\.com/.*"))).toBe(40);
    });
    it("returns 0 for global patterns", () => {
        expect(getSpecificity(global())).toBe(0);
    });
});
// ---------------------------------------------------------------------------
// compareSpecificity
// ---------------------------------------------------------------------------
describe("compareSpecificity", () => {
    it("returns positive when a is more specific than b", () => {
        expect(compareSpecificity(exact("a.com"), global())).toBeGreaterThan(0);
    });
    it("returns negative when a is less specific than b", () => {
        expect(compareSpecificity(global(), exact("a.com"))).toBeLessThan(0);
    });
    it("returns 0 when both have the same specificity", () => {
        expect(compareSpecificity(exact("a.com"), exact("b.com"))).toBe(0);
    });
    it("ranks exact > glob(no wildcard host)", () => {
        expect(compareSpecificity(exact("a.com"), globNoWildcardHost("a.com/*"))).toBeGreaterThan(0);
    });
    it("ranks glob(no wildcard host) > glob(wildcard host)", () => {
        expect(compareSpecificity(globNoWildcardHost("a.com/*"), globWildcardHost("*.a.com"))).toBeGreaterThan(0);
    });
    it("ranks glob(wildcard host) > regex", () => {
        expect(compareSpecificity(globWildcardHost("*.a.com"), regex("^https://a\\.com"))).toBeGreaterThan(0);
    });
    it("ranks regex > global", () => {
        expect(compareSpecificity(regex("^https://a\\.com"), global())).toBeGreaterThan(0);
    });
});
// ---------------------------------------------------------------------------
// sortBySpecificity
// ---------------------------------------------------------------------------
describe("sortBySpecificity", () => {
    it("sorts items from most specific to least specific", () => {
        const items = [
            { name: "global", scope: global() },
            { name: "regex", scope: regex("^https://a\\.com") },
            { name: "glob-wildcard", scope: globWildcardHost("*.a.com") },
            { name: "glob-no-wildcard", scope: globNoWildcardHost("a.com/*") },
            { name: "exact", scope: exact("a.com") },
        ];
        const sorted = sortBySpecificity(items);
        expect(sorted.map((i) => i.name)).toEqual([
            "exact",
            "glob-no-wildcard",
            "glob-wildcard",
            "regex",
            "global",
        ]);
    });
    it("does not mutate the original array", () => {
        const items = [
            { name: "global", scope: global() },
            { name: "exact", scope: exact("a.com") },
        ];
        const original = [...items];
        sortBySpecificity(items);
        expect(items).toEqual(original);
    });
    it("maintains relative order for items with same specificity", () => {
        const items = [
            { name: "exact-a", scope: exact("a.com") },
            { name: "exact-b", scope: exact("b.com") },
            { name: "exact-c", scope: exact("c.com") },
        ];
        const sorted = sortBySpecificity(items);
        // All have specificity 100, so they should keep their original order
        expect(sorted.map((i) => i.name)).toEqual([
            "exact-a",
            "exact-b",
            "exact-c",
        ]);
    });
    it("handles an empty array", () => {
        const sorted = sortBySpecificity([]);
        expect(sorted).toEqual([]);
    });
    it("handles a single-element array", () => {
        const items = [{ name: "only", scope: exact("a.com") }];
        const sorted = sortBySpecificity(items);
        expect(sorted).toEqual(items);
    });
    it("correctly sorts a realistic mix of scoped entities", () => {
        const items = [
            { name: "catch-all", scope: global() },
            { name: "github-exact", scope: exact("github.com") },
            { name: "github-repos", scope: globNoWildcardHost("github.com/*/repos") },
            { name: "github-regex", scope: regex("^https://github\\.com/user") },
            { name: "github-subdomain", scope: globWildcardHost("*.github.com") },
        ];
        const sorted = sortBySpecificity(items);
        expect(sorted.map((i) => i.name)).toEqual([
            "github-exact",
            "github-repos",
            "github-subdomain",
            "github-regex",
            "catch-all",
        ]);
    });
});
