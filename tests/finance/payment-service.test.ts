import { describe, expect, it, vi } from "vitest";
import {
  editClientPayment,
  recordClientPayment,
  recordVendorPayment,
  voidClientPayment,
  voidVendorPayment,
} from "@/lib/finance/payment-service";

const superAdmin = { role: "super_admin" as const, staffId: "staff-1" };
const assistant = { role: "admin_assistant" as const, staffId: "staff-2" };
const payment = { amountMinor: 250_000_00, paidOn: "2026-08-09", reference: "Transfer 8821" };

function clientRepository(overrides: Record<string, unknown> = {}) {
  return {
    getInvoiceForPayment: vi.fn().mockResolvedValue({ id: "inv-1", orderId: "order-1", status: "sent" }),
    createPayment: vi.fn().mockResolvedValue({ id: "pay-1" }),
    getPayment: vi.fn().mockResolvedValue({ id: "pay-1", version: 1, voidedAt: null }),
    updatePayment: vi.fn().mockResolvedValue(undefined),
    voidPayment: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("recordClientPayment", () => {
  it("records a payment for a Super Admin", async () => {
    const repo = clientRepository();

    const result = await recordClientPayment(
      { actor: superAdmin, organizationId: "org-1", invoiceId: "inv-1", payment },
      repo,
    );

    expect(result).toEqual({ id: "pay-1" });
    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 250_000_00, actorStaffId: "staff-1" }),
    );
  });

  it("refuses an Admin Assistant before any lookup", async () => {
    const repo = clientRepository();

    await expect(
      recordClientPayment({ actor: assistant, organizationId: "org-1", invoiceId: "inv-1", payment }, repo),
    ).rejects.toThrow("Super Admin");
    expect(repo.getInvoiceForPayment).not.toHaveBeenCalled();
  });

  it("rejects a zero or negative amount", async () => {
    const repo = clientRepository();

    for (const amountMinor of [0, -100]) {
      await expect(
        recordClientPayment(
          { actor: superAdmin, organizationId: "org-1", invoiceId: "inv-1", payment: { ...payment, amountMinor } },
          repo,
        ),
      ).rejects.toThrow("greater than zero");
    }
  });

  it("records a payment against a Draft Invoice rather than refusing it", async () => {
    // The money arrived; the mismatch is surfaced elsewhere rather than blocking the record.
    const repo = clientRepository({
      getInvoiceForPayment: vi.fn().mockResolvedValue({ id: "inv-1", orderId: "order-1", status: "draft" }),
    });

    await expect(
      recordClientPayment({ actor: superAdmin, organizationId: "org-1", invoiceId: "inv-1", payment }, repo),
    ).resolves.toEqual({ id: "pay-1" });
  });

  it("allows a payment that overshoots the invoiced total", async () => {
    const repo = clientRepository();

    await expect(
      recordClientPayment(
        {
          actor: superAdmin,
          organizationId: "org-1",
          invoiceId: "inv-1",
          payment: { ...payment, amountMinor: 999_999_00 },
        },
        repo,
      ),
    ).resolves.toEqual({ id: "pay-1" });
  });
});

describe("editClientPayment", () => {
  const editInput = { organizationId: "org-1", paymentId: "pay-1", expectedVersion: 1, payment };

  it("updates the amount and bumps the version", async () => {
    const repo = clientRepository();

    await editClientPayment({ actor: superAdmin, ...editInput }, repo);

    expect(repo.updatePayment).toHaveBeenCalledWith(expect.objectContaining({ nextVersion: 2 }));
  });

  it("refuses to edit a voided payment", async () => {
    const repo = clientRepository({
      getPayment: vi.fn().mockResolvedValue({ id: "pay-1", version: 1, voidedAt: new Date() }),
    });

    await expect(editClientPayment({ actor: superAdmin, ...editInput }, repo)).rejects.toThrow(
      "voided payment cannot be edited",
    );
  });

  it("refuses an Admin Assistant", async () => {
    const repo = clientRepository();

    await expect(editClientPayment({ actor: assistant, ...editInput }, repo)).rejects.toThrow("Super Admin");
  });
});

describe("voidClientPayment", () => {
  const voidInput = { organizationId: "org-1", paymentId: "pay-1", expectedVersion: 1, reason: "Entered twice" };

  it("voids rather than deleting, keeping the record and its reason", async () => {
    const repo = clientRepository();

    await voidClientPayment({ actor: superAdmin, ...voidInput }, repo);

    expect(repo.voidPayment).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Entered twice", actorStaffId: "staff-1" }),
    );
  });

  it("requires a reason", async () => {
    const repo = clientRepository();

    await expect(voidClientPayment({ actor: superAdmin, ...voidInput, reason: " " }, repo)).rejects.toThrow(
      "reason is required",
    );
  });

  it("refuses to void the same payment twice", async () => {
    const repo = clientRepository({
      getPayment: vi.fn().mockResolvedValue({ id: "pay-1", version: 1, voidedAt: new Date() }),
    });

    await expect(voidClientPayment({ actor: superAdmin, ...voidInput }, repo)).rejects.toThrow("already void");
  });

  it("refuses an Admin Assistant", async () => {
    const repo = clientRepository();

    await expect(voidClientPayment({ actor: assistant, ...voidInput }, repo)).rejects.toThrow("Super Admin");
  });
});

function vendorRepository(overrides: Record<string, unknown> = {}) {
  return {
    assignmentBelongsToOrganization: vi.fn().mockResolvedValue(true),
    createPayment: vi.fn().mockResolvedValue({ id: "vpay-1" }),
    getPayment: vi.fn().mockResolvedValue({ id: "vpay-1", version: 1, voidedAt: null }),
    voidPayment: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function vendorStorage(overrides: Record<string, unknown> = {}) {
  return {
    putObject: vi.fn().mockResolvedValue(undefined),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    buildObjectKey: vi.fn().mockReturnValue("orgs/org-1/vendor-assignments/asg-1/receipts/abc.pdf"),
    ...overrides,
  };
}

const vendorInput = { organizationId: "org-1", assignmentId: "asg-1", payment };

describe("recordVendorPayment", () => {
  it("records a payment with no receipt", async () => {
    const repo = vendorRepository();
    const storage = vendorStorage();

    await recordVendorPayment({ actor: superAdmin, ...vendorInput, receipt: null }, repo, storage);

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(repo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ receipt: null }));
  });

  it("uploads a receipt to private storage and stores its key", async () => {
    const repo = vendorRepository();
    const storage = vendorStorage();
    const receipt = { buffer: Buffer.from("%PDF-1.4"), declaredMimeType: "application/pdf" };

    await recordVendorPayment({ actor: superAdmin, ...vendorInput, receipt }, repo, storage);

    expect(storage.putObject).toHaveBeenCalledWith(
      "orgs/org-1/vendor-assignments/asg-1/receipts/abc.pdf",
      receipt.buffer,
      "application/pdf",
    );
    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        receipt: expect.objectContaining({ objectKey: "orgs/org-1/vendor-assignments/asg-1/receipts/abc.pdf" }),
      }),
    );
  });

  it("cleans up the uploaded object when the insert fails", async () => {
    const repo = vendorRepository({ createPayment: vi.fn().mockRejectedValue(new Error("database is down")) });
    const storage = vendorStorage();
    const receipt = { buffer: Buffer.from("%PDF-1.4"), declaredMimeType: "application/pdf" };

    await expect(
      recordVendorPayment({ actor: superAdmin, ...vendorInput, receipt }, repo, storage),
    ).rejects.toThrow("database is down");
    expect(storage.deleteObject).toHaveBeenCalledWith("orgs/org-1/vendor-assignments/asg-1/receipts/abc.pdf");
  });

  it("rejects an unsupported receipt type before uploading anything", async () => {
    const repo = vendorRepository();
    const storage = vendorStorage();

    await expect(
      recordVendorPayment(
        {
          actor: superAdmin,
          ...vendorInput,
          receipt: { buffer: Buffer.from("MZ"), declaredMimeType: "application/x-msdownload" },
        },
        repo,
        storage,
      ),
    ).rejects.toThrow("Unsupported receipt type");
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("refuses an Admin Assistant", async () => {
    const repo = vendorRepository();

    await expect(
      recordVendorPayment({ actor: assistant, ...vendorInput, receipt: null }, repo, vendorStorage()),
    ).rejects.toThrow("Super Admin");
    expect(repo.assignmentBelongsToOrganization).not.toHaveBeenCalled();
  });
});

describe("voidVendorPayment", () => {
  const voidInput = { organizationId: "org-1", paymentId: "vpay-1", expectedVersion: 1, reason: "Duplicate entry" };

  it("voids with a reason", async () => {
    const repo = vendorRepository();

    await voidVendorPayment({ actor: superAdmin, ...voidInput }, repo);

    expect(repo.voidPayment).toHaveBeenCalledWith(expect.objectContaining({ reason: "Duplicate entry" }));
  });

  it("refuses an Admin Assistant", async () => {
    const repo = vendorRepository();

    await expect(voidVendorPayment({ actor: assistant, ...voidInput }, repo)).rejects.toThrow("Super Admin");
  });
});
