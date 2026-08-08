import { describe, expect, it, vi } from "vitest";
import { createOrderInvoice, markInvoiceSent, updateDraftInvoice, voidInvoice } from "@/lib/finance/invoice-service";

const superAdmin = { role: "super_admin" as const, staffId: "staff-1" };
const assistant = { role: "admin_assistant" as const, staffId: "staff-2" };
const lines = [{ description: "Three-piece suit", quantity: 1, unitPriceMinor: 450_000_00 }];

function repository(overrides: Record<string, unknown> = {}) {
  return {
    orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
    getInvoiceByOrder: vi.fn().mockResolvedValue(null),
    getInvoice: vi.fn().mockResolvedValue({ id: "inv-1", orderId: "order-1", status: "draft", version: 1 }),
    countLineItems: vi.fn().mockResolvedValue(1),
    createInvoice: vi.fn().mockResolvedValue({ id: "inv-1", sequence: 1 }),
    replaceLineItems: vi.fn().mockResolvedValue(undefined),
    markSent: vi.fn().mockResolvedValue(undefined),
    markVoid: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseInput = {
  organizationId: "org-1",
  orderId: "order-1",
  issueDate: "2026-08-09",
  dueDate: null,
  notes: "",
  paymentInstructions: "",
  lines,
};

describe("createOrderInvoice", () => {
  it("creates the Invoice for a Super Admin", async () => {
    const repo = repository();

    const result = await createOrderInvoice({ actor: superAdmin, ...baseInput }, repo);

    expect(result).toEqual({ id: "inv-1", sequence: 1 });
    expect(repo.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ actorStaffId: "staff-1" }));
  });

  it("refuses an Admin Assistant before touching the database", async () => {
    const repo = repository();

    await expect(createOrderInvoice({ actor: assistant, ...baseInput }, repo)).rejects.toThrow("Super Admin");
    expect(repo.orderBelongsToOrganization).not.toHaveBeenCalled();
  });

  it("rejects a second Invoice for the same Order", async () => {
    const repo = repository({
      getInvoiceByOrder: vi.fn().mockResolvedValue({ id: "inv-1", orderId: "order-1", status: "sent", version: 2 }),
    });

    await expect(createOrderInvoice({ actor: superAdmin, ...baseInput }, repo)).rejects.toThrow("one per Order");
    expect(repo.createInvoice).not.toHaveBeenCalled();
  });

  it("refuses an Invoice with no line items", async () => {
    const repo = repository();

    await expect(createOrderInvoice({ actor: superAdmin, ...baseInput, lines: [] }, repo)).rejects.toThrow(
      "at least one line item",
    );
  });

  it("trims descriptions before they reach the database", async () => {
    const repo = repository();

    await createOrderInvoice(
      { actor: superAdmin, ...baseInput, lines: [{ ...lines[0], description: "  Suit  " }] },
      repo,
    );

    expect(repo.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [expect.objectContaining({ description: "Suit" })] }),
    );
  });
});

describe("updateDraftInvoice", () => {
  const editInput = {
    organizationId: "org-1",
    invoiceId: "inv-1",
    expectedVersion: 1,
    issueDate: "2026-08-09",
    dueDate: null,
    notes: "",
    paymentInstructions: "",
    lines,
  };

  it("replaces the line items of a Draft", async () => {
    const repo = repository();

    await updateDraftInvoice({ actor: superAdmin, ...editInput }, repo);

    expect(repo.replaceLineItems).toHaveBeenCalledWith(expect.objectContaining({ nextVersion: 2 }));
  });

  it("refuses to edit a sent Invoice — the client is holding those figures", async () => {
    const repo = repository({
      getInvoice: vi.fn().mockResolvedValue({ id: "inv-1", orderId: "order-1", status: "sent", version: 1 }),
    });

    await expect(updateDraftInvoice({ actor: superAdmin, ...editInput }, repo)).rejects.toThrow("Void it to correct");
    expect(repo.replaceLineItems).not.toHaveBeenCalled();
  });

  it("rejects a stale version rather than overwriting a concurrent edit", async () => {
    const repo = repository({
      getInvoice: vi.fn().mockResolvedValue({ id: "inv-1", orderId: "order-1", status: "draft", version: 5 }),
    });

    await expect(updateDraftInvoice({ actor: superAdmin, ...editInput }, repo)).rejects.toThrow("Reload and try again");
  });
});

describe("markInvoiceSent", () => {
  const sendInput = { organizationId: "org-1", invoiceId: "inv-1", expectedVersion: 1 };

  it("moves a Draft with line items to Sent", async () => {
    const repo = repository();

    await markInvoiceSent({ actor: superAdmin, ...sendInput }, repo);

    expect(repo.markSent).toHaveBeenCalledWith(expect.objectContaining({ nextVersion: 2, actorStaffId: "staff-1" }));
  });

  it("refuses to send an Invoice with no line items", async () => {
    const repo = repository({ countLineItems: vi.fn().mockResolvedValue(0) });

    await expect(markInvoiceSent({ actor: superAdmin, ...sendInput }, repo)).rejects.toThrow("at least one line item");
    expect(repo.markSent).not.toHaveBeenCalled();
  });

  it("refuses an Admin Assistant", async () => {
    const repo = repository();

    await expect(markInvoiceSent({ actor: assistant, ...sendInput }, repo)).rejects.toThrow("Super Admin");
  });
});

describe("voidInvoice", () => {
  const voidInput = { organizationId: "org-1", invoiceId: "inv-1", expectedVersion: 1, reason: "Wrong client" };

  it("voids with a reason and records the actor", async () => {
    const repo = repository();

    await voidInvoice({ actor: superAdmin, ...voidInput }, repo);

    expect(repo.markVoid).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Wrong client", actorStaffId: "staff-1" }),
    );
  });

  it("requires a non-empty reason", async () => {
    const repo = repository();

    await expect(voidInvoice({ actor: superAdmin, ...voidInput, reason: "   " }, repo)).rejects.toThrow(
      "reason is required",
    );
    expect(repo.markVoid).not.toHaveBeenCalled();
  });

  it("refuses an Admin Assistant", async () => {
    const repo = repository();

    await expect(voidInvoice({ actor: assistant, ...voidInput }, repo)).rejects.toThrow("Super Admin");
  });
});
