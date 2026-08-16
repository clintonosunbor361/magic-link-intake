import { describe, expect, it } from "vitest";
import { validateInvitePasswords } from "@/components/auth/invite-acceptance-form";

describe("invite password validation", () => {
  it("requires a password of at least ten characters", () => {
    expect(validateInvitePasswords("short", "short")).toBe("Use at least 10 characters.");
  });

  it("requires matching passwords", () => {
    expect(validateInvitePasswords("long-enough-password", "different-password")).toBe("The passwords do not match.");
  });

  it("accepts matching strong passwords", () => {
    expect(validateInvitePasswords("long-enough-password", "long-enough-password")).toBeNull();
  });
});
