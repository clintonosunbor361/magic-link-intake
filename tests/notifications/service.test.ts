import { describe, expect, it, vi } from "vitest";
import {
  type DeadlineSource,
  type EmailCandidate,
  type NotificationRepository,
  NotificationDeliveryError,
  canRetryEmail,
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

function repository(overrides: Partial<NotificationRepository> = {}) {
  const rows = new Map<string, EmailCandidate>();
  return {
    insertMissing: vi.fn(async ({ planned }: { planned: readonly PlannedNotification[] }) => {
      const created = [];
      for (const plan of planned) {
        const key = notificationKey(plan);
        if (rows.has(key)) continue;
        const row = { ...plan, id: `note-${rows.size}`, emailAttempts: 0, emailFirstAttemptAt: null,
          emailRetrySafe: true, emailPayload: null };
        rows.set(key, row);
        created.push(row);
      }
      return created;
    }),
    listEmailCandidates: vi.fn(async () => [...rows.values()].filter((row) => !(row as EmailCandidate & { done?: boolean }).done && (row as EmailCandidate & { emailEligible: boolean }).emailEligible && row.recipientStaffId !== null)),
    claimEmail: vi.fn(async (input: Parameters<NotificationRepository["claimEmail"]>[0]) => ({ claimId: "claim-1", payload: input.payload })),
    recordEmailOutcome: vi.fn(async (input: Parameters<NotificationRepository["recordEmailOutcome"]>[0]) => {
      const row = [...rows.values()].find((row) => row.id === input.notificationId);
      if (row) {
        row.emailAttempts += 1;
        row.emailFirstAttemptAt ??= new Date();
        row.emailRetrySafe = input.outcome.state === "failed" && input.outcome.retrySafe;
        if (input.outcome.state !== "failed") Object.assign(row, { done: true });
      }
    }),
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
      organizationId: "org-1", notificationId: "note-0", claimId: "claim-1",
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
      organizationId: "org-1", notificationId: "note-0", claimId: "claim-1",
      outcome: { state: "failed", error: "Resend is down", retrySafe: false },
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

  it("sends nothing when no pending or failed rows exist", async () => {
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


describe("durable delivery retries", () => {
  it("retries a failed email on an existing notification, then stops after success", async () => {
    const repo = repository();
    const email = { sendDeadlineEmail: vi.fn().mockRejectedValueOnce(new NotificationDeliveryError("Rate limited", true)).mockResolvedValue(undefined) };
    const input = { ...dispatchInput, planned: [planFor()] };
    expect(await dispatchNotifications(input, repo, email)).toMatchObject({ created: 1, failed: 1 });
    expect(await dispatchNotifications(input, repo, email)).toMatchObject({ created: 0, emailed: 1 });
    await dispatchNotifications(input, repo, email);
    expect(email.sendDeadlineEmail).toHaveBeenCalledTimes(2);
    expect(email.sendDeadlineEmail.mock.calls[0][0].idempotencyKey).toBe(email.sendDeadlineEmail.mock.calls[1][0].idempotencyKey);
  });
  it("does not send when another worker owns the claim", async () => {
    const repo = repository({ claimEmail: vi.fn().mockResolvedValue(null) });
    const email = { sendDeadlineEmail: vi.fn() };
    await dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email);
    expect(email.sendDeadlineEmail).not.toHaveBeenCalled();
  });
  it("skips a recipient whose active membership was removed", async () => {
    const repo = repository({ getStaffEmail: vi.fn().mockResolvedValue(null) });
    const email = { sendDeadlineEmail: vi.fn() };
    expect(await dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email)).toMatchObject({ skipped: 1 });
    expect(email.sendDeadlineEmail).not.toHaveBeenCalled();
  });
  it("does not retry failed reminders for completed or moved deadlines", async () => {
    const repo = repository();
    const email = { sendDeadlineEmail: vi.fn().mockRejectedValue(new Error("timeout")) };
    await dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email);
    expect(await dispatchNotifications({ ...dispatchInput, planned: [] }, repo, email)).toMatchObject({ skipped: 1 });
    expect(email.sendDeadlineEmail).toHaveBeenCalledTimes(1);
  });
  it("keeps an acknowledgement failure uncertain instead of recording it as a rejected send", async () => {
    const repo = repository({ recordEmailOutcome: vi.fn().mockRejectedValue(new Error("DB unavailable")) });
    const email = { sendDeadlineEmail: vi.fn().mockResolvedValue(undefined) };
    await expect(dispatchNotifications({ ...dispatchInput, planned: [planFor()] }, repo, email)).rejects.toThrow("DB unavailable");
    expect(repo.recordEmailOutcome).toHaveBeenCalledTimes(1);
  });
  it("limits ambiguous retries to the provider deduplication window", () => {
    const row = { emailAttempts: 1, emailRetrySafe: false, emailFirstAttemptAt: new Date("2026-09-08T06:00:00Z") };
    expect(canRetryEmail(row, new Date("2026-09-08T06:01:00Z"))).toBe(true);
    expect(canRetryEmail(row, new Date("2026-09-09T06:00:00Z"))).toBe(false);
    expect(canRetryEmail({ ...row, emailRetrySafe: true }, new Date("2026-09-09T06:00:00Z"))).toBe(true);
    expect(canRetryEmail({ ...row, emailAttempts: 5, emailRetrySafe: true }, new Date())).toBe(false);
  });
});
