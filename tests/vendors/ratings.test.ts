import { describe, expect, it } from "vitest";
import { assertValidScores, hasScoreChanged, summarizeVendorRatings } from "@/lib/vendors/ratings";

describe("summarizeVendorRatings", () => {
  it("reports unrated for a Vendor with no ratings, rather than a misleading zero", () => {
    // This is the Milestone 5 reality: the table exists, the Milestone 7 prompt flow that fills it
    // does not, so the picker renders "Not rated yet" from this state.
    expect(summarizeVendorRatings([])).toEqual({ state: "unrated" });
  });

  it("averages each criterion and derives overall from the three", () => {
    const summary = summarizeVendorRatings([
      { quality: 5, timeliness: 3, communication: 4 },
      { quality: 4, timeliness: 2, communication: 5 },
    ]);

    expect(summary).toEqual({
      state: "rated",
      ratingCount: 2,
      quality: 4.5,
      timeliness: 2.5,
      communication: 4.5,
      overall: 3.8,
    });
  });

  it("never lets overall disagree with its own criteria", () => {
    const summary = summarizeVendorRatings([{ quality: 5, timeliness: 5, communication: 5 }]);
    expect(summary).toMatchObject({ overall: 5, quality: 5, timeliness: 5, communication: 5 });
  });

  it("rounds to one decimal place", () => {
    const summary = summarizeVendorRatings([
      { quality: 5, timeliness: 4, communication: 4 },
      { quality: 4, timeliness: 4, communication: 4 },
      { quality: 4, timeliness: 4, communication: 4 },
    ]);
    expect(summary).toMatchObject({ quality: 4.3, overall: 4.1 });
  });
});

describe("assertValidScores", () => {
  it("accepts whole numbers from 1 to 5", () => {
    expect(() => assertValidScores({ quality: 1, timeliness: 5, communication: 3 })).not.toThrow();
  });

  it.each([
    ["below range", { quality: 0, timeliness: 3, communication: 3 }],
    ["above range", { quality: 3, timeliness: 6, communication: 3 }],
    ["fractional", { quality: 3, timeliness: 3, communication: 4.5 }],
    ["not a number", { quality: Number.NaN, timeliness: 3, communication: 3 }],
  ])("rejects a score that is %s", (_label, scores) => {
    expect(() => assertValidScores(scores)).toThrow("whole number from 1 to 5");
  });
});

describe("hasScoreChanged", () => {
  it("detects a change in any single criterion", () => {
    const previous = { quality: 4, timeliness: 4, communication: 4 };

    expect(hasScoreChanged(previous, { ...previous })).toBe(false);
    expect(hasScoreChanged(previous, { ...previous, quality: 5 })).toBe(true);
    expect(hasScoreChanged(previous, { ...previous, timeliness: 3 })).toBe(true);
    expect(hasScoreChanged(previous, { ...previous, communication: 1 })).toBe(true);
  });
});
