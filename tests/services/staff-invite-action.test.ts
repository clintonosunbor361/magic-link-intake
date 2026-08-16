import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inviteUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
  addInvitedStaffMember: vi.fn(),
  getRequestOrigin: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  requireSuperAdmin: vi.fn().mockResolvedValue({
    organizationId: "org-1",
    userId: "staff-1",
    role: "super_admin",
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail, deleteUser: mocks.deleteUser } },
  }),
}));
vi.mock("@/lib/team/repository", () => ({
  addInvitedStaffMember: mocks.addInvitedStaffMember,
  createStaffRepository: vi.fn(),
}));
vi.mock("@/lib/request-origin", () => ({ getRequestOrigin: mocks.getRequestOrigin }));

import { inviteStaffMemberAction } from "@/app/actions/team";

describe("inviteStaffMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestOrigin.mockResolvedValue("https://kuartz-crm.vercel.app");
    mocks.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "staff-2" } }, error: null });
    mocks.addInvitedStaffMember.mockResolvedValue(undefined);
  });

  it("sends invitees back to the host serving the invitation request", async () => {
    const formData = new FormData();
    formData.set("fullName", "Teni Adesina");
    formData.set("email", "teni@example.com");
    formData.set("role", "admin_assistant");

    await expect(inviteStaffMemberAction(formData)).rejects.toThrow("REDIRECT:/settings/team?invited=1");

    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith(
      "teni@example.com",
      expect.objectContaining({
        redirectTo: "https://kuartz-crm.vercel.app/auth/invite",
      }),
    );
  });
});
