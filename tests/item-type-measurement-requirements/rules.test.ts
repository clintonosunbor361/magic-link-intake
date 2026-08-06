import { describe, expect, it } from "vitest";
import { computeMissingFieldIds } from "@/lib/item-type-measurement-requirements/rules";

describe("computeMissingFieldIds", () => {
  it("returns nothing when there are no required fields", () => {
    expect(computeMissingFieldIds([], ["chest", "waist"])).toEqual([]);
  });

  it("returns nothing when every required field is present", () => {
    expect(computeMissingFieldIds(["chest", "waist"], ["chest", "waist", "hip"])).toEqual([]);
  });

  it("returns the required fields that are absent", () => {
    expect(computeMissingFieldIds(["chest", "waist", "hip"], ["chest"])).toEqual(["waist", "hip"]);
  });

  it("returns everything when nothing is present", () => {
    expect(computeMissingFieldIds(["chest", "waist"], [])).toEqual(["chest", "waist"]);
  });
});
