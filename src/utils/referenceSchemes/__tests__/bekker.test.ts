import { describe, it, expect } from "vitest";
import {
  bekkerScheme,
  isBekkerRef,
  parseBekkerReference,
  BEKKER_LINE_NUMBERS_TO_DISPLAY,
} from "../bekker";

describe("isBekkerRef", () => {
  it("accepts valid refs", () => {
    expect(isBekkerRef("791a1")).toBe(true);
    expect(isBekkerRef("791a10")).toBe(true);
    expect(isBekkerRef("799b35")).toBe(true);
  });

  it("rejects invalid refs", () => {
    expect(isBekkerRef("103a1")).toBe(true); // valid but Stephanus-shaped; we accept
    expect(isBekkerRef("not-a-ref")).toBe(false);
    expect(isBekkerRef("791c5")).toBe(false); // 'c' not valid for Bekker
    expect(isBekkerRef("")).toBe(false);
  });
});

describe("parseBekkerReference", () => {
  it("parses a standard ref", () => {
    expect(parseBekkerReference("791a10")).toEqual({
      page: "791",
      column: "a",
      line: "10",
    });
  });

  it("parses a single-digit line", () => {
    expect(parseBekkerReference("791a1")).toEqual({
      page: "791",
      column: "a",
      line: "1",
    });
  });

  it("parses b-column", () => {
    expect(parseBekkerReference("799b35")).toEqual({
      page: "799",
      column: "b",
      line: "35",
    });
  });

  it("returns null for invalid ref", () => {
    expect(parseBekkerReference("bad")).toBeNull();
  });
});

describe("bekkerScheme.parse", () => {
  it("returns parsed ref", () => {
    expect(bekkerScheme.parse("791a10")).toEqual({ page: "791", column: "a", line: "10" });
  });

  it("returns null for non-Bekker ref", () => {
    expect(bekkerScheme.parse("not-a-ref")).toBeNull();
  });
});

describe("bekkerScheme.showsBlockMarker", () => {
  it("shows at canonical Bekker cadence lines", () => {
    for (const line of BEKKER_LINE_NUMBERS_TO_DISPLAY) {
      expect(bekkerScheme.showsBlockMarker({ page: "791", column: "a", line })).toBe(true);
    }
  });

  it("does not show at non-canonical lines", () => {
    expect(bekkerScheme.showsBlockMarker({ page: "791", column: "a", line: "3" })).toBe(false);
    expect(bekkerScheme.showsBlockMarker({ page: "791", column: "a", line: "7" })).toBe(false);
  });
});

describe("bekkerScheme.blockMarker", () => {
  it("shows page+column on the very first line", () => {
    const parsed = { page: "791", column: "a", line: "1" };
    const result = bekkerScheme.blockMarker(parsed, { ref: "791a1", isFirstLine: true });
    expect(result).toBe("791a");
  });

  it("shows full page+column on first line of a new column (non-first)", () => {
    const parsed = { page: "793", column: "b", line: "1" };
    const result = bekkerScheme.blockMarker(parsed, { ref: "793b1", isFirstLine: false });
    expect(result).toBe("793b");
  });

  it("shows the line number otherwise", () => {
    const parsed = { page: "791", column: "a", line: "10" };
    const result = bekkerScheme.blockMarker(parsed, { ref: "791a10", isFirstLine: false });
    expect(result).toBe("10");
  });
});

describe("bekkerScheme.startingPageLabel", () => {
  it("extracts page number from ref", () => {
    expect(bekkerScheme.startingPageLabel?.("791a1")).toBe("791");
  });
});
