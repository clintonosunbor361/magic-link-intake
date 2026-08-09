import { describe, expect, it } from "vitest";
import { resolveAccessoryDeliveryDate } from "@/lib/accessories/delivery-date";

const live = (id: string, lookDate: string | null) => ({ id, lookDate, archivedAt: null });
const archived = (id: string, lookDate: string | null) => ({ id, lookDate, archivedAt: new Date() });

describe("resolveAccessoryDeliveryDate — whole-Order accessories", () => {
  it("inherits the earliest dated live Look", () => {
    const result = resolveAccessoryDeliveryDate({
      lookId: null,
      looks: [live("look-2", "2026-09-20"), live("look-1", "2026-09-05"), live("look-3", "2026-10-01")],
    });

    expect(result).toEqual({ state: "inherited", date: "2026-09-05", sourceLookId: "look-1" });
  });

  it("ignores archived Looks when picking the earliest", () => {
    // An archived Look's event is not happening, so an accessory must not be pulled early for it.
    const result = resolveAccessoryDeliveryDate({
      lookId: null,
      looks: [archived("look-1", "2026-01-01"), live("look-2", "2026-09-20")],
    });

    expect(result).toEqual({ state: "inherited", date: "2026-09-20", sourceLookId: "look-2" });
  });

  it("ignores Looks with no date", () => {
    const result = resolveAccessoryDeliveryDate({
      lookId: null,
      looks: [live("look-1", null), live("look-2", "2026-09-20")],
    });

    expect(result).toMatchObject({ date: "2026-09-20" });
  });

  it("has no date when no live Look carries one", () => {
    expect(
      resolveAccessoryDeliveryDate({ lookId: null, looks: [live("look-1", null), archived("look-2", "2026-01-01")] }),
    ).toEqual({ state: "none" });
    expect(resolveAccessoryDeliveryDate({ lookId: null, looks: [] })).toEqual({ state: "none" });
  });
});

describe("resolveAccessoryDeliveryDate — Look-scoped accessories", () => {
  it("takes its own Look's date, even when another Look is earlier", () => {
    const result = resolveAccessoryDeliveryDate({
      lookId: "look-2",
      looks: [live("look-1", "2026-09-05"), live("look-2", "2026-09-20")],
    });

    expect(result).toEqual({ state: "inherited", date: "2026-09-20", sourceLookId: "look-2" });
  });

  it("has no date rather than falling back to another Look when its own Look has none", () => {
    // Falling back would attach the accessory to an event it is not for.
    const result = resolveAccessoryDeliveryDate({
      lookId: "look-2",
      looks: [live("look-1", "2026-09-05"), live("look-2", null)],
    });

    expect(result).toEqual({ state: "none" });
  });

  it("has no date when its Look has been archived", () => {
    const result = resolveAccessoryDeliveryDate({
      lookId: "look-2",
      looks: [live("look-1", "2026-09-05"), archived("look-2", "2026-09-20")],
    });

    expect(result).toEqual({ state: "none" });
  });

  it("follows the Look when its date moves, because nothing is stored", () => {
    const before = resolveAccessoryDeliveryDate({ lookId: "look-1", looks: [live("look-1", "2026-09-05")] });
    const after = resolveAccessoryDeliveryDate({ lookId: "look-1", looks: [live("look-1", "2026-11-30")] });

    expect(before).toMatchObject({ date: "2026-09-05" });
    expect(after).toMatchObject({ date: "2026-11-30" });
  });
});
