import { describe, expect, it } from "vitest";
import {
  assertConfirmable,
  assertFittingTransitionAllowed,
  assertReschedulable,
  isOpenFittingStatus,
  isTerminalFittingStatus,
  parseScheduledAt,
} from "@/lib/fittings/fitting";

describe("fitting terminal states", () => {
  it("treats completed, missed and cancelled as terminal and scheduled as open", () => {
    expect(isOpenFittingStatus("scheduled")).toBe(true);
    for (const status of ["completed", "missed", "cancelled"] as const) {
      expect(isTerminalFittingStatus(status)).toBe(true);
      expect(isOpenFittingStatus(status)).toBe(false);
    }
  });
});

describe("assertFittingTransitionAllowed", () => {
  it("allows a scheduled Fitting to reach any other state", () => {
    for (const next of ["completed", "missed", "cancelled"] as const) {
      expect(() => assertFittingTransitionAllowed("scheduled", next)).not.toThrow();
    }
  });

  it("refuses to move a Fitting that has already concluded", () => {
    // Correcting a concluded fitting means booking a repeat, not reopening a record the client may
    // already have confirmed.
    expect(() => assertFittingTransitionAllowed("completed", "scheduled")).toThrow("repeat Fitting");
    expect(() => assertFittingTransitionAllowed("missed", "completed")).toThrow("repeat Fitting");
    expect(() => assertFittingTransitionAllowed("cancelled", "scheduled")).toThrow("repeat Fitting");
  });

  it("rejects a no-op transition", () => {
    expect(() => assertFittingTransitionAllowed("scheduled", "scheduled")).toThrow("already at that status");
  });
});

describe("assertReschedulable", () => {
  it("allows moving a scheduled Fitting", () => {
    expect(() => assertReschedulable("scheduled")).not.toThrow();
  });

  it("refuses to move a concluded Fitting, which would erase what happened", () => {
    expect(() => assertReschedulable("missed")).toThrow("cannot be rescheduled");
    expect(() => assertReschedulable("completed")).toThrow("cannot be rescheduled");
    expect(() => assertReschedulable("cancelled")).toThrow("cannot be rescheduled");
  });
});

describe("assertConfirmable", () => {
  it("allows confirmation of a scheduled appointment without outcome notes", () => {
    expect(() => assertConfirmable("scheduled")).not.toThrow();
  });
  it.each(["completed", "missed", "cancelled"] as const)("rejects a %s appointment", (status) => {
    expect(() => assertConfirmable(status)).toThrow("Only a scheduled Fitting");
  });
});

describe("parseScheduledAt", () => {
  it("accepts a datetime-local value", () => {
    expect(parseScheduledAt("2026-09-05T14:30").toISOString()).toContain("2026-09-05");
  });

  it("rejects nonsense rather than silently producing an Invalid Date", () => {
    expect(() => parseScheduledAt("not a date")).toThrow("valid fitting date");
    expect(() => parseScheduledAt("")).toThrow("valid fitting date");
  });
});
