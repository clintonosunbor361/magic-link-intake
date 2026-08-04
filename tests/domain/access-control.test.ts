import { describe, expect, it } from "vitest";
import {
  assertCanManageTeam,
  canManageTeam,
  canPerformOperationalWork,
  type StaffRole,
} from "@/lib/domain/access-control";

describe("staff access policy", () => {
  it.each<[StaffRole, boolean]>([
    ["super_admin", true],
    ["admin_assistant", false],
  ])("allows team management for %s: %s", (role, expected) => {
    expect(canManageTeam(role)).toBe(expected);
  });

  it.each<StaffRole>(["super_admin", "admin_assistant"])(
    "allows operational work for %s",
    (role) => {
      expect(canPerformOperationalWork(role)).toBe(true);
    },
  );

  it("rejects an Admin Assistant at the team-management service boundary", () => {
    expect(() => assertCanManageTeam("admin_assistant")).toThrowError(
      "Super Admin access is required.",
    );
  });
});
