import { describe, expect, it, vi } from "vitest";
import {
  type DeadlineSource,
  dispatchNotifications,
  notificationKey,
  planNotifications,
  planNotificationsForSource,
  type PlannedNotification,
} from "@/lib/notifications/service";

const source: DeadlineSource = {
  sourceType: "vendor_assignment",
  sourceId: "asg-1",
  dueDate: "2026-09-10",
  subject: "Three-piece suit",
  context: "Tunde Tailors · Ade's wedding",
  href: "/production/asg-1",
  recipientStaffId: "staff-1",
};

describe("planNotificationsForSource", () => {
  it("plans nothing before the first trigger lands", () => {
    expect(planNotificationsForSource({ source, today: "2026-09-02" })).toEqual([]);
  });

  it("plans one notification per due trigger, carrying the source's recipient", () => {
    const planned = planNotificationsForSource({ source, today: "2026-09-07" });

    expect(planned.map((plan) => plan.trigger)).toEqual(["days_7", "days_3"]);
    expect(planned.every((plan) => plan.recipientStaffId === "staff-1")).toBe(true);
    expect(planned[0].href).toBe("/production/asg-1");
  });

  it("marks only the trigger landing today as email-eligible", () => {
    const planned = planNotificationsForSource({ source, today: "2026-09-07" });

    expect(planned.find((plan) => plan.trigger === "days_7")?.emailEligible).toBe(false);
    expect(planned.find((plan) => plan.trigger === "days_3")?.emailEligible).toBe(true);
  });

  it("plans a complete backlog after an outage, but with nothing email-eligible", () => {
    // The dashboard record must be complete; inboxes must not receive a month of history.
    const planned = planNotificationsForSource({ source, today: "2026-10-15" });

    expect(planned).toHaveLength(4);
    expect(planned.some((plan) => plan.emailEligible)).toBe(false);
  });

  it("names the source type and subject in the title", () => {
    const [first] = planNotificationsForSource({ source, today: "2026-09-03" });
    expect(first.title).toBe("Production deadline: Three-piece suit");
  });

  it("keeps a null recipient rather than inventing one", () => {
    const planned = planNotificationsForSource({
      source: { ...source, recipientStaffId: null },
      today: "2026-09-03",
    });
    expect(planned[0].recipientStaffId).toBeNull();
  });
});

describe("planNotifications", () => {
  it("expands every source independently", () => {
    const planned = planNotifications({
      sources: [source, { ...source, sourceId: "asg-2", dueDate: "2026-09-11" }],
      today: "2026-09-04",
    });

    expect(planned.filter((plan) => plan.sourceId === "asg-1")).toHaveLength(1);
    expect(planned.filter((plan) => plan.sourceId === "asg-2")).toHaveLength(1);
  });
});

function planFor(overrides: Partial<PlannedNotification> = {}): PlannedNotification {
  return {
    sourceType: "vendor_assignment",
    sourceId: "asg-1",
    trigger: "days_3",
    dueDate: "2026-09-10",
    recipientStaffId: "staff-1",
    title: "Production deadline: Three-piece suit",
    body: "due in 3 days",
    href: "/production/asg-1",
    emailEligible: true,
    ...overrides,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    insertMissing: vi.fn(async ({ planned }: { planned: readonly PlannedNotification[] }) =>
      planned.map((plan, index) => ({
        id: `note-${index}`,
        sourceType: plan.sourceType,
        sourceId: plan.sourceId,
        trigger: plan.trigger,
        dueDate: plan.dueDate,
        recipientStaffId: plan.recipientStaffId,
        title: plan.title,
        body: plan.body,
        href: plan.href,
      })),
    ),
    recordEmailOutcome: vi.fn().mockResolvedValue(undefined),
    getStaffEmail: vi.fn().mockResolvedValue({ email: "staff@kuartz.test", fullName: "Ada" }),
    ...overrides,
  };
}

const dispatchInput = { organizationId: "org-1", appOrigin: "https://app.kuartz.test" };

describe("dispatchNotifications", () => {
  it("emails the responsible person for an eligible new notification", async () => {
    const repo = repository();
    const email = { sendDeadlineEmail: vi.fn().mockResolvedValue(undefined) };

    const result = await dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email);

    expect(result).toMatchObject({ created: 1, emailed: 1, failed: 0 });
    expect(email.sendDeadlineEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "staff@kuartz.test", url: "https://app.kuartz.test/production/asg-1" }),
    );
    expect(repo.recordEmailOutcome).toHaveBeenCalledWith({
      notificationId: "note-0",
      outcome: { state: "sent" },
    });
  });

  it("keeps the dashboard notification when the email fails, recording the error", async () => {
    // This is the whole point of inserting before sending: a Resend outage must not cost the record.
    const repo = repository();
    const email = { sendDeadlineEmail: vi.fn().mockRejectedValue(new Error("Resend is down")) };

    const result = await dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email);

    expect(result).toMatchObject({ created: 1, emailed: 0, failed: 1 });
    expect(repo.recordEmailOutcome).toHaveBeenCalledWith({
      notificationId: "note-0",
      outcome: { state: "failed", error: "Resend is down" },
    });
  });

  it("does not email a caught-up notification, but still creates it", async () => {
    const repo = repository();
    const email = { sendDeadlineEmail: vi.fn() };

    const result = await dispatchNotifications(
      { ...dispatchInput, planned: [planFor({ emailEligible: false })] },
      repo,
      email,
    );

    expect(result).toMatchObject({ created: 1, emailed: 0, skipped: 1 });
    expect(email.sendDeadlineEmail).not.toHaveBeenCalled();
  });

  it("skips email when the source has no responsible person", async () => {
    const repo = repository();
    const email = { sendDeadlineEmail: vi.fn() };

    const result = await dispatchNotifications(
      { ...dispatchInput, planned: [planFor({ recipientStaffId: null })] },
      repo,
      email,
    );

    expect(result).toMatchObject({ created: 1, skipped: 1 });
    expect(email.sendDeadlineEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when the row already existed — idempotency comes from the insert", async () => {
    // insertMissing returns only genuinely new rows, so a second run has no email candidates.
    const repo = repository({ insertMissing: vi.fn().mockResolvedValue([]) });
    const email = { sendDeadlineEmail: vi.fn() };

    const result = await dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email);

    expect(result).toEqual({ created: 0, emailed: 0, failed: 0, skipped: 0 });
    expect(email.sendDeadlineEmail).not.toHaveBeenCalled();
  });

  it("one recipient's failure does not stop the others", async () => {
    const repo = repository();
    const email = {
      sendDeadlineEmail: vi
        .fn()
        .mockRejectedValueOnce(new Error("bounced"))
        .mockResolvedValueOnce(undefined),
    };

    const result = await dispatchNotifications(
      { ...dispatchInput, planned: [planFor(), planFor({ sourceId: "asg-2" })] },
      repo,
      email,
    );

    expect(result).toMatchObject({ created: 2, emailed: 1, failed: 1 });
  });

  it("does nothing at all when there is nothing planned", async () => {
    const repo = repository({ insertMissing: vi.fn().mockResolvedValue([]) });
    const email = { sendDeadlineEmail: vi.fn() };

    const result = await dispatchNotifications({ ...dispatchInput, planned: [] }, repo, email);

    expect(result).toEqual({ created: 0, emailed: 0, failed: 0, skipped: 0 });
  });
});

describe("notificationKey", () => {
  it("includes the due date, so a moved deadline is a different notification", () => {
    const base = { sourceType: "accessory_item" as const, sourceId: "acc-1", trigger: "days_7" as const };
    expect(notificationKey({ ...base, dueDate: "2026-09-10" })).not.toBe(
      notificationKey({ ...base, dueDate: "2026-10-20" }),
    );
  });
});
