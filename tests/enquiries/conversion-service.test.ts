import { describe, expect, it, vi } from "vitest";
import { convertEnquiryToClientAndOrder } from "@/lib/enquiries/conversion-service";

const validOrder = {
  title: "Tayo Wedding",
  eventType: "Wedding",
  finalAgreedPriceMinor: 50_000_00,
  primaryOwnerStaffId: "staff-1",
  ffDiscount: false,
  ffDiscountAmountMinor: null,
};

const validLook = {
  name: "Traditional Wedding",
  lookDate: null,
  notes: "",
};

describe("convertEnquiryToClientAndOrder", () => {
  it("converts an eligible Enquiry", async () => {
    const repository = {
      getEnquiryForConversion: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 1,
        convertedAt: null,
        archivedAt: null,
        fullName: "Teni Adesina",
      }),
      convertEnquiry: vi.fn().mockResolvedValue({ clientId: "client-1", orderId: "order-1", lookId: "look-1" }),
    };

    const result = await convertEnquiryToClientAndOrder(
      {
        organizationId: "org-1",
        enquiryId: "enq-1",
        expectedVersion: 1,
        actorId: "staff-1",
        existingClientId: null,
        order: validOrder,
        look: validLook,
      },
      repository,
    );

    expect(result).toEqual({ clientId: "client-1", orderId: "order-1", lookId: "look-1" });
    expect(repository.convertEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 1, nextVersion: 2, existingClientId: null }),
    );
  });

  it("rejects converting an already-converted Enquiry", async () => {
    const repository = {
      getEnquiryForConversion: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 2,
        convertedAt: new Date(),
        archivedAt: null,
        fullName: "Teni Adesina",
      }),
      convertEnquiry: vi.fn(),
    };

    await expect(
      convertEnquiryToClientAndOrder(
        {
          organizationId: "org-1",
          enquiryId: "enq-1",
          expectedVersion: 2,
          actorId: "staff-1",
          existingClientId: null,
          order: validOrder,
          look: validLook,
        },
        repository,
      ),
    ).rejects.toThrow("This Enquiry has already been converted.");
    expect(repository.convertEnquiry).not.toHaveBeenCalled();
  });

  it("rejects converting an archived Enquiry", async () => {
    const repository = {
      getEnquiryForConversion: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 1,
        convertedAt: null,
        archivedAt: new Date(),
        fullName: "Teni Adesina",
      }),
      convertEnquiry: vi.fn(),
    };

    await expect(
      convertEnquiryToClientAndOrder(
        {
          organizationId: "org-1",
          enquiryId: "enq-1",
          expectedVersion: 1,
          actorId: "staff-1",
          existingClientId: null,
          order: validOrder,
          look: validLook,
        },
        repository,
      ),
    ).rejects.toThrow("Restore this Enquiry before converting it.");
  });

  it("rejects a stale version before touching the repository transaction", async () => {
    const repository = {
      getEnquiryForConversion: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 5,
        convertedAt: null,
        archivedAt: null,
        fullName: "Teni Adesina",
      }),
      convertEnquiry: vi.fn(),
    };

    await expect(
      convertEnquiryToClientAndOrder(
        {
          organizationId: "org-1",
          enquiryId: "enq-1",
          expectedVersion: 1,
          actorId: "staff-1",
          existingClientId: null,
          order: validOrder,
          look: validLook,
        },
        repository,
      ),
    ).rejects.toThrow("This Enquiry changed. Reload and try again.");
    expect(repository.convertEnquiry).not.toHaveBeenCalled();
  });

  it("requires a positive final agreed price", async () => {
    const repository = {
      getEnquiryForConversion: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 1,
        convertedAt: null,
        archivedAt: null,
        fullName: "Teni Adesina",
      }),
      convertEnquiry: vi.fn(),
    };

    await expect(
      convertEnquiryToClientAndOrder(
        {
          organizationId: "org-1",
          enquiryId: "enq-1",
          expectedVersion: 1,
          actorId: "staff-1",
          existingClientId: null,
          order: { ...validOrder, finalAgreedPriceMinor: 0 },
          look: validLook,
        },
        repository,
      ),
    ).rejects.toThrow("Final agreed price must be greater than zero.");
  });

  it("reuses an existing Client when provided", async () => {
    const repository = {
      getEnquiryForConversion: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 1,
        convertedAt: null,
        archivedAt: null,
        fullName: "Teni Adesina",
      }),
      convertEnquiry: vi.fn().mockResolvedValue({ clientId: "client-existing", orderId: "order-1", lookId: "look-1" }),
    };

    await convertEnquiryToClientAndOrder(
      {
        organizationId: "org-1",
        enquiryId: "enq-1",
        expectedVersion: 1,
        actorId: "staff-1",
        existingClientId: "client-existing",
        order: validOrder,
        look: validLook,
      },
      repository,
    );

    expect(repository.convertEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({ existingClientId: "client-existing" }),
    );
  });
});
