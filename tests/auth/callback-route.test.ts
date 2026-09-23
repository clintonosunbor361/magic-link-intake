import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

import { GET } from "@/app/auth/callback/route";

describe("auth callback", () => {
  beforeEach(() => verifyOtp.mockReset().mockResolvedValue({ error: null }));

  it("verifies an invite token hash and redirects to account creation", async () => {
    const response = await GET(
      new Request(
        "https://kuartz-crm.vercel.app/auth/callback?token_hash=invite-hash&type=invite&next=%2Fauth%2Fupdate-password%3Fcontext%3Dinvite",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "invite-hash", type: "invite" });
    expect(response.headers.get("location")).toBe(
      "https://kuartz-crm.vercel.app/auth/update-password?context=invite",
    );
  });
});
