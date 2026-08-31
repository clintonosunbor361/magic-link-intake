import { describe, expect, it } from "vitest";
import { splitSearchTokens } from "@/lib/search";

describe("splitSearchTokens", () => {
  it("keeps separate name tokens so reversed name searches can match", () => {
    expect(splitSearchTokens("A Mr")).toEqual(["a", "mr"]);
  });

  it("removes SQL wildcard characters from user input", () => {
    expect(splitSearchTokens("  Mr_% A%  ")).toEqual(["mr", "a"]);
  });
});
