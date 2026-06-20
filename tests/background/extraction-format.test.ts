import { describe, it, expect } from "vitest";
import { formatResults } from "@/background/services/extraction-engine";

describe("formatResults", () => {
  describe("markdown", () => {
    it("escapes pipe characters so the table is not corrupted", () => {
      const out = formatResults([{ col: "a|b" }], "markdown");
      expect(out).toContain("a\\|b");
    });

    it("collapses newlines in a cell to a space (a newline would break the row)", () => {
      const out = formatResults([{ col: "line1\nline2" }], "markdown");
      expect(out).toContain("line1 line2");
      expect(out.split("\n")).toHaveLength(3); // header, separator, single row
    });
  });

  describe("html", () => {
    it("escapes markup in cell content (no raw tags emitted)", () => {
      const out = formatResults([{ col: "<script>alert(1)</script>" }], "html");
      expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(out).not.toContain("<script>");
    });

    it("escapes header names", () => {
      const out = formatResults([{ "<b>": "x" }], "html");
      expect(out).toContain("<th>&lt;b&gt;</th>");
    });
  });

  describe("xml", () => {
    it("escapes &, <, > in text content", () => {
      const out = formatResults([{ note: "a & b < c > d" }], "xml");
      expect(out).toContain("a &amp; b &lt; c &gt; d");
    });

    it("sanitizes field keys into valid XML element names", () => {
      const out = formatResults([{ "first name": "x", "1col": "y" }], "xml");
      expect(out).toContain("<first_name>x</first_name>");
      expect(out).toContain("<_1col>y</_1col>");
    });
  });

  describe("csv", () => {
    it("still quotes cells containing commas", () => {
      const out = formatResults([{ col: "a,b" }], "csv");
      expect(out).toContain('"a,b"');
    });
  });
});
