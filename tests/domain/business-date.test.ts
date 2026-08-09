import { describe, expect, it } from "vitest";
import { businessToday, daysBetween, formatBusinessDate, toBusinessDate } from "@/lib/domain/business-date";

describe("toBusinessDate", () => {
  it("resolves an instant into the organization's calendar day, not the runtime's", () => {
    // 23:30 UTC is already the next day in Lagos (UTC+1).
    const instant = new Date("2026-08-07T23:30:00Z");

    expect(toBusinessDate(instant, "Africa/Lagos")).toBe("2026-08-08");
    expect(toBusinessDate(instant, "UTC")).toBe("2026-08-07");
  });

  it("handles a zone behind UTC", () => {
    const instant = new Date("2026-08-07T02:00:00Z");
    expect(toBusinessDate(instant, "America/New_York")).toBe("2026-08-06");
  });

  it("respects a daylight-saving offset rather than a fixed one", () => {
    // London is UTC+1 in August, so 23:30 UTC is already the 8th there.
    expect(toBusinessDate(new Date("2026-08-07T23:30:00Z"), "Europe/London")).toBe("2026-08-08");
    // In January it is UTC+0, so the same wall-clock instant stays on the 7th.
    expect(toBusinessDate(new Date("2026-01-07T23:30:00Z"), "Europe/London")).toBe("2026-01-07");
  });
});

describe("businessToday", () => {
  it("takes the reference instant as an argument so callers stay testable", () => {
    expect(businessToday("Africa/Lagos", new Date("2026-08-07T23:30:00Z"))).toBe("2026-08-08");
  });
});

describe("formatBusinessDate", () => {
  it("formats the recorded calendar day without timezone drift", () => {
    expect(formatBusinessDate("2026-08-09", "en-NG")).toBe("9 Aug 2026");
  });
});

describe("daysBetween", () => {
  it("counts whole calendar days in each direction", () => {
    expect(daysBetween("2026-08-07", "2026-08-10")).toBe(3);
    expect(daysBetween("2026-08-10", "2026-08-07")).toBe(-3);
    expect(daysBetween("2026-08-07", "2026-08-07")).toBe(0);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("counts a leap day", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("is unaffected by a daylight-saving transition between the two dates", () => {
    // Spanning the UK clock change: 30 civil days regardless of the 23-hour day inside the range.
    expect(daysBetween("2026-03-15", "2026-04-14")).toBe(30);
  });

  it("rejects a value that is not an ISO calendar day", () => {
    expect(() => daysBetween("07/08/2026", "2026-08-10")).toThrow("YYYY-MM-DD");
  });
});
