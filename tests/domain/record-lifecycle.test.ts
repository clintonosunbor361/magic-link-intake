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
    expect(LIFECYCLE_ENTITIES).toHaveLength(21);
    LIFECYCLE_ENTITIES.forEach((entity) => {
      expect(getRecordLifecyclePolicy(entity)).toEqual(
        expect.objectContaining({ archive: expect.any(Boolean), restore: expect.any(Boolean) }),
      );
    });
  });

  it("lets assistants archive client to-dos while reserving major archives for Super Admin", () => {
    expect(mayArchive("client_task", "admin_assistant")).toBe(true);
    expect(mayRestore("client_task", "admin_assistant")).toBe(true);
    expect(mayArchive("client", "admin_assistant")).toBe(false);
    expect(mayArchive("client", "super_admin")).toBe(true);
    expect(mayArchive("client_payment", "super_admin")).toBe(false);
  });

  it("hides dependents through the parent archive instead of rewriting child history", () => {
    expect(ARCHIVE_CASCADE.behavior).toBe("visibility_only");
  });

  it("purges private attachments only when explicitly eligible", () => {
    expect(
      mayPermanentlyDelete({
        entity: "private_file",
        role: "super_admin",
        archivedDays: 30,
        belongsToPurgeablePrivateFileOwner: true,
      }),
    ).toBe(true);
    expect(
      mayPermanentlyDelete({
        entity: "private_file",
        role: "super_admin",
        archivedDays: 30,
        belongsToPurgeablePrivateFileOwner: false,
      }),
    ).toBe(false);
  });
});
