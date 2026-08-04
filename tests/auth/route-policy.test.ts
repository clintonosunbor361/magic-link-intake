import { describe, expect, it } from "vitest";
import { decideRouteAccess } from "@/lib/auth/route-policy";

describe("staff route policy", () => {
  it.each(["/auth/sign-in", "/setup", "/offline", "/i/token", "/intake/token", "/intake/success"])(
    "keeps %s public",
    (pathname) => {
      expect(decideRouteAccess({ pathname, configured: true, signedIn: false })).toBe("allow");
    },
  );

  it.each(["/", "/settings/team", "/api/intake-links"])(
    "requires a staff session for %s",
    (pathname) => {
      expect(decideRouteAccess({ pathname, configured: true, signedIn: false })).toBe("sign_in");
    },
  );

  it("fails closed to setup when production services are absent", () => {
    expect(decideRouteAccess({ pathname: "/", configured: false, signedIn: false })).toBe("setup");
  });
});
