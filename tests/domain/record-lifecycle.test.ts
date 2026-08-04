import { describe, expect, it } from "vitest";
import {
  getRecordLifecyclePolicy,
  mayPermanentlyDelete,
} from "@/lib/domain/record-lifecycle";

describe("Phase 1 record lifecycle", () => {
  it("keeps core operational and financial records recoverable indefinitely", () => {
    expect(getRecordLifecyclePolicy("client")).toEqual({
      archive: true,
      restore: true,
      permanentDelete: false,
      purgeAfterDays: null,
    });
    expect(getRecordLifecyclePolicy("payment").permanentDelete).toBe(false);
    expect(getRecordLifecyclePolicy("audit_entry").archive).toBe(false);
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
});
