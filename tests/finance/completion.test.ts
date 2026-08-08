import { describe, expect, it, vi } from "vitest";
import { computeOrderBalance } from "@/lib/finance/balances";
import { completeOrder } from "@/lib/finance/completion-service";
import { decideOrderCompletion, describeCompletionForAudit } from "@/lib/finance/completion";

const superAdmin = { role: "super_admin" as const, staffId: "staff-1" };
const assistant = { role: "admin_assistant" as const, staffId: "staff-2" };

describe("decideOrderCompletion", () => {
  const settled = computeOrderBalance({ invoicedMinor: 100_000_00, paidMinor: 100_000_00 });
  const outstanding = computeOrderBalance({ invoicedMinor: 100_000_00, paidMinor: 60_000_00 });
  const uninvoiced = computeOrderBalance({ invoicedMinor: null, paidMinor: 0 });

  it("lets either role complete a settled Order with no override", () => {
    for (const role of ["super_admin", "admin_assistant"] as const) {
      expect(decideOrderCompletion({ balance: settled, role, overrideReason: null })).toEqual({
        blocked: false,
        overrideReason: null,
      });
    }
  });

  it("blocks an Admin Assistant when a balance is outstanding", () => {
    expect(() =>
      decideOrderCompletion({ balance: outstanding, role: assistant.role, overrideReason: "Client will pay later" }),
    ).toThrow("Super Admin must override");
  });

  it("requires a non-empty reason from a Super Admin overriding the gate", () => {
    expect(() =>
      decideOrderCompletion({ balance: outstanding, role: superAdmin.role, overrideReason: "   " }),
    ).toThrow("reason is required");
    expect(() => decideOrderCompletion({ balance: outstanding, role: superAdmin.role, overrideReason: null })).toThrow(
      "reason is required",
    );
  });

  it("accepts a Super Admin override and keeps the trimmed reason", () => {
    expect(
      decideOrderCompletion({ balance: outstanding, role: superAdmin.role, overrideReason: "  Paid in cash  " }),
    ).toEqual({ blocked: true, overrideReason: "Paid in cash" });
  });

  it("treats an uninvoiced Order as blocked — nothing billed cannot be settled", () => {
    expect(() =>
      decideOrderCompletion({ balance: uninvoiced, role: assistant.role, overrideReason: null }),
    ).toThrow("Super Admin must override");
  });

  it("names the override in the audit summary, and stays quiet when there was none", () => {
    expect(describeCompletionForAudit({ blocked: true, overrideReason: "Paid in cash" })).toContain("Paid in cash");
    expect(describeCompletionForAudit({ blocked: false, overrideReason: null })).toBe("Completed the Order.");
  });
});

function repository(overrides: Record<string, unknown> = {}) {
  return {
    getOrderForCompletion: vi.fn().mockResolvedValue({
      id: "order-1",
      version: 3,
      completedAt: null,
      archivedAt: null,
      invoicedMinor: 100_000_00,
      paidMinor: 100_000_00,
    }),
    completeOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const input = { organizationId: "org-1", orderId: "order-1", overrideReason: null };

describe("completeOrder", () => {
  it("completes a settled Order and records who did it", async () => {
    const repo = repository();

    const result = await completeOrder({ actor: assistant, ...input }, repo);

    expect(result).toEqual({ alreadyCompleted: false, decision: { blocked: false, overrideReason: null } });
    expect(repo.completeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        actorStaffId: "staff-2",
        overrideReason: null,
        expectedVersion: 3,
        nextVersion: 4,
        auditSummary: "Completed the Order.",
      }),
    );
  });

  it("is idempotent: completing an already-completed Order writes nothing", async () => {
    const repo = repository({
      getOrderForCompletion: vi.fn().mockResolvedValue({
        id: "order-1",
        version: 4,
        completedAt: new Date("2026-08-01"),
        archivedAt: null,
        invoicedMinor: 100_000_00,
        paidMinor: 100_000_00,
      }),
    });

    const result = await completeOrder({ actor: superAdmin, ...input }, repo);

    expect(result).toEqual({ alreadyCompleted: true, decision: null });
    expect(repo.completeOrder).not.toHaveBeenCalled();
  });

  it("re-reads the balance server-side, so a stale page cannot bypass the gate", async () => {
    // The page may have shown a settled balance; the database says otherwise and the gate holds.
    const repo = repository({
      getOrderForCompletion: vi.fn().mockResolvedValue({
        id: "order-1",
        version: 3,
        completedAt: null,
        archivedAt: null,
        invoicedMinor: 100_000_00,
        paidMinor: 10_000_00,
      }),
    });

    await expect(completeOrder({ actor: assistant, ...input }, repo)).rejects.toThrow("Super Admin must override");
    expect(repo.completeOrder).not.toHaveBeenCalled();
  });

  it("records the override reason on the Order and in the audit summary", async () => {
    const repo = repository({
      getOrderForCompletion: vi.fn().mockResolvedValue({
        id: "order-1",
        version: 3,
        completedAt: null,
        archivedAt: null,
        invoicedMinor: 100_000_00,
        paidMinor: 10_000_00,
      }),
    });

    await completeOrder({ actor: superAdmin, ...input, overrideReason: "Balance waived" }, repo);

    expect(repo.completeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideReason: "Balance waived",
        auditSummary: expect.stringContaining("Balance waived"),
      }),
    );
  });

  it("refuses to complete an archived Order", async () => {
    const repo = repository({
      getOrderForCompletion: vi.fn().mockResolvedValue({
        id: "order-1",
        version: 3,
        completedAt: null,
        archivedAt: new Date(),
        invoicedMinor: 100_000_00,
        paidMinor: 100_000_00,
      }),
    });

    await expect(completeOrder({ actor: superAdmin, ...input }, repo)).rejects.toThrow("archived Order");
  });

  it("reports a missing Order rather than completing nothing", async () => {
    const repo = repository({ getOrderForCompletion: vi.fn().mockResolvedValue(null) });

    await expect(completeOrder({ actor: superAdmin, ...input }, repo)).rejects.toThrow("Order was not found");
  });
});
