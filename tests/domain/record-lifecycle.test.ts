import { describe, expect, it } from "vitest";
import {
  ARCHIVE_CASCADE,
  LIFECYCLE_ENTITIES,
  getRecordLifecyclePolicy,
  mayArchive,
  mayPermanentlyDelete,
  mayRestore,
} from "@/lib/domain/record-lifecycle";

describe("Phase 1 record lifecycle", () => {
  it("keeps core operational and financial records recoverable indefinitely", () => {
    expect(getRecordLifecyclePolicy("client")).toEqual({
      archive: true,
      restore: true,
      permanentDelete: false,
      purgeAfterDays: null,
    });
    expect(getRecordLifecyclePolicy("client_payment").permanentDelete).toBe(false);
    expect(getRecordLifecyclePolicy("audit_entry").archive).toBe(false);
  });

  it("defines a lifecycle for every Phase 1 record family", () => {
    expect(LIFECYCLE_ENTITIES).toHaveLength(22);
    LIFECYCLE_ENTITIES.forEach((entity) => {
      expect(getRecordLifecyclePolicy(entity)).toEqual(
        expect.objectContaining({ archive: expect.any(Boolean), restore: expect.any(Boolean) }),
      );
    });
  });

  it("lets assistants archive Enquiry work while reserving major archives for Super Admin", () => {
    expect(mayArchive("enquiry", "admin_assistant")).toBe(true);
    expect(mayRestore("enquiry", "admin_assistant")).toBe(true);
    expect(mayArchive("client", "admin_assistant")).toBe(false);
    expect(mayArchive("client", "super_admin")).toBe(true);
    expect(mayArchive("client_payment", "super_admin")).toBe(false);
  });

  it("hides dependents through the parent archive instead of rewriting child history", () => {
    expect(ARCHIVE_CASCADE.behavior).toBe("visibility_only");
  });

  it("allows only a Super Admin to permanently delete an unconverted Enquiry after 30 days", () => {
    expect(
      mayPermanentlyDelete({
        entity: "enquiry",
        role: "super_admin",
        archivedDays: 30,
        converted: false,
      }),
    ).toBe(true);

    expect(
      mayPermanentlyDelete({
        entity: "enquiry",
        role: "admin_assistant",
        archivedDays: 90,
        converted: false,
      }),
    ).toBe(false);

    expect(
      mayPermanentlyDelete({
        entity: "enquiry",
        role: "super_admin",
        archivedDays: 90,
        converted: true,
      }),
    ).toBe(false);
  });

  it("purges private attachments only with their eligible unconverted Enquiry", () => {
    expect(
      mayPermanentlyDelete({
        entity: "private_file",
        role: "super_admin",
        archivedDays: 30,
        belongsToPurgeableEnquiry: true,
      }),
    ).toBe(true);
    expect(
      mayPermanentlyDelete({
        entity: "private_file",
        role: "super_admin",
        archivedDays: 30,
        belongsToPurgeableEnquiry: false,
      }),
    ).toBe(false);
  });
});
