import { describe, expect, it, vi } from "vitest";
import { renderThenRecordExport } from "@/lib/pdf/ephemeral-export";

describe("renderThenRecordExport", () => {
  it("does not record sent/export metadata when rendering fails", async () => {
    const record = vi.fn();
    await expect(
      renderThenRecordExport(async () => { throw new Error("reference unavailable"); }, record),
    ).rejects.toThrow("reference unavailable");
    expect(record).not.toHaveBeenCalled();
  });

  it("returns bytes only after metadata is recorded", async () => {
    const events: string[] = [];
    const bytes = await renderThenRecordExport(
      async () => { events.push("render"); return Buffer.from("%PDF"); },
      async () => { events.push("record"); },
    );
    expect(events).toEqual(["render", "record"]);
    expect(bytes.toString()).toBe("%PDF");
  });
});
