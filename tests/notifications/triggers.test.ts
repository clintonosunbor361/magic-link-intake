import { describe, expect, it } from "vitest";
import { dueTriggers, mayEmail, shiftDays, triggerFireDate } from "@/lib/notifications/triggers";

const DUE = "2026-09-10";

describe("triggerFireDate", () => {
  it("fires lead-time triggers the stated number of days before the deadline", () => {
    expect(triggerFireDate(DUE, "days_7")).toBe("2026-09-03");
    expect(triggerFireDate(DUE, "days_3")).toBe("2026-09-07");
    expect(triggerFireDate(DUE, "days_1")).toBe("2026-09-09");
  });

  it("fires overdue on the first day past the deadline, not on the deadline itself", () => {
    expect(triggerFireDate(DUE, "overdue")).toBe("2026-09-11");
  });

  it("crosses month and year boundaries by calendar day", () => {
    expect(triggerFireDate("2026-01-05", "days_7")).toBe("2025-12-29");
    expect(triggerFireDate("2026-12-31", "overdue")).toBe("2027-01-01");
  });
});

describe("dueTriggers", () => {
  it("reports nothing while the deadline is still far off", () => {
    expect(dueTriggers({ dueDate: DUE, today: "2026-09-02" })).toEqual([]);
  });

  it("adds each trigger on the day it lands", () => {
    expect(dueTriggers({ dueDate: DUE, today: "2026-09-03" })).toEqual(["days_7"]);
    expect(dueTriggers({ dueDate: DUE, today: "2026-09-07" })).toEqual(["days_7", "days_3"]);
    expect(dueTriggers({ dueDate: DUE, today: "2026-09-09" })).toEqual(["days_7", "days_3", "days_1"]);
  });

  it("does not treat the deadline day itself as overdue", () => {
    expect(dueTriggers({ dueDate: DUE, today: DUE })).toEqual(["days_7", "days_3", "days_1"]);
  });

  it("adds overdue the day after the deadline", () => {
    expect(dueTriggers({ dueDate: DUE, today: "2026-09-11" })).toEqual([
      "days_7",
      "days_3",
      "days_1",
      "overdue",
    ]);
  });

  it("still reports every missed trigger long after the fact, so a cron outage loses nothing", () => {
    // The dashboard record must be complete even if the cron was down for a month.
    expect(dueTriggers({ dueDate: DUE, today: "2026-10-15" })).toEqual([
      "days_7",
      "days_3",
      "days_1",
      "overdue",
    ]);
  });

  it("reports overdue for a deadline that was already past when first seen", () => {
    expect(dueTriggers({ dueDate: "2026-01-01", today: "2026-09-10" })).toContain("overdue");
  });
});

describe("mayEmail", () => {
  it("allows email only on the day a trigger lands", () => {
    expect(mayEmail({ dueDate: DUE, trigger: "days_7", today: "2026-09-03" })).toBe(true);
    expect(mayEmail({ dueDate: DUE, trigger: "overdue", today: "2026-09-11" })).toBe(true);
  });

  it("suppresses email for a trigger whose day has passed, so a backlog is never blasted out", () => {
    expect(mayEmail({ dueDate: DUE, trigger: "days_7", today: "2026-09-09" })).toBe(false);
    expect(mayEmail({ dueDate: DUE, trigger: "overdue", today: "2026-10-15" })).toBe(false);
  });

  it("suppresses email before the trigger day", () => {
    expect(mayEmail({ dueDate: DUE, trigger: "days_3", today: "2026-09-01" })).toBe(false);
  });
});

describe("date-change re-arming", () => {
  it("produces a different fire date when a deadline moves, re-arming the trigger", () => {
    // The notification key includes the due date, so moving a deadline out re-arms its warnings
    // rather than leaving the item silently un-warned for its new date.
    const before = triggerFireDate("2026-09-10", "days_7");
    const after = triggerFireDate("2026-10-20", "days_7");
    expect(before).not.toBe(after);
    expect(after).toBe("2026-10-13");
  });
});

describe("shiftDays", () => {
  it("moves by calendar days across a leap day", () => {
    expect(shiftDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});
