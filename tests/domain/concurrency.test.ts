import { describe, expect, it } from "vitest";
import { resolveVersionedUpdate } from "@/lib/domain/concurrency";

describe("optimistic concurrency policy", () => {
  it("accepts an edit based on the current version", () => {
    expect(resolveVersionedUpdate({ expectedVersion: 4, currentVersion: 4 })).toEqual({
      ok: true,
      nextVersion: 5,
    });
  });

  it("returns a recoverable conflict without discarding submitted input", () => {
    expect(
      resolveVersionedUpdate({
        expectedVersion: 3,
        currentVersion: 4,
        submittedInput: { title: "Reception look" },
      }),
    ).toEqual({
      ok: false,
      conflict: "stale_version",
      currentVersion: 4,
      submittedInput: { title: "Reception look" },
    });
  });
});
