import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileCSSRule } from "@/background/services/css-injector";
import type { CSSRule } from "@/shared/types/entities";
import { mockFn } from "../helpers";

/**
 * Regression tests for C4 — injected CSS was never removed on disable / delete /
 * edit (`chrome.scripting.removeCSS` appeared nowhere). reconcileCSSRule now
 * removes the previously-injected stylesheet and (re)injects the new one.
 */

function cssRule(id: string, css: string, enabled = true): CSSRule {
  return {
    id,
    name: `css-${id}`,
    css,
    scope: { type: "global", value: "" },
    enabled,
    injectAt: "document_idle",
    profileId: null,
    meta: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  } as CSSRule;
}

describe("reconcileCSSRule (C4)", () => {
  let globalEnabled: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    globalEnabled = true;
    mockFn(chrome.storage.sync.get).mockImplementation(async () => ({
      settings: { globalEnabled },
    }));
    mockFn(chrome.tabs.query).mockResolvedValue([{ id: 1, url: "https://example.com/" }]);
  });

  it("removes the stylesheet from open tabs when a rule is deleted", async () => {
    await reconcileCSSRule(cssRule("r1", "body{color:red}"), undefined);

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: "body{color:red}",
    });
    expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
  });

  it("removes the stylesheet when a rule is disabled", async () => {
    await reconcileCSSRule(
      cssRule("r1", "body{color:red}", true),
      cssRule("r1", "body{color:red}", false),
    );

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: "body{color:red}",
    });
    expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
  });

  it("removes the old stylesheet and inserts the new one on edit", async () => {
    await reconcileCSSRule(cssRule("r1", "body{color:red}"), cssRule("r1", "body{color:blue}"));

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: "body{color:red}",
    });
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: "body{color:blue}",
    });
  });

  it("injects into matching tabs when a rule is created", async () => {
    await reconcileCSSRule(undefined, cssRule("r1", "body{color:green}"));

    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: "body{color:green}",
    });
    expect(chrome.scripting.removeCSS).not.toHaveBeenCalled();
  });

  it("does nothing when the CSS is unchanged and still applies (avoids a flash)", async () => {
    await reconcileCSSRule(cssRule("r1", "body{color:red}"), cssRule("r1", "body{color:red}"));

    expect(chrome.scripting.removeCSS).not.toHaveBeenCalled();
    expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
  });

  it("does not inject when globally disabled, but still removes stale CSS", async () => {
    globalEnabled = false;

    await reconcileCSSRule(cssRule("r1", "body{color:red}"), cssRule("r1", "body{color:blue}"));

    expect(chrome.scripting.removeCSS).toHaveBeenCalledWith({
      target: { tabId: 1 },
      css: "body{color:red}",
    });
    expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
  });
});
