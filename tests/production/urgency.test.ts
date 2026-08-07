import { describe, expect, it } from "vitest";
import { computeUrgencyBand, describeUrgency } from "@/lib/production/urgency";

const today = "2026-08-07";

describe("computeUrgencyBand", () => {
  it("bands a deadline exactly as the spec describes", () => {
    const band = (deadline: string) => computeUrgencyBand({ deadline, today });

    expect(band("2026-08-06")).toBe("overdue");
    expect(band("2026-08-07")).toBe("urgent"); // due today
    expect(band("2026-08-08")).toBe("urgent"); // 1 day
    expect(band("2026-08-10")).toBe("urgent"); // 3 days — last urgent day
    expect(band("2026-08-11")).toBe("soon"); // 4 days — first amber day
    expect(band("2026-08-14")).toBe("soon"); // 7 days — last amber day
    expect(band("2026-08-15")).toBe("normal"); // 8 days
  });

  it("treats a long-overdue deadline as overdue rather than wrapping", () => {
    expect(computeUrgencyBand({ deadline: "2025-01-01", today })).toBe("overdue");
  });
});

describe("describeUrgency", () => {
  it("labels each band with words, so colour never carries the meaning alone", () => {
    expect(describeUrgency({ deadline: "2026-08-05", today })).toMatchObject({
      band: "overdue",
      daysRemaining: -2,
      label: "Overdue by 2 days",
    });
    expect(describeUrgency({ deadline: "2026-08-06", today }).label).toBe("Overdue by 1 day");
    expect(describeUrgency({ deadline: "2026-08-07", today }).label).toBe("Due today");
    expect(describeUrgency({ deadline: "2026-08-08", today }).label).toBe("Due tomorrow");
    expect(describeUrgency({ deadline: "2026-08-12", today }).label).toBe("Due in 5 days");
  });
});
