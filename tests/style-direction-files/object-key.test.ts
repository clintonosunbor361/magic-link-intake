import { describe, expect, it } from "vitest";
import { buildStyleDirectionObjectKey } from "@/lib/style-direction-files/object-key";

describe("buildStyleDirectionObjectKey", () => {
  it("builds a key grouped by organization and order, with the revision number and extension", () => {
    const key = buildStyleDirectionObjectKey({
      organizationId: "org-1",
      orderId: "order-1",
      revisionNumber: 2,
      extension: "webp",
    });

    expect(key).toMatch(/^orgs\/org-1\/orders\/order-1\/style-direction\/2-[0-9a-f-]{36}\.webp$/);
  });

  it("produces a different key on every call", () => {
    const input = { organizationId: "org-1", orderId: "order-1", revisionNumber: 1, extension: "jpg" };
    expect(buildStyleDirectionObjectKey(input)).not.toBe(buildStyleDirectionObjectKey(input));
  });
});
