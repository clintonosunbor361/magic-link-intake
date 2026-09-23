import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateLink: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  getRequestOrigin: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/request-origin", () => ({ getRequestOrigin: mocks.getRequestOrigin }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { generateLink: mocks.generateLink } } }),
}));
vi.mock("@/lib/email/resend", () => ({ sendPasswordResetEmail: mocks.sendPasswordResetEmail }));

import { requestPasswordResetAction } from "@/app/actions/auth";

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestOrigin.mockResolvedValue("https://kuartz-crm.vercel.app");
    mocks.generateLink.mockResolvedValue({
      data: { user: { id: "staff-2" }, properties: { hashed_token: "recovery-token-hash" } },
      error: null,
    });
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it("emails a recovery link that enters through the Vercel callback", async () => {
    const formData = new FormData();
    formData.set("email", "teni@example.com");

    await expect(requestPasswordResetAction(formData)).rejects.toThrow(
      "REDIRECT:/auth/forgot-password?sent=1",
    );

    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "teni@example.com" });
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith({
      to: "teni@example.com",
      resetUrl:
        "https://kuartz-crm.vercel.app/auth/callback?token_hash=recovery-token-hash&type=recovery&next=%2Fauth%2Fupdate-password",
      idempotencyKey: "auth/recovery/staff-2/recovery-token-h",
    });
  });
});
