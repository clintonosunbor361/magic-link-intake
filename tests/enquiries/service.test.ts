import { describe, expect, it, vi } from "vitest";
import { archiveEnquiry, createInternalEnquiry, restoreEnquiry, updateEnquiryDetails } from "@/lib/enquiries/service";

const baseEnquiry = {
  fullName: "Teni Adesina",
  primaryPhone: "08012345678",
  whatsappSameAsPrimary: true,
  whatsappPhone: "",
  email: "teni@example.com",
  preferredContactChannel: "WhatsApp",
  eventType: "Wedding",
  budgetRange: "Under 500k",
  brief: "Needs an agbada.",
  leadSource: "Instagram",
  ownerStaffId: "staff-1",
  internalNotes: "",
  acknowledgedDuplicates: false,
  linkedClientId: null,
};
const { acknowledgedDuplicates: _acknowledgedDuplicates, ...baseEditableEnquiry } = baseEnquiry;

describe("createInternalEnquiry", () => {
  it("creates the Enquiry when there are no duplicate matches", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([]),
      createInternalEnquiry: vi.fn().mockResolvedValue({ id: "enq-new" }),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createInternalEnquiry(
      { actor: { organizationId: "org-1", role: "admin_assistant" }, enquiry: baseEnquiry },
      repository,
    );

    expect(result).toEqual({ ok: true, enquiryId: "enq-new" });
    expect(repository.createInternalEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", fullName: "Teni Adesina" }),
    );
  });

  it("returns duplicate matches instead of creating when unacknowledged", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([
        {
          id: "enq-existing",
          kind: "enquiry" as const,
          fullName: "Teni Adesina",
          nameNormalized: "adesina teni",
          primaryPhone: "08012345678",
          primaryPhoneNormalized: "8012345678",
          email: "teni@example.com",
          emailNormalized: "teni@example.com",
        },
      ]),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createInternalEnquiry(
      { actor: { organizationId: "org-1", role: "admin_assistant" }, enquiry: baseEnquiry },
      repository,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("duplicates_not_acknowledged");
      expect(result.matches).toHaveLength(1);
    }
    expect(repository.createInternalEnquiry).not.toHaveBeenCalled();
  });

  it("creates the Enquiry despite duplicate matches once acknowledged", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([
        {
          id: "enq-existing",
          kind: "enquiry" as const,
          fullName: "Teni Adesina",
          nameNormalized: "adesina teni",
          primaryPhone: "08012345678",
          primaryPhoneNormalized: "8012345678",
          email: "teni@example.com",
          emailNormalized: "teni@example.com",
        },
      ]),
      createInternalEnquiry: vi.fn().mockResolvedValue({ id: "enq-new" }),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createInternalEnquiry(
      {
        actor: { organizationId: "org-1", role: "admin_assistant" },
        enquiry: { ...baseEnquiry, acknowledgedDuplicates: true },
      },
      repository,
    );

    expect(result).toEqual({ ok: true, enquiryId: "enq-new" });
    expect(repository.createInternalEnquiry).toHaveBeenCalled();
  });

  it("rejects a missing full name without touching the repository", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn(),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createInternalEnquiry(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, enquiry: { ...baseEnquiry, fullName: "  " } },
        repository,
      ),
    ).rejects.toThrow("Full name is required.");
    expect(repository.getDuplicateCandidates).not.toHaveBeenCalled();
  });
});

describe("updateEnquiryDetails", () => {
  it("updates an unconverted Enquiry", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([]),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn().mockResolvedValue({ id: "enq-1", version: 1, archivedAt: null, convertedAt: null }),
      updateEnquiryDetails: vi.fn().mockResolvedValue(undefined),
      setArchivedState: vi.fn(),
    };

    const result = await updateEnquiryDetails(
      {
        actor: { organizationId: "org-1", role: "admin_assistant" },
        enquiryId: "enq-1",
        expectedVersion: 1,
        fields: { ...baseEditableEnquiry, fullName: "Teni A." },
      },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.updateEnquiryDetails).toHaveBeenCalledWith(
      expect.objectContaining({ enquiryId: "enq-1", fullName: "Teni A.", nextVersion: 2 }),
    );
  });

  it("blocks editing a converted Enquiry", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([]),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn().mockResolvedValue({
        id: "enq-1",
        version: 1,
        archivedAt: null,
        convertedAt: new Date(),
      }),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateEnquiryDetails(
        {
          actor: { organizationId: "org-1", role: "admin_assistant" },
          enquiryId: "enq-1",
          expectedVersion: 1,
          fields: baseEditableEnquiry,
        },
        repository,
      ),
    ).rejects.toThrow("Converted Enquiries cannot be edited.");
    expect(repository.updateEnquiryDetails).not.toHaveBeenCalled();
  });

  it("rejects a stale edit", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([]),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn().mockResolvedValue({ id: "enq-1", version: 2, archivedAt: null, convertedAt: null }),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateEnquiryDetails(
        {
          actor: { organizationId: "org-1", role: "admin_assistant" },
          enquiryId: "enq-1",
          expectedVersion: 1,
          fields: baseEditableEnquiry,
        },
        repository,
      ),
    ).rejects.toThrow("This Enquiry changed. Reload and try again.");
  });

  it("blocks changing an Enquiry to a phone already used elsewhere", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn().mockResolvedValue([
        {
          id: "client-1",
          kind: "client" as const,
          fullName: "Tayo Ade",
          nameNormalized: "ade tayo",
          primaryPhone: "+234 704 567 1233",
          primaryPhoneNormalized: "2347045671233",
          email: "tayo@example.com",
          emailNormalized: "tayo@example.com",
        },
      ]),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn(),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateEnquiryDetails(
        {
          actor: { organizationId: "org-1", role: "admin_assistant" },
          enquiryId: "enq-1",
          expectedVersion: 1,
          fields: { ...baseEditableEnquiry, primaryPhone: "07045671233" },
        },
        repository,
      ),
    ).rejects.toThrow("already uses this phone number");
    expect(repository.getEditableEnquiry).not.toHaveBeenCalled();
  });
});

describe("archiveEnquiry", () => {
  it("allows an Admin Assistant to archive an Enquiry", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn(),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn().mockResolvedValue({ id: "enq-1", version: 1, archivedAt: null }),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveEnquiry(
      { actor: { organizationId: "org-1", role: "admin_assistant" }, enquiryId: "enq-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects a stale version", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn(),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn().mockResolvedValue({ id: "enq-1", version: 2, archivedAt: null }),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveEnquiry(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, enquiryId: "enq-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("This Enquiry changed. Reload and try again.");
    expect(repository.setArchivedState).not.toHaveBeenCalled();
  });
});

describe("restoreEnquiry", () => {
  it("allows either role to restore an Enquiry", async () => {
    const repository = {
      getDuplicateCandidates: vi.fn(),
      createInternalEnquiry: vi.fn(),
      getEnquiryLifecycle: vi.fn().mockResolvedValue({ id: "enq-1", version: 3, archivedAt: new Date() }),
      getEditableEnquiry: vi.fn(),
      updateEnquiryDetails: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreEnquiry(
      { actor: { organizationId: "org-1", role: "super_admin" }, enquiryId: "enq-1", expectedVersion: 3 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 4 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(
      expect.objectContaining({ archived: false }),
    );
  });
});
