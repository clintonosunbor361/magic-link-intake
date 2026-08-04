import { describe, expect, it, vi } from "vitest";
import { changeStaffRole } from "@/lib/team/service";

describe("changeStaffRole", () => {
  it("changes a role and records the actor-facing audit summary", async () => {
    const repository = {
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      getMember: vi.fn().mockResolvedValue({
        id: "member-2",
        fullName: "Teni Adesina",
        role: "admin_assistant" as const,
        version: 1,
      }),
      changeRoleWithAudit: vi.fn().mockResolvedValue(undefined),
    };

    const result = await changeStaffRole(
      {
        actor: {
          userId: "member-1",
          organizationId: "org-1",
          role: "super_admin",
        },
        memberId: "member-2",
        role: "super_admin",
        expectedVersion: 1,
      },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.changeRoleWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        memberId: "member-2",
        role: "super_admin",
        expectedVersion: 1,
        nextVersion: 2,
        actorId: "member-1",
        action: "staff.role_changed",
        summary: "Changed Teni Adesina from Admin Assistant to Super Admin.",
      }),
    );
  });

  it("rejects an Admin Assistant without touching the repository", async () => {
    const repository = {
      countActiveSuperAdmins: vi.fn(),
      getMember: vi.fn(),
      changeRoleWithAudit: vi.fn(),
    };

    await expect(
      changeStaffRole(
        {
          actor: {
            userId: "member-1",
            organizationId: "org-1",
            role: "admin_assistant",
          },
          memberId: "member-2",
          role: "super_admin",
          expectedVersion: 1,
        },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.getMember).not.toHaveBeenCalled();
  });

  it("preserves the final active Super Admin", async () => {
    const repository = {
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
      getMember: vi.fn().mockResolvedValue({
        id: "member-1",
        fullName: "Roti Akinola",
        role: "super_admin" as const,
        version: 3,
      }),
      changeRoleWithAudit: vi.fn(),
    };

    await expect(
      changeStaffRole(
        {
          actor: {
            userId: "member-1",
            organizationId: "org-1",
            role: "super_admin",
          },
          memberId: "member-1",
          role: "admin_assistant",
          expectedVersion: 3,
        },
        repository,
      ),
    ).rejects.toThrow("The organization must keep at least one Super Admin.");
  });
});
