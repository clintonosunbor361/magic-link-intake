import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/notifications/route";
const mocks = vi.hoisted(() => ({ list: vi.fn(), sources: vi.fn(), dispatch: vi.fn(), candidates: vi.fn() }));
vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/repository", () => ({ listOrganizationsForCron: mocks.list, createNotificationRepository: () => ({ listEmailCandidates: mocks.candidates }), collectDeadlineSources: mocks.sources }));
vi.mock("@/lib/notifications/service", async (original) => ({ ...await original<typeof import("@/lib/notifications/service")>(), dispatchNotifications: mocks.dispatch }));
vi.mock("@/lib/email/resend", () => ({ sendDeadlineEmail: vi.fn() }));
const request = (query = "", secret = "local-test-secret") => new NextRequest(`http://localhost/api/cron/notifications${query}`, { headers: { authorization: `Bearer ${secret}` } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "local-test-secret");
  mocks.list.mockResolvedValue([]);
  mocks.sources.mockResolvedValue([]);
  mocks.candidates.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("Cron bearer boundary", () => {
  it("rejects missing and incorrect secrets before database access", async () => {
    expect((await GET(new NextRequest("http://localhost/api/cron/notifications"))).status).toBe(401);
    expect((await GET(request("", "wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("accepts an authorized scheduler with no staff cookie", async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.list).toHaveBeenCalled();
  });
  it("provides a read-only dry run without dispatching email", async () => {
    mocks.list.mockResolvedValue([{ id: "org", timezone: "Africa/Lagos" }]);
    const response = await GET(request("?dryRun=1"));
    expect((await response.json()).results[0]).toMatchObject({ dryRun: true, sources: 0, queued: 0 });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("drains a full successful batch and retries a failed delivery", async () => {
    mocks.list.mockResolvedValue([{ id: "org", timezone: "Africa/Lagos" }]);
    mocks.dispatch.mockResolvedValueOnce({ created: 26, emailed: 25, failed: 0, skipped: 0 })
      .mockResolvedValueOnce({ created: 0, emailed: 0, failed: 1, skipped: 0 })
      .mockResolvedValueOnce({ created: 0, emailed: 1, failed: 0, skipped: 0 });
    const response = await GET(request());
    expect((await response.json()).results[0]).toMatchObject({ created: 26, emailed: 26, failed: 0 });
    expect(mocks.dispatch).toHaveBeenCalledTimes(3);
  });
});
