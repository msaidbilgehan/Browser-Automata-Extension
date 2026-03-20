import { describe, it, expect } from "vitest";
import { matchUrl, globToRegex } from "@/shared/url-pattern/matcher";
import type { UrlPattern } from "@/shared/types/entities";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function exact(value: string): UrlPattern {
  return { type: "exact", value };
}

function glob(value: string): UrlPattern {
  return { type: "glob", value };
}

function regex(value: string): UrlPattern {
  return { type: "regex", value };
}

function global(): UrlPattern {
  return { type: "global", value: "" };
}

// ---------------------------------------------------------------------------
// matchUrl — exact
// ---------------------------------------------------------------------------

describe("matchUrl — exact matching", () => {
  it("matches when the hostname equals the pattern value", () => {
    expect(matchUrl(exact("github.com"), "https://github.com/user/repo")).toBe(
      true,
    );
  });

  it("matches a bare hostname URL", () => {
    expect(matchUrl(exact("github.com"), "https://github.com")).toBe(true);
  });

  it("matches regardless of protocol", () => {
    expect(matchUrl(exact("github.com"), "http://github.com/page")).toBe(true);
  });

  it("does NOT match a different hostname", () => {
    expect(matchUrl(exact("github.com"), "https://gitlab.com")).toBe(false);
  });

  it("does NOT match a subdomain of the pattern hostname", () => {
    expect(matchUrl(exact("github.com"), "https://docs.github.com")).toBe(
      false,
    );
  });

  it("does NOT match when the pattern hostname is a substring", () => {
    expect(matchUrl(exact("git.com"), "https://github.com")).toBe(false);
  });

  it("returns false for an invalid URL", () => {
    expect(matchUrl(exact("github.com"), "not-a-url")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchUrl — glob
// ---------------------------------------------------------------------------

describe("matchUrl — glob matching", () => {
  describe("wildcard subdomain (*.host)", () => {
    it("matches a single subdomain when path is not constrained", () => {
      expect(
        matchUrl(glob("*.github.com/**"), "https://docs.github.com/page"),
      ).toBe(true);
    });

    it("matches a subdomain with root path only", () => {
      expect(
        matchUrl(glob("*.github.com/"), "https://docs.github.com/"),
      ).toBe(true);
    });

    it("matches the bare hostname (no subdomain) — Chrome match-pattern style", () => {
      expect(matchUrl(glob("*.github.com/"), "https://github.com/")).toBe(
        true,
      );
    });

    it("matches any single-level subdomain with root path", () => {
      expect(
        matchUrl(glob("*.example.com/"), "https://api.example.com/"),
      ).toBe(true);
      expect(
        matchUrl(glob("*.example.com/"), "https://www.example.com/"),
      ).toBe(true);
    });

    it("matches a multi-level subdomain", () => {
      expect(
        matchUrl(glob("*.example.com/"), "https://a.b.example.com/"),
      ).toBe(true);
    });
  });

  describe("wildcard path (host/*)", () => {
    it("matches a single path segment", () => {
      expect(matchUrl(glob("github.com/*"), "https://github.com/user")).toBe(
        true,
      );
    });

    it("matches a deeper path with trailing /* (any depth)", () => {
      // trailing /* now matches any path depth (Chrome match-pattern style)
      expect(
        matchUrl(glob("github.com/*"), "https://github.com/user/repo"),
      ).toBe(true);
    });

    it("matches the root path (empty segment)", () => {
      expect(matchUrl(glob("github.com/*"), "https://github.com/")).toBe(true);
    });
  });

  describe("double-star glob (**)", () => {
    it("matches any depth of path", () => {
      expect(
        matchUrl(glob("github.com/**"), "https://github.com/a/b/c"),
      ).toBe(true);
    });
  });

  describe("combined wildcard host + path", () => {
    it("matches subdomain and path together", () => {
      expect(
        matchUrl(
          glob("*.example.com/*"),
          "https://sub.example.com/path",
        ),
      ).toBe(true);
    });

    it("matches bare hostname with path (Chrome match-pattern style)", () => {
      expect(
        matchUrl(glob("*.example.com/*"), "https://example.com/path"),
      ).toBe(true);
    });

    it("matches deep paths with trailing /*", () => {
      expect(
        matchUrl(glob("*.example.com/*"), "https://sub.example.com/a/b/c"),
      ).toBe(true);
    });
  });

  describe("YouTube URL matching (real-world)", () => {
    it("matches www.youtube.com with any path", () => {
      expect(
        matchUrl(glob("*.youtube.com/*"), "https://www.youtube.com/watch?v=abc"),
      ).toBe(true);
    });

    it("matches bare youtube.com", () => {
      expect(
        matchUrl(glob("*.youtube.com/*"), "https://youtube.com/watch?v=abc"),
      ).toBe(true);
    });

    it("matches youtube.com shorts", () => {
      expect(
        matchUrl(glob("*.youtube.com/*"), "https://www.youtube.com/shorts/abc123"),
      ).toBe(true);
    });

    it("matches youtube.com channel pages", () => {
      expect(
        matchUrl(glob("*.youtube.com/*"), "https://www.youtube.com/channel/UCxxx"),
      ).toBe(true);
    });

    it("matches m.youtube.com (mobile)", () => {
      expect(
        matchUrl(glob("*.youtube.com/*"), "https://m.youtube.com/watch?v=abc"),
      ).toBe(true);
    });

    it("matches youtube.com root", () => {
      expect(
        matchUrl(glob("*.youtube.com/*"), "https://www.youtube.com/"),
      ).toBe(true);
    });
  });

  describe("question mark wildcard", () => {
    it("matches exactly one character", () => {
      expect(
        matchUrl(glob("example.com/ab?"), "https://example.com/abc"),
      ).toBe(true);
    });

    it("does NOT match zero characters", () => {
      expect(
        matchUrl(glob("example.com/ab?"), "https://example.com/ab"),
      ).toBe(false);
    });
  });

  it("returns false for an invalid URL", () => {
    expect(matchUrl(glob("*.github.com"), "not-a-url")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// matchUrl — regex
// ---------------------------------------------------------------------------

describe("matchUrl — regex matching", () => {
  it("matches a GitHub URL with a regex pattern", () => {
    expect(
      matchUrl(
        regex("^https://github\\.com/.*"),
        "https://github.com/user/repo",
      ),
    ).toBe(true);
  });

  it("does NOT match a non-GitHub URL", () => {
    expect(
      matchUrl(regex("^https://github\\.com/.*"), "https://gitlab.com/user"),
    ).toBe(false);
  });

  it("matches partial URLs when the regex allows it", () => {
    expect(matchUrl(regex("github"), "https://github.com")).toBe(true);
  });

  it("returns false for an invalid regex pattern (does not throw)", () => {
    expect(matchUrl(regex("[invalid("), "https://github.com")).toBe(false);
  });

  it("supports regex flags implicitly (case sensitive by default)", () => {
    expect(matchUrl(regex("^https://GitHub\\.com"), "https://github.com")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// matchUrl — global
// ---------------------------------------------------------------------------

describe("matchUrl — global matching", () => {
  it("matches any URL", () => {
    expect(matchUrl(global(), "https://github.com/user/repo")).toBe(true);
  });

  it("matches an empty string", () => {
    expect(matchUrl(global(), "")).toBe(true);
  });

  it("matches an invalid URL string", () => {
    expect(matchUrl(global(), "not-a-url")).toBe(true);
  });

  it("matches a localhost URL", () => {
    expect(matchUrl(global(), "http://localhost:3000")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchUrl — edge cases
// ---------------------------------------------------------------------------

describe("matchUrl — edge cases", () => {
  it("returns false for an empty pattern value with exact type", () => {
    expect(matchUrl(exact(""), "https://github.com")).toBe(false);
  });

  it("returns false for an empty URL with exact type", () => {
    expect(matchUrl(exact("github.com"), "")).toBe(false);
  });

  it("handles URLs with ports", () => {
    expect(matchUrl(exact("localhost"), "http://localhost:3000/page")).toBe(
      true,
    );
  });

  it("handles URLs with query strings (exact matches hostname only)", () => {
    expect(
      matchUrl(exact("example.com"), "https://example.com?foo=bar"),
    ).toBe(true);
  });

  it("handles URLs with fragments (exact matches hostname only)", () => {
    expect(
      matchUrl(exact("example.com"), "https://example.com#section"),
    ).toBe(true);
  });

  it("returns false for an unknown pattern type", () => {
    const unknown = { type: "unknown" as never, value: "test" };
    expect(matchUrl(unknown, "https://example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// globToRegex
// ---------------------------------------------------------------------------

describe("globToRegex", () => {
  it("converts a simple hostname to an anchored regex", () => {
    const re = globToRegex("example.com");
    expect(re.source).toBe("^example\\.com$");
  });

  it("converts leading *. to optional subdomain group", () => {
    const re = globToRegex("*.example.com");
    // ([^/]+\.)? makes the subdomain optional
    expect(re.test("www.example.com")).toBe(true);
    expect(re.test("example.com")).toBe(true);
    expect(re.test("a.b.example.com")).toBe(true);
  });

  it("converts ** to match-all wildcard", () => {
    const re = globToRegex("example.com/**");
    expect(re.test("example.com/a/b/c")).toBe(true);
  });

  it("converts trailing /* to match any path depth", () => {
    const re = globToRegex("example.com/*");
    expect(re.test("example.com/")).toBe(true);
    expect(re.test("example.com/user")).toBe(true);
    expect(re.test("example.com/user/repo")).toBe(true);
  });

  it("mid-path * still matches single segment only", () => {
    const re = globToRegex("*.example.com/*/page");
    expect(re.test("sub.example.com/section/page")).toBe(true);
    expect(re.test("sub.example.com/a/b/page")).toBe(false);
  });

  it("converts ? to single non-slash character", () => {
    const re = globToRegex("example.com/a?c");
    expect(re.test("example.com/abc")).toBe(true);
    expect(re.test("example.com/ac")).toBe(false);
  });

  it("escapes special regex characters", () => {
    const re = globToRegex("example.com/path+file");
    expect(re.test("example.com/path+file")).toBe(true);
    expect(re.test("example.com/pathXfile")).toBe(false);
  });

  it("produces a regex that is anchored at start and end", () => {
    const re = globToRegex("example.com");
    expect(re.test("example.com")).toBe(true);
    expect(re.test("sub.example.com")).toBe(false);
    expect(re.test("example.com.evil")).toBe(false);
  });

  it("handles an empty glob pattern", () => {
    const re = globToRegex("");
    expect(re.source).toBe("^$");
    expect(re.test("")).toBe(true);
    expect(re.test("anything")).toBe(false);
  });

  it("handles *.youtube.com/* pattern", () => {
    const re = globToRegex("*.youtube.com/*");
    expect(re.test("www.youtube.com/watch")).toBe(true);
    expect(re.test("youtube.com/watch")).toBe(true);
    expect(re.test("m.youtube.com/watch")).toBe(true);
    expect(re.test("www.youtube.com/shorts/abc")).toBe(true);
    expect(re.test("www.youtube.com/channel/UCxxx")).toBe(true);
    expect(re.test("www.youtube.com/")).toBe(true);
    expect(re.test("notyoutube.com/watch")).toBe(false);
  });
});
