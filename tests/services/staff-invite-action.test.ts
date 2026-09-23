import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateLink: vi.fn(),
  deleteUser: vi.fn(),
  addInvitedStaffMember: vi.fn(),
  sendStaffInviteEmail: vi.fn(),
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
    auth: { admin: { generateLink: mocks.generateLink, deleteUser: mocks.deleteUser } },
  }),
}));
vi.mock("@/lib/email/resend", () => ({ sendStaffInviteEmail: mocks.sendStaffInviteEmail }));
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
    mocks.generateLink.mockResolvedValue({
      data: { user: { id: "staff-2" }, properties: { hashed_token: "invite-token-hash" } },
      error: null,
    });
    mocks.addInvitedStaffMember.mockResolvedValue(undefined);
    mocks.sendStaffInviteEmail.mockResolvedValue(undefined);
  });

  it("sends a branded invite through the Vercel callback instead of Supabase's site URL", async () => {
    const formData = new FormData();
    formData.set("fullName", "Teni Adesina");
    formData.set("email", "teni@example.com");
    formData.set("role", "admin_assistant");

    await expect(inviteStaffMemberAction(formData)).rejects.toThrow("REDIRECT:/settings/team?invited=1");

    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "invite",
      email: "teni@example.com",
      options: { data: { full_name: "Teni Adesina" } },
    });
    expect(mocks.sendStaffInviteEmail).toHaveBeenCalledWith({
      to: "teni@example.com",
      staffName: "Teni Adesina",
      inviteUrl:
        "https://kuartz-crm.vercel.app/auth/callback?token_hash=invite-token-hash&type=invite&next=%2Fauth%2Fupdate-password%3Fcontext%3Dinvite",
      idempotencyKey: "auth/invite/staff-2",
    });
  });
});
